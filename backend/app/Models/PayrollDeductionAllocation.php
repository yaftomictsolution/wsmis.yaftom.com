<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayrollDeductionAllocation extends Model
{
    use HasFactory;

    protected $fillable = [
        'payroll_item_id', 'employee_payroll_deduction_id', 'payroll_deduction_rule_id',
        'code', 'name', 'type', 'calculation_type', 'value_snapshot', 'amount',
    ];

    protected function casts(): array
    {
        return ['value_snapshot' => 'decimal:4', 'amount' => 'decimal:2'];
    }

    public function payrollItem(): BelongsTo
    {
        return $this->belongsTo(PayrollItem::class);
    }

    public function employeeDeduction(): BelongsTo
    {
        return $this->belongsTo(EmployeePayrollDeduction::class, 'employee_payroll_deduction_id');
    }

    public function rule(): BelongsTo
    {
        return $this->belongsTo(PayrollDeductionRule::class, 'payroll_deduction_rule_id');
    }
}
