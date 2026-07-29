<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CustomerDeposit extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_contract_id',
        'customer_id',
        'payment_method_id',
        'accounting_account_id',
        'received_by',
        'applied_by',
        'refunded_by',
        'accounting_transaction_id',
        'refund_transaction_id',
        'payment_id',
        'receipt_number',
        'amount',
        'applied_amount',
        'refunded_amount',
        'received_at',
        'refunded_at',
        'applied_at',
        'status',
        'reference',
        'refund_receipt_number',
        'refund_reference',
        'refund_reason',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'applied_amount' => 'decimal:2',
            'refunded_amount' => 'decimal:2',
            'received_at' => 'date',
            'refunded_at' => 'date',
            'applied_at' => 'datetime',
        ];
    }

    public static function nextReceiptNumber(): string
    {
        return 'DEP-'.now()->format('Ymd').'-'.str_pad((string) ((self::query()->max('id') ?? 0) + 1), 5, '0', STR_PAD_LEFT);
    }

    public static function nextRefundReceiptNumber(): string
    {
        return 'RFD-'.now()->format('Ymd').'-'.str_pad((string) ((self::query()->whereNotNull('refund_receipt_number')->count()) + 1), 5, '0', STR_PAD_LEFT);
    }

    public function availableAmount(): float
    {
        return max(0, (float) $this->amount - (float) $this->applied_amount - (float) $this->refunded_amount);
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(CustomerContract::class, 'customer_contract_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(AccountingAccount::class, 'accounting_account_id');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function applier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'applied_by');
    }

    public function refunder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'refunded_by');
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(AccountingTransaction::class, 'accounting_transaction_id');
    }

    public function refundTransaction(): BelongsTo
    {
        return $this->belongsTo(AccountingTransaction::class, 'refund_transaction_id');
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(CustomerDepositAllocation::class);
    }
}
