<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LeaveRequest extends Model
{
    use HasFactory;

    protected $fillable = ['employee_id', 'leave_policy_id', 'created_by', 'reviewed_by', 'leave_number', 'leave_type', 'start_date', 'end_date', 'total_days', 'is_paid', 'reason', 'status', 'reviewed_at', 'rejection_reason', 'attachment_path', 'attachment_original_name'];

    protected function casts(): array
    {
        return ['start_date' => 'date', 'end_date' => 'date', 'total_days' => 'decimal:2', 'is_paid' => 'boolean', 'reviewed_at' => 'datetime'];
    }

    public static function nextNumber(): string
    {
        return 'LEV-'.now()->format('Ymd').'-'.str_pad((string) ((self::query()->max('id') ?? 0) + 1), 5, '0', STR_PAD_LEFT);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function policy(): BelongsTo
    {
        return $this->belongsTo(LeavePolicy::class, 'leave_policy_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function attendanceRecords(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class);
    }
}
