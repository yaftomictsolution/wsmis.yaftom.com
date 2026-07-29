<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MeterAssignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id',
        'customer_contract_id',
        'meter_id',
        'source_warehouse_id',
        'return_warehouse_id',
        'installed_by',
        'initial_reading',
        'installation_date',
        'seal_number',
        'status',
        'removed_at',
        'removal_disposition',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'initial_reading' => 'decimal:2',
            'installation_date' => 'date',
            'removed_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(CustomerContract::class, 'customer_contract_id');
    }

    public function meter(): BelongsTo
    {
        return $this->belongsTo(Meter::class);
    }

    public function sourceWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'source_warehouse_id');
    }

    public function returnWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'return_warehouse_id');
    }

    public function installer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'installed_by');
    }

    public function meterReadings(): HasMany
    {
        return $this->hasMany(MeterReading::class);
    }

    public function seals(): HasMany
    {
        return $this->hasMany(MeterSeal::class)->latest('sealed_at')->latest('id');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(MeterMovement::class);
    }
}
