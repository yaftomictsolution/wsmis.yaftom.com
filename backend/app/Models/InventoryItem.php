<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryItem extends Model
{
    use HasFactory;

    protected $with = ['good'];

    protected $fillable = [
        'good_id',
        'warehouse_id',
        'name',
        'code',
        'category',
        'unit',
        'quantity',
        'unit_cost',
        'unit_price',
        'reorder_level',
        'supplier_id',
        'notes',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'unit_cost' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'reorder_level' => 'decimal:2',
    ];

    // Accessors - get name from good if not set
    public function getNameAttribute($value)
    {
        if ($value) return $value;
        return $this->good?->name ?? 'Unknown';
    }

    // Accessors - get code from good if not set
    public function getCodeAttribute($value)
    {
        if ($value) return $value;
        return $this->good?->code ?? '-';
    }

    // Accessors - get category from good if not set
    public function getCategoryAttribute($value)
    {
        if ($value) return $value;
        return $this->good?->category ?? 'other';
    }

    // Accessors - get unit from good if not set
    public function getUnitAttribute($value)
    {
        if ($value) return $value;
        return $this->good?->unit ?? 'piece';
    }

    // Relationships
    public function good(): BelongsTo
    {
        return $this->belongsTo(Good::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(InventoryTransaction::class);
    }

    public function issueItems(): HasMany
    {
        return $this->hasMany(InventoryIssueItem::class);
    }

    public function requestItems(): HasMany
    {
        return $this->hasMany(InventoryRequestItem::class);
    }

    public function meters(): HasMany
    {
        return $this->hasMany(Meter::class);
    }

    // Scopes
    public function scopeLowStock($query)
    {
        return $query->whereColumn('quantity', '<=', 'reorder_level');
    }

    public function scopeOfCategory($query, string $category)
    {
        return $query->where('category', $category);
    }

    public function scopeInWarehouse($query, int $warehouseId)
    {
        return $query->where('warehouse_id', $warehouseId);
    }

    // Accessors
    public function getTotalValueAttribute(): float
    {
        return (float) $this->quantity * (float) $this->unit_cost;
    }

    public function getNeedsReorderAttribute(): bool
    {
        return (float) $this->quantity <= (float) $this->reorder_level;
    }
}
