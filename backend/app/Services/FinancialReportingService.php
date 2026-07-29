<?php

namespace App\Services;

use App\Models\AccountingAccount;
use App\Models\AccountingTransaction;
use App\Models\AccountReconciliation;
use App\Models\Customer;
use App\Models\CustomerCharge;
use App\Models\CustomerDeposit;
use App\Models\FinancialPeriodClosing;
use App\Models\Invoice;
use App\Models\PayrollRun;
use App\Models\ShareholderDistribution;
use Carbon\Carbon;

class FinancialReportingService
{
    public function bookBalance(AccountingAccount $account, string $throughDate): float
    {
        $income = $account->transactions()->where('status', 'approved')->whereIn('type', ['income', 'customer_advance'])->whereDate('transaction_date', '<=', $throughDate)->sum('amount');
        $outflow = $account->transactions()->where('status', 'approved')->whereIn('type', ['expense', 'equity', 'deposit_refund', 'customer_refund'])->whereDate('transaction_date', '<=', $throughDate)->sum('amount');

        return round((float) $account->opening_balance + (float) $income - (float) $outflow, 2);
    }

    public function periodSnapshot(string $start, string $end): array
    {
        $approved = AccountingTransaction::query()
            ->where('status', 'approved')
            ->whereDate('transaction_date', '>=', $start)
            ->whereDate('transaction_date', '<=', $end);
        $income = (float) (clone $approved)->where('type', 'income')->sum('amount');
        $expense = (float) (clone $approved)->where('type', 'expense')->sum('amount');
        $payroll = (float) (clone $approved)->where('type', 'expense')->where('source_type', 'payroll_run')->sum('amount');
        $depositsReceived = (float) (clone $approved)->where('type', 'customer_advance')->sum('amount');
        $depositsRefunded = (float) (clone $approved)->where('type', 'deposit_refund')->sum('amount');
        $customerPaymentsRefunded = (float) (clone $approved)->where('type', 'customer_refund')->sum('amount');

        $balances = AccountingAccount::query()->where('status', 'active')->get()->mapWithKeys(
            fn (AccountingAccount $account): array => [$account->id => $this->bookBalance($account, $end)],
        );

        return [
            'period_start' => $start,
            'period_end' => $end,
            'total_income' => round($income, 2),
            'total_expense' => round($expense, 2),
            'payroll_expense' => round($payroll, 2),
            'net_income' => round($income - $expense - $customerPaymentsRefunded, 2),
            'customer_deposits_received' => round($depositsReceived, 2),
            'customer_deposits_refunded' => round($depositsRefunded, 2),
            'customer_payments_refunded' => round($customerPaymentsRefunded, 2),
            'customer_deposit_liability' => round((float) CustomerDeposit::query()->whereIn('status', ['pending', 'refund_required', 'partially_applied'])->get()->sum(fn (CustomerDeposit $deposit): float => $deposit->availableAmount()), 2),
            'customer_deposits_requiring_refund' => round((float) CustomerDeposit::query()->where('status', 'refund_required')->get()->sum(fn (CustomerDeposit $deposit): float => $deposit->availableAmount()), 2),
            'receivables' => round(
                (float) Invoice::query()
                    ->whereIn('status', ['unpaid', 'partially_paid', 'overdue'])
                    ->sum('remaining_amount')
                + (float) CustomerCharge::query()
                    ->whereNull('invoice_id')
                    ->where('status', 'posted')
                    ->sum('remaining_amount'),
                2,
            ),
            // Retained as zero for historical monthly-closing schema compatibility.
            'supplier_payables' => 0.0,
            'cash_balance' => round((float) AccountingAccount::query()->whereIn('id', $balances->keys())->whereIn('type', ['cash', 'mobile_money', 'check', 'online'])->get()->sum(fn (AccountingAccount $account): float => (float) ($balances[$account->id] ?? 0)), 2),
            'bank_balance' => round((float) AccountingAccount::query()->whereIn('id', $balances->keys())->where('type', 'bank')->get()->sum(fn (AccountingAccount $account): float => (float) ($balances[$account->id] ?? 0)), 2),
            'reconciliation_complete' => $this->reconciliationsComplete($end),
        ];
    }

    public function reconciliationsComplete(string $end): bool
    {
        $required = AccountingAccount::query()
            ->where('status', 'active')
            ->whereIn('type', ['cash', 'bank', 'mobile_money', 'check', 'online'])
            ->where(function ($query) use ($end): void {
                $query->where('opening_balance', '!=', 0)
                    ->orWhereHas('transactions', fn ($transactions) => $transactions->where('status', 'approved')->whereDate('transaction_date', '<=', $end));
            })
            ->pluck('id');

        if ($required->isEmpty()) {
            return true;
        }

        $approved = AccountReconciliation::query()
            ->whereIn('accounting_account_id', $required)
            ->whereDate('period_end', $end)
            ->where('status', 'approved')
            ->distinct()
            ->count('accounting_account_id');

        return $approved === $required->count();
    }

    public function report(string $from, string $to, ?int $accountId = null): array
    {
        $snapshot = $this->periodSnapshot($from, $to);
        $transactions = AccountingTransaction::query()
            ->with(['category:id,name,type', 'account:id,name,code,type', 'paymentMethod:id,name,code'])
            ->where('status', 'approved')
            ->whereDate('transaction_date', '>=', $from)
            ->whereDate('transaction_date', '<=', $to)
            ->when($accountId, fn ($query) => $query->where('accounting_account_id', $accountId))
            ->orderBy('transaction_date')
            ->orderBy('id')
            ->get();

        $grouped = fn (string $type) => $transactions->where('type', $type)->groupBy(fn ($transaction) => $transaction->category?->name ?? 'Uncategorized')->map(fn ($items, $name): array => [
            'name' => $name,
            'amount' => round((float) $items->sum('amount'), 2),
        ])->values();

        $cashFlow = $transactions->groupBy(fn ($transaction) => $transaction->transaction_date->toDateString())->map(function ($items, $date): array {
            $cashItems = $items->whereNotNull('accounting_account_id');
            $income = (float) $cashItems->whereIn('type', ['income', 'customer_advance'])->sum('amount');
            $outflow = (float) $cashItems->whereIn('type', ['expense', 'equity', 'deposit_refund', 'customer_refund'])->sum('amount');

            return ['date' => $date, 'income' => $income, 'outflow' => $outflow, 'net' => $income - $outflow];
        })->values();

        return [
            'filters' => ['from' => $from, 'to' => $to, 'account_id' => $accountId],
            'summary' => $snapshot + [
                'shareholder_payments' => round((float) $transactions->where('type', 'equity')->sum('amount'), 2),
                'net_cash_flow' => round((float) $transactions->whereNotNull('accounting_account_id')->whereIn('type', ['income', 'customer_advance'])->sum('amount') - (float) $transactions->whereNotNull('accounting_account_id')->whereIn('type', ['expense', 'equity', 'deposit_refund', 'customer_refund'])->sum('amount'), 2),
            ],
            'income_by_category' => $grouped('income'),
            'expense_by_category' => $grouped('expense'),
            'cash_flow' => $cashFlow,
            'accounts' => AccountingAccount::query()->orderBy('type')->orderBy('name')->get()->map(fn (AccountingAccount $account): array => [
                'id' => $account->id,
                'name' => $account->name,
                'code' => $account->code,
                'type' => $account->type,
                'opening_balance' => (float) $account->opening_balance,
                'closing_balance' => $this->bookBalance($account, $to),
            ]),
            'ledger' => $transactions,
            'receivables' => Customer::query()->where('current_balance', '>', 0)->with('serviceArea:id,name')->orderByDesc('current_balance')->get(['id', 'name', 'phone', 'service_area_id', 'current_balance']),
            'supplier_payables' => [],
            'payroll' => PayrollRun::query()->with('creator:id,name')->whereDate('payment_date', '>=', $from)->whereDate('payment_date', '<=', $to)->latest('payment_date')->get(),
            'shareholder_distributions' => ShareholderDistribution::query()->with(['closing:id,period_code,period_start,period_end', 'items.shareholder:id,name'])->whereHas('closing', fn ($query) => $query->whereDate('period_end', '>=', $from)->whereDate('period_end', '<=', $to))->latest()->get(),
            'reconciliations' => AccountReconciliation::query()->with('account:id,name,code,type')->whereDate('period_end', '>=', $from)->whereDate('period_end', '<=', $to)->latest('period_end')->get(),
            'closings' => FinancialPeriodClosing::query()->whereDate('period_end', '>=', $from)->whereDate('period_end', '<=', $to)->latest('period_end')->get(),
            'generated_at' => Carbon::now()->toIso8601String(),
        ];
    }
}
