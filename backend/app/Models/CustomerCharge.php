<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CustomerCharge extends Model
{
    use HasFactory;

    protected $appends = [
        'payment_status',
    ];

    protected $fillable = [
        'customer_id',
        'customer_contract_id',
        'invoice_id',
        'customer_charge_type_id',
        'financial_category_id',
        'accounting_transaction_id',
        'created_by',
        'title',
        'type',
        'amount',
        'paid_amount',
        'remaining_amount',
        'charge_date',
        'paid_at',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'remaining_amount' => 'decimal:2',
            'charge_date' => 'date',
            'paid_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (CustomerCharge $charge): void {
            if ($charge->customer_charge_type_id) {
                $chargeType = CustomerChargeType::query()->find($charge->customer_charge_type_id);
                if ($chargeType) {
                    $charge->type = $chargeType->code;
                }
            } elseif ($charge->type) {
                $charge->customer_charge_type_id = CustomerChargeType::query()
                    ->where('code', $charge->type)
                    ->value('id');
            }

            $paidAmount = (float) ($charge->paid_amount ?? 0);

            if ($charge->remaining_amount === null || (float) $charge->remaining_amount <= 0) {
                $charge->remaining_amount = max(0, (float) $charge->amount - $paidAmount);
            }
        });
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(CustomerContract::class, 'customer_contract_id');
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function chargeType(): BelongsTo
    {
        return $this->belongsTo(CustomerChargeType::class, 'customer_charge_type_id');
    }

    public function depositAllocations(): HasMany
    {
        return $this->hasMany(CustomerDepositAllocation::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(FinancialCategory::class, 'financial_category_id');
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(AccountingTransaction::class, 'accounting_transaction_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class);
    }

    public function getPaymentStatusAttribute(): string
    {
        if ((float) $this->remaining_amount <= 0.005) {
            return 'paid';
        }

        return (float) $this->paid_amount > 0.005 ? 'partially_paid' : 'unpaid';
    }
}
