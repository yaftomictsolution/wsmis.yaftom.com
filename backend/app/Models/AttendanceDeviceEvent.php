<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceDeviceEvent extends Model
{
    use HasFactory;

    protected $appends = ['local_occurred_at'];

    protected $fillable = [
        'attendance_device_id', 'attendance_device_mapping_id', 'employee_id',
        'biometric_import_batch_id', 'attendance_record_id', 'event_uid', 'device_user_id',
        'device_user_name', 'attendance_date', 'occurred_at', 'verification_type',
        'punch_state', 'source', 'status', 'raw_payload', 'error_message', 'processed_at',
    ];

    protected function casts(): array
    {
        return [
            'attendance_date' => 'date',
            'occurred_at' => 'datetime',
            'processed_at' => 'datetime',
            'raw_payload' => 'array',
        ];
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(AttendanceDevice::class, 'attendance_device_id');
    }

    public function mapping(): BelongsTo
    {
        return $this->belongsTo(AttendanceDeviceMapping::class, 'attendance_device_mapping_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function importBatch(): BelongsTo
    {
        return $this->belongsTo(BiometricImportBatch::class, 'biometric_import_batch_id');
    }

    public function attendanceRecord(): BelongsTo
    {
        return $this->belongsTo(AttendanceRecord::class);
    }

    public function getLocalOccurredAtAttribute(): ?string
    {
        if (! $this->occurred_at) {
            return null;
        }

        $timezone = $this->device?->timezone ?: config('attendance-devices.default_timezone');

        return $this->occurred_at->copy()->setTimezone($timezone)->format('Y-m-d H:i:s');
    }
}
