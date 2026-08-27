<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContractCancellationItem extends Model
{
    protected $fillable = [
        'contract_cancellation_request_id',
        'inventory_request_id',
        'inventory_request_item_id',
        'inventory_item_id',
        'good_id',
        'warehouse_id',
        'description',
        'unit',
        'quantity',
        'unit_cost',
        'unit_price',
        'total_cost',
        'total_price',
        'returned_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_cost' => 'decimal:2',
            'unit_price' => 'decimal:2',
            'total_cost' => 'decimal:2',
            'total_price' => 'decimal:2',
            'returned_at' => 'datetime',
        ];
    }

    public function cancellationRequest(): BelongsTo
    {
        return $this->belongsTo(ContractCancellationRequest::class, 'contract_cancellation_request_id');
    }

    public function inventoryRequest(): BelongsTo
    {
        return $this->belongsTo(InventoryRequest::class);
    }

    public function inventoryRequestItem(): BelongsTo
    {
        return $this->belongsTo(InventoryRequestItem::class);
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    public function good(): BelongsTo
    {
        return $this->belongsTo(Good::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }
}
