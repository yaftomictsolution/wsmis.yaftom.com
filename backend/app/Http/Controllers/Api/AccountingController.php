<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingAccount;
use App\Models\AccountingTransaction;
use App\Models\CustomerDeposit;
use App\Models\FinancialCategory;
use App\Models\Invoice;
use App\Services\AccountingWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AccountingController extends Controller
{
    public function __construct(private readonly AccountingWorkflowService $workflow) {}

    public function summary(Request $request): JsonResponse
    {
        $this->authorizeView($request);
        $today = now()->toDateString();
        $monthStart = now()->startOfMonth()->toDateString();
        $monthEnd = now()->endOfMonth()->toDateString();
        $approved = AccountingTransaction::query()->where('status', 'approved');
        $todayIncome = (float) (clone $approved)->where('type', 'income')->whereDate('transaction_date', $today)->sum('amount');
        $todayExpense = (float) (clone $approved)->where('type', 'expense')->whereDate('transaction_date', $today)->sum('amount');
        $monthlyIncome = (float) (clone $approved)->where('type', 'income')->whereBetween('transaction_date', [$monthStart, $monthEnd])->sum('amount');
        $monthlyExpense = (float) (clone $approved)->where('type', 'expense')->whereBetween('transaction_date', [$monthStart, $monthEnd])->sum('amount');

        return response()->json(['data' => [
            'opening_balance' => (float) AccountingAccount::query()->sum('opening_balance'),
            'cash_balance' => (float) AccountingAccount::query()->whereIn('type', ['cash', 'mobile_money', 'check', 'online'])->sum('current_balance'),
            'bank_balance' => (float) AccountingAccount::query()->where('type', 'bank')->sum('current_balance'),
            'available_balance' => (float) AccountingAccount::query()->sum('current_balance'),
            'today_income' => $todayIncome,
            'today_expense' => $todayExpense,
            'monthly_income' => $monthlyIncome,
            'monthly_expense' => $monthlyExpense,
            'monthly_net_income' => round($monthlyIncome - $monthlyExpense, 2),
            'pending_customer_payments' => (float) Invoice::query()->whereIn('status', ['unpaid', 'partially_paid', 'overdue'])->sum('remaining_amount'),
            'pending_expenses' => (float) AccountingTransaction::query()->where('type', 'expense')->whereIn('status', ['pending_review', 'pending_approval'])->sum('amount'),
            'quarter_net_income' => $this->quarterNetIncome(),
            'customer_deposit_liability' => (float) CustomerDeposit::query()->whereIn('status', ['pending', 'refund_required', 'partially_applied'])->get()->sum(fn (CustomerDeposit $deposit): float => $deposit->availableAmount()),
            'customer_deposits_requiring_refund' => (float) CustomerDeposit::query()->where('status', 'refund_required')->get()->sum(fn (CustomerDeposit $deposit): float => $deposit->availableAmount()),
        ]]);
    }

    public function accounts(Request $request): JsonResponse
    {
        $this->authorizeView($request);
        $accounts = AccountingAccount::query()
            ->withSum(['transactions as total_income' => fn ($query) => $query->where('status', 'approved')->where('type', 'income')], 'amount')
            ->withSum(['transactions as total_expense' => fn ($query) => $query->where('status', 'approved')->where('type', 'expense')], 'amount')
            ->withSum(['transactions as total_equity' => fn ($query) => $query->where('status', 'approved')->where('type', 'equity')], 'amount')
            ->withSum(['transactions as total_customer_advances' => fn ($query) => $query->where('status', 'approved')->where('type', 'customer_advance')], 'amount')
            ->withSum(['transactions as total_deposit_refunds' => fn ($query) => $query->where('status', 'approved')->where('type', 'deposit_refund')], 'amount')
            ->withMax(['transactions as last_transaction_at' => fn ($query) => $query->where('status', 'approved')], 'transaction_date')
            ->orderBy('type')->orderBy('name')->get();

        return response()->json(['data' => $accounts]);
    }

    public function storeAccount(Request $request): JsonResponse
    {
        $this->authorizeView($request);
        $data = $this->validateAccount($request);
        $opening = (float) ($data['opening_balance'] ?? 0);
        $account = AccountingAccount::query()->create($data + ['opening_balance' => $opening, 'current_balance' => $opening, 'status' => $data['status'] ?? 'active']);

        return response()->json(['data' => $account], 201);
    }

    public function updateAccount(Request $request, AccountingAccount $accountingAccount): JsonResponse
    {
        $this->authorizeView($request);
        $data = $this->validateAccount($request, $accountingAccount);
        if ($accountingAccount->transactions()->exists() && array_key_exists('opening_balance', $data) && abs((float) $data['opening_balance'] - (float) $accountingAccount->opening_balance) > 0.005) {
            throw ValidationException::withMessages(['opening_balance' => ['Opening balance cannot be changed after transactions have been posted.']]);
        }
        $accountingAccount->update($data);

        return response()->json(['data' => $accountingAccount->fresh()]);
    }

    public function destroyAccount(Request $request, AccountingAccount $accountingAccount): JsonResponse
    {
        $this->authorizeView($request);
        abort_if($accountingAccount->transactions()->exists(), 422, 'An account with transaction history cannot be deleted. Set it inactive instead.');
        abort_if(abs((float) $accountingAccount->current_balance) > 0.005, 422, 'Move or reconcile the account balance to zero before deleting it.');
        $accountingAccount->delete();

        return response()->json(['message' => 'Account deleted.']);
    }

    public function transactions(Request $request): JsonResponse
    {
        $this->authorizeView($request);
        $transactions = AccountingTransaction::with($this->transactionRelations())
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')))
            ->when($request->filled('account_id'), fn ($query) => $query->where('accounting_account_id', $request->integer('account_id')))
            ->when($request->filled('from'), fn ($query) => $query->whereDate('transaction_date', '>=', $request->input('from')))
            ->when($request->filled('to'), fn ($query) => $query->whereDate('transaction_date', '<=', $request->input('to')))
            ->latest('transaction_date')->latest()->get();

        return response()->json(['data' => $transactions]);
    }

    public function expenses(Request $request): JsonResponse
    {
        $this->authorizeView($request);
        $perPage = min(max($request->integer('per_page', 20), 10), 100);
        $search = trim($request->string('search')->toString());
        $expenses = AccountingTransaction::query()
            ->with($this->transactionRelations())
            ->where('type', 'expense')
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('account_id'), fn ($query) => $query->where('accounting_account_id', $request->integer('account_id')))
            ->when($request->filled('from'), fn ($query) => $query->whereDate('transaction_date', '>=', $request->input('from')))
            ->when($request->filled('to'), fn ($query) => $query->whereDate('transaction_date', '<=', $request->input('to')))
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($builder) use ($search): void {
                    $builder->where('transaction_number', 'like', "%{$search}%")
                        ->orWhere('title', 'like', "%{$search}%")
                        ->orWhere('paid_to', 'like', "%{$search}%")
                        ->orWhere('reference', 'like', "%{$search}%");
                });
            })
            ->latest('transaction_date')
            ->latest('id')
            ->paginate($perPage);

        return response()->json($expenses);
    }

    public function storeTransaction(Request $request): JsonResponse
    {
        $this->authorizeView($request);
        $data = $this->validateTransaction($request);
        $this->workflow->ensureDateIsOpen($data['transaction_date']);
        $this->workflow->ensureCompatibleAccount((int) $data['payment_method_id'], (int) $data['accounting_account_id']);

        $category = FinancialCategory::query()->findOrFail($data['financial_category_id']);
        if ($category->type !== $data['type']) {
            throw ValidationException::withMessages(['financial_category_id' => ['The category type must match the transaction type.']]);
        }
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $data['attachment_path'] = $file->store('accounting-attachments', 'public');
            $data['attachment_original_name'] = $file->getClientOriginalName();
        }
        unset($data['attachment']);

        $transaction = AccountingTransaction::query()->create($data + [
            'transaction_number' => AccountingTransaction::nextNumber($data['type']),
            'recorded_by' => $request->user()?->id,
            'source_type' => 'manual',
            'status' => 'pending_review',
        ]);

        return response()->json(['data' => $transaction->load($this->transactionRelations())], 201);
    }

    public function updateTransaction(Request $request, AccountingTransaction $accountingTransaction): JsonResponse
    {
        $this->authorizeView($request);
        abort_unless(
            in_array($accountingTransaction->source_type, [null, 'manual'], true),
            422,
            'Automatic expenses must be edited from their source module.',
        );
        abort_unless(
            in_array($accountingTransaction->status, ['pending_review', 'rejected'], true),
            422,
            'Only expenses awaiting review or rejected expenses can be edited.',
        );

        $data = $this->validateTransaction($request);
        if ($data['type'] !== $accountingTransaction->type) {
            throw ValidationException::withMessages(['type' => ['The transaction type cannot be changed.']]);
        }
        $this->workflow->ensureDateIsOpen($data['transaction_date']);
        $this->workflow->ensureCompatibleAccount((int) $data['payment_method_id'], (int) $data['accounting_account_id']);
        $category = FinancialCategory::query()->findOrFail($data['financial_category_id']);
        if ($category->type !== $data['type']) {
            throw ValidationException::withMessages(['financial_category_id' => ['The category type must match the transaction type.']]);
        }

        $oldPath = $accountingTransaction->attachment_path;
        $newPath = null;
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $newPath = $file->store('accounting-attachments', 'public');
            $data['attachment_path'] = $newPath;
            $data['attachment_original_name'] = $file->getClientOriginalName();
        }
        unset($data['attachment']);

        try {
            DB::transaction(function () use ($accountingTransaction, $data): void {
                $accountingTransaction->update($data + [
                    'status' => 'pending_review',
                    'reviewed_by' => null,
                    'approved_by' => null,
                    'rejected_by' => null,
                    'reviewed_at' => null,
                    'approved_at' => null,
                    'rejected_at' => null,
                    'rejection_reason' => null,
                    'reversal_reason' => null,
                ]);
            });
        } catch (\Throwable $exception) {
            if ($newPath) {
                Storage::disk('public')->delete($newPath);
            }
            throw $exception;
        }

        if ($newPath && $oldPath && $oldPath !== $newPath) {
            Storage::disk('public')->delete($oldPath);
        }

        return response()->json(['data' => $accountingTransaction->fresh()->load($this->transactionRelations())]);
    }

    public function destroyTransaction(Request $request, AccountingTransaction $accountingTransaction): JsonResponse
    {
        $this->authorizeView($request);
        abort_unless(
            in_array($accountingTransaction->source_type, [null, 'manual'], true),
            422,
            'Automatic expenses cannot be deleted from accounting.',
        );
        abort_unless(
            in_array($accountingTransaction->status, ['pending_review', 'rejected'], true)
                && ! $accountingTransaction->posted_at,
            422,
            'Only unposted expenses awaiting review or rejected expenses can be deleted.',
        );

        $attachment = $accountingTransaction->attachment_path;
        $accountingTransaction->delete();
        if ($attachment) {
            Storage::disk('public')->delete($attachment);
        }

        return response()->json(['message' => 'Expense deleted.']);
    }

    public function review(Request $request, AccountingTransaction $accountingTransaction): JsonResponse
    {
        $this->authorizeReview($request);
        $transaction = $this->workflow->review($accountingTransaction, $request->user());

        return response()->json(['data' => $transaction->load($this->transactionRelations())]);
    }

    public function approve(Request $request, AccountingTransaction $accountingTransaction): JsonResponse
    {
        $this->authorizeApprove($request);
        $transaction = $this->workflow->approve($accountingTransaction, $request->user());

        return response()->json(['data' => $transaction->load($this->transactionRelations())]);
    }

    public function reject(Request $request, AccountingTransaction $accountingTransaction): JsonResponse
    {
        $this->authorizeApprove($request);
        $data = $request->validate(['rejection_reason' => ['required', 'string', 'max:1000']]);
        $transaction = $this->workflow->reject($accountingTransaction, $request->user(), $data['rejection_reason']);

        return response()->json(['data' => $transaction->load($this->transactionRelations())]);
    }

    public function cancel(Request $request, AccountingTransaction $accountingTransaction): JsonResponse
    {
        $this->authorizeApprove($request);
        abort_if(in_array($accountingTransaction->source_type, ['customer_payment', 'customer_payment_allocation', 'customer_payment_refund', 'customer_deposit', 'customer_deposit_refund', 'customer_deposit_application'], true), 422, 'This automatic customer transaction must be managed from its customer workflow.');
        $data = $request->validate(['reversal_reason' => ['nullable', 'string', 'max:1000']]);
        $accountingTransaction->forceFill(['reversal_reason' => $data['reversal_reason'] ?? null])->save();
        $transaction = $this->workflow->cancel($accountingTransaction);

        return response()->json(['data' => $transaction->load($this->transactionRelations())]);
    }

    public function downloadAttachment(Request $request, AccountingTransaction $accountingTransaction)
    {
        $this->authorizeView($request);
        abort_unless($accountingTransaction->attachment_path && Storage::disk('public')->exists($accountingTransaction->attachment_path), 404, 'Attachment not found.');

        return Storage::disk('public')->download($accountingTransaction->attachment_path, $accountingTransaction->attachment_original_name ?: basename($accountingTransaction->attachment_path));
    }

    private function validateAccount(Request $request, ?AccountingAccount $account = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:100', Rule::unique('accounting_accounts', 'code')->ignore($account?->id)],
            'type' => ['required', Rule::in(['cash', 'bank', 'mobile_money', 'check', 'online', 'other'])],
            'opening_balance' => ['nullable', 'numeric'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'notes' => ['nullable', 'string'],
        ]);
    }

    private function validateTransaction(Request $request): array
    {
        return $request->validate([
            'type' => ['required', Rule::in(['income', 'expense'])],
            'financial_category_id' => ['required', 'integer', 'exists:financial_categories,id'],
            'payment_method_id' => ['required', 'integer', 'exists:payment_methods,id'],
            'accounting_account_id' => ['required', 'integer', 'exists:accounting_accounts,id'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'title' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'received_from' => ['nullable', 'string', 'max:255'],
            'paid_to' => ['nullable', 'string', 'max:255'],
            'transaction_date' => ['required', 'date'],
            'receipt_number' => ['nullable', 'string', 'max:255'],
            'reference' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'attachment' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,doc,docx', 'max:10240'],
        ]);
    }

    private function transactionRelations(): array
    {
        return ['category:id,name,type', 'paymentMethod:id,name,code', 'account:id,name,code,type,current_balance', 'customer:id,name,phone,house_number', 'supplier:id,name,supplier_type', 'supplierInstallment:id,installment_number,due_date,status', 'recorder:id,name', 'reviewer:id,name', 'approver:id,name', 'rejector:id,name'];
    }

    private function authorizeReview(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['Manager', 'Admin', 'Super Admin']), 403, 'Only managers or admins can review accounting transactions.');
    }

    private function authorizeView(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['Accountant', 'Manager', 'Admin', 'Super Admin']), 403, 'You cannot access financial accounting.');
    }

    private function authorizeApprove(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['Admin', 'Super Admin']), 403, 'Only admins can approve accounting transactions.');
    }

    private function quarterNetIncome(): float
    {
        $start = now()->startOfQuarter()->toDateString();
        $end = now()->endOfQuarter()->toDateString();
        $income = (float) AccountingTransaction::query()->where('status', 'approved')->where('type', 'income')->whereBetween('transaction_date', [$start, $end])->sum('amount');
        $expense = (float) AccountingTransaction::query()->where('status', 'approved')->where('type', 'expense')->whereBetween('transaction_date', [$start, $end])->sum('amount');

        return round($income - $expense, 2);
    }
}
