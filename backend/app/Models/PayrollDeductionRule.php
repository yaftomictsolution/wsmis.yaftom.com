<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PayrollDeductionRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'code', 'name', 'type', 'calculation_type', 'value', 'threshold_amount', 'maximum_amount', 'status', 'description',
    ];

    protected function casts(): array
    {
        return ['value' => 'decimal:4', 'threshold_amount' => 'decimal:2', 'maximum_amount' => 'decimal:2'];
    }

    public function employeeDeductions(): HasMany
    {
        return $this->hasMany(EmployeePayrollDeduction::class);
    }
}
