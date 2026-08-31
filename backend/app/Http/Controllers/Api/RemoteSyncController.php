<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SyncChange;
use App\Models\SyncDevice;
use App\Services\Sync\SyncApplyService;
use App\Services\Sync\SyncCatalog;
use App\Services\Sync\SyncChangeDetector;
use App\Services\Sync\SyncFileService;
use App\Services\Sync\SyncIntegrityService;
use App\Services\Sync\SyncNodeManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class RemoteSyncController extends Controller
{
    public function __construct(
        private readonly SyncNodeManager $nodes,
        private readonly SyncCatalog $catalog,
        private readonly SyncChangeDetector $detector,
        private readonly SyncApplyService $applier,
        private readonly SyncFileService $files,
        private readonly SyncIntegrityService $integrity,
    ) {}

    public function handshake(): JsonResponse
    {
        $this->detector->detect();
        $state = $this->nodes->state();

        return response()->json(['data' => [
            'protocol_version' => (int) config('sync.protocol_version'),
            'node_uuid' => $state->node_uuid,
            'installation_uuid' => $state->installation_uuid,
            'latest_cursor' => (int) (SyncChange::query()->max('id') ?? 0),
            'writer_mode' => $state->writer_mode,
            'lease_expires_at' => optional($state->lease_expires_at)->toISOString(),
            'server_time' => now()->toISOString(),
        ]]);
    }

    public function push(Request $request): JsonResponse
    {
        $data = $request->validate([
            'changes' => ['required', 'array', 'max:500'],
            'changes.*.change_uuid' => ['required', 'uuid'],
            'changes.*.entity_uuid' => ['required', 'uuid'],
            'changes.*.table_name' => ['required', 'string'],
            'changes.*.operation' => ['required', 'in:create,update,delete'],
            'changes.*.base_version' => ['required', 'integer', 'min:0'],
            'changes.*.version' => ['required', 'integer', 'min:1'],
            'changes.*.source_node_uuid' => ['required', 'uuid'],
            'changes.*.payload' => ['nullable', 'array'],
            'changes.*.relationships' => ['nullable', 'array'],
            'changes.*.files' => ['nullable', 'array'],
            'changes.*.checksum' => ['nullable', 'string', 'size:64'],
        ]);

        /** @var SyncDevice $device */
        $device = $request->attributes->get('sync_device');
        $changes = collect($data['changes'])
            ->each(fn (array $change) => abort_unless($change['source_node_uuid'] === $device->uuid, 422, 'Change source does not match the authenticated device.'))
            ->sortBy(function (array $change): int {
                $rank = $this->catalog->rank($change['table_name']);
                return $change['operation'] === 'delete' ? 100000 - $rank : $rank;
            });

        $results = $changes->map(function (array $change): array {
            $result = $this->applier->apply($change, true, true);

            return ['change_uuid' => $change['change_uuid']] + $result;
        })->values();

        return response()->json(['data' => ['results' => $results]]);
    }

    public function pull(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cursor' => ['nullable', 'integer', 'min:0'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);
        $this->detector->detect();

        /** @var SyncDevice $device */
        $device = $request->attributes->get('sync_device');
        $cursor = (int) ($data['cursor'] ?? 0);
        $limit = (int) ($data['limit'] ?? config('sync.batch_size', 100));
        $scanned = SyncChange::query()->where('id', '>', $cursor)->orderBy('id')->limit($limit)->get();
        $nextCursor = (int) ($scanned->max('id') ?? $cursor);
        $changes = $scanned
            ->reject(fn (SyncChange $change): bool => $change->source_node_uuid === $device->uuid)
            ->map->toProtocolArray()
            ->values();

        return response()->json(['data' => [
            'changes' => $changes,
            'next_cursor' => $nextCursor,
            'has_more' => SyncChange::query()->where('id', '>', $nextCursor)->exists(),
        ]]);
    }

    public function manifest(): JsonResponse
    {
        $this->detector->detect();

        return response()->json(['data' => $this->integrity->manifest()]);
    }

    public function uploadFile(Request $request): JsonResponse
    {
        $request->validate([
            'descriptor' => ['required', 'string'],
            'file' => ['required', 'file', 'max:51200'],
        ]);
        $descriptor = json_decode((string) $request->input('descriptor'), true, flags: JSON_THROW_ON_ERROR);
        $this->files->storeUploaded($descriptor, $request->file('file'));

        return response()->json(['data' => ['stored' => true]]);
    }

    public function downloadFile(Request $request)
    {
        $descriptor = $request->validate([
            'table_name' => ['required', 'string'],
            'column_name' => ['required', 'string'],
            'disk' => ['required', 'string'],
            'path' => ['required', 'string'],
            'sha256' => ['required', 'string', 'size:64'],
        ]);
        abort_unless($this->files->hasExpectedFile($descriptor), 404, 'Synchronized file not found or failed checksum validation.');

        return Storage::disk($descriptor['disk'])->response($descriptor['path']);
    }

    public function acquireLease(Request $request): JsonResponse
    {
        $data = $request->validate(['force' => ['sometimes', 'boolean']]);
        /** @var SyncDevice $device */
        $device = $request->attributes->get('sync_device');
        $state = $this->nodes->state();
        $activeOtherDevice = $state->writer_mode === 'local'
            && $state->writer_device_uuid !== $device->uuid
            && $state->lease_expires_at?->isFuture();
        abort_if($activeOtherDevice && ! ($data['force'] ?? false), 409, 'Another local device currently owns the offline editing lease.');

        $state->forceFill([
            'writer_mode' => 'local',
            'writer_device_uuid' => $device->uuid,
            'lease_expires_at' => now()->addHours((int) config('sync.lease_hours', 72)),
        ])->save();

        return response()->json(['data' => [
            'writer_mode' => 'local',
            'lease_expires_at' => $state->lease_expires_at->toISOString(),
        ]]);
    }

    public function releaseLease(Request $request): JsonResponse
    {
        /** @var SyncDevice $device */
        $device = $request->attributes->get('sync_device');
        $state = $this->nodes->state();
        abort_if($state->writer_device_uuid && $state->writer_device_uuid !== $device->uuid, 409, 'This device does not own the offline editing lease.');

        $state->forceFill([
            'writer_mode' => 'cloud',
            'writer_device_uuid' => null,
            'lease_expires_at' => null,
        ])->save();

        return response()->json(['data' => ['writer_mode' => 'cloud']]);
    }
}
