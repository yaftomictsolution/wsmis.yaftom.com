<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ShareholderDistributionItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'shareholder_distribution_id',
        'shareholder_id',
        'percentage_snapshot',
        'entitlement_amount',
        'paid_amount',
        'status',
    ];

    protected $appends = ['remaining_amount'];

    protected function casts(): array
    {
        return [
            'percentage_snapshot' => 'decimal:4',
            'entitlement_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
        ];
    }

    public function getRemainingAmountAttribute(): float
    {
        return max(0, (float) $this->entitlement_amount - (float) $this->paid_amount);
    }

    public function distribution(): BelongsTo
    {
        return $this->belongsTo(ShareholderDistribution::class, 'shareholder_distribution_id');
    }

    public function shareholder(): BelongsTo
    {
        return $this->belongsTo(Shareholder::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(ShareholderPayment::class);
    }
}
