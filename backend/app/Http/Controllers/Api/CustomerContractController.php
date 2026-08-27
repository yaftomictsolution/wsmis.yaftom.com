<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Authority;
use App\Models\ContractCancellationRequest;
use App\Models\Customer;
use App\Models\CustomerContract;
use App\Models\User;
use App\Notifications\ContractCancellationResolved;
use App\Notifications\ContractCancellationSubmitted;
use App\Services\ContractCancellationWorkflowService;
use App\Services\CustomerContractWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;

class CustomerContractController extends Controller
{
    public function __construct(
        private readonly CustomerContractWorkflowService $workflow,
        private readonly ContractCancellationWorkflowService $cancellations,
    ) {}

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
            'materials_received_confirmed' => ['sometimes', 'boolean'],
            'refund_posted_payments' => ['sometimes', 'boolean'],
            'refund_accounting_account_id' => [
                Rule::requiredIf(fn (): bool => $request->boolean('refund_posted_payments')),
                'nullable',
                'integer',
                Rule::exists('accounting_accounts', 'id')->where('status', 'active'),
            ],
            'refunded_at' => ['nullable', 'required_if:refund_posted_payments,true', 'date', 'before_or_equal:today'],
            'refund_reference' => ['nullable', 'string', 'max:255'],
        ], [
            'refund_accounting_account_id.required' => 'Select the account that will pay the customer refund.',
            'refund_accounting_account_id.exists' => 'The selected refund account is unavailable or inactive.',
        ]);

        $cancellation = $this->cancellations->submit($customerContract, $data, $request->user());
        $admins = User::query()
            ->where('status', 'active')
            ->whereHas('roles', fn ($query) => $query->whereIn('name', ['Admin', 'Super Admin']))
            ->get();
        if ($admins->isNotEmpty()) {
            Notification::send($admins, new ContractCancellationSubmitted($cancellation));
        }

        return response()->json([
            'message' => 'Contract cancellation submitted for admin approval.',
            'data' => $cancellation,
        ], 202);
    }

    public function cancellationPreview(Request $request, CustomerContract $customerContract): JsonResponse
    {
        $this->authorizeManage($request, 'update');

        return response()->json(['data' => $this->cancellations->preview($customerContract)]);
    }

    public function resolveCancellation(
        Request $request,
        ContractCancellationRequest $contractCancellationRequest,
    ): JsonResponse {
        abort_unless(
            $request->user()?->hasAnyRole(['Admin', 'Super Admin']),
            403,
            'Only Admin can approve or reject a contract cancellation.',
        );
        $data = $request->validate([
            'status' => ['required', Rule::in(['approved', 'rejected'])],
            'resolution_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $result = $this->cancellations->resolve(
            $contractCancellationRequest,
            $data['status'],
            $data['resolution_notes'] ?? null,
            $request->user(),
        );
        if ($result->requester && $result->requested_by !== $request->user()->id) {
            $result->requester->notify(new ContractCancellationResolved($result));
        }

        return response()->json([
            'message' => $result->status === 'approved'
                ? 'Contract cancellation approved and processed.'
                : 'Contract cancellation rejected.',
            'data' => $result,
        ]);
    }

    private function validateContract(Request $request): array
    {
        $data = $request->validate([
            'subscription_date' => ['required', 'date', 'before_or_equal:today'],
            'meter_size' => ['nullable', 'string', 'max:100'],
            'connection_fee' => ['required', 'numeric', 'min:0'],
            'meter_fee' => ['required', 'numeric', 'min:0'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'discount_authority_id' => [
                Rule::requiredIf(fn (): bool => (float) $request->input('discount_amount', 0) > 0),
                'nullable',
                'integer',
                Rule::exists('authorities', 'id')->where('status', 'active'),
            ],
            'notes' => ['nullable', 'string'],
        ], [
            'discount_authority_id.required' => 'Select the authority who granted this discount.',
            'discount_authority_id.exists' => 'The selected discount authority is unavailable or inactive.',
        ]);

        if ((float) ($data['discount_amount'] ?? 0) > 0) {
            $authority = Authority::query()->findOrFail($data['discount_authority_id']);
            $data['discount_approved_by'] = $authority->name;
        } else {
            $data['discount_authority_id'] = null;
            $data['discount_approved_by'] = null;
        }

        return $data;
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
