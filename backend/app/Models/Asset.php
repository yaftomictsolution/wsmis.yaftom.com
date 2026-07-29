<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Asset extends Model
{
    use HasFactory;

    protected $fillable = [
        'asset_purchase_id',
        'asset_code',
        'name',
        'type',
        'status',
        'service_area_id',
        'latitude',
        'longitude',
        'address',
        'purchase_cost',
        'purchase_date',
        'warranty_expiry',
        'supplier_id',
        'attributes',
        'created_by',
        'notes',
    ];

    protected $casts = [
        'attributes' => 'array',
        'purchase_cost' => 'decimal:2',
        'purchase_date' => 'date',
        'warranty_expiry' => 'date',
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
    ];

    // Relationships
    public function serviceArea(): BelongsTo
    {
        return $this->belongsTo(ServiceArea::class);
    }

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(AssetPurchase::class, 'asset_purchase_id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function maintenance(): HasMany
    {
        return $this->hasMany(AssetMaintenance::class);
    }

    // Scopes
    public function scopeOfType($query, string $type)
    {
        return $query->where('type', $type);
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeNeedingMaintenance($query)
    {
        return $query->where('status', 'maintenance');
    }

    // Type-specific attribute accessors
    public function getCustomAttribute(string $key, $default = null)
    {
        return $this->attributes['attributes'][$key] ?? $default;
    }

    // Well-specific
    public function getWellDepthAttribute(): ?float
    {
        return $this->getCustomAttribute('well_depth');
    }

    public function getWaterCapacityAttribute(): ?float
    {
        return $this->getCustomAttribute('water_capacity');
    }

    // Reservoir-specific
    public function getCapacityAttribute(): ?float
    {
        return $this->getCustomAttribute('capacity');
    }

    public function getCurrentLevelAttribute(): ?float
    {
        return $this->getCustomAttribute('current_level');
    }

    // Generator-specific
    public function getPowerOutputAttribute(): ?float
    {
        return $this->getCustomAttribute('power_output');
    }

    public function getFuelTypeAttribute(): ?string
    {
        return $this->getCustomAttribute('fuel_type');
    }

    // Solar-specific
    public function getTotalWattageAttribute(): ?float
    {
        return $this->getCustomAttribute('total_wattage');
    }

    public function getPanelCountAttribute(): ?int
    {
        return $this->getCustomAttribute('panel_count');
    }

    // Technical-specific
    public function getTechCategoryAttribute(): ?string
    {
        return $this->getCustomAttribute('category');
    }

    public function getBrandAttribute(): ?string
    {
        return $this->getCustomAttribute('brand');
    }

    public function getModelNameAttribute(): ?string
    {
        return $this->getCustomAttribute('model');
    }
}
