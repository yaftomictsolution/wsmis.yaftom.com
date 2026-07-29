<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShareholderPayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'shareholder_distribution_item_id',
        'accounting_account_id',
        'payment_method_id',
        'accounting_transaction_id',
        'created_by',
        'payment_number',
        'amount',
        'payment_date',
        'receipt_number',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'payment_date' => 'date',
        ];
    }

    public static function nextNumber(): string
    {
        return 'SHP-'.now()->format('Ymd').'-'.str_pad((string) ((self::query()->max('id') ?? 0) + 1), 5, '0', STR_PAD_LEFT);
    }

    public function distributionItem(): BelongsTo
    {
        return $this->belongsTo(ShareholderDistributionItem::class, 'shareholder_distribution_item_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(AccountingAccount::class, 'accounting_account_id');
    }

    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(AccountingTransaction::class, 'accounting_transaction_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
