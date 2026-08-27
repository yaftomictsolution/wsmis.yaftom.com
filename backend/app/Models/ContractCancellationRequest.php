<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ContractCancellationRequest extends Model
{
    protected $fillable = [
        'customer_contract_id',
        'customer_id',
        'status',
        'reason',
        'materials_received_confirmed',
        'refund_posted_payments',
        'refund_accounting_account_id',
        'refunded_at',
        'refund_reference',
        'requested_by',
        'resolved_by',
        'resolved_at',
        'resolution_notes',
    ];

    protected function casts(): array
    {
        return [
            'materials_received_confirmed' => 'boolean',
            'refund_posted_payments' => 'boolean',
            'refunded_at' => 'date',
            'resolved_at' => 'datetime',
        ];
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(CustomerContract::class, 'customer_contract_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function refundAccount(): BelongsTo
    {
        return $this->belongsTo(AccountingAccount::class, 'refund_accounting_account_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ContractCancellationItem::class);
    }
}
