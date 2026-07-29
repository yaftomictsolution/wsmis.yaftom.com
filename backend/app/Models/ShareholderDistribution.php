<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ShareholderDistribution extends Model
{
    use HasFactory;

    protected $fillable = [
        'financial_period_closing_id',
        'created_by',
        'reviewed_by',
        'approved_by',
        'rejected_by',
        'distribution_number',
        'distributable_amount',
        'allocated_amount',
        'paid_amount',
        'status',
        'submitted_at',
        'reviewed_at',
        'approved_at',
        'rejected_at',
        'rejection_reason',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'distributable_amount' => 'decimal:2',
            'allocated_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
        ];
    }

    public static function nextNumber(): string
    {
        return 'DST-'.now()->format('Ymd').'-'.str_pad((string) ((self::query()->max('id') ?? 0) + 1), 5, '0', STR_PAD_LEFT);
    }

    public function refreshPaymentStatus(): void
    {
        $paid = (float) $this->items()->sum('paid_amount');
        $allocated = (float) $this->items()->sum('entitlement_amount');
        $status = $this->status;

        if (in_array($status, ['approved', 'partially_paid', 'paid'], true)) {
            $status = $paid <= 0 ? 'approved' : ($paid + 0.005 >= $allocated ? 'paid' : 'partially_paid');
        }

        $this->update([
            'allocated_amount' => $allocated,
            'paid_amount' => $paid,
            'status' => $status,
        ]);
    }

    public function closing(): BelongsTo
    {
        return $this->belongsTo(FinancialPeriodClosing::class, 'financial_period_closing_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ShareholderDistributionItem::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
