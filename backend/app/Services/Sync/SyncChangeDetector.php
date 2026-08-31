<?php

namespace App\Services\Sync;

use App\Models\SyncChange;
use App\Models\SyncEntity;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SyncChangeDetector
{
    public function __construct(
        private readonly SyncNodeManager $nodes,
        private readonly SyncCatalog $catalog,
        private readonly SyncFileService $files,
    ) {}

    public function detect(): array
    {
        $state = $this->nodes->state();
        $initializing = ! $state->initialized_at;
        $counts = ['created' => 0, 'updated' => 0, 'deleted' => 0, 'unchanged' => 0];

        DB::transaction(function () use ($initializing): void {
            foreach ($this->catalog->tables() as $table) {
                DB::table($table)->orderBy('id')->pluck('id')->each(
                    fn ($id) => $this->catalog->ensureEntity($table, (int) $id, $initializing),
                );
            }

            if ($initializing) {
                $this->nodes->state()->forceFill(['initialized_at' => now()])->save();
            }
        });

        foreach ($this->catalog->tables() as $table) {
            $seenIds = [];
            foreach (DB::table($table)->orderBy('id')->get() as $row) {
                $recordId = (int) $row->id;
                $seenIds[$recordId] = true;
                $entity = $this->catalog->ensureEntity($table, $recordId);
                $portable = $this->catalog->portableSnapshot($table, $row);
                $fileDescriptors = $this->files->descriptors($table, $portable['payload']);
                $checksum = $this->catalog->checksum($portable['payload'], $portable['relationships']);

                if ($entity->checksum !== $checksum || $entity->deleted_at) {
                    $operation = $entity->version === 0 || $entity->deleted_at ? 'create' : 'update';
                    $this->queueChange(
                        $entity,
                        $operation,
                        $portable['payload'],
                        $portable['relationships'],
                        $fileDescriptors,
                        $checksum,
                    );
                    $counts[$operation === 'create' ? 'created' : 'updated']++;
                } else {
                    $counts['unchanged']++;
                }
            }

            SyncEntity::query()
                ->where('table_name', $table)
                ->whereNotNull('record_id')
                ->whereNull('deleted_at')
                ->get()
                ->each(function (SyncEntity $entity) use ($seenIds, &$counts): void {
                    if (! isset($seenIds[(int) $entity->record_id])) {
                        $this->queueDeletion($entity);
                        $counts['deleted']++;
                    }
                });
        }

        return $counts + [
            'pending' => SyncChange::query()
                ->where('source_node_uuid', $state->node_uuid)
                ->whereNull('pushed_at')
                ->count(),
        ];
    }

    private function queueChange(
        SyncEntity $entity,
        string $operation,
        array $payload,
        array $relationships,
        array $files,
        string $checksum,
    ): void {
        $state = $this->nodes->state();
        $coalesce = $state->mode === 'local'
            ? SyncChange::query()
                ->where('entity_uuid', $entity->entity_uuid)
                ->where('source_node_uuid', $state->node_uuid)
                ->whereNull('pushed_at')
                ->latest('id')
                ->first()
            : null;

        if ($coalesce) {
            $coalesce->forceFill([
                'operation' => $coalesce->operation === 'create' ? 'create' : $operation,
                'payload' => $payload,
                'relationships' => $relationships,
                'files' => $files,
                'checksum' => $checksum,
            ])->save();

            $entity->forceFill([
                'checksum' => $checksum,
                'snapshot' => compact('payload', 'relationships', 'files'),
                'deleted_at' => null,
            ])->save();

            return;
        }

        $baseVersion = (int) $entity->version;
        $version = $baseVersion + 1;

        SyncChange::query()->create([
            'change_uuid' => (string) Str::uuid(),
            'entity_uuid' => $entity->entity_uuid,
            'table_name' => $entity->table_name,
            'operation' => $operation,
            'base_version' => $baseVersion,
            'version' => $version,
            'payload' => $payload,
            'relationships' => $relationships,
            'files' => $files,
            'checksum' => $checksum,
            'source_node_uuid' => $state->node_uuid,
            'pushed_at' => $state->mode === 'cloud' ? now() : null,
        ]);

        $entity->forceFill([
            'version' => $version,
            'checksum' => $checksum,
            'snapshot' => compact('payload', 'relationships', 'files'),
            'deleted_at' => null,
        ])->save();
    }

    private function queueDeletion(SyncEntity $entity): void
    {
        $state = $this->nodes->state();
        $pending = $state->mode === 'local'
            ? SyncChange::query()
                ->where('entity_uuid', $entity->entity_uuid)
                ->where('source_node_uuid', $state->node_uuid)
                ->whereNull('pushed_at')
                ->latest('id')
                ->first()
            : null;

        if ($pending?->operation === 'create') {
            $pending->delete();
            $entity->delete();

            return;
        }

        if ($pending) {
            $pending->forceFill([
                'operation' => 'delete',
                'payload' => null,
                'relationships' => [],
                'files' => [],
                'checksum' => null,
            ])->save();
        } else {
            $baseVersion = (int) $entity->version;
            $version = $baseVersion + 1;
            SyncChange::query()->create([
                'change_uuid' => (string) Str::uuid(),
                'entity_uuid' => $entity->entity_uuid,
                'table_name' => $entity->table_name,
                'operation' => 'delete',
                'base_version' => $baseVersion,
                'version' => $version,
                'payload' => null,
                'relationships' => [],
                'files' => [],
                'source_node_uuid' => $state->node_uuid,
                'pushed_at' => $state->mode === 'cloud' ? now() : null,
            ]);
            $entity->version = $version;
        }

        $entity->forceFill([
            'record_id' => null,
            'checksum' => null,
            'deleted_at' => now(),
        ])->save();
    }
}
