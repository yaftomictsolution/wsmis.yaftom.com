<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayrollAdvanceAllocation extends Model
{
    use HasFactory;

    protected $fillable = ['payroll_item_id', 'salary_advance_id', 'amount'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }

    public function payrollItem(): BelongsTo
    {
        return $this->belongsTo(PayrollItem::class);
    }

    public function salaryAdvance(): BelongsTo
    {
        return $this->belongsTo(SalaryAdvance::class);
    }
}
