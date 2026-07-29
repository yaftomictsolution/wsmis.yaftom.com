<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeLeaveBalance extends Model
{
    use HasFactory;

    protected $fillable = [
        'employee_id', 'leave_policy_id', 'year', 'entitlement_days', 'carried_forward_days', 'adjustment_days', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'year' => 'integer', 'entitlement_days' => 'decimal:2', 'carried_forward_days' => 'decimal:2',
            'adjustment_days' => 'decimal:2',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function policy(): BelongsTo
    {
        return $this->belongsTo(LeavePolicy::class, 'leave_policy_id');
    }
}
