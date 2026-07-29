<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryIssueItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'inventory_issue_id',
        'inventory_item_id',
        'quantity',
        'unit_cost',
        'unit_price',
        'total_cost',
        'total_price',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'unit_cost' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'total_cost' => 'decimal:2',
        'total_price' => 'decimal:2',
    ];

    // Relationships
    public function issue(): BelongsTo
    {
        return $this->belongsTo(InventoryIssue::class, 'inventory_issue_id');
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }
}
