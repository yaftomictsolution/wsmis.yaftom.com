<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AttendanceRecord extends Model
{
    use HasFactory;

    protected $fillable = ['employee_id', 'leave_request_id', 'biometric_import_batch_id', 'recorded_by', 'approved_by', 'attendance_date', 'check_in', 'check_out', 'attendance_status', 'is_paid', 'worked_minutes', 'late_minutes', 'overtime_minutes', 'source', 'external_reference', 'approval_status', 'approved_at', 'rejection_reason', 'notes'];

    protected function casts(): array
    {
        return ['attendance_date' => 'date', 'is_paid' => 'boolean', 'approved_at' => 'datetime'];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function leaveRequest(): BelongsTo
    {
        return $this->belongsTo(LeaveRequest::class);
    }

    public function biometricImportBatch(): BelongsTo
    {
        return $this->belongsTo(BiometricImportBatch::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function deviceEvents(): HasMany
    {
        return $this->hasMany(AttendanceDeviceEvent::class);
    }
}
