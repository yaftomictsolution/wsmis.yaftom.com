<?php

namespace App\Services;

use App\Models\AccountingAccount;
use App\Models\AccountingTransaction;
use App\Models\Customer;
use App\Models\CustomerContract;
use App\Models\FinancialCategory;
use App\Models\Good;
use App\Models\InventoryItem;
use App\Models\InventoryPurchasePayment;
use App\Models\InventoryRequest;
use App\Models\InventoryRequestItem;
use App\Models\InventoryTransaction;
use App\Models\Invoice;
use App\Models\Meter;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryRequestWorkflowService
{
    public function __construct(
        private readonly CustomerBillingService $billing,
        private readonly AccountingWorkflowService $accounting,
        private readonly MeterInventoryService $meterInventory,
    ) {}

    public function submit(array $data, User $user): InventoryRequest
    {
        return DB::transaction(function () use ($data, $user): InventoryRequest {
            $type = $data['type'];
            $issueType = $type === 'issue' ? $data['issue_type'] : null;
            $issuePurpose = $issueType === 'customer'
                ? ($data['issue_purpose'] ?? 'separate_sale')
                : null;
            $customerContractId = null;
            $totalAmount = 0.0;
            $totalItems = 0.0;
            $lines = [];

            if ($issuePurpose === 'contract_material') {
                $contract = CustomerContract::query()
                    ->whereKey($data['customer_contract_id'] ?? null)
                    ->where('customer_id', $data['customer_id'] ?? null)
                    ->whereIn('status', ['installation_pending', 'active'])
                    ->lockForUpdate()
                    ->first();
                if (! $contract || $contract->cancellationRequests()->where('status', 'pending')->exists()) {
                    throw ValidationException::withMessages([
                        'customer_contract_id' => ['Select the customer current contract. A contract awaiting cancellation cannot receive more materials.'],
                    ]);
                }
                $customerContractId = $contract->id;
            }

            if ($type === 'purchase') {
                $goods = Good::query()
                    ->whereIn('id', collect($data['items'])->pluck('good_id'))
                    ->get()
                    ->keyBy('id');

                foreach ($data['items'] as $index => $line) {
                    $good = $goods->get((int) $line['good_id']);
                    if (! $good || $good->status !== 'active') {
                        throw ValidationException::withMessages([
                            "items.{$index}.good_id" => ['Select an active good.'],
                        ]);
                    }

                    $quantity = round((float) $line['quantity'], 2);
                    $unitPrice = round((float) $line['unit_price'], 2);
                    $lineTotal = round($quantity * $unitPrice, 2);
                    $meterSerials = $good->category === 'meter'
                        ? $this->validatePurchaseMeterSerials($line, $quantity, $index)
                        : null;
                    $totalItems += $quantity;
                    $totalAmount += $lineTotal;
                    $lines[] = [
                        'good_id' => $good->id,
                        'inventory_item_id' => null,
                        'description' => $good->name,
                        'quantity' => $quantity,
                        'unit_price' => $unitPrice,
                        'total_price' => $lineTotal,
                        'meter_serials' => $meterSerials,
                        'meter_ids' => null,
                    ];
                }
                $this->assertPurchaseSerialsAreNotReserved($lines);
            } else {
                $stockItems = InventoryItem::query()
                    ->with('good')
                    ->whereIn('id', collect($data['items'])->pluck('inventory_item_id'))
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');

                foreach ($data['items'] as $index => $line) {
                    $stockItem = $stockItems->get((int) $line['inventory_item_id']);
                    if (! $stockItem || (int) $stockItem->warehouse_id !== (int) $data['warehouse_id']) {
                        throw ValidationException::withMessages([
                            "items.{$index}.inventory_item_id" => ['The selected item is not available in this warehouse.'],
                        ]);
                    }
                    if ($issuePurpose === 'contract_material' && $stockItem->category === 'meter') {
                        throw ValidationException::withMessages([
                            "items.{$index}.inventory_item_id" => ['Install water meters from Meter Assignments. Do not issue them as contract material.'],
                        ]);
                    }

                    $quantity = round((float) $line['quantity'], 2);
                    if ((float) $stockItem->quantity + 0.0001 < $quantity) {
                        throw ValidationException::withMessages([
                            "items.{$index}.quantity" => ["Only {$stockItem->quantity} {$stockItem->unit} are available."],
                        ]);
                    }

                    $unitPrice = $issueType === 'customer'
                        ? round((float) $line['unit_price'], 2)
                        : round((float) $stockItem->unit_cost, 2);
                    $lineTotal = round($quantity * $unitPrice, 2);
                    [$meterIds, $meterSerials] = $stockItem->category === 'meter'
                        ? $this->validateIssueMeters($line, $stockItem, $quantity, $index, (int) $data['warehouse_id'])
                        : [null, null];
                    $totalItems += $quantity;
                    $totalAmount += $lineTotal;
                    $lines[] = [
                        'good_id' => $stockItem->good_id,
                        'inventory_item_id' => $stockItem->id,
                        'description' => $stockItem->name,
                        'quantity' => $quantity,
                        'unit_price' => $unitPrice,
                        'total_price' => $lineTotal,
                        'meter_serials' => $meterSerials,
                        'meter_ids' => $meterIds,
                    ];
                }
            }

            $initialPaymentAmount = ($type === 'purchase' || $issueType === 'customer')
                ? round((float) ($data['amount_paid'] ?? 0), 2)
                : 0.0;
            if ($initialPaymentAmount > round($totalAmount, 2) + 0.005) {
                throw ValidationException::withMessages([
                    'amount_paid' => ['Amount paid cannot be greater than the document total.'],
                ]);
            }
            if ($initialPaymentAmount > 0.005) {
                if (empty($data['payment_method_id']) || empty($data['accounting_account_id'])) {
                    throw ValidationException::withMessages([
                        'amount_paid' => ['Select a payment method and account when an amount is paid.'],
                    ]);
                }
                $this->accounting->ensureDateIsOpen($data['request_date']);
                $this->accounting->ensureCompatibleAccount(
                    (int) $data['payment_method_id'],
                    (int) $data['accounting_account_id'],
                );
            }

            $inventoryRequest = InventoryRequest::query()->create([
                'request_number' => InventoryRequest::nextNumber($type),
                'type' => $type,
                'issue_type' => $issueType,
                'issue_purpose' => $issuePurpose,
                'status' => 'pending',
                'return_status' => $issuePurpose === 'contract_material' ? 'not_requested' : 'not_required',
                'supplier_id' => $type === 'purchase' ? $data['supplier_id'] : null,
                'customer_id' => $issueType === 'customer' ? $data['customer_id'] : null,
                'customer_contract_id' => $customerContractId,
                'department_id' => $issueType === 'internal' ? $data['department_id'] : null,
                'accounting_account_id' => $initialPaymentAmount > 0.005
                    ? ($data['accounting_account_id'] ?? null)
                    : null,
                'payment_method_id' => $initialPaymentAmount > 0.005
                    ? ($data['payment_method_id'] ?? null)
                    : null,
                'warehouse_id' => $data['warehouse_id'],
                'request_date' => $data['request_date'],
                'notes' => $data['notes'] ?? null,
                'total_amount' => round($totalAmount, 2),
                'initial_payment_amount' => $initialPaymentAmount,
                'paid_amount' => 0,
                'remaining_amount' => round($totalAmount, 2),
                'payment_status' => 'unpaid',
                'total_items' => round($totalItems, 2),
                'requested_by' => $user->id,
            ]);

            $inventoryRequest->items()->createMany($lines);

            return $inventoryRequest->load($this->relations());
        });
    }

    public function resolve(InventoryRequest $inventoryRequest, array $data, User $actor): InventoryRequest
    {
        return DB::transaction(function () use ($inventoryRequest, $data, $actor): InventoryRequest {
            $locked = InventoryRequest::query()
                ->whereKey($inventoryRequest->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($locked->status !== 'pending') {
                throw ValidationException::withMessages([
                    'status' => ['This request has already been resolved.'],
                ]);
            }

            if ($data['status'] === 'rejected') {
                $locked->update([
                    'status' => 'rejected',
                    'approved_by' => $actor->id,
                    'approved_at' => now(),
                    'approval_notes' => $data['approval_notes'] ?? null,
                ]);

                return $locked->load($this->relations());
            }

            $locked->load($this->relations());
            $documentNumber = null;
            if ($locked->type === 'purchase') {
                $this->processPurchase($locked, $actor);
                $documentNumber = $locked->purchaseBillNumber();
            } else {
                $this->processIssue($locked, $actor);
                if ($locked->issue_type === 'customer' || $locked->customer_id) {
                    $documentNumber = Invoice::query()
                        ->whereKey($locked->invoice_id)
                        ->value('invoice_number');
                }
            }

            $locked->update([
                'status' => 'approved',
                'approved_by' => $actor->id,
                'approved_at' => now(),
                'approval_notes' => $data['approval_notes'] ?? null,
                'document_number' => $documentNumber,
                'document_generated_at' => $documentNumber ? now() : null,
            ]);

            return $locked->fresh()->load($this->relations());
        });
    }

    public function recordPurchasePayment(InventoryRequest $inventoryRequest, array $data, User $actor): InventoryRequest
    {
        return DB::transaction(function () use ($inventoryRequest, $data, $actor): InventoryRequest {
            $locked = InventoryRequest::query()
                ->whereKey($inventoryRequest->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($locked->type !== 'purchase') {
                throw ValidationException::withMessages([
                    'inventory_request_id' => ['Supplier payments can only be recorded against purchase records.'],
                ]);
            }
            if ($locked->status !== 'approved') {
                throw ValidationException::withMessages([
                    'inventory_request_id' => ['Approve the purchase before recording another supplier payment.'],
                ]);
            }

            $this->postPurchasePayment(
                $locked,
                round((float) $data['amount'], 2),
                (int) $data['payment_method_id'],
                (int) $data['accounting_account_id'],
                $data['paid_at'],
                $actor,
                $data['reference'] ?? null,
                $data['notes'] ?? null,
            );

            return $locked->fresh()->load($this->relations());
        });
    }

    private function processPurchase(InventoryRequest $request, User $actor): void
    {
        $warehouse = $request->warehouse;
        if (! $warehouse || $warehouse->status !== 'active') {
            throw ValidationException::withMessages([
                'warehouse_id' => ['The selected warehouse is no longer active.'],
            ]);
        }

        $totalAmount = round((float) $request->total_amount, 2);

        foreach ($request->items as $line) {
            $good = Good::query()->find($line->good_id);
            if (! $good) {
                throw ValidationException::withMessages([
                    'items' => ["{$line->description} is no longer registered in Goods."],
                ]);
            }

            $stockItem = InventoryItem::query()
                ->where('good_id', $good->id)
                ->where('warehouse_id', $warehouse->id)
                ->lockForUpdate()
                ->first();

            $receivedQuantity = (float) $line->quantity;
            $receivedCost = (float) $line->unit_price;
            if ($stockItem) {
                $oldQuantity = (float) $stockItem->quantity;
                $newQuantity = $oldQuantity + $receivedQuantity;
                $weightedCost = $newQuantity > 0
                    ? (($oldQuantity * (float) $stockItem->unit_cost) + ($receivedQuantity * $receivedCost)) / $newQuantity
                    : $receivedCost;

                $stockItem->update([
                    'quantity' => round($newQuantity, 2),
                    'unit_cost' => round($weightedCost, 2),
                    'unit_price' => (float) $good->default_price,
                    'supplier_id' => $request->supplier_id,
                ]);
            } else {
                $stockItem = InventoryItem::query()->create([
                    'good_id' => $good->id,
                    'warehouse_id' => $warehouse->id,
                    'name' => $good->name,
                    'code' => $this->uniqueStockCode($good->code, $warehouse->code),
                    'category' => $good->category,
                    'unit' => $good->unit,
                    'quantity' => $receivedQuantity,
                    'unit_cost' => $receivedCost,
                    'unit_price' => $good->default_price,
                    'reorder_level' => 10,
                    'supplier_id' => $request->supplier_id,
                ]);
            }

            $line->update(['inventory_item_id' => $stockItem->id]);
            $transaction = InventoryTransaction::query()->create([
                'inventory_item_id' => $stockItem->id,
                'type' => 'purchase',
                'quantity' => $receivedQuantity,
                'unit_cost' => $receivedCost,
                'unit_price' => $stockItem->unit_price,
                'total_amount' => (float) $line->total_price,
                'transaction_date' => $request->request_date,
                'reference_type' => InventoryRequest::class,
                'reference_id' => $request->id,
                'notes' => $request->request_number,
                'created_by' => $actor->id,
            ]);
            if ($good->category === 'meter') {
                $this->meterInventory->receivePurchasedMeters($request, $line, $stockItem, $transaction, $actor);
            }
        }

        $request->update([
            'paid_amount' => 0,
            'remaining_amount' => $totalAmount,
            'payment_status' => 'unpaid',
        ]);

        $initialPayment = round((float) $request->initial_payment_amount, 2);
        if ($initialPayment > 0.005) {
            if (! $request->payment_method_id || ! $request->accounting_account_id) {
                throw ValidationException::withMessages([
                    'amount_paid' => ['Select a payment method and payment account for the paid amount.'],
                ]);
            }

            $this->postPurchasePayment(
                $request,
                $initialPayment,
                (int) $request->payment_method_id,
                (int) $request->accounting_account_id,
                $request->request_date->toDateString(),
                $actor,
                $request->request_number,
                $request->notes,
            );
        }
    }

    private function postPurchasePayment(
        InventoryRequest $request,
        float $amount,
        int $paymentMethodId,
        int $accountId,
        string $paidAt,
        User $actor,
        ?string $reference = null,
        ?string $notes = null,
    ): InventoryPurchasePayment {
        $postedAmount = round((float) $request->purchasePayments()->where('status', 'posted')->sum('amount'), 2);
        $remaining = max(0, round((float) $request->total_amount - $postedAmount, 2));

        if ($amount <= 0.005) {
            throw ValidationException::withMessages([
                'amount' => ['Payment amount must be greater than zero.'],
            ]);
        }
        if ($amount > $remaining + 0.005) {
            throw ValidationException::withMessages([
                'amount' => ["Payment cannot be greater than the remaining payable amount of AFN {$remaining}."],
            ]);
        }

        $this->accounting->ensureDateIsOpen($paidAt);
        $this->accounting->ensureCompatibleAccount($paymentMethodId, $accountId);
        $account = AccountingAccount::query()->whereKey($accountId)->lockForUpdate()->firstOrFail();
        if ((float) $account->current_balance + 0.005 < $amount) {
            throw ValidationException::withMessages([
                'accounting_account_id' => ['The selected account does not have enough available balance for this payment.'],
            ]);
        }

        $category = FinancialCategory::query()->firstOrCreate(
            ['code' => 'inventory_purchase'],
            ['name' => 'Inventory Purchase', 'type' => 'expense', 'status' => 'active']
        );
        $payment = InventoryPurchasePayment::query()->create([
            'inventory_request_id' => $request->id,
            'accounting_account_id' => $account->id,
            'payment_method_id' => $paymentMethodId,
            'recorded_by' => $actor->id,
            'receipt_number' => InventoryPurchasePayment::nextReceiptNumber(),
            'amount' => $amount,
            'paid_at' => $paidAt,
            'reference' => $reference ?: $request->request_number,
            'status' => 'posted',
            'notes' => $notes,
        ]);
        $transaction = AccountingTransaction::query()->create([
            'financial_category_id' => $category->id,
            'payment_method_id' => $paymentMethodId,
            'accounting_account_id' => $account->id,
            'supplier_id' => $request->supplier_id,
            'recorded_by' => $actor->id,
            'reviewed_by' => $actor->id,
            'approved_by' => $actor->id,
            'transaction_number' => AccountingTransaction::nextNumber('expense'),
            'type' => 'expense',
            'title' => 'Inventory Purchase Payment - '.$request->request_number,
            'amount' => $amount,
            'paid_to' => $request->supplier?->name,
            'transaction_date' => $paidAt,
            'receipt_number' => $payment->receipt_number,
            'reference' => $reference ?: $request->request_number,
            'source_type' => 'inventory_purchase_payment',
            'source_id' => $payment->id,
            'status' => 'approved',
            'reviewed_at' => now(),
            'approved_at' => now(),
            'description' => $notes,
        ]);
        $transaction->postToAccount();
        $payment->update(['accounting_transaction_id' => $transaction->id]);

        $request->refreshPurchasePaymentStatus();

        return $payment->fresh();
    }

    private function processIssue(InventoryRequest $request, User $actor): void
    {
        $warehouse = $request->warehouse;
        if (! $warehouse || $warehouse->status !== 'active') {
            throw ValidationException::withMessages([
                'warehouse_id' => ['The selected warehouse is no longer active.'],
            ]);
        }

        $issueType = $request->issue_type ?: ($request->customer_id ? 'customer' : 'internal');
        $totalCost = 0.0;
        $totalPrice = 0.0;

        if ($issueType === 'customer') {
            $customer = Customer::query()
                ->whereKey($request->customer_id)
                ->lockForUpdate()
                ->first();

            if (! $customer || ! $customer->canReceiveInventorySale()) {
                throw ValidationException::withMessages([
                    'customer_id' => ['Select a current customer. Inactive customers cannot receive goods.'],
                ]);
            }

            $request->setRelation('customer', $customer);

            if ($request->issue_purpose === 'contract_material') {
                $contractIsCurrent = CustomerContract::query()
                    ->whereKey($request->customer_contract_id)
                    ->where('customer_id', $request->customer_id)
                    ->whereIn('status', ['installation_pending', 'active'])
                    ->whereDoesntHave('cancellationRequests', fn ($query) => $query->where('status', 'pending'))
                    ->exists();
                if (! $contractIsCurrent) {
                    throw ValidationException::withMessages([
                        'customer_contract_id' => ['The linked contract is no longer available for material issue.'],
                    ]);
                }
            }
        }

        foreach ($request->items as $line) {
            $stockItem = InventoryItem::query()
                ->whereKey($line->inventory_item_id)
                ->where('warehouse_id', $warehouse->id)
                ->lockForUpdate()
                ->first();

            if (! $stockItem) {
                throw ValidationException::withMessages([
                    'items' => ["{$line->description} is no longer available in {$warehouse->name}."],
                ]);
            }

            $quantity = (float) $line->quantity;
            if ((float) $stockItem->quantity + 0.0001 < $quantity) {
                throw ValidationException::withMessages([
                    'items' => ["Only {$stockItem->quantity} {$stockItem->unit} of {$stockItem->name} remain in stock."],
                ]);
            }

            $unitCost = (float) $stockItem->unit_cost;
            $unitPrice = $issueType === 'customer' ? (float) $line->unit_price : $unitCost;
            $lineCost = round($quantity * $unitCost, 2);
            $linePrice = round($quantity * $unitPrice, 2);
            $totalCost += $lineCost;
            $totalPrice += $linePrice;

            $stockItem->update([
                'quantity' => round((float) $stockItem->quantity - $quantity, 2),
            ]);
            $transaction = InventoryTransaction::query()->create([
                'inventory_item_id' => $stockItem->id,
                'type' => $issueType === 'customer' ? 'sale' : 'internal_use',
                'quantity' => -$quantity,
                'unit_cost' => $unitCost,
                'unit_price' => $unitPrice,
                'total_amount' => $issueType === 'customer' ? $linePrice : $lineCost,
                'transaction_date' => $request->request_date,
                'reference_type' => InventoryRequest::class,
                'reference_id' => $request->id,
                'notes' => $request->request_number,
                'created_by' => $actor->id,
            ]);
            if ($stockItem->category === 'meter') {
                $this->meterInventory->issueRequestMeters($request, $line, $transaction, $actor);
            }
        }

        $request->update([
            'total_amount' => round($issueType === 'customer' ? $totalPrice : $totalCost, 2),
        ]);

        if ($issueType === 'internal') {
            $category = FinancialCategory::query()->firstOrCreate(
                ['code' => 'internal_material_usage'],
                ['name' => 'Internal Material Usage', 'type' => 'expense', 'status' => 'active']
            );
            AccountingTransaction::query()->create([
                'financial_category_id' => $category->id,
                'recorded_by' => $actor->id,
                'reviewed_by' => $actor->id,
                'approved_by' => $actor->id,
                'transaction_number' => AccountingTransaction::nextNumber('expense'),
                'type' => 'expense',
                'title' => 'Internal Material Usage - '.$request->request_number,
                'amount' => round($totalCost, 2),
                'transaction_date' => $request->request_date,
                'source_type' => 'inventory_request',
                'source_id' => $request->id,
                'status' => 'approved',
                'reviewed_at' => now(),
                'approved_at' => now(),
                'posted_at' => now(),
                'description' => $request->notes,
            ]);

            return;
        }

        if (! $request->customer_id) {
            throw ValidationException::withMessages([
                'customer_id' => ['Select the customer receiving these goods.'],
            ]);
        }

        $initialPaymentAmount = round((float) $request->initial_payment_amount, 2);
        if ($initialPaymentAmount > round($totalPrice, 2) + 0.005) {
            throw ValidationException::withMessages([
                'amount_paid' => ['Amount paid cannot be greater than the sale total.'],
            ]);
        }

        $incomeCategory = FinancialCategory::query()->firstOrCreate(
            ['code' => 'inventory_sale_income'],
            ['name' => 'Inventory Sale Income', 'type' => 'income', 'status' => 'active']
        );
        $invoice = Invoice::query()->create([
            'customer_id' => $request->customer_id,
            'source_type' => 'inventory_request',
            'source_id' => $request->id,
            'invoice_number' => Invoice::nextNumber('inventory'),
            'issue_date' => $request->request_date,
            'due_date' => $request->request_date,
            'previous_balance' => 0,
            'consumption' => 0,
            'rate_per_cubic_meter' => 0,
            'water_amount' => 0,
            'penalty_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => round($totalPrice, 2),
            'paid_amount' => 0,
            'remaining_amount' => round($totalPrice, 2),
            'status' => 'unpaid',
            'notes' => 'Inventory sale - '.$request->request_number,
            'invoice_type' => 'inventory',
        ]);
        $request->update(['invoice_id' => $invoice->id]);

        foreach ($request->items as $line) {
            $invoice->items()->create([
                'financial_category_id' => $incomeCategory->id,
                'item_type' => 'inventory_sale',
                'description' => $line->description,
                'quantity' => $line->quantity,
                'unit_price' => $line->unit_price,
                'discount_amount' => 0,
                'amount' => $line->total_price,
            ]);
        }

        if ($initialPaymentAmount > 0.005) {
            if (! $request->payment_method_id || ! $request->accounting_account_id) {
                throw ValidationException::withMessages([
                    'amount_paid' => ['Select a payment method and receiving account for the paid amount.'],
                ]);
            }

            $this->accounting->ensureDateIsOpen($request->request_date->toDateString());
            $this->accounting->ensureCompatibleAccount(
                (int) $request->payment_method_id,
                (int) $request->accounting_account_id,
            );
            $account = $this->lockedActiveAccount($request);
            $paymentMethod = PaymentMethod::query()
                ->whereKey($request->payment_method_id)
                ->where('status', 'active')
                ->firstOrFail();
            $payment = Payment::query()->create([
                'invoice_id' => $invoice->id,
                'customer_id' => $request->customer_id,
                'payment_method_id' => $paymentMethod->id,
                'accounting_account_id' => $account->id,
                'received_by' => $request->requested_by,
                'receipt_number' => Payment::nextReceiptNumber(),
                'amount' => $initialPaymentAmount,
                'paid_at' => $request->request_date,
                'reference' => $request->request_number,
                'status' => 'posted',
                'notes' => $request->notes,
            ]);
            $allocation = $payment->allocations()->create([
                'invoice_id' => $invoice->id,
                'amount' => $initialPaymentAmount,
            ]);

            $income = AccountingTransaction::query()->create([
                'financial_category_id' => $incomeCategory->id,
                'payment_method_id' => $paymentMethod->id,
                'accounting_account_id' => $account->id,
                'customer_id' => $request->customer_id,
                'recorded_by' => $request->requested_by,
                'reviewed_by' => $actor->id,
                'approved_by' => $actor->id,
                'transaction_number' => AccountingTransaction::nextNumber('income'),
                'type' => 'income',
                'title' => $invoice->invoice_number.' payment',
                'amount' => $initialPaymentAmount,
                'received_from' => $request->customer?->name,
                'transaction_date' => $request->request_date,
                'receipt_number' => $payment->receipt_number,
                'reference' => $request->request_number,
                'source_type' => 'customer_payment_allocation',
                'source_id' => $allocation->id,
                'status' => 'approved',
                'reviewed_at' => now(),
                'approved_at' => now(),
                'description' => $request->notes,
            ]);
            $income->postToAccount();
        }

        $this->billing->syncInvoice($invoice, $request->request_date->toDateString());

        $cogsCategory = FinancialCategory::query()->firstOrCreate(
            ['code' => 'cogs_inventory'],
            ['name' => 'Cost of Goods Sold - Inventory', 'type' => 'expense', 'status' => 'active']
        );
        AccountingTransaction::query()->create([
            'financial_category_id' => $cogsCategory->id,
            'customer_id' => $request->customer_id,
            'recorded_by' => $actor->id,
            'reviewed_by' => $actor->id,
            'approved_by' => $actor->id,
            'transaction_number' => AccountingTransaction::nextNumber('expense'),
            'type' => 'expense',
            'title' => 'Cost of Goods Sold - '.$request->request_number,
            'amount' => round($totalCost, 2),
            'transaction_date' => $request->request_date,
            'source_type' => 'inventory_request_cogs',
            'source_id' => $request->id,
            'status' => 'approved',
            'reviewed_at' => now(),
            'approved_at' => now(),
            'posted_at' => now(),
            'description' => 'Inventory cost recognized for '.$request->request_number,
        ]);
    }

    private function lockedActiveAccount(InventoryRequest $request): AccountingAccount
    {
        $account = AccountingAccount::query()
            ->whereKey($request->accounting_account_id)
            ->lockForUpdate()
            ->first();

        if (! $account || $account->status !== 'active') {
            throw ValidationException::withMessages([
                'accounting_account_id' => ['Select an active accounting account.'],
            ]);
        }

        return $account;
    }

    private function uniqueStockCode(string $goodCode, string $warehouseCode): string
    {
        $base = $goodCode;
        if (! InventoryItem::query()->where('code', $base)->exists()) {
            return $base;
        }

        $base = $goodCode.'-'.$warehouseCode;
        $code = $base;
        $suffix = 2;
        while (InventoryItem::query()->where('code', $code)->exists()) {
            $code = $base.'-'.$suffix;
            $suffix++;
        }

        return $code;
    }

    private function validatePurchaseMeterSerials(array $line, float $quantity, int $index): array
    {
        if (abs($quantity - round($quantity)) > 0.0001) {
            throw ValidationException::withMessages([
                "items.{$index}.quantity" => ['Meter quantity must be a whole number.'],
            ]);
        }

        $serials = collect($line['meter_serials'] ?? [])
            ->map(fn ($serial) => trim((string) $serial))
            ->filter()
            ->values();
        if ($serials->count() !== (int) round($quantity)) {
            throw ValidationException::withMessages([
                "items.{$index}.meter_serials" => ['Enter one physical meter serial for every purchased meter.'],
            ]);
        }
        $duplicate = $serials->map(fn (string $serial) => mb_strtolower($serial))->duplicates()->first();
        if ($duplicate) {
            throw ValidationException::withMessages([
                "items.{$index}.meter_serials" => ['Every purchased meter serial must be unique.'],
            ]);
        }

        $existing = Meter::query()->whereIn('meter_number', $serials)->value('meter_number');
        if ($existing) {
            throw ValidationException::withMessages([
                "items.{$index}.meter_serials" => ["Meter serial {$existing} is already registered."],
            ]);
        }

        return $serials->all();
    }

    private function validateIssueMeters(
        array $line,
        InventoryItem $stockItem,
        float $quantity,
        int $index,
        int $warehouseId,
    ): array {
        if (abs($quantity - round($quantity)) > 0.0001) {
            throw ValidationException::withMessages([
                "items.{$index}.quantity" => ['Meter quantity must be a whole number.'],
            ]);
        }

        $ids = collect($line['meter_ids'] ?? [])->map(fn ($id) => (int) $id)->filter()->unique()->values();
        if ($ids->count() !== (int) round($quantity)) {
            throw ValidationException::withMessages([
                "items.{$index}.meter_ids" => ['Select the exact physical meter serials being issued.'],
            ]);
        }

        $meters = Meter::query()->whereIn('id', $ids)->lockForUpdate()->get();
        if (
            $meters->count() !== $ids->count()
            || $meters->contains(fn (Meter $meter) => $meter->status !== 'available'
                || (int) $meter->inventory_item_id !== (int) $stockItem->id
                || (int) $meter->current_warehouse_id !== $warehouseId)
        ) {
            throw ValidationException::withMessages([
                "items.{$index}.meter_ids" => ['One or more selected meter serials are no longer available in this warehouse.'],
            ]);
        }

        return [
            $ids->all(),
            $meters->sortBy(fn (Meter $meter) => $ids->search($meter->id))->pluck('meter_number')->values()->all(),
        ];
    }

    private function assertPurchaseSerialsAreNotReserved(array $lines): void
    {
        $serials = collect($lines)
            ->flatMap(fn (array $line) => $line['meter_serials'] ?? [])
            ->map(fn (string $serial) => mb_strtolower($serial))
            ->values();
        if ($serials->duplicates()->isNotEmpty()) {
            throw ValidationException::withMessages([
                'items' => ['A meter serial cannot be repeated across purchase lines.'],
            ]);
        }
        if ($serials->isEmpty()) {
            return;
        }

        $reserved = InventoryRequestItem::query()
            ->whereNotNull('meter_serials')
            ->whereHas('request', fn ($query) => $query->where('type', 'purchase')->where('status', 'pending'))
            ->get(['meter_serials'])
            ->flatMap(fn (InventoryRequestItem $item) => $item->meter_serials ?? [])
            ->map(fn ($serial) => mb_strtolower(trim((string) $serial)));
        $conflict = $serials->first(fn (string $serial) => $reserved->contains($serial));
        if ($conflict) {
            throw ValidationException::withMessages([
                'items' => ["Meter serial {$conflict} is already reserved by a pending purchase."],
            ]);
        }
    }

    private function relations(): array
    {
        return [
            'items.good',
            'items.inventoryItem.warehouse',
            'supplier',
            'customer',
            'department',
            'account',
            'paymentMethod',
            'purchasePayments.account',
            'purchasePayments.paymentMethod',
            'purchasePayments.recorder',
            'invoice.items.category',
            'invoice.allocations.payment.paymentMethod',
            'invoice.allocations.payment.account',
            'invoice.allocations.payment.receiver',
            'warehouse',
            'requester',
            'approver',
        ];
    }
}
