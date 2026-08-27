<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingAccount;
use App\Models\Customer;
use App\Models\InventoryRequest;
use App\Models\User;
use App\Notifications\InventoryRequestApproved;
use App\Notifications\InventoryRequestSubmitted;
use App\Services\InventoryRequestWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;

class InventoryRequestController extends Controller
{
    public function __construct(private readonly InventoryRequestWorkflowService $workflow) {}

    public function purchaseAccounts(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless(
            $user?->hasAnyRole(['Warehouse Officer', 'Accountant', 'Manager', 'Admin', 'Super Admin'])
                || $user?->can('inventory.create')
                || $user?->can('accounting.create')
                || $user?->can('expenses.create'),
            403,
            'You cannot access purchase payment accounts.',
        );

        return response()
            ->json([
                'data' => AccountingAccount::query()
                    ->where('status', 'active')
                    ->orderBy('type')
                    ->orderBy('name')
                    ->get(['id', 'name', 'code', 'type', 'current_balance', 'status']),
            ])
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
            ->header('Pragma', 'no-cache');
    }

    public function index(Request $request): JsonResponse
    {
        $query = InventoryRequest::query()
            ->with($this->relations())
            ->when($request->filled('status'), fn ($builder) => $builder->where('status', $request->status))
            ->when($request->filled('type'), fn ($builder) => $builder->where('type', $request->type))
            ->when($request->filled('issue_type'), fn ($builder) => $builder->where('issue_type', $request->issue_type))
            ->latest('id');

        return response()->json([
            'data' => $query->paginate(20),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $type = $request->input('type');
        $issueType = $request->input('issue_type');
        $isPurchase = $type === 'purchase';
        $isCustomerIssue = $type === 'issue' && $issueType === 'customer';
        $isInternalIssue = $type === 'issue' && $issueType === 'internal';
        $isContractMaterial = $isCustomerIssue && $request->input('issue_purpose') === 'contract_material';
        $initialPaymentAmount = (float) $request->input('amount_paid', 0);
        if ($isCustomerIssue && $initialPaymentAmount > 0.005) {
            $user = $request->user();
            abort_unless(
                $user?->hasAnyRole(['Collector', 'Accountant', 'Manager', 'Admin', 'Super Admin'])
                    || $user?->can('payments.create'),
                403,
                'Only authorized payment staff can record an amount paid for a customer sale.',
            );
        }

        $validated = $request->validate([
            'type' => ['required', Rule::in(['purchase', 'issue'])],
            'issue_type' => [Rule::requiredIf($type === 'issue'), 'nullable', Rule::in(['internal', 'customer'])],
            'issue_purpose' => [
                'sometimes',
                'nullable',
                Rule::in(['separate_sale', 'contract_material']),
            ],
            'supplier_id' => [
                Rule::requiredIf($isPurchase),
                'nullable',
                'integer',
                Rule::exists('suppliers', 'id')->where('status', 'active'),
            ],
            'customer_id' => [
                Rule::requiredIf($isCustomerIssue),
                'nullable',
                'integer',
                Rule::exists('customers', 'id')->whereIn('status', Customer::INVENTORY_SALE_ELIGIBLE_STATUSES),
            ],
            'customer_contract_id' => [
                Rule::requiredIf($isContractMaterial),
                'nullable',
                'integer',
                'exists:customer_contracts,id',
            ],
            'department_id' => [
                Rule::requiredIf($isInternalIssue),
                'nullable',
                'integer',
                Rule::exists('departments', 'id')->where('status', 'active'),
            ],
            'accounting_account_id' => [
                Rule::requiredIf(($isPurchase || $isCustomerIssue) && $initialPaymentAmount > 0.005),
                'nullable',
                'integer',
                Rule::exists('accounting_accounts', 'id')->where('status', 'active'),
            ],
            'payment_method_id' => [
                Rule::requiredIf(($isPurchase || $isCustomerIssue) && $initialPaymentAmount > 0.005),
                'nullable',
                'integer',
                Rule::exists('payment_methods', 'id')->where('status', 'active'),
            ],
            'amount_paid' => ['nullable', 'numeric', 'min:0'],
            'warehouse_id' => [
                'required',
                'integer',
                Rule::exists('warehouses', 'id')->where('status', 'active'),
            ],
            'request_date' => ['required', 'date', 'before_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.good_id' => [
                Rule::requiredIf($isPurchase),
                'nullable',
                'integer',
                'distinct',
                Rule::exists('goods', 'id')->where('status', 'active'),
            ],
            'items.*.inventory_item_id' => [
                Rule::requiredIf(! $isPurchase),
                'nullable',
                'integer',
                'distinct',
                'exists:inventory_items,id',
            ],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => $isCustomerIssue
                ? ['required', 'numeric', 'gt:0']
                : ['required', 'numeric', 'min:0'],
            'items.*.meter_serials' => ['nullable', 'array'],
            'items.*.meter_serials.*' => ['required', 'string', 'max:100', 'distinct:ignore_case'],
            'items.*.meter_ids' => ['nullable', 'array'],
            'items.*.meter_ids.*' => ['required', 'integer', 'distinct', 'exists:meters,id'],
        ]);

        $inventoryRequest = $this->workflow->submit($validated, $request->user());
        $admins = User::query()
            ->where('status', 'active')
            ->whereHas('roles', fn ($query) => $query->whereIn('name', ['Admin', 'Super Admin']))
            ->get();
        if ($admins->isNotEmpty()) {
            Notification::send($admins, new InventoryRequestSubmitted($inventoryRequest));
        }

        return response()->json([
            'message' => 'Request submitted for approval.',
            'data' => $inventoryRequest,
        ], 201);
    }

    public function approve(Request $request, InventoryRequest $inventoryRequest): JsonResponse
    {
        abort_unless(
            $request->user()?->hasAnyRole(['Admin', 'Super Admin']),
            403,
            'Only admins can approve or reject inventory requests.'
        );

        $validated = $request->validate([
            'status' => ['required', Rule::in(['approved', 'rejected'])],
            'approval_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $result = $this->workflow->resolve($inventoryRequest, $validated, $request->user());
        if ($result->requester && $result->requested_by !== $request->user()->id) {
            $result->requester->notify(new InventoryRequestApproved($result));
        }

        return response()->json([
            'message' => $result->status === 'approved'
                ? 'Request approved and processed.'
                : 'Request rejected.',
            'data' => $result,
        ]);
    }

    public function pay(Request $request, InventoryRequest $inventoryRequest): JsonResponse
    {
        $user = $request->user();
        abort_unless(
            $user?->hasAnyRole(['Accountant', 'Manager', 'Admin', 'Super Admin'])
                || $user?->can('accounting.create')
                || $user?->can('expenses.create'),
            403,
            'You cannot record supplier payments.',
        );

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'payment_method_id' => [
                'required',
                'integer',
                Rule::exists('payment_methods', 'id')->where('status', 'active'),
            ],
            'accounting_account_id' => [
                'required',
                'integer',
                Rule::exists('accounting_accounts', 'id')->where('status', 'active'),
            ],
            'paid_at' => ['required', 'date', 'before_or_equal:today'],
            'reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $result = $this->workflow->recordPurchasePayment($inventoryRequest, $validated, $user);

        return response()->json([
            'message' => 'Supplier payment recorded.',
            'data' => $result,
        ], 201);
    }

    public function show(InventoryRequest $inventoryRequest): JsonResponse
    {
        return response()->json([
            'data' => $inventoryRequest->load($this->relations()),
        ]);
    }

    private function relations(): array
    {
        return [
            'items.good',
            'items.inventoryItem.warehouse',
            'supplier',
            'customer',
            'contract:id,customer_id,contract_number,status',
            'department',
            'account',
            'paymentMethod',
            'purchasePayments.account',
            'purchasePayments.paymentMethod',
            'purchasePayments.recorder',
            'invoice.items.category',
            'invoice.allocations.payment.paymentMethod',
            'invoice.allocations.payment.account',
            'invoice.allocations.payment.receiver',
            'warehouse',
            'requester',
            'approver',
            'returner:id,name',
        ];
    }
}
