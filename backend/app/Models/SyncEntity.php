<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SyncEntity extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'snapshot' => 'array',
            'deleted_at' => 'datetime',
        ];
    }
}
