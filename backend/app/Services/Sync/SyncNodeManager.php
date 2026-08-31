<?php

namespace App\Services\Sync;

use App\Models\SyncNodeState;
use Illuminate\Support\Str;
use RuntimeException;

class SyncNodeManager
{
    public function state(): SyncNodeState
    {
        $state = SyncNodeState::query()->first();
        if ($state) {
            $configuredMode = (string) config('sync.mode', 'standalone');
            $configuredNode = (string) config('sync.device_uuid', '');
            $updates = [];
            if ($configuredMode === 'local' && Str::isUuid($configuredNode) && $state->node_uuid !== $configuredNode) {
                if ($state->mode !== 'cloud') {
                    throw new RuntimeException('The configured local device UUID does not match this database.');
                }
                $updates['node_uuid'] = $configuredNode;
                $updates['writer_device_uuid'] = null;
            }
            if ($state->mode !== $configuredMode) {
                $updates['mode'] = $configuredMode;
            }
            if ($updates !== []) {
                $state->forceFill($updates)->save();
            }
            return $state;
        }

        $configuredNode = config('sync.device_uuid');

        return SyncNodeState::query()->create([
            'node_uuid' => $configuredNode && Str::isUuid($configuredNode) ? $configuredNode : (string) Str::uuid(),
            'installation_uuid' => (string) Str::uuid(),
            'mode' => config('sync.mode', 'standalone'),
            'writer_mode' => 'cloud',
        ]);
    }

    public function adoptInstallation(string $installationUuid): SyncNodeState
    {
        if (! Str::isUuid($installationUuid)) {
            throw new RuntimeException('The remote installation identifier is invalid.');
        }

        $state = $this->state();
        if ($state->initialized_at && $state->installation_uuid !== $installationUuid) {
            throw new RuntimeException('This local database belongs to a different WSMIS installation.');
        }

        if ($state->installation_uuid !== $installationUuid) {
            $state->forceFill(['installation_uuid' => $installationUuid])->save();
        }

        return $state->fresh();
    }

    public function deterministicEntityUuid(string $table, int|string $recordId): string
    {
        $hash = hash('sha256', $this->state()->installation_uuid.'|'.$table.'|'.$recordId);

        return sprintf(
            '%s-%s-4%s-a%s-%s',
            substr($hash, 0, 8),
            substr($hash, 8, 4),
            substr($hash, 13, 3),
            substr($hash, 17, 3),
            substr($hash, 20, 12),
        );
    }
}
