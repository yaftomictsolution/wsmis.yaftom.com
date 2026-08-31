<?php

namespace App\Services\Sync;

use App\Models\SyncChange;
use App\Models\SyncConflict;
use App\Models\SyncEntity;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class SyncApplyService
{
    public function __construct(
        private readonly SyncNodeManager $nodes,
        private readonly SyncCatalog $catalog,
    ) {}

    public function apply(array $change, bool $recordInChangeLog = false, bool $protectLocalChanges = true): array
    {
        $this->validateChange($change);

        if (SyncChange::query()->where('change_uuid', $change['change_uuid'])->exists()) {
            return ['status' => 'accepted', 'reason' => 'already_applied'];
        }

        $entity = SyncEntity::query()->where('entity_uuid', $change['entity_uuid'])->first();
        $localPending = $protectLocalChanges
            ? SyncChange::query()
                ->where('entity_uuid', $change['entity_uuid'])
                ->where('source_node_uuid', $this->nodes->state()->node_uuid)
                ->whereNull('pushed_at')
                ->first()
            : null;

        if ($entity && $change['operation'] !== 'delete'
            && $entity->checksum
            && hash_equals((string) $entity->checksum, (string) ($change['checksum'] ?? ''))
            && $entity->record_id
            && $this->catalog->recordExists($entity->table_name, (int) $entity->record_id)) {
            if ((int) $change['version'] > (int) $entity->version) {
                $entity->forceFill([
                    'version' => (int) $change['version'],
                    'snapshot' => [
                        'payload' => $change['payload'] ?? [],
                        'relationships' => $change['relationships'] ?? [],
                        'files' => $change['files'] ?? [],
                    ],
                ])->save();
            }
            $this->recordAcceptedChange($change, $recordInChangeLog);

            return ['status' => 'accepted', 'reason' => 'same_content'];
        }

        if ($entity?->deleted_at && $change['operation'] === 'delete') {
            if ((int) $change['version'] > (int) $entity->version) {
                $entity->forceFill(['version' => (int) $change['version']])->save();
            }
            $this->recordAcceptedChange($change, $recordInChangeLog);

            return ['status' => 'accepted', 'reason' => 'already_deleted'];
        }

        if ($localPending) {
            return $this->conflict($change, $entity, $localPending, 'The record was changed both locally and online.');
        }

        $currentVersion = (int) ($entity?->version ?? 0);
        if ($currentVersion !== (int) $change['base_version']) {
            return $this->conflict($change, $entity, null, 'The incoming change is based on an older record version.');
        }

        try {
            DB::transaction(function () use ($change, $entity, $recordInChangeLog): void {
                $entity = $entity ?? SyncEntity::query()->create([
                    'entity_uuid' => $change['entity_uuid'],
                    'table_name' => $change['table_name'],
                    'record_id' => null,
                    'version' => 0,
                    'origin_node_uuid' => $change['source_node_uuid'],
                ]);

                if ($entity->table_name !== $change['table_name']) {
                    throw new RuntimeException('The synchronized entity table does not match its identity.');
                }

                if ($change['operation'] === 'delete') {
                    $this->applyDelete($entity);
                } else {
                    $this->applyWrite($entity, $change);
                }

                $entity->forceFill([
                    'version' => (int) $change['version'],
                    'checksum' => $change['operation'] === 'delete' ? null : ($change['checksum'] ?? null),
                    'snapshot' => $change['operation'] === 'delete' ? null : [
                        'payload' => $change['payload'] ?? [],
                        'relationships' => $change['relationships'] ?? [],
                        'files' => $change['files'] ?? [],
                    ],
                    'deleted_at' => $change['operation'] === 'delete' ? now() : null,
                ])->save();

                $this->recordAcceptedChange($change, $recordInChangeLog);
            });

            $this->resolveDeferredRelations();

            return ['status' => 'accepted'];
        } catch (Throwable $exception) {
            report($exception);

            return $this->conflict(
                $change,
                $entity,
                null,
                $exception instanceof QueryException
                    ? 'The change violates a database relationship or uniqueness rule.'
                    : $exception->getMessage(),
            );
        }
    }

    public function resolveConflict(SyncConflict $conflict, string $resolution, int $userId): SyncConflict
    {
        if ($conflict->status !== 'open') {
            throw new RuntimeException('This synchronization conflict is already resolved.');
        }

        if ($resolution === 'use_remote') {
            DB::transaction(function () use ($conflict): void {
                SyncChange::query()
                    ->where('entity_uuid', $conflict->entity_uuid)
                    ->whereNull('pushed_at')
                    ->delete();

                $remote = $conflict->remote_snapshot;
                $entity = SyncEntity::query()->where('entity_uuid', $conflict->entity_uuid)->first();
                if (! $remote) {
                    if ($entity) {
                        $this->applyDelete($entity);
                        $entity->forceFill([
                            'version' => (int) $conflict->remote_version,
                            'checksum' => null,
                            'snapshot' => null,
                            'deleted_at' => now(),
                        ])->save();
                    }

                    return;
                }

                if ($entity) {
                    $entity->forceFill(['version' => (int) ($remote['base_version'] ?? $conflict->remote_version)])->save();
                }

                $result = $this->apply($remote, false, false);
                if ($result['status'] !== 'accepted') {
                    throw new RuntimeException($result['reason'] ?? 'Unable to apply the online version.');
                }
            });
        } elseif ($resolution === 'keep_local') {
            $entity = SyncEntity::query()->where('entity_uuid', $conflict->entity_uuid)->firstOrFail();
            $snapshot = $entity->snapshot ?? [];
            $pending = SyncChange::query()
                ->where('entity_uuid', $entity->entity_uuid)
                ->whereNull('pushed_at')
                ->latest('id')
                ->first();
            $nextVersion = (int) $conflict->remote_version + 1;

            $values = [
                'base_version' => (int) $conflict->remote_version,
                'version' => $nextVersion,
                'operation' => $entity->deleted_at ? 'delete' : 'update',
                'payload' => $entity->deleted_at ? null : ($snapshot['payload'] ?? []),
                'relationships' => $entity->deleted_at ? [] : ($snapshot['relationships'] ?? []),
                'files' => $entity->deleted_at ? [] : ($snapshot['files'] ?? []),
                'checksum' => $entity->checksum,
                'source_node_uuid' => $this->nodes->state()->node_uuid,
                'pushed_at' => null,
            ];

            if ($pending) {
                $pending->forceFill($values)->save();
            } else {
                SyncChange::query()->create($values + [
                    'change_uuid' => (string) Str::uuid(),
                    'entity_uuid' => $entity->entity_uuid,
                    'table_name' => $entity->table_name,
                ]);
            }
            $entity->forceFill(['version' => $nextVersion])->save();
        } else {
            throw new RuntimeException('Unknown conflict resolution.');
        }

        $conflict->forceFill([
            'status' => 'resolved',
            'resolution' => $resolution,
            'resolved_at' => now(),
            'resolved_by' => $userId,
        ])->save();

        return $conflict->fresh();
    }

    public function resolveDeferredRelations(): int
    {
        $resolved = 0;
        DB::table('sync_deferred_relations')->orderBy('id')->get()->each(function (object $deferred) use (&$resolved): void {
            $entity = SyncEntity::query()->where('entity_uuid', $deferred->entity_uuid)->first();
            $target = SyncEntity::query()->where('entity_uuid', $deferred->target_entity_uuid)->first();
            if (! $entity?->record_id || ! $target?->record_id || $entity->deleted_at || $target->deleted_at) {
                return;
            }

            DB::table($deferred->table_name)
                ->where('id', $entity->record_id)
                ->update([$deferred->column_name => $target->record_id]);
            DB::table('sync_deferred_relations')->where('id', $deferred->id)->delete();
            $resolved++;
        });

        return $resolved;
    }

    private function applyWrite(SyncEntity $entity, array $change): void
    {
        $table = $change['table_name'];
        $columns = $this->catalog->columns($table);
        $payload = array_intersect_key($change['payload'] ?? [], $columns);

        foreach ($change['relationships'] ?? [] as $column => $reference) {
            if (! isset($columns[$column])) {
                continue;
            }

            if ($reference === null) {
                $payload[$column] = null;
                continue;
            }

            $target = SyncEntity::query()->where('entity_uuid', $reference['entity_uuid'] ?? '')->first();
            if ($target?->record_id && ! $target->deleted_at) {
                $payload[$column] = $target->record_id;
                continue;
            }

            if (! $this->catalog->isNullable($table, $column)) {
                throw new RuntimeException("Required related record {$reference['entity_uuid']} is not synchronized yet.");
            }

            $payload[$column] = null;
            DB::table('sync_deferred_relations')->updateOrInsert(
                ['entity_uuid' => $entity->entity_uuid, 'column_name' => $column],
                [
                    'table_name' => $table,
                    'target_entity_uuid' => $reference['entity_uuid'],
                    'target_table' => $reference['table_name'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            );
        }

        if ($entity->record_id && DB::table($table)->where('id', $entity->record_id)->exists()) {
            DB::table($table)->where('id', $entity->record_id)->update($payload);
            $this->catalog->applyVirtualFields($table, (int) $entity->record_id, $change['payload'] ?? []);

            return;
        }

        $entity->record_id = (int) DB::table($table)->insertGetId($payload);
        $entity->save();
        $this->catalog->applyVirtualFields($table, (int) $entity->record_id, $change['payload'] ?? []);
    }

    private function applyDelete(SyncEntity $entity): void
    {
        if ($entity->record_id) {
            DB::table($entity->table_name)->where('id', $entity->record_id)->delete();
        }
        DB::table('sync_deferred_relations')->where('entity_uuid', $entity->entity_uuid)->delete();
        $entity->record_id = null;
    }

    private function recordAcceptedChange(array $change, bool $record): void
    {
        if (! $record) {
            return;
        }

        SyncChange::query()->firstOrCreate(
            ['change_uuid' => $change['change_uuid']],
            [
                'entity_uuid' => $change['entity_uuid'],
                'table_name' => $change['table_name'],
                'operation' => $change['operation'],
                'base_version' => $change['base_version'],
                'version' => $change['version'],
                'payload' => $change['payload'] ?? null,
                'relationships' => $change['relationships'] ?? [],
                'files' => $change['files'] ?? [],
                'checksum' => $change['checksum'] ?? null,
                'source_node_uuid' => $change['source_node_uuid'],
                'pushed_at' => now(),
            ],
        );
    }

    private function conflict(array $change, ?SyncEntity $entity, ?SyncChange $pending, string $reason): array
    {
        SyncConflict::query()->updateOrCreate(
            [
                'entity_uuid' => $change['entity_uuid'],
                'status' => 'open',
            ],
            [
                'conflict_uuid' => (string) Str::uuid(),
                'table_name' => $change['table_name'],
                'local_change_uuid' => $pending?->change_uuid,
                'local_snapshot' => $entity?->snapshot,
                'remote_snapshot' => $change,
                'local_version' => (int) ($entity?->version ?? 0),
                'remote_version' => (int) $change['version'],
                'reason' => $reason,
                'detected_at' => now(),
            ],
        );

        $snapshot = $entity?->snapshot ?? [];
        $remoteState = $entity ? [
            'change_uuid' => (string) Str::uuid(),
            'entity_uuid' => $entity->entity_uuid,
            'table_name' => $entity->table_name,
            'operation' => $entity->deleted_at ? 'delete' : 'update',
            'base_version' => max(0, (int) $entity->version - 1),
            'version' => (int) $entity->version,
            'payload' => $entity->deleted_at ? null : ($snapshot['payload'] ?? []),
            'relationships' => $entity->deleted_at ? [] : ($snapshot['relationships'] ?? []),
            'files' => $entity->deleted_at ? [] : ($snapshot['files'] ?? []),
            'checksum' => $entity->checksum,
            'source_node_uuid' => $this->nodes->state()->node_uuid,
        ] : null;

        return [
            'status' => 'conflict',
            'reason' => $reason,
            'remote_version' => (int) ($entity?->version ?? 0),
            'remote_snapshot' => $remoteState,
        ];
    }

    private function validateChange(array $change): void
    {
        foreach (['change_uuid', 'entity_uuid', 'table_name', 'operation', 'base_version', 'version', 'source_node_uuid'] as $field) {
            if (! array_key_exists($field, $change)) {
                throw new RuntimeException("The sync change is missing {$field}.");
            }
        }

        if (! in_array($change['table_name'], $this->catalog->tables(), true)) {
            throw new RuntimeException('The synchronized table is not allowed.');
        }
        if (! in_array($change['operation'], ['create', 'update', 'delete'], true)) {
            throw new RuntimeException('The synchronization operation is invalid.');
        }
    }
}
