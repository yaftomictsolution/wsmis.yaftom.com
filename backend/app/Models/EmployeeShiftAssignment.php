<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeShiftAssignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'employee_id', 'work_shift_id', 'assigned_by', 'effective_from', 'effective_to', 'work_days', 'notes',
    ];

    protected function casts(): array
    {
        return ['effective_from' => 'date', 'effective_to' => 'date', 'work_days' => 'array'];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(WorkShift::class, 'work_shift_id');
    }

    public function assigner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }
}
