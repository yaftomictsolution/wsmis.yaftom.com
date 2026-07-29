<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

class AccountingTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'financial_category_id',
        'payment_method_id',
        'accounting_account_id',
        'customer_id',
        'supplier_id',
        'supplier_installment_id',
        'recorded_by',
        'reviewed_by',
        'approved_by',
        'rejected_by',
        'transaction_number',
        'type',
        'title',
        'amount',
        'received_from',
        'paid_to',
        'transaction_date',
        'receipt_number',
        'reference',
        'source_type',
        'source_id',
        'status',
        'reviewed_at',
        'approved_at',
        'rejected_at',
        'posted_at',
        'reversed_at',
        'rejection_reason',
        'reversal_reason',
        'attachment_path',
        'attachment_original_name',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'transaction_date' => 'date',
            'reviewed_at' => 'datetime',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
            'posted_at' => 'datetime',
            'reversed_at' => 'datetime',
        ];
    }

    public static function nextNumber(string $type): string
    {
        $prefix = match ($type) {
            'expense' => 'EXP',
            'equity' => 'EQT',
            'customer_advance' => 'ADV',
            'deposit_refund' => 'RFD',
            'customer_refund' => 'RFD',
            'employee_advance' => 'EAD',
            'final_settlement' => 'EXP',
            default => 'INC',
        };

        return $prefix.'-'.now()->format('Ymd').'-'.str_pad((string) ((self::query()->max('id') ?? 0) + 1), 5, '0', STR_PAD_LEFT);
    }

    public function postToAccount(): void
    {
        if (! $this->accounting_account_id || $this->posted_at) {
            return;
        }

        DB::transaction(function (): void {
            $account = AccountingAccount::query()->lockForUpdate()->find($this->accounting_account_id);
            if (! $account) {
                return;
            }

            $amount = (float) $this->amount;
            $nextBalance = (float) $account->current_balance + ($this->isAccountInflow() ? $amount : -$amount);

            $account->update(['current_balance' => $nextBalance]);
            $this->forceFill(['posted_at' => now(), 'reversed_at' => null])->save();
        });
    }

    public function reverseFromAccount(): void
    {
        if (! $this->accounting_account_id || ! $this->posted_at || $this->reversed_at) {
            return;
        }

        DB::transaction(function (): void {
            $account = AccountingAccount::query()->lockForUpdate()->find($this->accounting_account_id);
            if (! $account) {
                return;
            }

            $amount = (float) $this->amount;
            $nextBalance = (float) $account->current_balance + ($this->isAccountInflow() ? -$amount : $amount);

            $account->update(['current_balance' => $nextBalance]);
            $this->forceFill(['reversed_at' => now()])->save();
        });
    }

    public function isAccountInflow(): bool
    {
        return in_array($this->type, ['income', 'customer_advance'], true);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(FinancialCategory::class, 'financial_category_id');
    }

    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(AccountingAccount::class, 'accounting_account_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function supplierInstallment(): BelongsTo
    {
        return $this->belongsTo(SupplierInstallment::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
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
