<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceAreaMosque extends Model
{
    use HasFactory;

    protected $fillable = [
        'service_area_id',
        'name',
        'status',
        'notes',
    ];

    public function serviceArea(): BelongsTo
    {
        return $this->belongsTo(ServiceArea::class);
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class);
    }
}
