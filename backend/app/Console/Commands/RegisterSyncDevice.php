<?php

namespace App\Console\Commands;

use App\Models\SyncDevice;
use App\Services\Sync\SyncNodeManager;
use App\Services\Sync\SyncChangeDetector;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class RegisterSyncDevice extends Command
{
    protected $signature = 'sync:register-device {name : A recognizable office computer name} {--uuid= : Reuse a local node UUID}';

    protected $description = 'Register a trusted office computer and print its one-time sync credentials';

    public function handle(SyncNodeManager $nodes, SyncChangeDetector $detector): int
    {
        if (config('sync.mode') !== 'cloud') {
            $this->error('Run this command on the cloud installation with SYNC_MODE=cloud.');

            return self::FAILURE;
        }

        $uuid = (string) ($this->option('uuid') ?: Str::uuid());
        if (! Str::isUuid($uuid)) {
            $this->error('The supplied UUID is invalid.');

            return self::FAILURE;
        }

        $secret = Str::random(64);
        SyncDevice::query()->updateOrCreate(
            ['uuid' => $uuid],
            [
                'name' => (string) $this->argument('name'),
                'token_hash' => Hash::make($secret),
                'status' => 'active',
            ],
        );

        $state = $nodes->state();
        $baseline = $detector->detect();
        $this->info('Device registered. Store this secret now; it is not shown again.');
        $this->info("Cloud baseline initialized: {$baseline['created']} records mapped.");
        $this->newLine();
        $this->line("SYNC_ENABLED=true");
        $this->line("SYNC_MODE=local");
        $this->line('SYNC_REMOTE_URL=https://wsmis-api.yaftom.com/api');
        $this->line("SYNC_DEVICE_UUID={$uuid}");
        $this->line("SYNC_DEVICE_SECRET={$secret}");
        $this->line("# Cloud installation UUID: {$state->installation_uuid}");

        return self::SUCCESS;
    }
}
