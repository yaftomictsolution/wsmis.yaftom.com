<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SalaryAdvance extends Model
{
    use HasFactory;

    protected $fillable = ['employee_id', 'payment_method_id', 'accounting_account_id', 'accounting_transaction_id', 'created_by', 'reviewed_by', 'approved_by', 'rejected_by', 'advance_number', 'amount', 'deducted_amount', 'payment_date', 'deduction_start_date', 'status', 'reviewed_at', 'approved_at', 'rejected_at', 'rejection_reason', 'reason', 'notes'];

    protected $appends = ['remaining_amount'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'deducted_amount' => 'decimal:2', 'payment_date' => 'date', 'deduction_start_date' => 'date', 'reviewed_at' => 'datetime', 'approved_at' => 'datetime', 'rejected_at' => 'datetime'];
    }

    public static function nextNumber(): string
    {
        return 'ADV-'.now()->format('Ymd').'-'.str_pad((string) ((self::query()->max('id') ?? 0) + 1), 5, '0', STR_PAD_LEFT);
    }

    public function getRemainingAmountAttribute(): float
    {
        return round(max(0, (float) $this->amount - (float) $this->deducted_amount), 2);
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

    public function payrollAllocations(): HasMany
    {
        return $this->hasMany(PayrollAdvanceAllocation::class);
    }
}
