<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Good extends Model
{
    protected $fillable = [
        'name',
        'code',
        'category',
        'unit',
        'default_cost',
        'default_price',
        'status',
        'description',
    ];

    protected $casts = [
        'default_cost' => 'decimal:2',
        'default_price' => 'decimal:2',
    ];

    // Relationships
    public function inventoryItems(): HasMany
    {
        return $this->hasMany(InventoryItem::class);
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeOfCategory($query, string $category)
    {
        return $query->where('category', $category);
    }

    public function scopeByCode($query, string $code)
    {
        return $query->where('code', $code);
    }
}
