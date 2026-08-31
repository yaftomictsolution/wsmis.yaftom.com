<?php

namespace App\Console\Commands;

use App\Services\Sync\SyncChangeDetector;
use App\Services\Sync\SyncIntegrityService;
use App\Services\Sync\SyncNodeManager;
use Illuminate\Console\Command;

class InitializeSync extends Command
{
    protected $signature = 'sync:initialize';

    protected $description = 'Create the stable synchronization baseline for every existing WSMIS record';

    public function handle(
        SyncNodeManager $nodes,
        SyncChangeDetector $detector,
        SyncIntegrityService $integrity,
    ): int {
        if (! config('sync.enabled')) {
            $this->error('Set SYNC_ENABLED=true before initializing synchronization.');

            return self::FAILURE;
        }

        $state = $nodes->state();
        $result = $detector->detect();
        $manifest = $integrity->manifest();

        $this->info('Synchronization baseline is ready.');
        $this->line("Node: {$state->node_uuid}");
        $this->line("Installation: {$state->installation_uuid}");
        $this->line("Mapped changes: ".($result['created'] + $result['updated'] + $result['deleted']));
        $this->line("Integrity hash: {$manifest['root_hash']}");

        return self::SUCCESS;
    }
}
