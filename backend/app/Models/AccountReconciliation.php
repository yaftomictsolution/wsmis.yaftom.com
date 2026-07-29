<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AccountReconciliation extends Model
{
    use HasFactory;

    protected $fillable = [
        'accounting_account_id',
        'created_by',
        'reviewed_by',
        'approved_by',
        'rejected_by',
        'reconciliation_number',
        'period_start',
        'period_end',
        'book_balance',
        'statement_balance',
        'adjusted_statement_balance',
        'difference',
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
            'book_balance' => 'decimal:2',
            'statement_balance' => 'decimal:2',
            'adjusted_statement_balance' => 'decimal:2',
            'difference' => 'decimal:2',
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
        ];
    }

    public static function nextNumber(): string
    {
        return 'REC-'.now()->format('Ymd').'-'.str_pad((string) ((self::query()->max('id') ?? 0) + 1), 5, '0', STR_PAD_LEFT);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(AccountingAccount::class, 'accounting_account_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(AccountReconciliationItem::class);
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
