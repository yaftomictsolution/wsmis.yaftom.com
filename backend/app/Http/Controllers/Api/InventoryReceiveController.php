<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingTransaction;
use App\Models\FinancialCategory;
use App\Models\InventoryItem;
use App\Models\InventoryTransaction;
use App\Models\SupplierPurchaseContract;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryReceiveController extends Controller
{
    /**
     * Receive goods from supplier into inventory
     * This adds stock to inventory and records the financial effect
     */
    public function receive(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'supplier_purchase_contract_id' => 'nullable|exists:supplier_purchase_contracts,id',
            'receive_date' => 'required|date',
            'items' => 'required|array|min:1',
            'items.*.warehouse_id' => 'required|exists:warehouses,id',
            'items.*.name' => 'required|string|max:255',
            'items.*.code' => 'required|unique:inventory_items,code',
            'items.*.category' => 'required|in:pipe,meter,chemical,fuel,solar,technical,office,other',
            'items.*.unit' => 'nullable|string|max:50',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_cost' => 'required|numeric|min:0',
            'items.*.unit_price' => 'nullable|numeric|min:0',
            'items.*.reorder_level' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $result = DB::transaction(function () use ($validated, $request) {
            $totalCost = 0;
            $items = [];

            foreach ($validated['items'] as $item) {
                $itemTotal = $item['quantity'] * $item['unit_cost'];
                $totalCost += $itemTotal;

                // Create inventory item
                $inventoryItem = InventoryItem::create([
                    'warehouse_id' => $item['warehouse_id'],
                    'name' => $item['name'],
                    'code' => $item['code'],
                    'category' => $item['category'],
                    'unit' => $item['unit'] ?? 'piece',
                    'quantity' => $item['quantity'],
                    'unit_cost' => $item['unit_cost'],
                    'unit_price' => $item['unit_price'] ?? 0,
                    'reorder_level' => $item['reorder_level'] ?? 10,
                    'supplier_id' => $validated['supplier_id'],
                    'notes' => $validated['notes'] ?? null,
                ]);

                // Create stock-in transaction
                InventoryTransaction::create([
                    'inventory_item_id' => $inventoryItem->id,
                    'type' => 'purchase',
                    'quantity' => $item['quantity'],
                    'unit_cost' => $item['unit_cost'],
                    'unit_price' => $item['unit_price'] ?? 0,
                    'total_amount' => $itemTotal,
                    'transaction_date' => $validated['receive_date'],
                    'reference_type' => SupplierPurchaseContract::class,
                    'reference_id' => $validated['supplier_purchase_contract_id'] ?? null,
                    'notes' => "Received from supplier",
                    'created_by' => $request->user()?->id,
                ]);

                $items[] = $inventoryItem;
            }

            // Record accounting transaction (inventory asset increase)
            if ($totalCost > 0) {
                $categoryId = FinancialCategory::query()
                    ->firstOrCreate(
                        ['code' => 'inventory_purchase'],
                        ['name' => 'Inventory Purchase', 'type' => 'asset', 'status' => 'active']
                    )->id;

                AccountingTransaction::create([
                    'financial_category_id' => $categoryId,
                    'supplier_id' => $validated['supplier_id'],
                    'recorded_by' => $request->requestedBy ?? $request->user()?->id,
                    'transaction_number' => AccountingTransaction::nextNumber('expense'),
                    'type' => 'expense',
                    'title' => 'Inventory Purchase - Goods Received',
                    'amount' => $totalCost,
                    'transaction_date' => $validated['receive_date'],
                    'status' => 'approved',
                    'description' => $validated['notes'] ?? null,
                ]);
            }

            return $items;
        });

        return response()->json([
            'message' => 'Goods received into inventory successfully',
            'items' => $result,
        ], 201);
    }
}
