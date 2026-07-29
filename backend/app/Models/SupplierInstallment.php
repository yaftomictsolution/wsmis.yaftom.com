<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplierInstallment extends Model
{
    use HasFactory;

    protected $fillable = [
        'supplier_purchase_contract_id',
        'payment_method_id',
        'accounting_account_id',
        'accounting_transaction_id',
        'recorded_by',
        'installment_number',
        'due_date',
        'amount',
        'paid_amount',
        'paid_at',
        'status',
        'receipt_number',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'paid_at' => 'date',
            'amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
        ];
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(SupplierPurchaseContract::class, 'supplier_purchase_contract_id');
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

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
