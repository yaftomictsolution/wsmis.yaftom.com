<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AttendanceDevice extends Model
{
    use HasFactory;

    protected $fillable = [
        'created_by', 'updated_by', 'name', 'code', 'vendor', 'model', 'serial_number',
        'connection_mode', 'ip_address', 'port', 'timeout_seconds', 'timezone', 'status',
        'connection_status', 'last_seen_at', 'last_sync_at', 'last_punch_at', 'last_error', 'device_info',
    ];

    protected function casts(): array
    {
        return [
            'port' => 'integer',
            'timeout_seconds' => 'integer',
            'last_seen_at' => 'datetime',
            'last_sync_at' => 'datetime',
            'last_punch_at' => 'datetime',
            'device_info' => 'array',
        ];
    }

    public function mappings(): HasMany
    {
        return $this->hasMany(AttendanceDeviceMapping::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(AttendanceDeviceEvent::class);
    }

    public function importBatches(): HasMany
    {
        return $this->hasMany(BiometricImportBatch::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
