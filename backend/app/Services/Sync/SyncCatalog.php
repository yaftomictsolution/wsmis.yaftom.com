<?php

namespace App\Services\Sync;

use App\Models\SyncEntity;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;

class SyncCatalog
{
    private array $foreignKeyCache = [];

    private array $columnCache = [];

    private array $entityCache = [];

    private ?array $tableCache = null;

    public function __construct(private readonly SyncNodeManager $nodes) {}

    public function tables(): array
    {
        if ($this->tableCache !== null) {
            return $this->tableCache;
        }

        return $this->tableCache = array_values(array_filter(
            config('sync.tables', []),
            fn (string $table): bool => Schema::hasTable($table) && Schema::hasColumn($table, 'id'),
        ));
    }

    public function rank(string $table): int
    {
        $rank = array_search($table, $this->tables(), true);

        return $rank === false ? PHP_INT_MAX : $rank;
    }

    public function foreignKeys(string $table): array
    {
        if (array_key_exists($table, $this->foreignKeyCache)) {
            return $this->foreignKeyCache[$table];
        }

        $allowed = array_flip($this->tables());
        $keys = array_values(array_filter(
            Schema::getForeignKeys($table),
            static fn (array $key): bool => count($key['columns'] ?? []) === 1
                && count($key['foreign_columns'] ?? []) === 1
                && ($key['foreign_columns'][0] ?? null) === 'id'
                && isset($allowed[$key['foreign_table'] ?? '']),
        ));

        return $this->foreignKeyCache[$table] = $keys;
    }

    public function columns(string $table): array
    {
        if (! array_key_exists($table, $this->columnCache)) {
            $this->columnCache[$table] = collect(Schema::getColumns($table))
                ->keyBy('name')
                ->all();
        }

        return $this->columnCache[$table];
    }

    public function isNullable(string $table, string $column): bool
    {
        return (bool) ($this->columns($table)[$column]['nullable'] ?? false);
    }

    public function ensureEntity(string $table, int $recordId, bool $deterministic = false): SyncEntity
    {
        $cacheKey = $table.':'.$recordId;
        if (isset($this->entityCache[$cacheKey])) {
            return $this->entityCache[$cacheKey];
        }

        $existing = SyncEntity::query()
            ->where('table_name', $table)
            ->where('record_id', $recordId)
            ->first();

        if ($existing) {
            return $this->entityCache[$cacheKey] = $existing;
        }

        $state = $this->nodes->state();
        $entityUuid = $deterministic
            ? $this->nodes->deterministicEntityUuid($table, $recordId)
            : (string) Str::uuid();

        if ($deterministic) {
            $byUuid = SyncEntity::query()->where('entity_uuid', $entityUuid)->first();
            if ($byUuid) {
                if ($byUuid->table_name !== $table
                    || ($byUuid->record_id !== null && (int) $byUuid->record_id !== $recordId)) {
                    throw new RuntimeException("Synchronization identity {$entityUuid} is already assigned to another record.");
                }

                $byUuid->forceFill([
                    'record_id' => $recordId,
                    'deleted_at' => null,
                ])->save();

                return $this->entityCache[$cacheKey] = $byUuid;
            }
        }

        return $this->entityCache[$cacheKey] = SyncEntity::query()->create([
            'entity_uuid' => $entityUuid,
            'table_name' => $table,
            'record_id' => $recordId,
            'version' => 0,
            'origin_node_uuid' => $state->node_uuid,
        ]);
    }

    public function portableSnapshot(string $table, array|object $row): array
    {
        $payload = (array) $row;
        unset($payload['id']);
        foreach (config("sync.ignored_columns.{$table}", []) as $ignoredColumn) {
            unset($payload[$ignoredColumn]);
        }
        $this->appendVirtualFields($table, (int) ((array) $row)['id'], $payload);
        $relationships = [];

        foreach ($this->foreignKeys($table) as $key) {
            $column = $key['columns'][0];
            $targetTable = $key['foreign_table'];
            $recordId = $payload[$column] ?? null;
            unset($payload[$column]);

            if ($recordId === null) {
                $relationships[$column] = null;

                continue;
            }

            $target = $this->entityCache[$targetTable.':'.(int) $recordId]
                ?? SyncEntity::query()
                    ->where('table_name', $targetTable)
                    ->where('record_id', $recordId)
                    ->first();

            if ($target) {
                $this->entityCache[$targetTable.':'.(int) $recordId] = $target;
            }

            $relationships[$column] = $target ? [
                'table_name' => $targetTable,
                'entity_uuid' => $target->entity_uuid,
            ] : null;
        }

        ksort($payload);
        ksort($relationships);

        return [
            'payload' => $payload,
            'relationships' => $relationships,
        ];
    }

    public function checksum(array $payload, array $relationships): string
    {
        return hash('sha256', json_encode([
            'payload' => $this->canonicalize($payload),
            'relationships' => $this->canonicalize($relationships),
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION));
    }

    public function normalizeSnapshot(string $table, array $snapshot): array
    {
        $payload = $snapshot['payload'] ?? [];
        foreach (config("sync.ignored_columns.{$table}", []) as $ignoredColumn) {
            unset($payload[$ignoredColumn]);
        }

        $relationships = $snapshot['relationships'] ?? [];
        ksort($payload);
        ksort($relationships);

        return [
            'payload' => $payload,
            'relationships' => $relationships,
            'files' => $snapshot['files'] ?? [],
        ];
    }

    public function snapshotsEquivalent(string $table, array $left, array $right): bool
    {
        $left = $this->normalizeSnapshot($table, $left);
        $right = $this->normalizeSnapshot($table, $right);

        return hash_equals(
            $this->checksum($left['payload'], $left['relationships']),
            $this->checksum($right['payload'], $right['relationships']),
        );
    }

    public function recordExists(string $table, int $recordId): bool
    {
        return DB::table($table)->where('id', $recordId)->exists();
    }

    public function applyVirtualFields(string $table, int $recordId, array $payload): void
    {
        if ($table === 'users') {
            $modelType = User::class;
            $this->syncNamedPivot(
                'model_has_roles',
                'role_id',
                'roles',
                $payload['__sync_roles'] ?? [],
                ['model_type' => $modelType, 'model_id' => $recordId],
            );
            $this->syncNamedPivot(
                'model_has_permissions',
                'permission_id',
                'permissions',
                $payload['__sync_permissions'] ?? [],
                ['model_type' => $modelType, 'model_id' => $recordId],
            );
        }

        if ($table === 'roles') {
            $this->syncNamedPivot(
                'role_has_permissions',
                'permission_id',
                'permissions',
                $payload['__sync_permissions'] ?? [],
                ['role_id' => $recordId],
            );
        }

        $this->applyIndirectReference($table, $recordId, $payload);

        if ($table === 'inventory_request_items' && array_key_exists('__sync_meter_entities', $payload)) {
            $entityUuids = $payload['__sync_meter_entities'];
            if ($entityUuids === null) {
                DB::table($table)->where('id', $recordId)->update(['meter_ids' => null]);

                return;
            }

            $meterIds = collect($entityUuids)->map(function (string $entityUuid): int {
                $entity = SyncEntity::query()
                    ->where('entity_uuid', $entityUuid)
                    ->where('table_name', 'meters')
                    ->whereNull('deleted_at')
                    ->first();

                if (! $entity?->record_id || ! $this->recordExists('meters', (int) $entity->record_id)) {
                    throw new RuntimeException("Referenced meter {$entityUuid} is not synchronized yet.");
                }

                return (int) $entity->record_id;
            })->values()->all();

            DB::table($table)->where('id', $recordId)->update([
                'meter_ids' => json_encode($meterIds, JSON_THROW_ON_ERROR),
            ]);
        }
    }

    private function canonicalize(array $value): array
    {
        ksort($value);
        foreach ($value as $key => $item) {
            if (is_array($item)) {
                $value[$key] = $this->canonicalize($item);
            }
        }

        return $value;
    }

    private function appendVirtualFields(string $table, int $recordId, array &$payload): void
    {
        if ($table === 'users') {
            $modelType = User::class;
            $payload['__sync_roles'] = DB::table('model_has_roles')
                ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
                ->where('model_has_roles.model_type', $modelType)
                ->where('model_has_roles.model_id', $recordId)
                ->orderBy('roles.name')
                ->pluck('roles.name')
                ->all();
            $payload['__sync_permissions'] = DB::table('model_has_permissions')
                ->join('permissions', 'permissions.id', '=', 'model_has_permissions.permission_id')
                ->where('model_has_permissions.model_type', $modelType)
                ->where('model_has_permissions.model_id', $recordId)
                ->orderBy('permissions.name')
                ->pluck('permissions.name')
                ->all();
        }

        if ($table === 'roles') {
            $payload['__sync_permissions'] = DB::table('role_has_permissions')
                ->join('permissions', 'permissions.id', '=', 'role_has_permissions.permission_id')
                ->where('role_has_permissions.role_id', $recordId)
                ->orderBy('permissions.name')
                ->pluck('permissions.name')
                ->all();
        }

        if ($table === 'inventory_request_items') {
            $meterIds = $this->decodeNumericIds($payload['meter_ids'] ?? null);
            unset($payload['meter_ids']);

            $payload['__sync_meter_entities'] = $meterIds === null
                ? null
                : collect($meterIds)->map(function (int $meterId): string {
                    $entity = $this->entityCache['meters:'.$meterId]
                        ?? SyncEntity::query()
                            ->where('table_name', 'meters')
                            ->where('record_id', $meterId)
                            ->first();

                    if (! $entity) {
                        throw new RuntimeException("Meter {$meterId} has no synchronization identity.");
                    }

                    $this->entityCache['meters:'.$meterId] = $entity;

                    return $entity->entity_uuid;
                })->values()->all();
        }

        $this->appendIndirectReference($table, $payload);
    }

    private function appendIndirectReference(string $table, array &$payload): void
    {
        $definition = config("sync.indirect_references.{$table}");
        if (! is_array($definition)) {
            return;
        }

        $idColumn = (string) $definition['id_column'];
        $typeColumn = (string) $definition['type_column'];
        $virtualColumn = '__sync_indirect_'.$idColumn;
        $recordId = $payload[$idColumn] ?? null;
        unset($payload[$idColumn]);

        if ($recordId === null || (int) $recordId <= 0) {
            $payload[$virtualColumn] = null;

            return;
        }

        $type = (string) ($payload[$typeColumn] ?? '');
        $targetTable = $this->resolveIndirectTable($definition, $type);
        if (! $targetTable) {
            throw new RuntimeException("Unmapped {$table}.{$typeColumn} value '{$type}' cannot be synchronized safely.");
        }

        $target = $this->entityCache[$targetTable.':'.(int) $recordId]
            ?? SyncEntity::query()
                ->where('table_name', $targetTable)
                ->where('record_id', $recordId)
                ->first();
        if (! $target) {
            throw new RuntimeException("{$table}.{$idColumn} references missing {$targetTable} record {$recordId}.");
        }

        $this->entityCache[$targetTable.':'.(int) $recordId] = $target;
        $payload[$virtualColumn] = [
            'table_name' => $targetTable,
            'entity_uuid' => $target->entity_uuid,
        ];
    }

    private function applyIndirectReference(string $table, int $recordId, array $payload): void
    {
        $definition = config("sync.indirect_references.{$table}");
        if (! is_array($definition)) {
            return;
        }

        $idColumn = (string) $definition['id_column'];
        $virtualColumn = '__sync_indirect_'.$idColumn;
        if (! array_key_exists($virtualColumn, $payload)) {
            return;
        }

        $entity = SyncEntity::query()
            ->where('table_name', $table)
            ->where('record_id', $recordId)
            ->firstOrFail();
        $reference = $payload[$virtualColumn];

        if ($reference === null) {
            DB::table($table)->where('id', $recordId)->update([$idColumn => null]);
            DB::table('sync_deferred_relations')
                ->where('entity_uuid', $entity->entity_uuid)
                ->where('column_name', $idColumn)
                ->delete();

            return;
        }

        $target = SyncEntity::query()
            ->where('entity_uuid', $reference['entity_uuid'] ?? '')
            ->where('table_name', $reference['table_name'] ?? '')
            ->whereNull('deleted_at')
            ->first();
        if ($target?->record_id && $this->recordExists($target->table_name, (int) $target->record_id)) {
            DB::table($table)->where('id', $recordId)->update([$idColumn => $target->record_id]);
            DB::table('sync_deferred_relations')
                ->where('entity_uuid', $entity->entity_uuid)
                ->where('column_name', $idColumn)
                ->delete();

            return;
        }

        DB::table($table)->where('id', $recordId)->update([$idColumn => null]);
        DB::table('sync_deferred_relations')->updateOrInsert(
            ['entity_uuid' => $entity->entity_uuid, 'column_name' => $idColumn],
            [
                'table_name' => $table,
                'target_entity_uuid' => $reference['entity_uuid'],
                'target_table' => $reference['table_name'],
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );
    }

    private function resolveIndirectTable(array $definition, string $type): ?string
    {
        $targetTable = $definition['types'][$type] ?? null;
        if (! $targetTable && ($definition['model_types'] ?? false)
            && class_exists($type) && is_subclass_of($type, Model::class)) {
            $targetTable = (new $type)->getTable();
        }

        return $targetTable && in_array($targetTable, $this->tables(), true)
            ? $targetTable
            : null;
    }

    private function decodeNumericIds(mixed $value): ?array
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_string($value)) {
            $value = json_decode($value, true, flags: JSON_THROW_ON_ERROR);
        }

        if (! is_array($value)) {
            throw new RuntimeException('Serialized meter references must be a JSON array.');
        }

        return collect($value)
            ->map(fn (mixed $id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0)
            ->values()
            ->all();
    }

    private function syncNamedPivot(
        string $pivotTable,
        string $foreignColumn,
        string $catalogTable,
        array $names,
        array $scope,
    ): void {
        $query = DB::table($pivotTable);
        foreach ($scope as $column => $value) {
            $query->where($column, $value);
        }
        $query->delete();

        $ids = DB::table($catalogTable)->whereIn('name', $names)->pluck('id');
        foreach ($ids as $id) {
            DB::table($pivotTable)->insert($scope + [$foreignColumn => $id]);
        }
    }
}
