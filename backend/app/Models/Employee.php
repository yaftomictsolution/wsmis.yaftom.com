<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Employee extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'job_position_id', 'service_area_id', 'referred_by_shareholder_id', 'created_by', 'updated_by',
        'employee_number', 'biometric_id', 'first_name', 'last_name', 'father_name', 'grandfather_name', 'gender', 'date_of_birth',
        'tazkira_number', 'phone', 'secondary_phone', 'email', 'address', 'emergency_contact_name',
        'emergency_contact_phone', 'hire_date', 'termination_date', 'employment_type', 'salary_type', 'base_salary',
        'daily_rate', 'overtime_hourly_rate', 'standard_daily_hours', 'work_start_time', 'work_end_time', 'work_days',
        'bank_name', 'bank_account_number', 'status', 'notes',
    ];

    protected $appends = ['full_name', 'effective_overtime_hourly_rate', 'overtime_rate_source'];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date', 'hire_date' => 'date', 'termination_date' => 'date',
            'base_salary' => 'decimal:2', 'daily_rate' => 'decimal:2', 'overtime_hourly_rate' => 'decimal:2',
            'standard_daily_hours' => 'decimal:2', 'work_days' => 'array',
        ];
    }

    public static function nextNumber(): string
    {
        return 'EMP-'.str_pad((string) ((self::query()->max('id') ?? 0) + 1), 5, '0', STR_PAD_LEFT);
    }

    public function getFullNameAttribute(): string
    {
        return trim($this->first_name.' '.($this->last_name ?? ''));
    }

    public function effectiveOvertimeHourlyRate(): float
    {
        $customRate = (float) $this->overtime_hourly_rate;
        if ($customRate > 0) {
            return $customRate;
        }

        $dailyHours = max(1, (float) $this->standard_daily_hours);
        $dailySalary = $this->salary_type === 'daily' && (float) $this->daily_rate > 0
            ? (float) $this->daily_rate
            : (float) $this->base_salary / 30;

        return $dailySalary / $dailyHours;
    }

    public function getEffectiveOvertimeHourlyRateAttribute(): float
    {
        return round($this->effectiveOvertimeHourlyRate(), 2);
    }

    public function getOvertimeRateSourceAttribute(): string
    {
        return (float) $this->overtime_hourly_rate > 0 ? 'custom' : 'automatic';
    }

    public function scheduledWorkDays(): array
    {
        return array_values(array_unique(array_map('intval', $this->work_days ?: [1, 2, 3, 4, 5, 6])));
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(JobPosition::class, 'job_position_id');
    }

    public function serviceArea(): BelongsTo
    {
        return $this->belongsTo(ServiceArea::class);
    }

    public function referringShareholder(): BelongsTo
    {
        return $this->belongsTo(Shareholder::class, 'referred_by_shareholder_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(EmployeeDocument::class);
    }

    public function attendanceRecords(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class);
    }

    public function leaveRequests(): HasMany
    {
        return $this->hasMany(LeaveRequest::class);
    }

    public function salaryAdvances(): HasMany
    {
        return $this->hasMany(SalaryAdvance::class);
    }

    public function adjustments(): HasMany
    {
        return $this->hasMany(EmployeeAdjustment::class);
    }

    public function performanceReviews(): HasMany
    {
        return $this->hasMany(PerformanceReview::class);
    }

    public function payrollItems(): HasMany
    {
        return $this->hasMany(PayrollItem::class);
    }

    public function leaveBalances(): HasMany
    {
        return $this->hasMany(EmployeeLeaveBalance::class);
    }

    public function shiftAssignments(): HasMany
    {
        return $this->hasMany(EmployeeShiftAssignment::class);
    }

    public function payrollDeductions(): HasMany
    {
        return $this->hasMany(EmployeePayrollDeduction::class);
    }

    public function terminations(): HasMany
    {
        return $this->hasMany(EmployeeTermination::class);
    }
}
