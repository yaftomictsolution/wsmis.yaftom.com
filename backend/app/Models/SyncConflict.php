<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SyncConflict extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'local_snapshot' => 'array',
            'remote_snapshot' => 'array',
            'detected_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'conflict_uuid';
    }
}
