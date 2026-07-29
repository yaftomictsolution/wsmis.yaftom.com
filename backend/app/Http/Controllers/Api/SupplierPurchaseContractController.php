<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingTransaction;
use App\Models\FinancialCategory;
use App\Models\SupplierInstallment;
use App\Models\SupplierPurchaseContract;
use App\Services\AccountingWorkflowService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SupplierPurchaseContractController extends Controller
{
    public function __construct(private readonly AccountingWorkflowService $workflow)
    {
    }

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => SupplierPurchaseContract::with([
                'supplier:id,name,supplier_type,phone',
                'category:id,name,type',
                'creator:id,name',
                'installments.paymentMethod:id,name,code',
                'installments.account:id,name,code,type',
                'installments.transaction:id,transaction_number,status,approved_at',
            ])->latest()->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateContract($request);

        $contract = DB::transaction(function () use ($request, $data) {
            $contract = SupplierPurchaseContract::query()->create($data + [
                'contract_number' => SupplierPurchaseContract::nextNumber(),
                'created_by' => $request->user()?->id,
                'paid_amount' => 0,
                'remaining_amount' => $data['total_amount'],
                'status' => 'active',
            ]);

            $this->createInstallmentSchedule($contract);
            $contract->refreshPaymentStatus();

            return $contract->load(['supplier', 'category', 'installments']);
        });

        return response()->json(['data' => $contract], 201);
    }

    public function show(SupplierPurchaseContract $supplierPurchaseContract): JsonResponse
    {
        return response()->json([
            'data' => $supplierPurchaseContract->load([
                'supplier',
                'category',
                'creator:id,name',
                'installments.paymentMethod',
                'installments.account',
                'installments.transaction',
            ]),
        ]);
    }

    public function update(Request $request, SupplierPurchaseContract $supplierPurchaseContract): JsonResponse
    {
        $data = $request->validate([
            'supplier_id' => ['sometimes', 'integer', 'exists:suppliers,id'],
            'financial_category_id' => ['nullable', 'integer', 'exists:financial_categories,id'],
            'item_type' => ['sometimes', 'string', 'max:255'],
            'status' => ['nullable', Rule::in(['active', 'completed', 'overdue', 'cancelled'])],
            'notes' => ['nullable', 'string'],
        ]);

        $supplierPurchaseContract->update($data);
        $supplierPurchaseContract->refreshPaymentStatus();

        return response()->json(['data' => $supplierPurchaseContract->fresh()->load(['supplier', 'category', 'installments'])]);
    }

    public function destroy(SupplierPurchaseContract $supplierPurchaseContract): JsonResponse
    {
        abort_if($supplierPurchaseContract->installments()->where('status', 'paid')->exists(), 422, 'A contract with paid installments cannot be deleted.');

        $supplierPurchaseContract->delete();

        return response()->json(['message' => 'Supplier contract deleted.']);
    }

    public function payInstallment(Request $request, SupplierInstallment $supplierInstallment): JsonResponse
    {
        $data = $request->validate([
            'payment_method_id' => ['required', 'integer', 'exists:payment_methods,id'],
            'accounting_account_id' => ['required', 'integer', 'exists:accounting_accounts,id'],
            'paid_at' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'notes' => ['nullable', 'string'],
        ]);

        abort_unless($supplierInstallment->status === 'pending', 422, 'Only pending installments can be sent for payment approval.');
        $this->workflow->ensureDateIsOpen($data['paid_at']);
        $this->workflow->ensureCompatibleAccount((int) $data['payment_method_id'], (int) $data['accounting_account_id']);

        $remaining = (float) $supplierInstallment->amount - (float) $supplierInstallment->paid_amount;
        if (abs((float) $data['amount'] - $remaining) > 0.01) {
            throw ValidationException::withMessages([
                'amount' => ['Installment payment must equal the remaining installment amount.'],
            ]);
        }

        $transaction = DB::transaction(function () use ($request, $supplierInstallment, $data) {
            $contract = $supplierInstallment->contract()->with('supplier')->firstOrFail();
            $categoryId = $contract->financial_category_id ?: FinancialCategory::query()
                ->firstOrCreate(
                    ['code' => 'supplier_installment_payment'],
                    ['name' => 'Supplier Installment Payment', 'type' => 'expense', 'status' => 'active'],
                )
                ->id;

            $transaction = AccountingTransaction::query()->create([
                'financial_category_id' => $categoryId,
                'payment_method_id' => $data['payment_method_id'],
                'accounting_account_id' => $data['accounting_account_id'],
                'supplier_id' => $contract->supplier_id,
                'supplier_installment_id' => $supplierInstallment->id,
                'recorded_by' => $request->user()?->id,
                'transaction_number' => AccountingTransaction::nextNumber('expense'),
                'type' => 'expense',
                'title' => 'Supplier installment payment - '.$contract->contract_number,
                'amount' => $data['amount'],
                'paid_to' => $contract->supplier?->name,
                'transaction_date' => $data['paid_at'],
                'source_type' => 'supplier_installment',
                'source_id' => $supplierInstallment->id,
                'status' => 'pending_review',
                'description' => $data['notes'] ?? null,
            ]);

            $supplierInstallment->update([
                'payment_method_id' => $data['payment_method_id'],
                'accounting_account_id' => $data['accounting_account_id'],
                'accounting_transaction_id' => $transaction->id,
                'recorded_by' => $request->user()?->id,
                'status' => 'pending_review',
                'notes' => $data['notes'] ?? $supplierInstallment->notes,
            ]);

            return $transaction->load(['category', 'paymentMethod', 'account', 'supplier', 'supplierInstallment.contract']);
        });

        return response()->json(['data' => $transaction], 201);
    }

    private function validateContract(Request $request): array
    {
        return $request->validate([
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'financial_category_id' => ['nullable', 'integer', 'exists:financial_categories,id'],
            'item_type' => ['required', 'string', 'max:255'],
            'total_amount' => ['required', 'numeric', 'min:0.01'],
            'down_payment_amount' => ['nullable', 'numeric', 'min:0'],
            'installments_count' => ['required', 'integer', 'min:0', 'max:120'],
            'installment_start_date' => ['required', 'date'],
            'installment_end_date' => ['nullable', 'date', 'after_or_equal:installment_start_date'],
            'notes' => ['nullable', 'string'],
        ]);
    }

    private function createInstallmentSchedule(SupplierPurchaseContract $contract): void
    {
        $startDate = Carbon::parse($contract->installment_start_date);
        $total = (float) $contract->total_amount;
        $downPayment = min((float) $contract->down_payment_amount, $total);
        $remaining = max(0, $total - $downPayment);
        $installmentNumber = 1;

        if ($downPayment > 0) {
            $contract->installments()->create([
                'installment_number' => $installmentNumber++,
                'due_date' => $startDate->toDateString(),
                'amount' => $downPayment,
                'status' => 'pending',
                'notes' => 'Down payment',
            ]);
        }

        $count = max(1, (int) $contract->installments_count);
        if ($remaining <= 0) {
            return;
        }

        $baseAmount = floor(($remaining / $count) * 100) / 100;
        $scheduledTotal = 0;

        for ($index = 0; $index < $count; $index++) {
            $amount = $index === $count - 1 ? round($remaining - $scheduledTotal, 2) : $baseAmount;
            $scheduledTotal += $amount;

            $contract->installments()->create([
                'installment_number' => $installmentNumber++,
                'due_date' => $startDate->copy()->addMonths($index + ($downPayment > 0 ? 1 : 0))->toDateString(),
                'amount' => $amount,
                'status' => 'pending',
            ]);
        }
    }
}
