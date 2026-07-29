<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\InventoryItem;
use App\Models\InventoryRequest;
use App\Models\InventoryTransaction;
use App\Models\Meter;
use App\Models\Warehouse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InventoryController extends Controller
{
    // Warehouse CRUD
    public function warehouses(Request $request): JsonResponse
    {
        $query = Warehouse::query()
            ->select('warehouses.*')
            ->with('serviceArea')
            ->withCount([
                'items',
                'items as products_count',
                'items as low_stock_count' => fn ($query) => $query->whereColumn('quantity', '<=', 'reorder_level'),
                'items as out_of_stock_count' => fn ($query) => $query->where('quantity', '<=', 0),
                'availableMeters as available_meter_serials_count',
            ])
            ->withSum('items as total_quantity', 'quantity')
            ->selectSub(
                InventoryItem::query()
                    ->selectRaw('COALESCE(SUM(quantity * unit_cost), 0)')
                    ->whereColumn('warehouse_id', 'warehouses.id'),
                'stock_value'
            )
            ->selectSub(
                InventoryTransaction::query()
                    ->selectRaw('DATE(inventory_transactions.transaction_date)')
                    ->join('inventory_items', 'inventory_items.id', '=', 'inventory_transactions.inventory_item_id')
                    ->whereColumn('inventory_items.warehouse_id', 'warehouses.id')
                    ->orderByDesc('inventory_transactions.transaction_date')
                    ->orderByDesc('inventory_transactions.id')
                    ->limit(1),
                'last_movement_at'
            )
            ->when($request->filled('status'), fn($q) => $q->where('status', $request->status))
            ->when($request->filled('search'), function ($q) use ($request) {
                $search = $request->search;
                $q->where(function ($sub) use ($search) {
                    $sub->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%")
                        ->orWhere('address', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->paginate(20);

        $payload = $query->toArray();
        $payload['summary'] = [
            'total_warehouses' => Warehouse::query()->count(),
            'active_warehouses' => Warehouse::query()->where('status', 'active')->count(),
            'products_count' => InventoryItem::query()->count(),
            'total_quantity' => (float) InventoryItem::query()->sum('quantity'),
            'stock_value' => (float) (InventoryItem::query()
                ->selectRaw('COALESCE(SUM(quantity * unit_cost), 0) as total')
                ->value('total') ?? 0),
            'low_stock_count' => InventoryItem::query()->lowStock()->count(),
            'out_of_stock_count' => InventoryItem::query()->where('quantity', '<=', 0)->count(),
        ];

        return response()->json($payload);
    }

    public function warehouseDetails(Request $request, Warehouse $warehouse): JsonResponse
    {
        $inventoryPerPage = min(max($request->integer('inventory_per_page', 10), 1), 50);
        $movementPerPage = min(max($request->integer('movement_per_page', 10), 1), 50);
        $meterPerPage = min(max($request->integer('meter_per_page', 10), 1), 50);

        $inventory = $warehouse->items()
            ->with(['good', 'supplier'])
            ->withCount([
                'meters as serialized_available_count' => fn ($query) => $query
                    ->where('status', 'available')
                    ->where('current_warehouse_id', $warehouse->id),
            ])
            ->when($request->filled('inventory_search'), function ($query) use ($request) {
                $search = $request->string('inventory_search')->trim()->toString();
                $query->where(function ($subQuery) use ($search) {
                    $subQuery->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%")
                        ->orWhereHas('good', function ($goodQuery) use ($search) {
                            $goodQuery->where('name', 'like', "%{$search}%")
                                ->orWhere('code', 'like', "%{$search}%");
                        });
                });
            })
            ->when($request->filled('category'), fn ($query) => $query->where('category', $request->string('category')->toString()))
            ->when($request->input('stock_status') === 'low', fn ($query) => $query->lowStock()->where('quantity', '>', 0))
            ->when($request->input('stock_status') === 'out', fn ($query) => $query->where('quantity', '<=', 0))
            ->when($request->input('stock_status') === 'available', fn ($query) => $query->whereColumn('quantity', '>', 'reorder_level'))
            ->orderBy('name')
            ->paginate($inventoryPerPage, ['*'], 'inventory_page');

        $movements = InventoryTransaction::query()
            ->with(['inventoryItem.good', 'creator'])
            ->whereHas('inventoryItem', fn ($query) => $query->where('warehouse_id', $warehouse->id))
            ->when($request->filled('movement_type'), fn ($query) => $query->ofType($request->string('movement_type')->toString()))
            ->when(
                $request->filled('movement_from') && $request->filled('movement_to'),
                fn ($query) => $query->inDateRange(
                    $request->string('movement_from')->toString(),
                    $request->string('movement_to')->toString()
                )
            )
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->paginate($movementPerPage, ['*'], 'movement_page');

        $meters = Meter::query()
            ->with([
                'good:id,name,code',
                'supplier:id,name',
                'purchaseItem.request:id,request_number,supplier_id,warehouse_id,request_date',
            ])
            ->where('current_warehouse_id', $warehouse->id)
            ->when($request->filled('meter_search'), function ($query) use ($request) {
                $search = $request->string('meter_search')->trim()->toString();
                $query->where(function ($subQuery) use ($search) {
                    $subQuery->where('meter_number', 'like', "%{$search}%")
                        ->orWhereHas('good', fn ($goodQuery) => $goodQuery
                            ->where('name', 'like', "%{$search}%")
                            ->orWhere('code', 'like', "%{$search}%"));
                });
            })
            ->when($request->filled('meter_status'), fn ($query) => $query->where('status', $request->string('meter_status')->toString()))
            ->latest('id')
            ->paginate($meterPerPage, ['*'], 'meter_page');

        $stockSummary = $warehouse->items()
            ->selectRaw('COUNT(*) as products_count')
            ->selectRaw('COALESCE(SUM(quantity), 0) as total_quantity')
            ->selectRaw('COALESCE(SUM(quantity * unit_cost), 0) as stock_value')
            ->selectRaw('SUM(CASE WHEN quantity <= reorder_level THEN 1 ELSE 0 END) as low_stock_count')
            ->selectRaw('SUM(CASE WHEN quantity <= 0 THEN 1 ELSE 0 END) as out_of_stock_count')
            ->first();

        $lastMovementAt = InventoryTransaction::query()
            ->whereHas('inventoryItem', fn ($query) => $query->where('warehouse_id', $warehouse->id))
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->value('transaction_date');

        return response()->json([
            'data' => [
                'warehouse' => $warehouse->load('serviceArea'),
                'summary' => [
                    'products_count' => (int) ($stockSummary?->products_count ?? 0),
                    'total_quantity' => (float) ($stockSummary?->total_quantity ?? 0),
                    'stock_value' => (float) ($stockSummary?->stock_value ?? 0),
                    'low_stock_count' => (int) ($stockSummary?->low_stock_count ?? 0),
                    'out_of_stock_count' => (int) ($stockSummary?->out_of_stock_count ?? 0),
                    'last_movement_at' => $lastMovementAt ? Carbon::parse($lastMovementAt)->toDateString() : null,
                    'available_meter_serials' => Meter::query()
                        ->where('current_warehouse_id', $warehouse->id)
                        ->where('status', 'available')
                        ->count(),
                ],
                'inventory' => $inventory,
                'movements' => $movements,
                'meters' => $meters,
            ],
        ]);
    }

    public function storeWarehouse(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|unique:warehouses,code',
            'address' => 'nullable|string',
            'service_area_id' => 'nullable|exists:service_areas,id',
            'status' => 'nullable|in:active,inactive',
            'notes' => 'nullable|string',
        ]);

        $warehouse = Warehouse::create($validated);

        return response()->json([
            'message' => 'Warehouse created',
            'data' => $warehouse,
            'warehouse' => $warehouse,
        ], 201);
    }

    public function updateWarehouse(Request $request, Warehouse $warehouse): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'code' => ['sometimes', 'string', 'max:255', Rule::unique('warehouses', 'code')->ignore($warehouse->id)],
            'address' => 'nullable|string',
            'service_area_id' => 'nullable|exists:service_areas,id',
            'status' => 'sometimes|in:active,inactive',
            'notes' => 'nullable|string',
        ]);

        $warehouse->update($validated);

        return response()->json([
            'message' => 'Warehouse updated',
            'data' => $warehouse->fresh()->load('serviceArea'),
            'warehouse' => $warehouse->fresh(),
        ]);
    }

    public function destroyWarehouse(Warehouse $warehouse): JsonResponse
    {
        if ($warehouse->items()->exists()) {
            return response()->json([
                'message' => 'Move or remove this warehouse stock before deleting the warehouse.',
            ], 422);
        }

        if (InventoryRequest::query()->where('warehouse_id', $warehouse->id)->exists()) {
            return response()->json([
                'message' => 'A warehouse used by inventory history cannot be deleted. Mark it inactive instead.',
            ], 422);
        }

        $warehouse->delete();

        return response()->json(['message' => 'Warehouse deleted']);
    }

    // Inventory Items
    public function items(Request $request): JsonResponse
    {
        $query = InventoryItem::with(['warehouse', 'supplier', 'good'])
            ->withCount([
                'meters as serialized_available_count' => fn ($meterQuery) => $meterQuery->where('status', 'available'),
            ])
            ->when($request->filled('warehouse_id'), fn($q) => $q->where('warehouse_id', $request->warehouse_id))
            ->when($request->filled('category'), fn($q) => $q->ofCategory($request->category))
            ->when($request->boolean('low_stock'), fn($q) => $q->lowStock())
            ->when($request->filled('search'), function ($q) use ($request) {
                $search = $request->search;
                $q->where(function ($sub) use ($search) {
                    $sub->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%");
                });
            });

        return response()->json($query->orderBy('name')->paginate(20));
    }

    public function storeItem(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'good_id' => 'nullable|exists:goods,id',
            'warehouse_id' => 'required|exists:warehouses,id',
            'name' => 'required|string|max:255',
            'code' => 'required|unique:inventory_items,code',
            'category' => 'required|in:pipe,meter,chemical,fuel,solar,technical,office,other',
            'unit' => 'nullable|string|max:50',
            'quantity' => 'nullable|numeric|min:0',
            'unit_cost' => 'nullable|numeric|min:0',
            'unit_price' => 'nullable|numeric|min:0',
            'reorder_level' => 'nullable|numeric|min:0',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'notes' => 'nullable|string',
        ]);
        if ($validated['category'] === 'meter' && (float) ($validated['quantity'] ?? 0) > 0.0001) {
            return response()->json([
                'message' => 'Meter stock must be received through Purchase Goods with physical serial numbers, or registered as Opening Meter Stock.',
            ], 422);
        }

        $item = InventoryItem::create($validated);

        return response()->json([
            'message' => 'Item created',
            'data' => $item->load(['warehouse', 'supplier', 'good']),
            'item' => $item->load(['warehouse', 'supplier', 'good']),
        ], 201);
    }

    public function updateItem(Request $request, InventoryItem $item): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'category' => 'sometimes|in:pipe,meter,chemical,fuel,solar,technical,office,other',
            'unit' => 'nullable|string|max:50',
            'reorder_level' => 'nullable|numeric|min:0',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'notes' => 'nullable|string',
        ]);

        $item->update($validated);

        return response()->json([
            'message' => 'Item updated',
            'data' => $item->fresh()->load(['warehouse', 'supplier', 'good']),
            'item' => $item->fresh(),
        ]);
    }

    public function destroyItem(InventoryItem $item): JsonResponse
    {
        if (abs((float) $item->quantity) > 0.0001) {
            return response()->json([
                'message' => 'Adjust this item stock to zero before deleting it.',
            ], 422);
        }

        if ($item->transactions()->exists() || $item->issueItems()->exists() || $item->requestItems()->exists()) {
            return response()->json([
                'message' => 'An inventory item with transaction history cannot be deleted.',
            ], 422);
        }

        $item->delete();

        return response()->json(['message' => 'Item deleted']);
    }

    // Transactions
    public function transactions(Request $request): JsonResponse
    {
        $query = InventoryTransaction::with(['inventoryItem', 'creator'])
            ->when($request->filled('type'), fn($q) => $q->ofType($request->type))
            ->when($request->filled('inventory_item_id'), fn($q) => $q->where('inventory_item_id', $request->inventory_item_id))
            ->when($request->filled('from') && $request->filled('to'), fn($q) => $q->inDateRange($request->from, $request->to));

        return response()->json($query->orderBy('transaction_date', 'desc')->paginate(20));
    }

    public function stats(): JsonResponse
    {
        $stats = [
            'total_items' => InventoryItem::count(),
            'low_stock' => InventoryItem::lowStock()->count(),
            'total_value' => InventoryItem::select(DB::raw('SUM(quantity * unit_cost) as total'))->value('total') ?? 0,
            'by_category' => InventoryItem::select('category', DB::raw('count(*) as count'))
                ->groupBy('category')
                ->pluck('count', 'category'),
        ];

        return response()->json($stats);
    }

    // Departments (for issue form dropdown)
    public function departments(): JsonResponse
    {
        $departments = Department::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'code', 'name']);

        return response()->json(['data' => $departments]);
    }
}
