<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Supplier extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'supplier_type',
        'phone',
        'address',
        'status',
        'notes',
    ];

    public function contracts(): HasMany
    {
        return $this->hasMany(SupplierPurchaseContract::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(AccountingTransaction::class);
    }
}
