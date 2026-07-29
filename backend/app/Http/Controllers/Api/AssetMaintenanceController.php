<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetMaintenance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AssetMaintenanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AssetMaintenance::with(['asset', 'creator']);

        if ($request->filled('asset_id')) {
            $query->where('asset_id', $request->asset_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('type')) {
            $query->ofType($request->type);
        }

        if ($request->boolean('upcoming')) {
            $query->upcoming();
        }

        $maintenance = $query->orderBy('next_due_date')->paginate(20);

        return response()->json($maintenance);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'asset_id' => 'required|exists:assets,id',
            'maintenance_type' => 'required|in:preventive,corrective,emergency',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'cost' => 'nullable|numeric|min:0',
            'performed_at' => 'required|date',
            'next_due_date' => 'nullable|date',
            'status' => 'nullable|in:scheduled,in_progress,completed,cancelled',
            'performed_by' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        $this->validateDates($validated);
        $maintenance = DB::transaction(function () use ($validated): AssetMaintenance {
            $maintenance = AssetMaintenance::query()->create($validated + ['created_by' => auth()->id()]);
            $this->syncAssetStatus($maintenance->asset);

            return $maintenance;
        });

        return response()->json([
            'message' => 'Maintenance record created',
            'data' => $maintenance->load(['asset', 'creator']),
        ], 201);
    }

    public function show(AssetMaintenance $maintenance): JsonResponse
    {
        return response()->json([
            'data' => $maintenance->load(['asset', 'creator']),
        ]);
    }

    public function update(Request $request, AssetMaintenance $maintenance): JsonResponse
    {
        $validated = $request->validate([
            'maintenance_type' => 'sometimes|in:preventive,corrective,emergency',
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'cost' => 'nullable|numeric|min:0',
            'performed_at' => 'sometimes|date',
            'next_due_date' => 'nullable|date',
            'status' => 'sometimes|in:scheduled,in_progress,completed,cancelled',
            'performed_by' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        $this->validateDates($validated, $maintenance);
        DB::transaction(function () use ($maintenance, $validated): void {
            $maintenance->update($validated);
            $this->syncAssetStatus($maintenance->asset);
        });

        return response()->json([
            'message' => 'Maintenance record updated',
            'data' => $maintenance->fresh()->load(['asset', 'creator']),
        ]);
    }

    public function destroy(AssetMaintenance $maintenance): JsonResponse
    {
        DB::transaction(function () use ($maintenance): void {
            $asset = $maintenance->asset;
            $maintenance->delete();
            $this->syncAssetStatus($asset);
        });

        return response()->json([
            'message' => 'Maintenance record deleted',
        ]);
    }

    public function upcoming(): JsonResponse
    {
        $upcoming = AssetMaintenance::upcoming()
            ->with('asset')
            ->get();

        return response()->json(['data' => $upcoming]);
    }

    private function validateDates(array $data, ?AssetMaintenance $maintenance = null): void
    {
        $performedAt = $data['performed_at'] ?? $maintenance?->performed_at?->toDateString();
        $nextDueDate = $data['next_due_date'] ?? $maintenance?->next_due_date?->toDateString();

        if ($performedAt && $nextDueDate && $nextDueDate < $performedAt) {
            throw ValidationException::withMessages([
                'next_due_date' => ['The next due date must be on or after the maintenance date.'],
            ]);
        }
    }

    private function syncAssetStatus(Asset $asset): void
    {
        $hasActiveMaintenance = $asset->maintenance()
            ->where('status', 'in_progress')
            ->exists();

        if ($hasActiveMaintenance && $asset->status !== 'maintenance') {
            $asset->update(['status' => 'maintenance']);
        } elseif (! $hasActiveMaintenance && $asset->status === 'maintenance') {
            $asset->update(['status' => 'active']);
        }
    }
}
