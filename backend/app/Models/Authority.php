<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Authority extends Model
{
    use HasFactory;

    protected $fillable = [
        'authority_number',
        'name',
        'father_name',
        'title',
        'phone',
        'email',
        'status',
        'notes',
    ];

    public static function nextNumber(): string
    {
        return 'AUT-'.str_pad((string) ((self::query()->max('id') ?? 0) + 1), 5, '0', STR_PAD_LEFT);
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(CustomerContract::class, 'discount_authority_id');
    }

    public function discountPayments(): HasMany
    {
        return $this->hasMany(Payment::class, 'discount_authority_id');
    }
}
