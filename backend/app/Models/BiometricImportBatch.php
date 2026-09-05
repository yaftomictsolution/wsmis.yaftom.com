<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BiometricImportBatch extends Model
{
    use HasFactory;

    protected $fillable = [
        'attendance_device_id', 'imported_by', 'batch_number', 'original_name', 'path', 'source',
        'total_rows', 'imported_rows', 'skipped_rows', 'unmatched_rows', 'failed_rows', 'status', 'errors',
    ];

    protected function casts(): array
    {
        return [
            'total_rows' => 'integer',
            'imported_rows' => 'integer',
            'skipped_rows' => 'integer',
            'unmatched_rows' => 'integer',
            'failed_rows' => 'integer',
            'errors' => 'array',
        ];
    }

    public static function nextNumber(): string
    {
        return 'BIO-'.now()->format('Ymd').'-'.str_pad((string) ((self::query()->max('id') ?? 0) + 1), 5, '0', STR_PAD_LEFT);
    }

    public function importer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'imported_by');
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(AttendanceDevice::class, 'attendance_device_id');
    }

    public function attendanceRecords(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class);
    }

    public function deviceEvents(): HasMany
    {
        return $this->hasMany(AttendanceDeviceEvent::class);
    }
}
