<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SyncRun extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'counts' => 'array',
            'warnings' => 'array',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'run_uuid';
    }

    public function payload(): array
    {
        return [
            'run_uuid' => $this->run_uuid,
            'status' => $this->status,
            'stage' => $this->stage,
            'progress' => (int) $this->progress,
            'counts' => $this->counts ?? [],
            'warnings' => $this->warnings ?? [],
            'error' => $this->error,
            'started_at' => optional($this->started_at)->toISOString(),
            'completed_at' => optional($this->completed_at)->toISOString(),
        ];
    }
}
