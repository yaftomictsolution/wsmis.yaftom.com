<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LeavePolicy extends Model
{
    use HasFactory;

    protected $fillable = [
        'code', 'name', 'days_per_year', 'is_paid', 'tracks_balance', 'carry_forward_limit',
        'max_consecutive_days', 'attachment_after_days', 'payout_on_termination', 'status', 'description',
    ];

    protected function casts(): array
    {
        return [
            'days_per_year' => 'decimal:2', 'is_paid' => 'boolean', 'tracks_balance' => 'boolean',
            'carry_forward_limit' => 'decimal:2', 'max_consecutive_days' => 'decimal:2',
            'attachment_after_days' => 'decimal:2', 'payout_on_termination' => 'boolean',
        ];
    }

    public function balances(): HasMany
    {
        return $this->hasMany(EmployeeLeaveBalance::class);
    }

    public function leaveRequests(): HasMany
    {
        return $this->hasMany(LeaveRequest::class);
    }
}
