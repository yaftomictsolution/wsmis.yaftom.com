<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SyncNodeState extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'initialized_at' => 'datetime',
            'last_sync_at' => 'datetime',
            'last_verified_at' => 'datetime',
            'lease_expires_at' => 'datetime',
        ];
    }
}
