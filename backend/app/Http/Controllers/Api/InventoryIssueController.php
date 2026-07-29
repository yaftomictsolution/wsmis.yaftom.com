<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingTransaction;
use App\Models\FinancialCategory;
use App\Models\InventoryItem;
use App\Models\InventoryIssue;
use App\Models\InventoryIssueItem;
use App\Models\InventoryTransaction;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryIssueController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = InventoryIssue::with(['department', 'customer', 'requester', 'approver']);

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->customer_id);
        }

        return response()->json($query->orderBy('created_at', 'desc')->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'issue_date' => 'required|date',
            'type' => 'required|in:internal,customer',
            'department_id' => 'required_if:type,internal|nullable|exists:departments,id',
            'customer_id' => 'required_if:type,customer|nullable|exists:customers,id',
            'customer_contract_id' => 'nullable|exists:customer_contracts,id',
            'items' => 'required|array|min:1',
            'items.*.inventory_item_id' => 'required|exists:inventory_items,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_price' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $issue = DB::transaction(function () use ($validated, $request) {
            $totalCost = 0;
            $totalPrice = 0;

            $issue = InventoryIssue::create([
                'issue_number' => 'ISS-' . str_pad(InventoryIssue::count() + 1, 5, '0', STR_PAD_LEFT),
                'issue_date' => $validated['issue_date'],
                'type' => $validated['type'],
                'department_id' => $validated['department_id'] ?? null,
                'customer_id' => $validated['customer_id'] ?? null,
                'customer_contract_id' => $validated['customer_contract_id'] ?? null,
                'status' => 'issued',
                'notes' => $validated['notes'] ?? null,
                'created_by' => auth()->id(),
                'requested_by' => auth()->id(),
            ]);

            foreach ($validated['items'] as $item) {
                $inventoryItem = InventoryItem::findOrFail($item['inventory_item_id']);

                if ($inventoryItem->quantity < $item['quantity']) {
                    throw new \Exception("Insufficient stock for {$inventoryItem->name}. Available: {$inventoryItem->quantity}");
                }

                $unitCost = $inventoryItem->unit_cost;
                $unitPrice = $item['unit_price'] ?? $inventoryItem->unit_price;
                $itemTotalCost = $unitCost * $item['quantity'];
                $itemTotalPrice = $unitPrice * $item['quantity'];
                $totalCost += $itemTotalCost;
                $totalPrice += $itemTotalPrice;

                InventoryIssueItem::create([
                    'inventory_issue_id' => $issue->id,
                    'inventory_item_id' => $item['inventory_item_id'],
                    'quantity' => $item['quantity'],
                    'unit_cost' => $unitCost,
                    'unit_price' => $unitPrice,
                    'total_cost' => $itemTotalCost,
                    'total_price' => $itemTotalPrice,
                ]);

                InventoryTransaction::create([
                    'inventory_item_id' => $item['inventory_item_id'],
                    'type' => $validated['type'] === 'customer' ? 'sale' : 'internal_use',
                    'quantity' => -$item['quantity'],
                    'unit_cost' => $unitCost,
                    'unit_price' => $unitPrice,
                    'total_amount' => $itemTotalPrice,
                    'transaction_date' => $validated['issue_date'],
                    'reference_type' => InventoryIssue::class,
                    'reference_id' => $issue->id,
                    'created_by' => auth()->id(),
                ]);

                $inventoryItem->decrement('quantity', $item['quantity']);
            }

            $issue->update(['total_cost' => $totalCost, 'total_price' => $totalPrice]);

            if ($validated['type'] === 'customer' && $totalPrice > 0) {
                $this->handleCustomerSale($issue, $validated, $totalCost, $totalPrice);
            }

            if ($validated['type'] === 'internal' && $totalCost > 0) {
                $this->handleInternalUse($issue, $validated, $totalCost);
            }

            return $issue;
        });

        return response()->json([
            'message' => 'Issue created successfully',
            'issue' => $issue->load(['items.inventoryItem', 'customer', 'department', 'invoice']),
        ], 201);
    }

    private function handleCustomerSale(InventoryIssue $issue, array $validated, float $totalCost, float $totalPrice): void
    {
        $invoice = Invoice::create([
            'customer_id' => $validated['customer_id'],
            'invoice_number' => 'INV-' . str_pad(Invoice::count() + 1, 5, '0', STR_PAD_LEFT),
            'issue_date' => $validated['issue_date'],
            'due_date' => now()->addDays(30)->toDateString(),
            'previous_balance' => 0,
            'consumption' => 0,
            'rate_per_cubic_meter' => 0,
            'water_amount' => 0,
            'penalty_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => $totalPrice,
            'paid_amount' => 0,
            'remaining_amount' => $totalPrice,
            'status' => 'unpaid',
            'notes' => 'Inventory sales - Issue: ' . $issue->issue_number,
            'invoice_type' => 'inventory',
        ]);

        foreach ($issue->items as $item) {
            InvoiceItem::create([
                'invoice_id' => $invoice->id,
                'item_type' => 'inventory_sale',
                'description' => $item->inventoryItem->name,
                'quantity' => $item->quantity,
                'unit_price' => $item->unit_price,
                'amount' => $item->total_price,
            ]);
        }

        $issue->update(['invoice_id' => $invoice->id]);

        $incomeCategoryId = FinancialCategory::query()
            ->firstOrCreate(
                ['code' => 'inventory_sale_income'],
                ['name' => 'Inventory Sale Income', 'type' => 'income', 'status' => 'active']
            )->id;

        $incomeTransaction = AccountingTransaction::create([
            'financial_category_id' => $incomeCategoryId,
            'customer_id' => $validated['customer_id'],
            'recorded_by' => auth()->id(),
            'transaction_number' => AccountingTransaction::nextNumber('income'),
            'type' => 'income',
            'title' => 'Inventory Sale - ' . $issue->issue_number,
            'amount' => $totalPrice,
            'received_from' => $issue->customer?->name,
            'transaction_date' => $validated['issue_date'],
            'status' => 'approved',
            'description' => 'Revenue from inventory sales',
        ]);

        $cogsCategoryId = FinancialCategory::query()
            ->firstOrCreate(
                ['code' => 'cogs_inventory'],
                ['name' => 'Cost of Goods Sold - Inventory', 'type' => 'expense', 'status' => 'active']
            )->id;

        AccountingTransaction::create([
            'financial_category_id' => $cogsCategoryId,
            'customer_id' => $validated['customer_id'],
            'recorded_by' => auth()->id(),
            'transaction_number' => AccountingTransaction::nextNumber('expense'),
            'type' => 'expense',
            'title' => 'COGS - Inventory Issue ' . $issue->issue_number,
            'amount' => $totalCost,
            'transaction_date' => $validated['issue_date'],
            'status' => 'approved',
            'description' => 'Cost of goods sold for inventory issue',
        ]);

        $issue->update(['accounting_transaction_id' => $incomeTransaction->id]);
    }

    private function handleInternalUse(InventoryIssue $issue, array $validated, float $totalCost): void
    {
        $expenseCategoryId = FinancialCategory::query()
            ->firstOrCreate(
                ['code' => 'internal_material_usage'],
                ['name' => 'Internal Material Usage', 'type' => 'expense', 'status' => 'active']
            )->id;

        $transaction = AccountingTransaction::create([
            'financial_category_id' => $expenseCategoryId,
            'recorded_by' => auth()->id(),
            'transaction_number' => AccountingTransaction::nextNumber('expense'),
            'type' => 'expense',
            'title' => 'Internal Material Usage - ' . $issue->issue_number,
            'amount' => $totalCost,
            'transaction_date' => $validated['issue_date'],
            'status' => 'approved',
            'description' => 'Materials used internally - Issue: ' . $issue->issue_number,
        ]);

        $issue->update(['accounting_transaction_id' => $transaction->id]);
    }

    public function show(InventoryIssue $issue): JsonResponse
    {
        return response()->json(
            $issue->load(['items.inventoryItem', 'customer', 'department', 'requester', 'approver', 'invoice', 'transaction'])
        );
    }

    public function approve(InventoryIssue $issue): JsonResponse
    {
        $issue->update(['status' => 'approved', 'approved_by' => auth()->id()]);
        return response()->json(['message' => 'Issue approved', 'issue' => $issue->fresh()]);
    }

    public function issue(InventoryIssue $issue): JsonResponse
    {
        $issue->update(['status' => 'issued']);
        return response()->json(['message' => 'Issue marked as issued', 'issue' => $issue->fresh()]);
    }

    public function cancel(InventoryIssue $issue): JsonResponse
    {
        DB::transaction(function () use ($issue) {
            foreach ($issue->items as $item) {
                $item->inventoryItem->increment('quantity', $item->quantity);
                InventoryTransaction::create([
                    'inventory_item_id' => $item->inventory_item_id,
                    'type' => 'return',
                    'quantity' => $item->quantity,
                    'unit_cost' => $item->unit_cost,
                    'unit_price' => $item->unit_price,
                    'total_amount' => $item->total_price,
                    'transaction_date' => now(),
                    'reference_type' => InventoryIssue::class,
                    'reference_id' => $issue->id,
                    'notes' => 'Cancelled issue reversal',
                    'created_by' => auth()->id(),
                ]);
            }
            $issue->update(['status' => 'cancelled']);
        });
        return response()->json(['message' => 'Issue cancelled and stock restored']);
    }
}
