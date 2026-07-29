<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AssetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Asset::with([
            'serviceArea',
            'supplier',
            'creator',
            'purchase:id,purchase_number,accounting_account_id,accounting_transaction_id,quantity,unit_cost,total_amount,status',
            'purchase.account:id,name,code,type',
            'purchase.transaction:id,transaction_number,status',
        ]);

        // Filter by type
        if ($request->filled('type')) {
            $query->ofType($request->type);
        }

        // Filter by status
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        // Filter by service area
        if ($request->filled('service_area_id')) {
            $query->where('service_area_id', $request->service_area_id);
        }

        // Search
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('asset_code', 'like', "%{$search}%")
                  ->orWhere('name', 'like', "%{$search}%");
            });
        }

        $assets = $query->orderBy('created_at', 'desc')->paginate(20);

        return response()->json($assets);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'asset_code' => 'required|unique:assets,asset_code',
            'name' => 'required|string|max:255',
            'type' => 'required|in:well,reservoir,generator,solar,technical',
            'status' => 'nullable|in:active,inactive,maintenance,retired',
            'service_area_id' => 'nullable|exists:service_areas,id',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'address' => 'nullable|string',
            'purchase_cost' => 'nullable|numeric|min:0',
            'purchase_date' => 'nullable|date',
            'warranty_expiry' => 'nullable|date',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'attributes' => 'nullable|array',
            'notes' => 'nullable|string',
        ]);

        $asset = DB::transaction(function () use ($validated, $request) {
            return Asset::query()->create(array_merge($validated, [
                'created_by' => $request->user()?->id,
            ]));
        });
        $asset->load(['serviceArea', 'supplier', 'purchase.account', 'purchase.transaction']);

        return response()->json([
            'message' => 'Asset created successfully',
            'data' => $asset,
        ], 201);
    }

    public function show(Asset $asset): JsonResponse
    {
        return response()->json([
            'data' => $asset->load(['serviceArea', 'supplier', 'creator', 'maintenance', 'purchase.account', 'purchase.transaction']),
        ]);
    }

    public function update(Request $request, Asset $asset): JsonResponse
    {
        $validated = $request->validate([
            'asset_code' => ['sometimes', 'string', 'max:255', Rule::unique('assets', 'asset_code')->ignore($asset->id)],
            'name' => 'sometimes|string|max:255',
            'type' => 'sometimes|in:well,reservoir,generator,solar,technical',
            'status' => 'sometimes|in:active,inactive,maintenance,retired',
            'service_area_id' => 'nullable|exists:service_areas,id',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'address' => 'nullable|string',
            'purchase_cost' => 'nullable|numeric|min:0',
            'purchase_date' => 'nullable|date',
            'warranty_expiry' => 'nullable|date',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'attributes' => 'nullable|array',
            'notes' => 'nullable|string',
        ]);

        if ($asset->asset_purchase_id) {
            unset(
                $validated['purchase_cost'],
                $validated['purchase_date'],
                $validated['supplier_id'],
            );
        }

        $asset->update($validated);

        return response()->json([
            'message' => 'Asset updated successfully',
            'data' => $asset->fresh()->load(['serviceArea', 'supplier', 'purchase.account', 'purchase.transaction']),
        ]);
    }

    public function destroy(Asset $asset): JsonResponse
    {
        if ($asset->asset_purchase_id) {
            return response()->json([
                'message' => 'A purchased asset cannot be deleted. Retire it or reverse its linked purchase.',
            ], 422);
        }

        if ($asset->maintenance()->exists()) {
            return response()->json([
                'message' => 'An asset with maintenance history cannot be deleted. Mark it retired instead.',
            ], 422);
        }

        $asset->delete();

        return response()->json([
            'message' => 'Asset deleted successfully',
        ]);
    }

    public function stats(): JsonResponse
    {
        $stats = [
            'total' => Asset::count(),
            'active' => Asset::where('status', 'active')->count(),
            'maintenance' => Asset::where('status', 'maintenance')->count(),
            'by_type' => Asset::select('type', DB::raw('count(*) as count'))
                ->groupBy('type')
                ->pluck('count', 'type'),
            'total_value' => Asset::sum('purchase_cost'),
        ];

        return response()->json($stats);
    }
}
