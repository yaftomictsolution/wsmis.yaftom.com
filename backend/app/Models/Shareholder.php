<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shareholder extends Model
{
    use HasFactory;

    protected $fillable = [
        'shareholder_number',
        'name',
        'shareholder_type',
        'father_name',
        'phone',
        'email',
        'investment_amount',
        'ownership_percentage',
        'joined_on',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'investment_amount' => 'decimal:2',
            'ownership_percentage' => 'decimal:4',
            'joined_on' => 'date',
        ];
    }

    public static function nextNumber(): string
    {
        return 'SHR-'.str_pad((string) ((self::query()->max('id') ?? 0) + 1), 5, '0', STR_PAD_LEFT);
    }

    public function distributionItems(): HasMany
    {
        return $this->hasMany(ShareholderDistributionItem::class);
    }
}
