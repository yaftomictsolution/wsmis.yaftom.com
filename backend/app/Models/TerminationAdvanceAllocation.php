<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TerminationAdvanceAllocation extends Model
{
    use HasFactory;

    protected $fillable = ['employee_termination_id', 'salary_advance_id', 'amount'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }

    public function termination(): BelongsTo
    {
        return $this->belongsTo(EmployeeTermination::class, 'employee_termination_id');
    }

    public function salaryAdvance(): BelongsTo
    {
        return $this->belongsTo(SalaryAdvance::class);
    }
}
