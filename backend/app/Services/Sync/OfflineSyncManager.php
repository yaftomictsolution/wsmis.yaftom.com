<?php

namespace App\Services\Sync;

use App\Models\SyncChange;
use App\Models\SyncConflict;
use App\Models\SyncRun;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class OfflineSyncManager
{
    public function __construct(
        private readonly SyncNodeManager $nodes,
        private readonly SyncCatalog $catalog,
        private readonly SyncChangeDetector $detector,
        private readonly SyncApplyService $applier,
        private readonly SyncFileService $files,
        private readonly SyncIntegrityService $integrity,
        private readonly RemoteSyncClient $remote,
    ) {}

    public function status(): array
    {
        $state = $this->nodes->state();
        $latestRun = SyncRun::query()->latest('id')->first();

        return [
            'enabled' => (bool) config('sync.enabled'),
            'mode' => $state->mode,
            'configured' => $this->remote->configured(),
            'node_uuid' => $state->node_uuid,
            'installation_uuid' => $state->installation_uuid,
            'pending_changes' => SyncChange::query()
                ->where('source_node_uuid', $state->node_uuid)
                ->whereNull('pushed_at')
                ->count(),
            'open_conflicts' => SyncConflict::query()->where('status', 'open')->count(),
            'last_sync_at' => optional($state->last_sync_at)->toISOString(),
            'last_verified_at' => optional($state->last_verified_at)->toISOString(),
            'last_error' => $state->last_error,
            'writer_mode' => $state->writer_mode,
            'lease_expires_at' => optional($state->lease_expires_at)->toISOString(),
            'latest_run' => $latestRun?->payload(),
        ];
    }

    public function start(int $userId): SyncRun
    {
        if (! $this->remote->configured()) {
            throw new RuntimeException('Configure this installation as a local sync node before synchronizing.');
        }
        if (SyncRun::query()->where('status', 'running')->exists()) {
            throw new RuntimeException('Another synchronization is already running.');
        }

        $this->nodes->state()->forceFill(['last_error' => null])->save();

        return SyncRun::query()->create([
            'run_uuid' => (string) Str::uuid(),
            'user_id' => $userId,
            'status' => 'running',
            'stage' => 'prepare',
            'progress' => 2,
            'counts' => [
                'detected' => 0,
                'uploaded_files' => 0,
                'pushed' => 0,
                'pulled' => 0,
                'downloaded_files' => 0,
                'conflicts' => 0,
            ],
            'warnings' => [],
            'started_at' => now(),
        ]);
    }

    public function advance(SyncRun $run): SyncRun
    {
        if ($run->status !== 'running') {
            return $run;
        }

        try {
            match ($run->stage) {
                'prepare' => $this->prepare($run),
                'detect' => $this->detect($run),
                'push' => $this->push($run),
                'pull' => $this->pull($run),
                'verify' => $this->verify($run),
                default => throw new RuntimeException('Unknown synchronization stage.'),
            };
        } catch (Throwable $exception) {
            report($exception);
            $run->forceFill([
                'status' => 'failed',
                'error' => $exception->getMessage(),
                'completed_at' => now(),
            ])->save();
            $this->nodes->state()->forceFill(['last_error' => $exception->getMessage()])->save();
        }

        return $run->fresh();
    }

    public function acquireOfflineLease(bool $force = false): array
    {
        $state = $this->nodes->state();
        $pending = SyncChange::query()
            ->where('source_node_uuid', $state->node_uuid)
            ->whereNull('pushed_at')
            ->count();
        $conflicts = SyncConflict::query()->where('status', 'open')->count();
        if ($pending > 0 || $conflicts > 0 || ! $state->last_sync_at) {
            throw new RuntimeException('Complete a clean synchronization before starting offline work.');
        }

        $lease = $this->remote->acquireLease($force);
        $state->forceFill([
            'writer_mode' => 'local',
            'lease_expires_at' => $lease['lease_expires_at'] ?? null,
        ])->save();

        return $lease;
    }

    public function releaseOfflineLease(): array
    {
        $state = $this->nodes->state();
        if (SyncChange::query()->where('source_node_uuid', $state->node_uuid)->whereNull('pushed_at')->exists()
            || SyncConflict::query()->where('status', 'open')->exists()) {
            throw new RuntimeException('Synchronize all pending changes and resolve conflicts before returning control to the online website.');
        }

        $result = $this->remote->releaseLease();
        $state->forceFill(['writer_mode' => 'cloud', 'lease_expires_at' => null])->save();

        return $result;
    }

    private function prepare(SyncRun $run): void
    {
        $handshake = $this->remote->handshake();
        if ((int) ($handshake['protocol_version'] ?? 0) !== (int) config('sync.protocol_version')) {
            throw new RuntimeException('The local and cloud synchronization protocol versions do not match.');
        }

        $this->nodes->adoptInstallation($handshake['installation_uuid']);
        $run->forceFill(['stage' => 'detect', 'progress' => 10])->save();
    }

    private function detect(SyncRun $run): void
    {
        $result = $this->detector->detect();
        $counts = $run->counts ?? [];
        $counts['detected'] = $result['created'] + $result['updated'] + $result['deleted'];
        $counts['pending'] = $result['pending'];
        $run->forceFill(['stage' => 'push', 'progress' => 25, 'counts' => $counts])->save();
    }

    private function push(SyncRun $run): void
    {
        $state = $this->nodes->state();
        $changes = SyncChange::query()
            ->where('source_node_uuid', $state->node_uuid)
            ->whereNull('pushed_at')
            ->get()
            ->sortBy(function (SyncChange $change): int {
                $rank = $this->catalog->rank($change->table_name);

                return $change->operation === 'delete' ? 100000 - $rank : $rank;
            })
            ->take((int) config('sync.batch_size', 100))
            ->values();

        if ($changes->isEmpty()) {
            $run->forceFill(['stage' => 'pull', 'progress' => 55])->save();

            return;
        }

        $warnings = $run->warnings ?? [];
        $counts = $run->counts ?? [];
        foreach ($changes as $change) {
            foreach ($change->files ?? [] as $descriptor) {
                try {
                    if ($this->remote->uploadFile($descriptor)) {
                        $counts['uploaded_files'] = ($counts['uploaded_files'] ?? 0) + 1;
                    } else {
                        $warnings[] = "Missing local file: {$descriptor['path']}";
                    }
                } catch (Throwable $exception) {
                    $warnings[] = "File upload failed for {$descriptor['path']}: {$exception->getMessage()}";
                }
            }
        }

        $response = $this->remote->push($changes->map->toProtocolArray()->all());
        $results = collect($response['results'] ?? [])->keyBy('change_uuid');
        foreach ($changes as $change) {
            $result = $results->get($change->change_uuid);
            if (($result['status'] ?? null) === 'accepted') {
                $change->forceFill(['pushed_at' => now()])->save();
                $counts['pushed'] = ($counts['pushed'] ?? 0) + 1;
                continue;
            }

            if (($result['status'] ?? null) === 'conflict') {
                $this->quarantinePushConflict($change, $result);
                $change->forceFill(['pushed_at' => now()])->save();
                $counts['conflicts'] = ($counts['conflicts'] ?? 0) + 1;
            }
        }

        $remaining = SyncChange::query()
            ->where('source_node_uuid', $state->node_uuid)
            ->whereNull('pushed_at')
            ->count();
        $counts['pending'] = $remaining;
        $run->forceFill([
            'stage' => $remaining > 0 ? 'push' : 'pull',
            'progress' => $remaining > 0 ? 40 : 55,
            'counts' => $counts,
            'warnings' => array_values(array_unique($warnings)),
        ])->save();
    }

    private function pull(SyncRun $run): void
    {
        $state = $this->nodes->state();
        $response = $this->remote->pull((int) $state->remote_cursor, (int) config('sync.batch_size', 100));
        $changes = collect($response['changes'] ?? []);
        $counts = $run->counts ?? [];
        $warnings = $run->warnings ?? [];

        foreach ($changes as $change) {
            foreach ($change['files'] ?? [] as $descriptor) {
                try {
                    if (! $this->files->hasExpectedFile($descriptor) && $this->remote->downloadFile($descriptor)) {
                        $counts['downloaded_files'] = ($counts['downloaded_files'] ?? 0) + 1;
                    }
                } catch (Throwable $exception) {
                    throw new RuntimeException("File download failed for {$descriptor['path']}: {$exception->getMessage()}");
                }
            }

            $result = $this->applier->apply($change, false, true);
            if ($result['status'] === 'conflict') {
                $counts['conflicts'] = ($counts['conflicts'] ?? 0) + 1;
            } else {
                $counts['pulled'] = ($counts['pulled'] ?? 0) + 1;
            }
            $state->remote_cursor = max((int) $state->remote_cursor, (int) ($change['sequence'] ?? 0));
        }
        $state->remote_cursor = max((int) $state->remote_cursor, (int) ($response['next_cursor'] ?? 0));
        $state->save();

        $hasMore = (bool) ($response['has_more'] ?? false);
        $run->forceFill([
            'stage' => $hasMore ? 'pull' : 'verify',
            'progress' => $hasMore ? 70 : 88,
            'counts' => $counts,
            'warnings' => $warnings,
        ])->save();
    }

    private function verify(SyncRun $run): void
    {
        $comparison = $this->integrity->compare($this->remote->manifest());
        $state = $this->nodes->state();
        $conflicts = SyncConflict::query()->where('status', 'open')->count();
        $warnings = $run->warnings ?? [];
        if (! $comparison['consistent']) {
            $warnings[] = 'The local and cloud integrity manifests still differ. Run synchronization again or resolve listed conflicts.';
        }

        $state->forceFill([
            'last_sync_at' => now(),
            'last_verified_at' => now(),
            'last_error' => null,
        ])->save();
        $warnings = array_values(array_unique($warnings));
        $run->forceFill([
            'status' => $comparison['consistent'] && $conflicts === 0 && $warnings === [] ? 'completed' : 'completed_with_warnings',
            'stage' => 'complete',
            'progress' => 100,
            'warnings' => $warnings,
            'counts' => ($run->counts ?? []) + [
                'consistent' => $comparison['consistent'],
                'different_tables' => array_keys($comparison['differences']),
            ],
            'completed_at' => now(),
        ])->save();
    }

    private function quarantinePushConflict(SyncChange $change, array $result): void
    {
        SyncConflict::query()->updateOrCreate(
            ['entity_uuid' => $change->entity_uuid, 'status' => 'open'],
            [
                'conflict_uuid' => (string) Str::uuid(),
                'table_name' => $change->table_name,
                'local_change_uuid' => $change->change_uuid,
                'local_snapshot' => [
                    'payload' => $change->payload,
                    'relationships' => $change->relationships,
                    'files' => $change->files,
                ],
                'remote_snapshot' => $result['remote_snapshot'] ?? null,
                'local_version' => (int) $change->version,
                'remote_version' => (int) ($result['remote_version'] ?? 0),
                'reason' => $result['reason'] ?? 'The cloud rejected this local change because the record changed online.',
                'detected_at' => now(),
            ],
        );
    }
}
