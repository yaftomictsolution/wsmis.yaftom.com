<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentMethod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PaymentMethodController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => PaymentMethod::query()->orderBy('name')->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['data' => PaymentMethod::query()->create($this->validatePaymentMethod($request))], 201);
    }

    public function update(Request $request, PaymentMethod $paymentMethod): JsonResponse
    {
        $paymentMethod->update($this->validatePaymentMethod($request, $paymentMethod->id, partial: true));

        return response()->json(['data' => $paymentMethod->fresh()]);
    }

    public function destroy(PaymentMethod $paymentMethod): JsonResponse
    {
        $paymentMethod->delete();

        return response()->json(['message' => 'Payment method deleted.']);
    }

    private function validatePaymentMethod(Request $request, ?int $id = null, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$required, 'string', 'max:255'],
            'code' => [$required, 'string', 'max:100', Rule::unique('payment_methods', 'code')->ignore($id)],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);
    }
}
