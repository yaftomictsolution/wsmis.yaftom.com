<?php

namespace App\Services;

use App\Models\AccountingAccount;
use App\Models\AccountingTransaction;
use App\Models\ContractCancellationItem;
use App\Models\ContractCancellationRequest;
use App\Models\CustomerContract;
use App\Models\InventoryItem;
use App\Models\InventoryRequest;
use App\Models\InventoryTransaction;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ContractCancellationWorkflowService
{
    public function __construct(
        private readonly CustomerContractWorkflowService $contracts,
        private readonly CustomerPaymentRefundService $paymentRefunds,
        private readonly CustomerBillingService $billing,
        private readonly BusinessClock $clock,
    ) {}

    public function preview(CustomerContract $contract): array
    {
        $issues = $this->materialIssues($contract);

        return [
            'contract_id' => $contract->id,
            'contract_number' => $contract->contract_number,
            'materials' => $issues->flatMap(fn (InventoryRequest $request) => $request->items->map(
                fn ($item) => [
                    'inventory_request_id' => $request->id,
                    'request_number' => $request->request_number,
                    'description' => $item->description,
                    'quantity' => (float) $item->quantity,
                    'unit' => $item->inventoryItem?->unit ?? 'piece',
                    'warehouse' => $request->warehouse?->only(['id', 'name', 'code']),
                ]
            ))->values(),
            'material_request_count' => $issues->count(),
            'material_line_count' => $issues->sum(fn (InventoryRequest $request) => $request->items->count()),
            'material_quantity' => round((float) $issues->sum(
                fn (InventoryRequest $request) => $request->items->sum('quantity')
            ), 2),
            'active_meter_count' => $contract->meterAssignments()->where('status', 'active')->count(),
            'refundable_amount' => $this->refundableAmount($contract, $issues),
            'pending_request' => $contract->pendingCancellation()
                ->with($this->relations())
                ->first(),
        ];
    }

    public function submit(CustomerContract $contract, array $data, User $actor): ContractCancellationRequest
    {
        return DB::transaction(function () use ($contract, $data, $actor): ContractCancellationRequest {
            $contract = CustomerContract::query()->whereKey($contract->id)->lockForUpdate()->firstOrFail();
            abort_unless(
                in_array($contract->status, ['draft', 'printed', 'installation_pending', 'active'], true),
                422,
                'This contract cannot be cancelled.',
            );

            if ($contract->cancellationRequests()->where('status', 'pending')->lockForUpdate()->exists()) {
                throw ValidationException::withMessages([
                    'customer_contract_id' => ['A cancellation request is already waiting for admin approval.'],
                ]);
            }

            $issues = $this->materialIssues($contract, true);
            if ($issues->isNotEmpty() && ! ($data['materials_received_confirmed'] ?? false)) {
                throw ValidationException::withMessages([
                    'materials_received_confirmed' => ['Confirm that all listed contract materials were physically received.'],
                ]);
            }

            $refundableAmount = $this->refundableAmount($contract, $issues);
            if ($refundableAmount > 0.005 && ! ($data['refund_posted_payments'] ?? false)) {
                throw ValidationException::withMessages([
                    'refund_posted_payments' => ['Confirm the customer refund that will be posted when Admin approves the cancellation.'],
                ]);
            }
            if ($refundableAmount > 0.005 && empty($data['refunded_at'])) {
                throw ValidationException::withMessages([
                    'refunded_at' => ['Select the refund date.'],
                ]);
            }
            if ($refundableAmount > 0.005) {
                $refundAccount = AccountingAccount::query()
                    ->whereKey($data['refund_accounting_account_id'] ?? null)
                    ->where('status', 'active')
                    ->lockForUpdate()
                    ->first();
                if (! $refundAccount) {
                    throw ValidationException::withMessages([
                        'refund_accounting_account_id' => ['Select an active account that will pay the customer refund.'],
                    ]);
                }
            }

            $cancellation = ContractCancellationRequest::query()->create([
                'customer_contract_id' => $contract->id,
                'customer_id' => $contract->customer_id,
                'status' => 'pending',
                'reason' => $data['reason'],
                'materials_received_confirmed' => $issues->isNotEmpty(),
                'refund_posted_payments' => $refundableAmount > 0.005,
                'refund_accounting_account_id' => $refundableAmount > 0.005
                    ? $data['refund_accounting_account_id']
                    : null,
                'refunded_at' => $refundableAmount > 0.005 ? $data['refunded_at'] : null,
                'refund_reference' => $refundableAmount > 0.005 ? ($data['refund_reference'] ?? null) : null,
                'requested_by' => $actor->id,
            ]);

            foreach ($issues as $issue) {
                foreach ($issue->items as $line) {
                    $stockItem = $line->inventoryItem;
                    if (! $stockItem) {
                        throw ValidationException::withMessages([
                            'materials' => ["{$line->description} no longer has a warehouse stock record."],
                        ]);
                    }

                    $saleTransaction = InventoryTransaction::query()
                        ->where('reference_type', InventoryRequest::class)
                        ->where('reference_id', $issue->id)
                        ->where('inventory_item_id', $stockItem->id)
                        ->where('type', 'sale')
                        ->latest('id')
                        ->first();
                    $unitCost = (float) ($saleTransaction?->unit_cost ?? $stockItem->unit_cost);
                    $quantity = (float) $line->quantity;

                    $cancellation->items()->create([
                        'inventory_request_id' => $issue->id,
                        'inventory_request_item_id' => $line->id,
                        'inventory_item_id' => $stockItem->id,
                        'good_id' => $line->good_id ?? $stockItem->good_id,
                        'warehouse_id' => $issue->warehouse_id,
                        'description' => $line->description,
                        'unit' => $stockItem->unit,
                        'quantity' => $quantity,
                        'unit_cost' => $unitCost,
                        'unit_price' => $line->unit_price,
                        'total_cost' => round($quantity * $unitCost, 2),
                        'total_price' => $line->total_price,
                    ]);
                }

                $issue->update(['return_status' => 'pending_approval']);
            }

            return $cancellation->fresh()->load($this->relations());
        });
    }

    public function resolve(
        ContractCancellationRequest $cancellation,
        string $status,
        ?string $notes,
        User $actor,
    ): ContractCancellationRequest {
        return DB::transaction(function () use ($cancellation, $status, $notes, $actor): ContractCancellationRequest {
            $cancellation = ContractCancellationRequest::query()
                ->whereKey($cancellation->id)
                ->lockForUpdate()
                ->firstOrFail();
            abort_unless($cancellation->status === 'pending', 422, 'This cancellation request has already been resolved.');

            $issueIds = $cancellation->items()->pluck('inventory_request_id')->unique();
            if ($status === 'rejected') {
                InventoryRequest::query()
                    ->whereIn('id', $issueIds)
                    ->where('return_status', 'pending_approval')
                    ->update(['return_status' => 'not_requested']);
                $cancellation->update([
                    'status' => 'rejected',
                    'resolved_by' => $actor->id,
                    'resolved_at' => now(),
                    'resolution_notes' => $notes,
                ]);

                return $cancellation->fresh()->load($this->relations());
            }

            $contract = CustomerContract::query()
                ->whereKey($cancellation->customer_contract_id)
                ->lockForUpdate()
                ->firstOrFail();
            abort_unless(
                in_array($contract->status, ['draft', 'printed', 'installation_pending', 'active'], true),
                422,
                'The contract is no longer available for cancellation.',
            );

            $this->returnMaterials($cancellation, $actor);
            $this->cancelMaterialInvoices($cancellation, $actor);
            $this->contracts->cancel($contract, $actor, $cancellation->reason, [
                'refund_posted_payments' => $cancellation->refund_posted_payments,
                'refund_accounting_account_id' => $cancellation->refund_accounting_account_id,
                'refunded_at' => $cancellation->refunded_at?->toDateString(),
                'refund_reference' => $cancellation->refund_reference,
            ]);

            $cancellation->update([
                'status' => 'approved',
                'resolved_by' => $actor->id,
                'resolved_at' => now(),
                'resolution_notes' => $notes,
            ]);

            return $cancellation->fresh()->load($this->relations());
        });
    }

    public function relations(): array
    {
        return [
            'contract:id,customer_id,contract_number,status,cancelled_at',
            'customer:id,name,last_name,subscription_code',
            'requester:id,name',
            'resolver:id,name',
            'refundAccount:id,name,code,type,current_balance,status',
            'items.warehouse:id,name,code,status',
            'items.inventoryItem:id,warehouse_id,good_id,name,code,unit,quantity',
            'items.inventoryRequest:id,request_number,document_number,invoice_id,return_status',
        ];
    }

    private function materialIssues(CustomerContract $contract, bool $lock = false): Collection
    {
        $query = InventoryRequest::query()
            ->with(['items.inventoryItem', 'warehouse', 'invoice'])
            ->where('customer_contract_id', $contract->id)
            ->where('type', 'issue')
            ->where('issue_type', 'customer')
            ->where('issue_purpose', 'contract_material')
            ->where('status', 'approved')
            ->where('return_status', '!=', 'returned')
            ->orderBy('id');

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->get();
    }

    private function refundableAmount(CustomerContract $contract, Collection $issues): float
    {
        $invoiceIds = collect([$contract->invoice()->value('id')])
            ->merge($issues->pluck('invoice_id'))
            ->filter()
            ->unique();

        if ($invoiceIds->isEmpty()) {
            return 0;
        }

        return round((float) PaymentAllocation::query()
            ->whereIn('invoice_id', $invoiceIds)
            ->whereHas('payment', fn ($query) => $query->where('status', 'posted'))
            ->get(['amount', 'refunded_amount'])
            ->sum(fn (PaymentAllocation $allocation): float => max(
                0,
                (float) $allocation->amount - (float) $allocation->refunded_amount,
            )), 2);
    }

    private function returnMaterials(ContractCancellationRequest $cancellation, User $actor): void
    {
        $items = ContractCancellationItem::query()
            ->where('contract_cancellation_request_id', $cancellation->id)
            ->whereNull('returned_at')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        foreach ($items as $item) {
            $warehouse = Warehouse::query()->whereKey($item->warehouse_id)->lockForUpdate()->first();
            if (! $warehouse || $warehouse->status !== 'active') {
                throw ValidationException::withMessages([
                    'warehouse_id' => ["Activate the original warehouse for {$item->description} before approving cancellation."],
                ]);
            }

            $stockItem = InventoryItem::query()
                ->whereKey($item->inventory_item_id)
                ->where('warehouse_id', $warehouse->id)
                ->lockForUpdate()
                ->first();
            if (! $stockItem) {
                throw ValidationException::withMessages([
                    'materials' => ["The warehouse stock record for {$item->description} is unavailable."],
                ]);
            }

            $stockItem->update([
                'quantity' => round((float) $stockItem->quantity + (float) $item->quantity, 2),
            ]);
            InventoryTransaction::query()->create([
                'inventory_item_id' => $stockItem->id,
                'type' => 'return',
                'quantity' => $item->quantity,
                'unit_cost' => $item->unit_cost,
                'unit_price' => $item->unit_price,
                'total_amount' => $item->total_cost,
                'transaction_date' => $cancellation->refunded_at?->toDateString() ?? $this->clock->effectiveDate(),
                'reference_type' => ContractCancellationRequest::class,
                'reference_id' => $cancellation->id,
                'notes' => "Contract cancellation return: {$cancellation->contract?->contract_number}",
                'created_by' => $actor->id,
            ]);
            $item->update(['returned_at' => now()]);
        }
    }

    private function cancelMaterialInvoices(ContractCancellationRequest $cancellation, User $actor): void
    {
        $issues = InventoryRequest::query()
            ->with('invoice')
            ->whereIn('id', $cancellation->items()->pluck('inventory_request_id')->unique())
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        foreach ($issues as $issue) {
            if ($issue->invoice && $issue->invoice->status !== 'cancelled') {
                $this->refundInvoicePayments($issue->invoice, $cancellation, $actor);
                $this->billing->cancelInvoice($issue->invoice);
            }

            AccountingTransaction::query()
                ->where('source_type', 'inventory_request_cogs')
                ->where('source_id', $issue->id)
                ->where('status', 'approved')
                ->update([
                    'status' => 'cancelled',
                    'reversed_at' => now(),
                    'reversal_reason' => "Returned through contract cancellation #{$cancellation->id}.",
                ]);

            $issue->update([
                'return_status' => 'returned',
                'returned_by' => $actor->id,
                'returned_at' => now(),
                'paid_amount' => 0,
                'remaining_amount' => 0,
                'payment_status' => 'refunded',
            ]);
        }
    }

    private function refundInvoicePayments(
        Invoice $invoice,
        ContractCancellationRequest $cancellation,
        User $actor,
    ): void {
        $payments = Payment::query()
            ->where('status', 'posted')
            ->whereNull('customer_deposit_id')
            ->whereHas('allocations', fn ($query) => $query->where('invoice_id', $invoice->id))
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        if ($payments->isNotEmpty() && ! $cancellation->refund_posted_payments) {
            throw ValidationException::withMessages([
                'refund_posted_payments' => ['Customer payment refund confirmation is required.'],
            ]);
        }

        foreach ($payments as $payment) {
            $this->paymentRefunds->refundInvoiceAllocation($payment, $invoice->id, [
                'refunded_at' => $cancellation->refunded_at?->toDateString() ?? now()->toDateString(),
                'accounting_account_id' => $cancellation->refund_accounting_account_id,
                'refund_reference' => $cancellation->refund_reference,
                'refund_reason' => "Contract {$cancellation->contract?->contract_number} cancellation: {$cancellation->reason}",
            ], $actor);
        }
    }
}
