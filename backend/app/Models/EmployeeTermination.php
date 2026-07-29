<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmployeeTermination extends Model
{
    use HasFactory;

    protected $fillable = [
        'employee_id', 'payment_method_id', 'accounting_account_id', 'accounting_transaction_id',
        'created_by', 'reviewed_by', 'approved_by', 'rejected_by', 'termination_number',
        'last_working_date', 'termination_type', 'reason', 'settlement_period_start', 'final_salary',
        'unused_leave_payout', 'severance_amount', 'other_earnings', 'advance_recovery',
        'other_deductions', 'net_settlement', 'status', 'reviewed_at', 'approved_at',
        'rejected_at', 'rejection_reason', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'last_working_date' => 'date', 'settlement_period_start' => 'date',
            'final_salary' => 'decimal:2', 'unused_leave_payout' => 'decimal:2',
            'severance_amount' => 'decimal:2', 'other_earnings' => 'decimal:2',
            'advance_recovery' => 'decimal:2', 'other_deductions' => 'decimal:2',
            'net_settlement' => 'decimal:2', 'reviewed_at' => 'datetime',
            'approved_at' => 'datetime', 'rejected_at' => 'datetime',
        ];
    }

    public static function nextNumber(): string
    {
        return 'SET-'.now()->format('Ymd').'-'.str_pad((string) ((self::query()->max('id') ?? 0) + 1), 5, '0', STR_PAD_LEFT);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(AccountingAccount::class, 'accounting_account_id');
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(AccountingTransaction::class, 'accounting_transaction_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function rejector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }

    public function advanceAllocations(): HasMany
    {
        return $this->hasMany(TerminationAdvanceAllocation::class);
    }
}
