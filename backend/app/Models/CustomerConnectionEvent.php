<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerConnectionEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id',
        'processed_by',
        'customer_charge_id',
        'event_type',
        'reason',
        'fee',
        'status',
        'disconnected_at',
        'reconnected_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'fee' => 'decimal:2',
            'disconnected_at' => 'date',
            'reconnected_at' => 'date',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by');
    }

    public function charge(): BelongsTo
    {
        return $this->belongsTo(CustomerCharge::class, 'customer_charge_id');
    }
}
