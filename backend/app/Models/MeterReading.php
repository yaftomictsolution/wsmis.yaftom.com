<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class MeterReading extends Model
{
    use HasFactory;

    protected $fillable = [
        'billing_period_id',
        'meter_assignment_id',
        'customer_id',
        'meter_id',
        'read_by',
        'reading_date',
        'previous_reading',
        'current_reading',
        'consumption',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'reading_date' => 'date',
            'previous_reading' => 'decimal:2',
            'current_reading' => 'decimal:2',
            'consumption' => 'decimal:2',
        ];
    }

    public function billingPeriod(): BelongsTo
    {
        return $this->belongsTo(BillingPeriod::class);
    }

    public function meterAssignment(): BelongsTo
    {
        return $this->belongsTo(MeterAssignment::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function meter(): BelongsTo
    {
        return $this->belongsTo(Meter::class);
    }

    public function reader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'read_by');
    }

    public function invoice(): HasOne
    {
        return $this->hasOne(Invoice::class);
    }
}
