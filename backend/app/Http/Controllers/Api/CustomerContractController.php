<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerContract;
use App\Services\CustomerContractWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerContractController extends Controller
{
    public function __construct(private readonly CustomerContractWorkflowService $workflow) {}

    public function index(Request $request): JsonResponse
    {
        $contracts = CustomerContract::query()
            ->with($this->workflow->relations())
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('customer_id'), fn ($query) => $query->where('customer_id', $request->integer('customer_id')))
            ->latest()->get();

        return response()->json(['data' => $contracts]);
    }

    public function show(CustomerContract $customerContract): JsonResponse
    {
        return response()->json(['data' => $customerContract->load($this->workflow->relations())]);
    }

    public function store(Request $request, Customer $customer): JsonResponse
    {
        $this->authorizeManage($request, 'create');
        $contract = $this->workflow->create($customer, $this->validateContract($request), $request->user());

        return response()->json(['data' => $contract], 201);
    }

    public function update(Request $request, CustomerContract $customerContract): JsonResponse
    {
        $this->authorizeManage($request, 'update');
        $contract = $this->workflow->update($customerContract, $this->validateContract($request), $request->user());

        return response()->json(['data' => $contract]);
    }

    public function markPrinted(Request $request, CustomerContract $customerContract): JsonResponse
    {
        $this->authorizeManage($request, 'update');

        return response()->json(['data' => $this->workflow->markPrinted($customerContract)]);
    }

    public function confirm(Request $request, CustomerContract $customerContract): JsonResponse
    {
        $this->authorizeManage($request, 'update');

        return response()->json(['data' => $this->workflow->confirm($customerContract, $request->user())]);
    }

    public function cancel(Request $request, CustomerContract $customerContract): JsonResponse
    {
        $this->authorizeManage($request, 'update');
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
            'refund_posted_payments' => ['sometimes', 'boolean'],
            'refunded_at' => ['nullable', 'required_if:refund_posted_payments,true', 'date'],
            'refund_reference' => ['nullable', 'string', 'max:255'],
        ]);

        return response()->json([
            'data' => $this->workflow->cancel($customerContract, $request->user(), $data['reason'], $data),
        ]);
    }

    private function validateContract(Request $request): array
    {
        return $request->validate([
            'subscription_date' => ['required', 'date'],
            'meter_size' => ['nullable', 'string', 'max:100'],
            'connection_fee' => ['required', 'numeric', 'min:0'],
            'meter_fee' => ['required', 'numeric', 'min:0'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'discount_approved_by' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);
    }

    private function authorizeManage(Request $request, string $action): void
    {
        $user = $request->user();
        abort_unless(
            $user?->hasAnyRole(['Manager', 'Admin', 'Super Admin'])
                || $user?->can("customer-contracts.{$action}"),
            403,
            'You do not have permission to manage customer contracts.',
        );
    }
}
