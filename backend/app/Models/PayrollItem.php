<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PayrollItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'payroll_run_id',
        'user_id',
        'employee_id',
        'employee_name',
        'salary_type',
        'contracted_salary',
        'base_salary',
        'scheduled_days',
        'present_days',
        'paid_leave_days',
        'absent_days',
        'late_minutes',
        'overtime_hours',
        'bonus',
        'overtime_amount',
        'absence_deduction',
        'late_deduction',
        'advance_deduction',
        'tax_deduction',
        'recurring_deduction',
        'other_deduction',
        'net_amount',
        'payment_status',
        'paid_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'base_salary' => 'decimal:2',
            'contracted_salary' => 'decimal:2',
            'scheduled_days' => 'decimal:2',
            'present_days' => 'decimal:2',
            'paid_leave_days' => 'decimal:2',
            'absent_days' => 'decimal:2',
            'overtime_hours' => 'decimal:2',
            'bonus' => 'decimal:2',
            'overtime_amount' => 'decimal:2',
            'absence_deduction' => 'decimal:2',
            'late_deduction' => 'decimal:2',
            'advance_deduction' => 'decimal:2',
            'tax_deduction' => 'decimal:2',
            'recurring_deduction' => 'decimal:2',
            'other_deduction' => 'decimal:2',
            'net_amount' => 'decimal:2',
            'paid_at' => 'datetime',
        ];
    }

    public function payrollRun(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function advanceAllocations(): HasMany
    {
        return $this->hasMany(PayrollAdvanceAllocation::class);
    }

    public function adjustments(): HasMany
    {
        return $this->hasMany(EmployeeAdjustment::class);
    }

    public function deductionAllocations(): HasMany
    {
        return $this->hasMany(PayrollDeductionAllocation::class);
    }
}
