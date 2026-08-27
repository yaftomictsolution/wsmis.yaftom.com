<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Payment extends Model
{
    use HasFactory;

    public static function nextReceiptNumber(): string
    {
        return 'RCT-'.now()->format('Ymd').'-'.str_pad((string) ((self::query()->max('id') ?? 0) + 1), 5, '0', STR_PAD_LEFT);
    }

    public static function nextRefundReceiptNumber(): string
    {
        return 'PRF-'.now()->format('Ymd').'-'.str_pad((string) ((self::query()->whereNotNull('refund_receipt_number')->count()) + 1), 5, '0', STR_PAD_LEFT);
    }

    protected $fillable = [
        'invoice_id',
        'customer_id',
        'customer_contract_id',
        'customer_deposit_id',
        'payment_method_id',
        'accounting_account_id',
        'received_by',
        'refunded_by',
        'refund_transaction_id',
        'receipt_number',
        'refund_receipt_number',
        'idempotency_key',
        'amount',
        'discount_amount',
        'discount_authority_id',
        'refunded_amount',
        'paid_at',
        'refunded_at',
        'reference',
        'refund_reference',
        'status',
        'notes',
        'refund_reason',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'refunded_amount' => 'decimal:2',
            'paid_at' => 'date',
            'refunded_at' => 'date',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(CustomerContract::class, 'customer_contract_id');
    }

    public function deposit(): BelongsTo
    {
        return $this->belongsTo(CustomerDeposit::class, 'customer_deposit_id');
    }

    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(AccountingAccount::class, 'accounting_account_id');
    }

    public function discountAuthority(): BelongsTo
    {
        return $this->belongsTo(Authority::class, 'discount_authority_id');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function refunder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'refunded_by');
    }

    public function refundTransaction(): BelongsTo
    {
        return $this->belongsTo(AccountingTransaction::class, 'refund_transaction_id');
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class);
    }
}
