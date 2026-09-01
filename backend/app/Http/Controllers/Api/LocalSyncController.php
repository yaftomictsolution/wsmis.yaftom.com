<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SyncConflict;
use App\Models\SyncRun;
use App\Services\Sync\OfflineSyncManager;
use App\Services\Sync\RemoteSyncClient;
use App\Services\Sync\SyncApplyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LocalSyncController extends Controller
{
    public function __construct(
        private readonly OfflineSyncManager $sync,
        private readonly SyncApplyService $applier,
        private readonly RemoteSyncClient $remote,
    ) {}

    public function status(Request $request): JsonResponse
    {
        $this->authorizeView($request);

        return response()->json(['data' => $this->sync->status()]);
    }

    public function start(Request $request): JsonResponse
    {
        $this->authorizeManage($request);

        return response()->json(['data' => $this->sync->start((int) $request->user()->id)->payload()], 201);
    }

    public function advance(Request $request, SyncRun $syncRun): JsonResponse
    {
        $this->authorizeManage($request);

        return response()->json(['data' => $this->sync->advance($syncRun)->payload()]);
    }

    public function conflicts(Request $request): JsonResponse
    {
        $this->authorizeView($request);

        return response()->json(['data' => SyncConflict::query()
            ->where('status', 'open')
            ->latest('detected_at')
            ->get()]);
    }

    public function repairCloudQueue(Request $request): JsonResponse
    {
        $this->authorizeManage($request);

        return response()->json(['data' => $this->sync->repairCloudQueue()]);
    }

    public function resolve(Request $request, SyncConflict $syncConflict): JsonResponse
    {
        $this->authorizeManage($request);
        $data = $request->validate(['resolution' => ['required', 'in:use_remote,keep_local']]);

        if ($data['resolution'] === 'use_remote') {
            foreach ($syncConflict->remote_snapshot['files'] ?? [] as $descriptor) {
                if (! $this->remote->downloadFile($descriptor)) {
                    abort(409, "Unable to download {$descriptor['path']} before resolving the conflict.");
                }
            }
        }

        return response()->json(['data' => $this->applier->resolveConflict(
            $syncConflict,
            $data['resolution'],
            (int) $request->user()->id,
        )]);
    }

    public function acquireLease(Request $request): JsonResponse
    {
        $this->authorizeManage($request);
        $data = $request->validate(['force' => ['sometimes', 'boolean']]);

        return response()->json(['data' => $this->sync->acquireOfflineLease((bool) ($data['force'] ?? false))]);
    }

    public function releaseLease(Request $request): JsonResponse
    {
        $this->authorizeManage($request);

        return response()->json(['data' => $this->sync->releaseOfflineLease()]);
    }

    private function authorizeView(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['Admin', 'Super Admin', 'Manager']), 403, 'You cannot view synchronization status.');
    }

    private function authorizeManage(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['Admin', 'Super Admin']), 403, 'Only administrators can manage synchronization.');
    }
}
