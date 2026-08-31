<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SyncDevice extends Model
{
    protected $guarded = [];

    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return ['last_seen_at' => 'datetime'];
    }
}
