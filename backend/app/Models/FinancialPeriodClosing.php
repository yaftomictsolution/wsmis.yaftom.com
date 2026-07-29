<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class FinancialPeriodClosing extends Model
{
    use HasFactory;

    protected $fillable = [
        'prepared_by',
        'reviewed_by',
        'closed_by',
        'rejected_by',
        'reopened_by',
        'period_code',
        'period_start',
        'period_end',
        'total_income',
        'total_expense',
        'payroll_expense',
        'net_income',
        'receivables',
        'supplier_payables',
        'cash_balance',
        'bank_balance',
        'distributable_profit',
        'reconciliation_complete',
        'status',
        'submitted_at',
        'reviewed_at',
        'closed_at',
        'rejected_at',
        'reopened_at',
        'rejection_reason',
        'reopen_reason',
        'report_snapshot',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'total_income' => 'decimal:2',
            'total_expense' => 'decimal:2',
            'payroll_expense' => 'decimal:2',
            'net_income' => 'decimal:2',
            'receivables' => 'decimal:2',
            'supplier_payables' => 'decimal:2',
            'cash_balance' => 'decimal:2',
            'bank_balance' => 'decimal:2',
            'distributable_profit' => 'decimal:2',
            'reconciliation_complete' => 'boolean',
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'closed_at' => 'datetime',
            'rejected_at' => 'datetime',
            'reopened_at' => 'datetime',
            'report_snapshot' => 'array',
        ];
    }

    public static function isDateClosed(string $date): bool
    {
        return self::query()
            ->where('status', 'closed')
            ->whereDate('period_start', '<=', $date)
            ->whereDate('period_end', '>=', $date)
            ->exists();
    }

    public function preparer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'prepared_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function closer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function rejector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }

    public function reopener(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reopened_by');
    }

    public function distribution(): HasOne
    {
        return $this->hasOne(ShareholderDistribution::class);
    }
}
