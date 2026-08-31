<?php

namespace App\Console\Commands;

use App\Models\SyncNodeState;
use App\Services\Sync\SyncChangeDetector;
use App\Services\Sync\SyncIntegrityService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ResetCloudSyncBaseline extends Command
{
    protected $signature = 'sync:reset-cloud-baseline {--force : Reset cloud sync metadata without confirmation}';

    protected $description = 'Rebuild corrupted cloud synchronization metadata while preserving all business records and registered devices';

    public function handle(SyncChangeDetector $detector, SyncIntegrityService $integrity): int
    {
        if (! config('sync.enabled') || config('sync.mode') !== 'cloud') {
            $this->error('Run this command only on the cloud installation with SYNC_ENABLED=true and SYNC_MODE=cloud.');

            return self::FAILURE;
        }

        if (! $this->option('force') && ! $this->confirm('Reset only cloud synchronization metadata and create a new shared baseline?')) {
            return self::FAILURE;
        }

        $result = DB::transaction(function () use ($detector, $integrity): array {
            DB::table('sync_deferred_relations')->delete();
            DB::table('sync_conflicts')->delete();
            DB::table('sync_runs')->delete();
            DB::table('sync_changes')->delete();
            DB::table('sync_entities')->delete();
            DB::table('sync_node_states')->delete();

            $state = SyncNodeState::query()->create([
                'node_uuid' => (string) Str::uuid(),
                'installation_uuid' => (string) Str::uuid(),
                'mode' => 'cloud',
                'writer_mode' => 'cloud',
            ]);
            $baseline = $detector->detect();
            $manifest = $integrity->manifest();

            return compact('state', 'baseline', 'manifest');
        });

        $mapped = $result['baseline']['created'] + $result['baseline']['updated'] + $result['baseline']['deleted'];
        $this->info('Cloud synchronization baseline was rebuilt.');
        $this->line("Node: {$result['state']->node_uuid}");
        $this->line("Installation: {$result['state']->installation_uuid}");
        $this->line("Mapped business records: {$mapped}");
        $this->line("Integrity hash: {$result['manifest']['root_hash']}");
        $this->line('Registered sync devices were preserved.');

        return self::SUCCESS;
    }
}
