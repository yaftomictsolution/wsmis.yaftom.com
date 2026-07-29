<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ServiceArea;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ServiceAreaController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => ServiceArea::withCount('customers')->latest()->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['data' => ServiceArea::query()->create($this->validateArea($request))], 201);
    }

    public function show(ServiceArea $serviceArea): JsonResponse
    {
        return response()->json(['data' => $serviceArea->load('customers:id,service_area_id,name,phone,house_number,status')]);
    }

    public function update(Request $request, ServiceArea $serviceArea): JsonResponse
    {
        $serviceArea->update($this->validateArea($request, partial: true));

        return response()->json(['data' => $serviceArea->fresh()->loadCount('customers')]);
    }

    public function destroy(ServiceArea $serviceArea): JsonResponse
    {
        $serviceArea->delete();

        return response()->json(['message' => 'Service area deleted.']);
    }

    private function validateArea(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$required, 'string', 'max:255'],
            'mosque_name' => ['nullable', 'string', 'max:255'],
            'district' => ['nullable', 'string', 'max:255'],
            'street_block_village' => ['nullable', 'string', 'max:255'],
            'representative_name' => ['nullable', 'string', 'max:255'],
            'representative_phone' => ['nullable', 'string', 'max:50'],
            'households_count' => ['nullable', 'integer', 'min:0'],
            'rate_per_cubic_meter' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'inactive_reason' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]);
    }
}
