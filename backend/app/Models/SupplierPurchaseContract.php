<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupplierPurchaseContract extends Model
{
    use HasFactory;

    protected $fillable = [
        'supplier_id',
        'financial_category_id',
        'created_by',
        'contract_number',
        'item_type',
        'total_amount',
        'down_payment_amount',
        'paid_amount',
        'remaining_amount',
        'installments_count',
        'installment_start_date',
        'installment_end_date',
        'next_payment_date',
        'status',
        'attachment_path',
        'attachment_original_name',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'total_amount' => 'decimal:2',
            'down_payment_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'remaining_amount' => 'decimal:2',
            'installment_start_date' => 'date',
            'installment_end_date' => 'date',
            'next_payment_date' => 'date',
        ];
    }

    public static function nextNumber(): string
    {
        return 'SUP-'.now()->format('Ymd').'-'.str_pad((string) ((self::query()->max('id') ?? 0) + 1), 5, '0', STR_PAD_LEFT);
    }

    public function refreshPaymentStatus(): void
    {
        $paid = (float) $this->installments()->where('status', 'paid')->sum('paid_amount');
        $remaining = max(0, (float) $this->total_amount - $paid);
        $nextPaymentDate = $this->installments()
            ->whereIn('status', ['pending', 'pending_review', 'pending_approval'])
            ->orderBy('due_date')
            ->value('due_date');

        $this->update([
            'paid_amount' => $paid,
            'remaining_amount' => $remaining,
            'next_payment_date' => $nextPaymentDate,
            'status' => $remaining <= 0 ? 'completed' : ($nextPaymentDate && $nextPaymentDate < now()->toDateString() ? 'overdue' : 'active'),
        ]);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(FinancialCategory::class, 'financial_category_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function installments(): HasMany
    {
        return $this->hasMany(SupplierInstallment::class);
    }
}
