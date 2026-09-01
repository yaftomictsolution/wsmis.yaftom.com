<?php

namespace App\Services\Sync;

use App\Models\SyncNodeState;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;

class FreshLocalProvisioner
{
    public function __construct(
        private readonly RemoteSyncClient $remote,
        private readonly SyncCatalog $catalog,
        private readonly SyncApplyService $applier,
        private readonly SyncFileService $files,
        private readonly SyncIntegrityService $integrity,
    ) {}

    /**
     * @param  callable(int, string): void|null  $progress
     * @return array{pulled: int, downloaded_files: int, remote_cursor: int, root_hash: string}
     */
    public function provision(?callable $progress = null): array
    {
        $this->assertReady();
        $notify = static function (int $percentage, string $message) use ($progress): void {
            if ($progress) {
                $progress($percentage, $message);
            }
        };

        $notify(2, 'Checking the secure cloud connection');
        $handshake = $this->remote->handshake();
        $cloudNodeUuid = (string) ($handshake['node_uuid'] ?? '');
        $installationUuid = (string) ($handshake['installation_uuid'] ?? '');
        if (! Str::isUuid($cloudNodeUuid) || ! Str::isUuid($installationUuid)) {
            throw new RuntimeException('The cloud server did not return valid synchronization identifiers.');
        }
        if ((int) ($handshake['protocol_version'] ?? 0) !== (int) config('sync.protocol_version')) {
            throw new RuntimeException('The local and cloud synchronization protocol versions do not match.');
        }

        $notify(8, 'Preparing the empty local database');
        $this->purgeLocalData();
        $deviceUuid = (string) config('sync.device_uuid');
        $state = SyncNodeState::query()->create([
            'node_uuid' => $deviceUuid,
            'installation_uuid' => $installationUuid,
            'mode' => 'local',
            'writer_mode' => $handshake['writer_mode'] ?? 'cloud',
            'writer_device_uuid' => $handshake['writer_device_uuid'] ?? null,
            'lease_expires_at' => $handshake['lease_expires_at'] ?? null,
            'remote_cursor' => 0,
        ]);

        $cursor = 0;
        $pulled = 0;
        $downloadedFiles = 0;
        $latestCursor = max(0, (int) ($handshake['latest_cursor'] ?? 0));
        $batchSize = max(10, (int) config('sync.batch_size', 100));

        $downloadAvailable = function (bool $showProgress = true) use (
            &$cursor,
            &$pulled,
            &$downloadedFiles,
            $batchSize,
            $latestCursor,
            $state,
            $notify,
        ): void {
            do {
                // A replacement installation may reuse a registered device. Its complete
                // history is required because the new local database starts empty.
                $batch = $this->remote->pull($cursor, $batchSize, true);
                $changes = $batch['changes'] ?? [];
                foreach ($changes as $change) {
                    foreach ($change['files'] ?? [] as $descriptor) {
                        if (! $this->files->hasExpectedFile($descriptor)) {
                            $this->remote->downloadFile($descriptor);
                            $downloadedFiles++;
                        }
                    }

                    $result = $this->applier->apply($change, false, false);
                    if (($result['status'] ?? null) !== 'accepted') {
                        throw new RuntimeException(
                            "Cloud baseline record {$change['table_name']} could not be installed: "
                            .($result['reason'] ?? 'unknown synchronization error')
                        );
                    }
                    $pulled++;
                }

                $nextCursor = (int) ($batch['next_cursor'] ?? $cursor);
                $hasMore = (bool) ($batch['has_more'] ?? false);
                if ($hasMore && $nextCursor <= $cursor) {
                    throw new RuntimeException('The cloud synchronization cursor did not advance.');
                }
                $cursor = $nextCursor;
                $state->forceFill(['remote_cursor' => $cursor])->save();
                $this->applier->resolveDeferredRelations();

                if ($showProgress) {
                    $denominator = max(1, $latestCursor);
                    $percentage = min(88, 10 + (int) floor(($cursor / $denominator) * 78));
                    $notify($percentage, "Downloading cloud records ({$pulled} installed)");
                }
            } while ($hasMore);
        };

        $downloadAvailable();
        $this->assertRelationshipsResolved();

        $comparison = null;
        for ($attempt = 1; $attempt <= 4; $attempt++) {
            $notify(92, $attempt === 1
                ? 'Verifying local data against the cloud'
                : 'Verifying cloud changes received during setup');
            $comparison = $this->integrity->compare($this->remote->manifest());
            if ($comparison['consistent']) {
                break;
            }

            if ($attempt < 4) {
                $notify(94, 'Downloading changes created while setup was running');
                $downloadAvailable(false);
                $this->assertRelationshipsResolved();
            }
        }

        if (! $comparison || ! $comparison['consistent']) {
            $differentTables = implode(', ', array_keys($comparison['differences'] ?? []));
            throw new RuntimeException(
                'The downloaded local database failed its cloud integrity check.'
                .($differentTables !== '' ? " Different tables: {$differentTables}." : '')
            );
        }

        $now = now();
        $state->forceFill([
            'initialized_at' => $now,
            'last_sync_at' => $now,
            'last_verified_at' => $now,
            'last_error' => null,
            'remote_cursor' => $cursor,
        ])->save();

        $notify(100, 'Local WSMIS data is ready');

        return [
            'pulled' => $pulled,
            'downloaded_files' => $downloadedFiles,
            'remote_cursor' => $cursor,
            'root_hash' => (string) $comparison['local_root_hash'],
        ];
    }

    private function assertReady(): void
    {
        if (! config('sync.enabled') || config('sync.mode') !== 'local') {
            throw new RuntimeException('Fresh provisioning requires SYNC_ENABLED=true and SYNC_MODE=local.');
        }
        if (! $this->remote->configured() || ! Str::isUuid((string) config('sync.device_uuid'))) {
            throw new RuntimeException('Valid local-computer pairing credentials are required.');
        }
    }

    private function assertRelationshipsResolved(): void
    {
        $unresolved = DB::table('sync_deferred_relations')->count();
        if ($unresolved > 0) {
            throw new RuntimeException("{$unresolved} required record relationships could not be restored.");
        }
    }

    private function purgeLocalData(): void
    {
        $runtimeTables = [
            'model_has_permissions',
            'model_has_roles',
            'role_has_permissions',
            'notifications',
            'personal_access_tokens',
            'password_reset_tokens',
            'sessions',
            'failed_jobs',
            'jobs',
            'job_batches',
            'cache',
            'cache_locks',
        ];
        $syncTables = [
            'sync_deferred_relations',
            'sync_conflicts',
            'sync_runs',
            'sync_changes',
            'sync_entities',
            'sync_node_states',
        ];

        Schema::disableForeignKeyConstraints();
        try {
            foreach ($syncTables as $table) {
                if (Schema::hasTable($table)) {
                    DB::table($table)->delete();
                }
            }
            foreach ($runtimeTables as $table) {
                if (Schema::hasTable($table)) {
                    DB::table($table)->delete();
                }
            }
            foreach (array_reverse($this->catalog->tables()) as $table) {
                if (Schema::hasTable($table)) {
                    DB::table($table)->delete();
                }
            }
        } finally {
            Schema::enableForeignKeyConstraints();
        }
    }
}
