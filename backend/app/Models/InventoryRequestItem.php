<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryRequestItem extends Model
{
    protected $fillable = [
        'inventory_request_id',
        'good_id',
        'inventory_item_id',
        'description',
        'quantity',
        'unit_price',
        'total_price',
        'meter_serials',
        'meter_ids',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'total_price' => 'decimal:2',
        'meter_serials' => 'array',
        'meter_ids' => 'array',
    ];

    // Relationships
    public function request(): BelongsTo
    {
        return $this->belongsTo(InventoryRequest::class, 'inventory_request_id');
    }

    public function good(): BelongsTo
    {
        return $this->belongsTo(Good::class);
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }
}
