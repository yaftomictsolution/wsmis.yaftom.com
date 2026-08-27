<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Invoice extends Model
{
    use HasFactory;

    protected $fillable = [
        'invoice_type',
        'billing_period_id',
        'customer_id',
        'customer_contract_id',
        'meter_reading_id',
        'source_type',
        'source_id',
        'invoice_number',
        'issue_date',
        'due_date',
        'previous_balance',
        'consumption',
        'rate_per_cubic_meter',
        'water_amount',
        'penalty_amount',
        'discount_amount',
        'payment_discount_amount',
        'total_amount',
        'paid_amount',
        'remaining_amount',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'issue_date' => 'date',
            'due_date' => 'date',
            'previous_balance' => 'decimal:2',
            'consumption' => 'decimal:2',
            'rate_per_cubic_meter' => 'decimal:2',
            'water_amount' => 'decimal:2',
            'penalty_amount' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'payment_discount_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'remaining_amount' => 'decimal:2',
        ];
    }

    public function billingPeriod(): BelongsTo
    {
        return $this->belongsTo(BillingPeriod::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function meterReading(): BelongsTo
    {
        return $this->belongsTo(MeterReading::class);
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(CustomerContract::class, 'customer_contract_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class)->orderBy('id');
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class);
    }

    public function inventoryRequest(): HasOne
    {
        return $this->hasOne(InventoryRequest::class, 'invoice_id');
    }

    public function payments(): BelongsToMany
    {
        return $this->belongsToMany(Payment::class, 'payment_allocations')
            ->withPivot('amount')
            ->withTimestamps();
    }

    public static function nextNumber(string $type): string
    {
        $prefix = match ($type) {
            'contract' => 'INV-C',
            'service' => 'INV-S',
            'adjustment' => 'INV-A',
            'inventory' => 'INV-I',
            default => 'INV-W',
        };

        return $prefix.'-'.now()->format('Ymd').'-'.str_pad((string) ((self::query()->max('id') ?? 0) + 1), 5, '0', STR_PAD_LEFT);
    }
}
