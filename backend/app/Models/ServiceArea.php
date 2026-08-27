<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceArea extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'mosque_name',
        'district',
        'street_block_village',
        'representative_name',
        'representative_phone',
        'households_count',
        'rate_per_cubic_meter',
        'status',
        'inactive_reason',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'households_count' => 'integer',
            'rate_per_cubic_meter' => 'decimal:2',
        ];
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class);
    }

    public function mosques(): HasMany
    {
        return $this->hasMany(ServiceAreaMosque::class)->orderBy('name');
    }
}
