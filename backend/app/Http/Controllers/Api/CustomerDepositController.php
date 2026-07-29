<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomerDeposit;
use App\Services\CustomerContractWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerDepositController extends Controller
{
    public function __construct(private readonly CustomerContractWorkflowService $workflow) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeCashier($request);
        $deposits = CustomerDeposit::query()
            ->with($this->workflow->depositRelations())
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('customer_id'), fn ($query) => $query->where('customer_id', $request->integer('customer_id')))
            ->latest('received_at')->latest()->get();

        return response()->json(['data' => $deposits]);
    }

    public function refund(Request $request, CustomerDeposit $customerDeposit): JsonResponse
    {
        $this->authorizeCashier($request);
        $data = $request->validate([
            'refunded_at' => ['required', 'date'],
            'refund_reason' => ['required', 'string', 'max:2000'],
            'refund_reference' => ['nullable', 'string', 'max:255'],
        ]);

        return response()->json(['data' => $this->workflow->refundDeposit($customerDeposit, $data, $request->user())]);
    }

    private function authorizeCashier(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['Collector', 'Accountant', 'Manager', 'Admin', 'Super Admin']), 403, 'Only authorized finance staff can view or refund historical deposits.');
    }
}
