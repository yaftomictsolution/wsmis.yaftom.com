<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentAllocation extends Model
{
    use HasFactory;

    protected $fillable = [
        'payment_id',
        'invoice_id',
        'customer_charge_id',
        'amount',
        'discount_amount',
        'refunded_amount',
        'refunded_by',
        'refund_transaction_id',
        'refunded_at',
        'refund_receipt_number',
        'refund_reference',
        'refund_reason',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'refunded_amount' => 'decimal:2',
            'refunded_at' => 'date',
        ];
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function charge(): BelongsTo
    {
        return $this->belongsTo(CustomerCharge::class, 'customer_charge_id');
    }

    public function refunder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'refunded_by');
    }

    public function refundTransaction(): BelongsTo
    {
        return $this->belongsTo(AccountingTransaction::class, 'refund_transaction_id');
    }
}
