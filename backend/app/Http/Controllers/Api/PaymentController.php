<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingAccount;
use App\Models\AccountingTransaction;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Services\AccountingWorkflowService;
use App\Services\CustomerBillingService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PaymentController extends Controller
{
    public function __construct(
        private readonly AccountingWorkflowService $workflow,
        private readonly CustomerBillingService $billing,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeView($request);

        return response()->json([
            'data' => Payment::with($this->relations())->latest('paid_at')->latest()->get(),
        ]);
    }

    public function receivingAccounts(Request $request): JsonResponse
    {
        $this->authorizeCreate($request);

        return response()->json([
            'data' => AccountingAccount::query()
                ->where('status', 'active')
                ->orderBy('type')
                ->orderBy('name')
                ->get(['id', 'name', 'code', 'type', 'current_balance', 'status']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeCreate($request);

        $data = $request->validate([
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'payment_method_id' => ['required', 'integer', 'exists:payment_methods,id'],
            'accounting_account_id' => ['required', 'integer', 'exists:accounting_accounts,id'],
            'paid_at' => ['required', 'date', 'before_or_equal:today'],
            'idempotency_key' => ['nullable', 'string', 'max:100'],
            'discount_authority_id' => [
                'nullable',
                'integer',
                Rule::exists('authorities', 'id')->where('status', 'active'),
            ],
            'reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.type' => ['required', Rule::in(['invoice'])],
            'items.*.id' => ['required', 'integer'],
            'items.*.amount' => ['nullable', 'numeric', 'min:0'],
            'items.*.discount_amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        if ($existing = $this->idempotentPayment($data['idempotency_key'] ?? null, $request->user()->id)) {
            return response()->json(['data' => $existing]);
        }

        $this->workflow->ensureDateIsOpen($data['paid_at']);
        $this->workflow->ensureCompatibleAccount((int) $data['payment_method_id'], (int) $data['accounting_account_id']);

        try {
            $payment = DB::transaction(function () use ($request, $data): Payment {
                if ($existing = $this->idempotentPayment($data['idempotency_key'] ?? null, $request->user()->id, true)) {
                    return $existing;
                }

                $customer = Customer::query()->whereKey($data['customer_id'])->lockForUpdate()->firstOrFail();

                $allocations = $this->prepareAllocations(
                    $customer,
                    $data['items'],
                    $data['paid_at'],
                    isset($data['discount_authority_id']) ? (int) $data['discount_authority_id'] : null,
                );
                $totalAmount = round((float) collect($allocations)->sum('amount'), 2);
                $discountAmount = round((float) collect($allocations)->sum('discount_amount'), 2);
                $invoiceIds = collect($allocations)->pluck('invoice_id')->unique()->values();
                $contractIds = collect($allocations)->pluck('customer_contract_id')->filter()->unique()->values();

                $payment = Payment::query()->create([
                    'invoice_id' => $invoiceIds->first(),
                    'customer_id' => $customer->id,
                    'customer_contract_id' => $contractIds->count() === 1 ? $contractIds->first() : null,
                    'payment_method_id' => $data['payment_method_id'],
                    'accounting_account_id' => $data['accounting_account_id'],
                    'discount_authority_id' => $discountAmount > 0.005 ? $data['discount_authority_id'] : null,
                    'received_by' => $request->user()->id,
                    'receipt_number' => Payment::nextReceiptNumber(),
                    'idempotency_key' => $data['idempotency_key'] ?? null,
                    'amount' => $totalAmount,
                    'discount_amount' => $discountAmount,
                    'paid_at' => $data['paid_at'],
                    'reference' => $data['reference'] ?? null,
                    'status' => 'posted',
                    'notes' => $data['notes'] ?? null,
                ]);

                foreach ($allocations as $allocation) {
                    $payment->allocations()->create([
                        'invoice_id' => $allocation['invoice_id'],
                        'customer_charge_id' => null,
                        'amount' => $allocation['amount'],
                        'discount_amount' => $allocation['discount_amount'],
                    ]);
                }

                foreach ($invoiceIds as $invoiceId) {
                    $this->billing->syncInvoice((int) $invoiceId, $data['paid_at']);
                }
                $this->postPaymentToAccounting($payment);

                return $payment->load($this->relations());
            });
        } catch (QueryException $exception) {
            $existing = $this->idempotentPayment($data['idempotency_key'] ?? null, $request->user()->id);
            if ($exception->getCode() === '23000' && $existing) {
                return response()->json(['data' => $existing]);
            }

            throw $exception;
        }

        return response()->json(['data' => $payment], $payment->wasRecentlyCreated ? 201 : 200);
    }

    public function show(Request $request, Payment $payment): JsonResponse
    {
        $this->authorizeView($request);

        return response()->json([
            'data' => $payment->load([
                ...$this->relations(),
                'customer.serviceArea',
            ]),
        ]);
    }

    public function update(Request $request, Payment $payment): JsonResponse
    {
        $this->authorizeCancel($request);

        $data = $request->validate([
            'status' => ['required', Rule::in(['posted', 'cancelled'])],
            'notes' => ['nullable', 'string'],
        ]);

        abort_if($payment->status === 'cancelled', 422, 'This payment is already cancelled.');
        abort_if($payment->customer_deposit_id, 422, 'A payment created from a contract deposit cannot be cancelled from Payments. Use the contract refund workflow before installation.');
        abort_if($data['status'] !== 'cancelled', 422, 'Posted payments can only be cancelled.');
        $this->workflow->ensureDateIsOpen($payment->paid_at->toDateString());

        DB::transaction(function () use ($payment, $data): void {
            $payment = Payment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();
            $payment->load('allocations.charge');
            $payment->update([
                'status' => 'cancelled',
                'notes' => $data['notes'] ?? $payment->notes,
            ]);

            $invoiceIds = $payment->allocations
                ->map(fn (PaymentAllocation $allocation) => $allocation->invoice_id ?: $allocation->charge?->invoice_id)
                ->filter()
                ->unique()
                ->values();

            foreach ($invoiceIds as $invoiceId) {
                $this->billing->syncInvoice((int) $invoiceId);
            }

            foreach ($payment->allocations->whereNull('invoice_id') as $allocation) {
                $charge = $allocation->charge;
                if (! $charge || $charge->invoice_id) {
                    continue;
                }

                $paid = round((float) $charge->allocations()
                    ->whereHas('payment', fn ($query) => $query->where('status', 'posted'))
                    ->selectRaw('COALESCE(SUM(amount - refunded_amount), 0) as total')
                    ->value('total'), 2);
                $remaining = round(max(0, (float) $charge->amount - $paid), 2);
                $charge->update([
                    'paid_amount' => $paid,
                    'remaining_amount' => $remaining,
                    'paid_at' => $remaining <= 0.005 ? $charge->paid_at : null,
                ]);
            }

            $this->billing->syncCustomerBalance($payment->customer_id);
            $this->reversePaymentAccounting($payment);
        });

        return response()->json(['data' => $payment->fresh()->load($this->relations())]);
    }

    private function prepareAllocations(Customer $customer, array $items, string $paidAt, ?int $discountAuthorityId): array
    {
        $allocations = [];
        $seen = [];

        foreach ($items as $item) {
            $invoiceId = (int) $item['id'];
            if (isset($seen[$invoiceId])) {
                throw ValidationException::withMessages([
                    'items' => ['The same invoice cannot be selected twice.'],
                ]);
            }
            $seen[$invoiceId] = true;

            $invoice = Invoice::query()
                ->with('contract:id,status')
                ->where('customer_id', $customer->id)
                ->whereKey($invoiceId)
                ->lockForUpdate()
                ->firstOrFail();

            if ($invoice->invoice_type !== 'inventory' && ! $customer->contractAllowsWorkflow()) {
                abort(422, 'Customer contract must be confirmed before payment processing.');
            }
            if ($invoice->issue_date && $invoice->issue_date->toDateString() > $paidAt) {
                throw ValidationException::withMessages([
                    'paid_at' => ["Payment date cannot be before invoice {$invoice->invoice_number} was issued."],
                ]);
            }
            abort_if(in_array($invoice->status, ['paid', 'cancelled'], true), 422, 'Selected invoice is not payable.');
            if ($invoice->invoice_type === 'contract' && (! $invoice->contract || ! in_array($invoice->contract->status, ['installation_pending', 'active'], true))) {
                throw ValidationException::withMessages([
                    'items' => ['The contract invoice becomes payable after the customer contract is confirmed.'],
                ]);
            }

            $remainingAmount = (float) $invoice->remaining_amount;
            $discountAmount = round((float) ($item['discount_amount'] ?? 0), 2);
            if ($discountAmount > 0.005 && $invoice->invoice_type !== 'water') {
                throw ValidationException::withMessages([
                    'items' => ['Payment discounts can only be applied to meter-reading water invoices.'],
                ]);
            }
            if ($discountAmount > 0.005 && ! $discountAuthorityId) {
                throw ValidationException::withMessages([
                    'discount_authority_id' => ['Select the authority who granted this water bill discount.'],
                ]);
            }

            $amount = array_key_exists('amount', $item) && $item['amount'] !== null
                ? (float) $item['amount']
                : max(0, $remainingAmount - $discountAmount);
            $this->ensureAllocationAmount($amount, $discountAmount, $remainingAmount);

            $allocations[] = [
                'invoice_id' => $invoice->id,
                'customer_contract_id' => $invoice->customer_contract_id,
                'amount' => round($amount, 2),
                'discount_amount' => $discountAmount,
            ];
        }

        if (empty($allocations)) {
            throw ValidationException::withMessages([
                'items' => ['Select at least one payable invoice.'],
            ]);
        }

        return $allocations;
    }

    private function ensureAllocationAmount(float $amount, float $discountAmount, float $remainingAmount): void
    {
        if ($remainingAmount <= 0.005) {
            throw ValidationException::withMessages([
                'items' => ['Selected invoice is already paid.'],
            ]);
        }
        $settlementAmount = $amount + $discountAmount;
        if ($amount < 0 || $discountAmount < 0 || $settlementAmount <= 0 || $settlementAmount > $remainingAmount + 0.005) {
            throw ValidationException::withMessages([
                'items' => ['Cash received plus discount cannot be greater than the selected invoice remaining amount.'],
            ]);
        }
    }

    private function idempotentPayment(?string $key, int $userId, bool $lock = false): ?Payment
    {
        if (! $key) {
            return null;
        }

        $query = Payment::query()
            ->where('idempotency_key', $key)
            ->where('received_by', $userId);
        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first()?->load($this->relations());
    }

    private function postPaymentToAccounting(Payment $payment): void
    {
        $payment->loadMissing(['customer', 'allocations.invoice.items.category']);

        foreach ($payment->allocations as $allocation) {
            if (! $allocation->invoice) {
                continue;
            }

            foreach ($this->accountingSplits($allocation) as $split) {
                $transaction = AccountingTransaction::query()->firstOrCreate(
                    [
                        'source_type' => 'customer_payment_allocation',
                        'source_id' => $allocation->id,
                        'financial_category_id' => $split['category']->id,
                    ],
                    [
                        'payment_method_id' => $payment->payment_method_id,
                        'accounting_account_id' => $payment->accounting_account_id,
                        'customer_id' => $payment->customer_id,
                        'recorded_by' => $payment->received_by,
                        'reviewed_by' => $payment->received_by,
                        'approved_by' => $payment->received_by,
                        'transaction_number' => AccountingTransaction::nextNumber('income'),
                        'type' => 'income',
                        'title' => $allocation->invoice->invoice_number.' payment',
                        'amount' => $split['amount'],
                        'received_from' => $payment->customer?->name ?? 'Customer',
                        'transaction_date' => $payment->paid_at,
                        'receipt_number' => $payment->receipt_number,
                        'reference' => $payment->reference,
                        'status' => 'approved',
                        'reviewed_at' => now(),
                        'approved_at' => now(),
                        'description' => $payment->notes,
                    ],
                );

                if (! $transaction->posted_at) {
                    $transaction->postToAccount();
                }
            }
        }
    }

    private function accountingSplits(PaymentAllocation $allocation): Collection
    {
        $invoice = $allocation->invoice;
        $paidBefore = (float) $invoice->allocations()
            ->where('id', '<', $allocation->id)
            ->whereHas('payment', fn ($query) => $query->where('status', 'posted'))
            ->selectRaw('COALESCE(SUM(amount - refunded_amount), 0) as total')
            ->value('total');
        $amountLeft = max(0, (float) $allocation->amount - (float) $allocation->refunded_amount);
        $splits = collect();

        foreach ($invoice->items as $item) {
            $lineAmount = max(0, (float) $item->amount);
            if ($paidBefore >= $lineAmount - 0.005) {
                $paidBefore -= $lineAmount;

                continue;
            }

            $lineAvailable = max(0, $lineAmount - $paidBefore);
            $splitAmount = min($amountLeft, $lineAvailable);
            $paidBefore = 0;
            if ($splitAmount <= 0.005) {
                continue;
            }

            $category = $item->category ?: $this->billing->accountingCategory($invoice);
            $existing = $splits->firstWhere('category.id', $category->id);
            if ($existing) {
                $existing['amount'] = round((float) $existing['amount'] + $splitAmount, 2);
                $splits = $splits->map(fn ($value) => $value['category']->id === $category->id ? $existing : $value);
            } else {
                $splits->push(['category' => $category, 'amount' => round($splitAmount, 2)]);
            }
            $amountLeft -= $splitAmount;
            if ($amountLeft <= 0.005) {
                break;
            }
        }

        if ($amountLeft > 0.005) {
            $category = $this->billing->accountingCategory($invoice);
            $splits->push(['category' => $category, 'amount' => round($amountLeft, 2)]);
        }

        return $splits;
    }

    private function reversePaymentAccounting(Payment $payment): void
    {
        $allocationIds = $payment->allocations()->pluck('id');
        $transactions = AccountingTransaction::query()
            ->where(function ($query) use ($payment, $allocationIds): void {
                $query->where(function ($paymentQuery) use ($payment): void {
                    $paymentQuery->where('source_type', 'customer_payment')
                        ->where('source_id', $payment->id);
                });

                if ($allocationIds->isNotEmpty()) {
                    $query->orWhere(function ($allocationQuery) use ($allocationIds): void {
                        $allocationQuery
                            ->whereIn('source_type', ['customer_payment_allocation', 'customer_contract_payment_allocation'])
                            ->whereIn('source_id', $allocationIds);
                    });
                }
            })
            ->get();

        foreach ($transactions as $transaction) {
            if ($transaction->status === 'cancelled') {
                continue;
            }
            $transaction->reverseFromAccount();
            $transaction->update(['status' => 'cancelled']);
        }
    }

    private function relations(): array
    {
        return [
            'invoice:id,invoice_number,invoice_type,total_amount,paid_amount,payment_discount_amount,remaining_amount,status',
            'customer:id,name,phone,house_number,service_area_id',
            'paymentMethod:id,name,code',
            'account:id,name,code,type,current_balance',
            'receiver:id,name',
            'discountAuthority:id,authority_number,name,father_name,title,status',
            'refunder:id,name',
            'refundTransaction.account:id,name,code,type,current_balance',
            'allocations.invoice:id,invoice_number,invoice_type,total_amount,paid_amount,payment_discount_amount,remaining_amount,status',
            'allocations.charge:id,title,type,amount,paid_amount,remaining_amount,status',
        ];
    }

    private function authorizeView(Request $request): void
    {
        $user = $request->user();
        abort_unless(
            $user?->hasAnyRole(['Collector', 'Accountant', 'Manager', 'Admin', 'Super Admin']) || $user?->can('payments.view'),
            403,
            'Only authorized payment staff can view customer payments.',
        );
    }

    private function authorizeCreate(Request $request): void
    {
        $user = $request->user();
        abort_unless(
            $user?->hasAnyRole(['Collector', 'Accountant', 'Manager', 'Admin', 'Super Admin']) || $user?->can('payments.create'),
            403,
            'Only collectors, accountants, managers, or admins can receive customer payments.',
        );
    }

    private function authorizeCancel(Request $request): void
    {
        $user = $request->user();
        abort_unless(
            $user?->hasAnyRole(['Manager', 'Admin', 'Super Admin']) || $user?->can('payments.update'),
            403,
            'Only managers or admins can cancel customer payments.',
        );
    }
}
