<?php

namespace App\Services\Sync;

use App\Models\SyncEntity;

class SyncIntegrityService
{
    public function __construct(private readonly SyncCatalog $catalog) {}

    public function manifest(): array
    {
        $tables = [];
        foreach ($this->catalog->tables() as $table) {
            $entities = SyncEntity::query()
                ->where('table_name', $table)
                ->orderBy('entity_uuid')
                ->get(['entity_uuid', 'version', 'checksum', 'deleted_at']);

            $lines = $entities->map(static fn (SyncEntity $entity): string => implode(':', [
                $entity->entity_uuid,
                (int) $entity->version,
                $entity->checksum ?? '-',
                $entity->deleted_at ? 'deleted' : 'active',
            ]));

            $tables[$table] = [
                'active' => $entities->whereNull('deleted_at')->count(),
                'deleted' => $entities->whereNotNull('deleted_at')->count(),
                'hash' => hash('sha256', $lines->implode('|')),
            ];
        }

        return [
            'tables' => $tables,
            'root_hash' => hash('sha256', collect($tables)
                ->map(fn (array $value, string $table): string => $table.':'.$value['hash'])
                ->implode('|')),
        ];
    }

    public function compare(array $remote): array
    {
        $local = $this->manifest();
        $differences = [];
        $tableNames = array_unique(array_merge(
            array_keys($local['tables']),
            array_keys($remote['tables'] ?? []),
        ));

        foreach ($tableNames as $table) {
            if (($local['tables'][$table] ?? null) !== ($remote['tables'][$table] ?? null)) {
                $differences[$table] = [
                    'local' => $local['tables'][$table] ?? null,
                    'remote' => $remote['tables'][$table] ?? null,
                ];
            }
        }

        return [
            'consistent' => $local['root_hash'] === ($remote['root_hash'] ?? null),
            'local_root_hash' => $local['root_hash'],
            'remote_root_hash' => $remote['root_hash'] ?? null,
            'differences' => $differences,
        ];
    }
}
