<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Good;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class GoodController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Good::query();

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            });
        }

        if ($request->filled('category')) {
            $query->ofCategory($request->category);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return response()->json($query->latest('id')->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:50|unique:goods,code',
            'category' => 'required|in:pipe,meter,chemical,fuel,solar,technical,office,other',
            'unit' => 'required|string|max:50',
            'default_cost' => 'required|numeric|min:0',
            'default_price' => 'required|numeric|min:0',
            'status' => 'required|in:active,inactive',
            'description' => 'nullable|string',
        ]);

        $good = Good::create($validated);

        return response()->json([
            'message' => 'Good created successfully',
            'data' => $good,
        ], 201);
    }

    public function show(Good $good): JsonResponse
    {
        return response()->json([
            'data' => $good,
        ]);
    }

    public function update(Request $request, Good $good): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'code' => ['sometimes', 'string', 'max:50', Rule::unique('goods', 'code')->ignore($good->id)],
            'category' => 'sometimes|in:pipe,meter,chemical,fuel,solar,technical,office,other',
            'unit' => 'sometimes|string|max:50',
            'default_cost' => 'sometimes|numeric|min:0',
            'default_price' => 'sometimes|numeric|min:0',
            'status' => 'sometimes|in:active,inactive',
            'description' => 'nullable|string',
        ]);

        $good->update($validated);

        return response()->json([
            'message' => 'Good updated successfully',
            'data' => $good->fresh(),
        ]);
    }

    public function destroy(Good $good): JsonResponse
    {
        if ($good->inventoryItems()->exists()) {
            return response()->json([
                'message' => 'Cannot delete good with existing inventory items',
            ], 422);
        }

        $good->delete();

        return response()->json([
            'message' => 'Good deleted successfully',
        ]);
    }
}
