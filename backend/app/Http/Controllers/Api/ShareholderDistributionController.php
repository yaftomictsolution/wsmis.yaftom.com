<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingTransaction;
use App\Models\FinancialCategory;
use App\Models\FinancialPeriodClosing;
use App\Models\Shareholder;
use App\Models\ShareholderDistribution;
use App\Models\ShareholderDistributionItem;
use App\Models\ShareholderPayment;
use App\Services\AccountingWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ShareholderDistributionController extends Controller
{
    public function __construct(private readonly AccountingWorkflowService $workflow) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeCreate($request);

        return response()->json(['data' => ShareholderDistribution::with($this->relations())->latest()->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeCreate($request);
        $data = $request->validate([
            'financial_period_closing_id' => ['required', 'integer', 'exists:financial_period_closings,id', 'unique:shareholder_distributions,financial_period_closing_id'],
            'distributable_amount' => ['nullable', 'numeric', 'gt:0'],
            'notes' => ['nullable', 'string'],
        ]);

        $closing = FinancialPeriodClosing::query()->findOrFail($data['financial_period_closing_id']);
        abort_unless($closing->status === 'closed', 422, 'Only a closed financial period can be distributed.');
        abort_if((float) $closing->distributable_profit <= 0, 422, 'This period has no distributable profit.');

        $amount = round((float) ($data['distributable_amount'] ?? $closing->distributable_profit), 2);
        if ($amount > (float) $closing->distributable_profit) {
            throw ValidationException::withMessages(['distributable_amount' => ['Distribution cannot exceed the period distributable profit.']]);
        }

        $shareholders = Shareholder::query()->where('status', 'active')->orderBy('id')->get();
        $ownership = (float) $shareholders->sum('ownership_percentage');
        if ($shareholders->isEmpty() || abs($ownership - 100) > 0.01) {
            throw ValidationException::withMessages(['shareholders' => ['Active shareholder ownership must total exactly 100% before creating a distribution.']]);
        }

        $distribution = DB::transaction(function () use ($request, $data, $amount, $shareholders): ShareholderDistribution {
            $distribution = ShareholderDistribution::query()->create([
                'financial_period_closing_id' => $data['financial_period_closing_id'],
                'created_by' => $request->user()->id,
                'distribution_number' => ShareholderDistribution::nextNumber(),
                'distributable_amount' => $amount,
                'allocated_amount' => $amount,
                'status' => 'draft',
                'notes' => $data['notes'] ?? null,
            ]);

            $allocated = 0.0;
            foreach ($shareholders as $index => $shareholder) {
                $entitlement = $index === $shareholders->count() - 1
                    ? round($amount - $allocated, 2)
                    : round($amount * ((float) $shareholder->ownership_percentage / 100), 2);
                $allocated += $entitlement;
                $distribution->items()->create([
                    'shareholder_id' => $shareholder->id,
                    'percentage_snapshot' => $shareholder->ownership_percentage,
                    'entitlement_amount' => $entitlement,
                    'status' => 'pending',
                ]);
            }

            return $distribution;
        });

        return response()->json(['data' => $distribution->load($this->relations())], 201);
    }

    public function submit(Request $request, ShareholderDistribution $shareholderDistribution): JsonResponse
    {
        $this->authorizeCreate($request);
        abort_unless(in_array($shareholderDistribution->status, ['draft', 'rejected'], true), 422, 'Only draft or rejected distributions can be submitted.');
        $shareholderDistribution->update([
            'status' => 'pending_review',
            'submitted_at' => now(),
            'rejection_reason' => null,
            'rejected_by' => null,
            'rejected_at' => null,
        ]);

        return response()->json(['data' => $shareholderDistribution->fresh()->load($this->relations())]);
    }

    public function destroy(Request $request, ShareholderDistribution $shareholderDistribution): JsonResponse
    {
        $this->authorizeCreate($request);
        abort_unless(in_array($shareholderDistribution->status, ['draft', 'rejected'], true), 422, 'Only draft or rejected distributions can be deleted.');
        abort_if($shareholderDistribution->items()->whereHas('payments')->exists(), 422, 'A distribution with payment history cannot be deleted.');
        $shareholderDistribution->delete();

        return response()->json(['message' => 'Distribution deleted.']);
    }

    public function review(Request $request, ShareholderDistribution $shareholderDistribution): JsonResponse
    {
        $this->authorizeReview($request);
        abort_unless($shareholderDistribution->status === 'pending_review', 422, 'Only distributions awaiting review can be reviewed.');
        $shareholderDistribution->update(['status' => 'pending_approval', 'reviewed_by' => $request->user()->id, 'reviewed_at' => now()]);

        return response()->json(['data' => $shareholderDistribution->fresh()->load($this->relations())]);
    }

    public function approve(Request $request, ShareholderDistribution $shareholderDistribution): JsonResponse
    {
        $this->authorizeApprove($request);
        abort_unless(in_array($shareholderDistribution->status, ['pending_review', 'pending_approval'], true), 422, 'Only pending distributions can be approved.');
        $updates = ['status' => 'approved', 'approved_by' => $request->user()->id, 'approved_at' => now()];
        if (! $shareholderDistribution->reviewed_by) {
            $updates += ['reviewed_by' => $request->user()->id, 'reviewed_at' => now()];
        }
        $shareholderDistribution->update($updates);

        return response()->json(['data' => $shareholderDistribution->fresh()->load($this->relations())]);
    }

    public function reject(Request $request, ShareholderDistribution $shareholderDistribution): JsonResponse
    {
        $this->authorizeApprove($request);
        abort_unless(in_array($shareholderDistribution->status, ['pending_review', 'pending_approval'], true), 422, 'Only pending distributions can be rejected.');
        $data = $request->validate(['rejection_reason' => ['required', 'string', 'max:1000']]);
        $shareholderDistribution->update(['status' => 'rejected', 'rejected_by' => $request->user()->id, 'rejected_at' => now(), 'rejection_reason' => $data['rejection_reason']]);

        return response()->json(['data' => $shareholderDistribution->fresh()->load($this->relations())]);
    }

    public function pay(Request $request, ShareholderDistributionItem $shareholderDistributionItem): JsonResponse
    {
        $this->authorizeCreate($request);
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'payment_date' => ['required', 'date', 'before_or_equal:today'],
            'payment_method_id' => ['required', 'integer', 'exists:payment_methods,id'],
            'accounting_account_id' => ['required', 'integer', 'exists:accounting_accounts,id'],
            'receipt_number' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $shareholderDistributionItem->loadMissing(['distribution.closing', 'shareholder']);
        abort_unless(in_array($shareholderDistributionItem->distribution->status, ['approved', 'partially_paid'], true), 422, 'The distribution must be approved before payments can be created.');
        $this->workflow->ensureDateIsOpen($data['payment_date']);
        $this->workflow->ensureCompatibleAccount((int) $data['payment_method_id'], (int) $data['accounting_account_id']);

        $pending = (float) $shareholderDistributionItem->payments()->whereIn('status', ['pending_review', 'pending_approval'])->sum('amount');
        $available = (float) $shareholderDistributionItem->remaining_amount - $pending;
        if ((float) $data['amount'] > $available + 0.005) {
            throw ValidationException::withMessages(['amount' => ['Payment exceeds the shareholder remaining entitlement after pending payments.']]);
        }

        $payment = DB::transaction(function () use ($request, $data, $shareholderDistributionItem): ShareholderPayment {
            $category = FinancialCategory::query()->firstOrCreate(
                ['code' => 'shareholder_distribution'],
                ['name' => 'Shareholder Distribution', 'type' => 'expense', 'status' => 'active'],
            );
            $payment = ShareholderPayment::query()->create([
                'shareholder_distribution_item_id' => $shareholderDistributionItem->id,
                'accounting_account_id' => $data['accounting_account_id'],
                'payment_method_id' => $data['payment_method_id'],
                'created_by' => $request->user()->id,
                'payment_number' => ShareholderPayment::nextNumber(),
                'amount' => $data['amount'],
                'payment_date' => $data['payment_date'],
                'receipt_number' => $data['receipt_number'] ?? null,
                'status' => 'pending_review',
                'notes' => $data['notes'] ?? null,
            ]);
            $transaction = AccountingTransaction::query()->create([
                'financial_category_id' => $category->id,
                'payment_method_id' => $data['payment_method_id'],
                'accounting_account_id' => $data['accounting_account_id'],
                'recorded_by' => $request->user()->id,
                'transaction_number' => AccountingTransaction::nextNumber('equity'),
                'type' => 'equity',
                'title' => 'Shareholder distribution - '.$shareholderDistributionItem->distribution->distribution_number,
                'amount' => $data['amount'],
                'paid_to' => $shareholderDistributionItem->shareholder->name,
                'transaction_date' => $data['payment_date'],
                'receipt_number' => $data['receipt_number'] ?? null,
                'reference' => $payment->payment_number,
                'source_type' => 'shareholder_payment',
                'source_id' => $payment->id,
                'status' => 'pending_review',
                'description' => $data['notes'] ?? null,
            ]);
            $payment->update(['accounting_transaction_id' => $transaction->id]);

            return $payment;
        });

        return response()->json(['data' => $payment->load(['distributionItem.shareholder', 'account', 'paymentMethod', 'transaction'])], 201);
    }

    private function relations(): array
    {
        return ['closing:id,period_code,period_start,period_end,net_income,distributable_profit,status', 'items.shareholder:id,shareholder_number,name,phone,ownership_percentage', 'items.payments.account:id,name,code,type', 'items.payments.paymentMethod:id,name,code', 'items.payments.transaction:id,transaction_number,status', 'creator:id,name', 'reviewer:id,name', 'approver:id,name'];
    }

    private function authorizeCreate(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['Accountant', 'Manager', 'Admin', 'Super Admin']), 403, 'You cannot manage shareholder distributions.');
    }

    private function authorizeReview(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['Manager', 'Admin', 'Super Admin']), 403, 'Only managers or admins can review distributions.');
    }

    private function authorizeApprove(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['Admin', 'Super Admin']), 403, 'Only admins can approve distributions.');
    }
}
