<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PayrollRun extends Model
{
    use HasFactory;

    protected $fillable = [
        'accounting_account_id',
        'payment_method_id',
        'financial_category_id',
        'accounting_transaction_id',
        'created_by',
        'reviewed_by',
        'approved_by',
        'rejected_by',
        'payroll_number',
        'title',
        'generated_from_hr',
        'period_start',
        'period_end',
        'payment_date',
        'total_base_salary',
        'total_bonus',
        'total_overtime',
        'total_absence_deduction',
        'total_late_deduction',
        'total_advance_deduction',
        'total_tax_deduction',
        'total_recurring_deduction',
        'total_other_deduction',
        'total_net',
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
            'period_start' => 'date',
            'period_end' => 'date',
            'payment_date' => 'date',
            'total_base_salary' => 'decimal:2',
            'total_bonus' => 'decimal:2',
            'total_overtime' => 'decimal:2',
            'total_absence_deduction' => 'decimal:2',
            'total_late_deduction' => 'decimal:2',
            'total_advance_deduction' => 'decimal:2',
            'total_tax_deduction' => 'decimal:2',
            'total_recurring_deduction' => 'decimal:2',
            'total_other_deduction' => 'decimal:2',
            'total_net' => 'decimal:2',
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
            'generated_from_hr' => 'boolean',
        ];
    }

    public static function nextNumber(): string
    {
        return 'PAY-'.now()->format('Ymd').'-'.str_pad((string) ((self::query()->max('id') ?? 0) + 1), 5, '0', STR_PAD_LEFT);
    }

    public function refreshTotals(): void
    {
        $totals = $this->items()
            ->selectRaw('COALESCE(SUM(base_salary), 0) as base_salary')
            ->selectRaw('COALESCE(SUM(bonus), 0) as bonus')
            ->selectRaw('COALESCE(SUM(overtime_amount), 0) as overtime_amount')
            ->selectRaw('COALESCE(SUM(absence_deduction), 0) as absence_deduction')
            ->selectRaw('COALESCE(SUM(late_deduction), 0) as late_deduction')
            ->selectRaw('COALESCE(SUM(advance_deduction), 0) as advance_deduction')
            ->selectRaw('COALESCE(SUM(tax_deduction), 0) as tax_deduction')
            ->selectRaw('COALESCE(SUM(recurring_deduction), 0) as recurring_deduction')
            ->selectRaw('COALESCE(SUM(other_deduction), 0) as other_deduction')
            ->selectRaw('COALESCE(SUM(net_amount), 0) as net_amount')
            ->first();

        $this->update([
            'total_base_salary' => $totals?->base_salary ?? 0,
            'total_bonus' => $totals?->bonus ?? 0,
            'total_overtime' => $totals?->overtime_amount ?? 0,
            'total_absence_deduction' => $totals?->absence_deduction ?? 0,
            'total_late_deduction' => $totals?->late_deduction ?? 0,
            'total_advance_deduction' => $totals?->advance_deduction ?? 0,
            'total_tax_deduction' => $totals?->tax_deduction ?? 0,
            'total_recurring_deduction' => $totals?->recurring_deduction ?? 0,
            'total_other_deduction' => $totals?->other_deduction ?? 0,
            'total_net' => $totals?->net_amount ?? 0,
        ]);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PayrollItem::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(AccountingAccount::class, 'accounting_account_id');
    }

    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(FinancialCategory::class, 'financial_category_id');
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(AccountingTransaction::class, 'accounting_transaction_id');
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

    public function rejector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }
}
