<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Meter extends Model
{
    use HasFactory;

    protected $fillable = [
        'good_id',
        'inventory_item_id',
        'purchase_request_item_id',
        'supplier_id',
        'source_warehouse_id',
        'current_warehouse_id',
        'source_type',
        'purchase_cost',
        'meter_number',
        'type',
        'status',
        'condition_notes',
        'purchased_at',
        'received_at',
        'retired_at',
    ];

    protected function casts(): array
    {
        return [
            'purchase_cost' => 'decimal:2',
            'purchased_at' => 'date',
            'received_at' => 'date',
            'retired_at' => 'datetime',
        ];
    }

    public function good(): BelongsTo
    {
        return $this->belongsTo(Good::class);
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    public function purchaseItem(): BelongsTo
    {
        return $this->belongsTo(InventoryRequestItem::class, 'purchase_request_item_id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function sourceWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'source_warehouse_id');
    }

    public function currentWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'current_warehouse_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(MeterAssignment::class);
    }

    public function readings(): HasMany
    {
        return $this->hasMany(MeterReading::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(MeterMovement::class)->latest('movement_date')->latest('id');
    }

    public function activeAssignment(): HasOne
    {
        return $this->hasOne(MeterAssignment::class)->where('status', 'active')->latestOfMany();
    }
}
