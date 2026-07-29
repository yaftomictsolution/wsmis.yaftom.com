<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomerChargeType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CustomerChargeTypeController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => CustomerChargeType::query()
                ->withCount('charges')
                ->orderByDesc('is_system')
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeManage($request);
        $data = $this->validateType($request);
        $data['code'] = $this->nextCode($data['name']);
        $data['status'] = $data['status'] ?? 'active';
        $data['is_system'] = false;

        $type = CustomerChargeType::query()->create($data);

        return response()->json(['data' => $type->loadCount('charges')], 201);
    }

    public function update(Request $request, CustomerChargeType $customerChargeType): JsonResponse
    {
        $this->authorizeManage($request);
        $data = $this->validateType($request, $customerChargeType->id, partial: true);

        if ($customerChargeType->is_system && ($data['status'] ?? null) === 'inactive') {
            throw ValidationException::withMessages([
                'status' => ['Required system charge types cannot be deactivated.'],
            ]);
        }

        $customerChargeType->update($data);

        return response()->json(['data' => $customerChargeType->fresh()->loadCount('charges')]);
    }

    public function destroy(Request $request, CustomerChargeType $customerChargeType): JsonResponse
    {
        $this->authorizeManage($request);

        abort_if($customerChargeType->is_system, 422, 'Required system charge types cannot be deleted.');
        abort_if($customerChargeType->charges()->exists(), 422, 'A charge type used by customer history cannot be deleted. Set it inactive instead.');

        $customerChargeType->delete();

        return response()->json(['message' => 'Customer charge type deleted.']);
    }

    private function validateType(Request $request, ?int $id = null, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$required, 'string', 'max:255', Rule::unique('customer_charge_types', 'name')->ignore($id)],
            'description' => ['nullable', 'string', 'max:2000'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);
    }

    private function nextCode(string $name): string
    {
        $base = Str::slug($name, '_') ?: 'charge_type';
        $code = $base;
        $suffix = 2;

        while (CustomerChargeType::query()->where('code', $code)->exists()) {
            $code = $base.'_'.$suffix;
            $suffix++;
        }

        return $code;
    }

    private function authorizeManage(Request $request): void
    {
        $user = $request->user();
        abort_unless(
            $user?->hasAnyRole(['Admin', 'Super Admin']) || $user?->can('settings.update'),
            403,
            'Only administrators can manage customer charge types.',
        );
    }
}
