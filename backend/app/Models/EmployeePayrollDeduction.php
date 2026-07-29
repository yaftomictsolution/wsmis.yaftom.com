<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmployeePayrollDeduction extends Model
{
    use HasFactory;

    protected $fillable = [
        'employee_id', 'payroll_deduction_rule_id', 'assigned_by', 'override_value',
        'effective_from', 'effective_to', 'status', 'notes',
    ];

    protected function casts(): array
    {
        return ['override_value' => 'decimal:4', 'effective_from' => 'date', 'effective_to' => 'date'];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function rule(): BelongsTo
    {
        return $this->belongsTo(PayrollDeductionRule::class, 'payroll_deduction_rule_id');
    }

    public function assigner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(PayrollDeductionAllocation::class);
    }
}
