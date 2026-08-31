<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SyncChange extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'relationships' => 'array',
            'files' => 'array',
            'pushed_at' => 'datetime',
        ];
    }

    public function toProtocolArray(): array
    {
        return [
            'sequence' => $this->id,
            'change_uuid' => $this->change_uuid,
            'entity_uuid' => $this->entity_uuid,
            'table_name' => $this->table_name,
            'operation' => $this->operation,
            'base_version' => (int) $this->base_version,
            'version' => (int) $this->version,
            'payload' => $this->payload,
            'relationships' => $this->relationships ?? [],
            'files' => $this->files ?? [],
            'checksum' => $this->checksum,
            'source_node_uuid' => $this->source_node_uuid,
            'changed_at' => optional($this->created_at)->toISOString(),
        ];
    }
}
