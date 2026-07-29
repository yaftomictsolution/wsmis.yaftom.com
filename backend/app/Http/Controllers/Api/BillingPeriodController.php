<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BillingPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BillingPeriodController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => BillingPeriod::withCount(['meterReadings', 'invoices'])->latest('starts_on')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $period = BillingPeriod::query()->create($this->validatePeriod($request));

        return response()->json(['data' => $period], 201);
    }

    public function show(BillingPeriod $billingPeriod): JsonResponse
    {
        return response()->json([
            'data' => $billingPeriod->load(['meterReadings.customer:id,name', 'invoices.customer:id,name']),
        ]);
    }

    public function update(Request $request, BillingPeriod $billingPeriod): JsonResponse
    {
        $billingPeriod->update($this->validatePeriod($request, $billingPeriod->id, partial: true));

        return response()->json(['data' => $billingPeriod->fresh()]);
    }

    public function destroy(BillingPeriod $billingPeriod): JsonResponse
    {
        abort_if($billingPeriod->meterReadings()->exists() || $billingPeriod->invoices()->exists(), 422, 'A billing period with readings or invoices cannot be deleted.');

        $billingPeriod->delete();

        return response()->json(['message' => 'Billing period deleted.']);
    }

    private function validatePeriod(Request $request, ?int $id = null, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$required, 'string', 'max:255'],
            'code' => [$required, 'string', 'max:50', Rule::unique('billing_periods', 'code')->ignore($id)],
            'starts_on' => [$required, 'date'],
            'ends_on' => [$required, 'date', 'after_or_equal:starts_on'],
            'status' => ['nullable', Rule::in(['open', 'closed', 'locked'])],
            'locked_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);
    }
}
