<?php

namespace App\Console\Commands;

use App\Models\SyncNodeState;
use App\Services\Sync\RemoteSyncClient;
use App\Services\Sync\SyncChangeDetector;
use App\Services\Sync\SyncIntegrityService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class RebaselineLocalSync extends Command
{
    protected $signature = 'sync:rebaseline-local {--force : Rebuild local sync metadata without confirmation}';

    protected $description = 'Provision an exact cloud database copy as a local sync node without replaying baseline records';

    public function handle(
        RemoteSyncClient $remote,
        SyncChangeDetector $detector,
        SyncIntegrityService $integrity,
    ): int {
        if (! config('sync.enabled') || config('sync.mode') !== 'local') {
            $this->error('Run this command only on the local installation with SYNC_ENABLED=true and SYNC_MODE=local.');

            return self::FAILURE;
        }

        $deviceUuid = (string) config('sync.device_uuid');
        if (! Str::isUuid($deviceUuid) || ! $remote->configured()) {
            $this->error('Local sync device credentials are not configured.');

            return self::FAILURE;
        }

        $currentState = SyncNodeState::query()->first();
        if ($currentState?->mode === 'local'
            && $currentState->initialized_at
            && DB::table('sync_entities')->exists()) {
            $this->error(
                'This computer is already provisioned for local synchronization. '
                .'Use Sync Now to download or upload changes. Rebaseline is only for a newly imported, exact cloud database copy.'
            );

            return self::FAILURE;
        }

        if (! $this->option('force') && ! $this->confirm('Rebuild local sync metadata after importing an exact cloud database copy?')) {
            return self::FAILURE;
        }

        try {
            $handshake = $remote->handshake();
            $remoteManifest = $remote->manifest();
            $cloudNodeUuid = (string) ($handshake['node_uuid'] ?? '');
            $installationUuid = (string) ($handshake['installation_uuid'] ?? '');
            $latestCursor = (int) ($handshake['latest_cursor'] ?? 0);

            if (! Str::isUuid($cloudNodeUuid) || ! Str::isUuid($installationUuid)) {
                throw new RuntimeException('The cloud server did not return valid synchronization identifiers.');
            }

            $mapped = DB::transaction(function () use (
                $cloudNodeUuid,
                $installationUuid,
                $deviceUuid,
                $latestCursor,
                $handshake,
                $remoteManifest,
                $detector,
                $integrity,
            ): int {
                DB::table('sync_deferred_relations')->delete();
                DB::table('sync_conflicts')->delete();
                DB::table('sync_runs')->delete();
                DB::table('sync_changes')->delete();
                DB::table('sync_entities')->delete();
                DB::table('sync_node_states')->delete();

                SyncNodeState::query()->create([
                    'node_uuid' => $cloudNodeUuid,
                    'installation_uuid' => $installationUuid,
                    'mode' => 'cloud',
                    'writer_mode' => 'cloud',
                ]);

                config(['sync.mode' => 'cloud']);
                $baseline = $detector->detect();
                $comparison = $integrity->compare($remoteManifest);
                if (! $comparison['consistent']) {
                    $differentTables = implode(', ', array_keys($comparison['differences']));
                    throw new RuntimeException(
                        'Local business data does not exactly match the cloud database. Import a fresh cloud backup before provisioning this computer.'
                        .($differentTables !== '' ? " Different tables: {$differentTables}." : '')
                    );
                }

                DB::table('sync_changes')->delete();
                $now = now();
                SyncNodeState::query()->firstOrFail()->forceFill([
                    'node_uuid' => $deviceUuid,
                    'mode' => 'local',
                    'writer_mode' => $handshake['writer_mode'] ?? 'cloud',
                    'writer_device_uuid' => null,
                    'lease_expires_at' => null,
                    'remote_cursor' => $latestCursor,
                    'last_sync_at' => $now,
                    'last_verified_at' => $now,
                    'last_error' => null,
                ])->save();

                return $baseline['created'] + $baseline['updated'] + $baseline['deleted'];
            });

            $this->info('Local synchronization baseline is ready.');
            $this->line("Mapped local business records: {$mapped}");
            $this->line("Cloud cursor: {$latestCursor}");
            $this->line('The local and cloud databases match with zero generated conflicts.');

            return self::SUCCESS;
        } catch (Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        } finally {
            config(['sync.mode' => 'local']);
        }
    }
}
