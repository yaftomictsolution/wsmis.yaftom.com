<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerCharge;
use App\Models\CustomerChargeType;
use App\Models\CustomerConnectionEvent;
use App\Models\CustomerServiceRequest;
use App\Models\FinancialCategory;
use App\Models\User;
use App\Notifications\ServiceRequestAssignedNotification;
use App\Services\CustomerBillingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CustomerOperationsController extends Controller
{
    public function __construct(private readonly CustomerBillingService $billing) {}

    public function assignedToMe(Request $request): JsonResponse
    {
        $serviceRequests = CustomerServiceRequest::query()
            ->with([
                'customer:id,service_area_id,name,phone,house_number',
                'customer.serviceArea:id,name',
                'assignee:id,name',
                'creator:id,name',
            ])
            ->where('assigned_to', $request->user()->id)
            ->whereIn('status', ['assigned', 'in_progress'])
            ->orderByRaw("CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END")
            ->latest('assigned_at')
            ->latest('id')
            ->get();

        return response()->json(['data' => $serviceRequests]);
    }

    public function detail(Customer $customer): JsonResponse
    {
        $customer->load([
            'serviceArea',
            'serviceArea.mosques',
            'serviceAreaMosque',
            'contracts' => fn ($query) => $query->latest('id'),
            'contracts.creator:id,name',
            'contracts.updater:id,name',
            'contracts.submitter:id,name',
            'contracts.confirmer:id,name',
            'contracts.approver:id,name',
            'contracts.rejector:id,name',
            'contracts.discountAuthority:id,authority_number,name,father_name,title,status',
            'contracts.pendingCancellation.requester:id,name',
            'contracts.pendingCancellation.resolver:id,name',
            'contracts.pendingCancellation.refundAccount:id,name,code,type,current_balance,status',
            'contracts.pendingCancellation.items.warehouse:id,name,code,status',
            'contracts.deposits.paymentMethod:id,name,code',
            'contracts.deposits.account:id,name,code,type,current_balance',
            'contracts.deposits.receiver:id,name',
            'contracts.deposits.applier:id,name',
            'contracts.deposits.refunder:id,name',
            'contracts.invoice.items.category:id,name,type',
            'contracts.invoice.allocations.payment.paymentMethod:id,name,code',
            'contracts.invoice.allocations.payment.account:id,name,code,type,current_balance',
            'contracts.invoice.allocations.payment.receiver:id,name',
            'contracts.invoice.allocations.payment.refunder:id,name',
            'deposits',
            'latestContract.creator:id,name',
            'latestContract.submitter:id,name',
            'latestContract.approver:id,name',
            'latestContract.rejector:id,name',
            'latestContract.discountAuthority:id,authority_number,name,father_name,title,status',
            'latestContract.pendingCancellation.requester:id,name',
            'latestContract.pendingCancellation.resolver:id,name',
            'latestContract.pendingCancellation.refundAccount:id,name,code,type,current_balance,status',
            'latestContract.pendingCancellation.items.warehouse:id,name,code,status',
            'latestContract.deposits.paymentMethod:id,name,code',
            'latestContract.deposits.account:id,name,code,type,current_balance',
            'latestContract.deposits.receiver:id,name',
            'latestContract.deposits.applier:id,name',
            'latestContract.deposits.refunder:id,name',
            'latestContract.invoice.items.category:id,name,type',
            'latestContract.invoice.allocations.payment.paymentMethod:id,name,code',
            'latestContract.invoice.allocations.payment.account:id,name,code,type,current_balance',
            'latestContract.invoice.allocations.payment.receiver:id,name',
            'latestContract.invoice.allocations.payment.refunder:id,name',
            'approver:id,name',
            'rejector:id,name',
            'meterAssignments.meter',
            'meterAssignments.contract:id,customer_id,contract_number,status',
            'meterAssignments.replacementCharge:id,customer_id,customer_contract_id,invoice_id,customer_charge_type_id,title,type,amount,paid_amount,remaining_amount,charge_date,status',
            'meterAssignments.replacementCharge.chargeType:id,name,code,status,is_system',
            'meterAssignments.replacementCharge.invoice:id,invoice_number,invoice_type,total_amount,paid_amount,remaining_amount,status,due_date',
            'meterAssignments.installer:id,name',
            'meterAssignments.seals.sealer:id,name',
            'meterAssignments.seals.remover:id,name',
            'meterReadings.billingPeriod:id,name,code',
            'meterReadings.meter:id,meter_number',
            'meterReadings.reader:id,name',
            'meterReadings.invoice:id,meter_reading_id,invoice_number,total_amount,paid_amount,remaining_amount,status',
            'invoices.billingPeriod:id,name,code',
            'invoices.meterReading:id,current_reading,previous_reading,consumption',
            'invoices.contract:id,contract_number,status',
            'invoices.items.category:id,name,type',
            'invoices.payments.paymentMethod:id,name,code',
            'payments.invoice:id,invoice_number,total_amount,paid_amount,payment_discount_amount,remaining_amount,status',
            'payments.paymentMethod:id,name,code',
            'payments.account:id,name,code,type,current_balance',
            'payments.refunder:id,name',
            'payments.refundTransaction.account:id,name,code,type,current_balance',
            'payments.allocations.invoice:id,invoice_number,total_amount,paid_amount,payment_discount_amount,remaining_amount,status',
            'payments.allocations.charge:id,title,amount,paid_amount,remaining_amount,status',
            'payments.receiver:id,name',
            'documentFiles.uploader:id,name',
            'charges.category:id,name,type',
            'charges.chargeType:id,name,code,status,is_system',
            'charges.invoice:id,invoice_number,invoice_type,total_amount,paid_amount,remaining_amount,status',
            'charges.creator:id,name',
            'serviceRequests.assignee:id,name',
            'serviceRequests.creator:id,name',
            'serviceRequests.closer:id,name',
            'connectionEvents.processor:id,name',
            'connectionEvents.charge:id,title,amount,status',
        ]);

        $assignments = $customer->meterAssignments->sortByDesc('installation_date')->values();

        return response()->json([
            'data' => [
                'customer' => $customer,
                'current_meter_assignment' => $assignments->firstWhere('status', 'active'),
                'meter_replacement_history' => $assignments
                    ->filter(fn ($assignment) => in_array($assignment->status, ['replaced', 'removed'], true))
                    ->values(),
                'ledger' => $this->ledger($customer),
                'totals' => [
                    'charges' => (float) $customer->charges->where('status', 'posted')->sum('amount'),
                    'invoiced' => (float) $customer->invoices->where('status', '!=', 'cancelled')->sum('total_amount'),
                    'paid' => (float) $customer->payments
                        ->where('status', 'posted')
                        ->sum(fn ($payment) => max(0, (float) $payment->amount - (float) $payment->refunded_amount)),
                    'refunded' => (float) $customer->payments->sum('refunded_amount'),
                    'balance' => (float) $customer->current_balance,
                    'deposits_held' => (float) $customer->deposits->whereIn('status', ['pending', 'refund_required', 'partially_applied'])->sum(fn ($deposit) => (float) $deposit->amount - (float) $deposit->applied_amount - (float) $deposit->refunded_amount),
                ],
            ],
        ]);
    }

    public function storeCharge(Request $request, Customer $customer): JsonResponse
    {
        $this->ensureApprovedContract($customer);

        $data = $request->validate([
            'customer_charge_type_id' => [
                'required',
                'integer',
                Rule::exists('customer_charge_types', 'id')->where('status', 'active'),
            ],
            'title' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'charge_date' => ['required', 'date', 'before_or_equal:today'],
            'notes' => ['nullable', 'string'],
        ]);
        $chargeType = CustomerChargeType::query()->findOrFail($data['customer_charge_type_id']);
        $category = FinancialCategory::query()->firstOrCreate(
            ['code' => 'customer_charge_income'],
            ['name' => 'Customer Charge Income', 'type' => 'income', 'status' => 'active'],
        );

        $charge = DB::transaction(function () use ($request, $customer, $data, $chargeType, $category): CustomerCharge {
            $charge = $customer->charges()->create($data + [
                'type' => $chargeType->code,
                'financial_category_id' => $category->id,
                'created_by' => $request->user()?->id,
                'status' => 'posted',
            ]);
            $this->billing->issueChargeInvoice($charge);

            return $charge;
        });

        return response()->json(['data' => $charge->load(['chargeType:id,name,code,status,is_system', 'invoice.items', 'creator:id,name'])], 201);
    }

    public function cancelCharge(Customer $customer, CustomerCharge $customerCharge): JsonResponse
    {
        abort_unless((int) $customerCharge->customer_id === (int) $customer->id, 404);
        abort_unless($customerCharge->status === 'posted', 422, 'Only posted customer charges can be cancelled.');
        abort_if((float) $customerCharge->paid_amount > 0, 422, 'Paid customer charges cannot be cancelled.');

        DB::transaction(function () use ($customer, $customerCharge): void {
            if ($customerCharge->invoice) {
                $this->billing->cancelInvoice($customerCharge->invoice);
            } else {
                $customerCharge->update(['status' => 'cancelled', 'remaining_amount' => 0]);
                $this->billing->syncCustomerBalance($customer);
            }
        });

        return response()->json(['data' => $customerCharge->fresh()->load(['chargeType:id,name,code,status,is_system', 'invoice.items', 'creator:id,name'])]);
    }

    public function storeServiceRequest(Request $request, Customer $customer): JsonResponse
    {
        $this->ensureApprovedContract($customer);

        $data = $request->validate([
            'assigned_to' => $this->technicianAssignmentRules(),
            'type' => ['required', Rule::in(['complaint', 'leak', 'meter_problem', 'low_pressure', 'billing_question', 'other'])],
            'priority' => ['required', Rule::in(['low', 'normal', 'high', 'urgent'])],
            'description' => ['required', 'string', 'max:5000'],
            'requested_at' => ['required', 'date', 'before_or_equal:today'],
        ]);

        $serviceRequest = DB::transaction(function () use ($request, $customer, $data): CustomerServiceRequest {
            $serviceRequest = $customer->serviceRequests()->create($data + [
                'request_number' => $this->nextServiceRequestNumber(),
                'created_by' => $request->user()->id,
                'assigned_at' => isset($data['assigned_to']) ? now() : null,
                'status' => isset($data['assigned_to']) ? 'assigned' : 'open',
            ]);

            if (isset($data['assigned_to'])) {
                User::query()->findOrFail($data['assigned_to'])->notify(
                    new ServiceRequestAssignedNotification($serviceRequest, $request->user()),
                );
            }

            return $serviceRequest;
        });

        return response()->json(['data' => $serviceRequest->load(['assignee:id,name', 'creator:id,name', 'closer:id,name'])], 201);
    }

    public function updateServiceRequest(Request $request, Customer $customer, CustomerServiceRequest $customerServiceRequest): JsonResponse
    {
        abort_unless((int) $customerServiceRequest->customer_id === (int) $customer->id, 404);

        $data = $request->validate([
            'assigned_to' => $this->technicianAssignmentRules(),
            'priority' => ['nullable', Rule::in(['low', 'normal', 'high', 'urgent'])],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['required', Rule::in(['open', 'assigned', 'in_progress', 'resolved', 'closed'])],
            'resolution' => ['nullable', 'string'],
        ]);

        $previousAssigneeId = $customerServiceRequest->assigned_to;

        if (($data['assigned_to'] ?? null) && ! $customerServiceRequest->assigned_at) {
            $data['assigned_at'] = now();
        }

        if (($data['assigned_to'] ?? null) && ($data['status'] ?? null) === 'open') {
            $data['status'] = 'assigned';
        }

        if (in_array($data['status'], ['resolved', 'closed'], true) && ! $customerServiceRequest->resolved_at) {
            $data['resolved_at'] = now();
        }

        if ($data['status'] === 'closed') {
            $data['closed_at'] = now();
            $data['closed_by'] = $request->user()?->id;
        }

        DB::transaction(function () use ($request, $customerServiceRequest, $data, $previousAssigneeId): void {
            $customerServiceRequest->update($data);

            if (isset($data['assigned_to']) && (int) $data['assigned_to'] !== (int) $previousAssigneeId) {
                User::query()->findOrFail($data['assigned_to'])->notify(
                    new ServiceRequestAssignedNotification($customerServiceRequest, $request->user()),
                );
            }
        });

        return response()->json(['data' => $customerServiceRequest->fresh()->load(['assignee:id,name', 'creator:id,name', 'closer:id,name'])]);
    }

    public function storeConnectionEvent(Request $request, Customer $customer): JsonResponse
    {
        $this->ensureApprovedContract($customer);

        $data = $request->validate([
            'event_type' => ['required', Rule::in(['disconnection', 'reconnection'])],
            'reason' => ['nullable', 'string'],
            'fee' => ['nullable', 'numeric', 'min:0'],
            'status' => ['required', Rule::in(['pending', 'completed', 'cancelled'])],
            'disconnected_at' => ['nullable', 'date', 'before_or_equal:today', 'required_if:event_type,disconnection'],
            'reconnected_at' => ['nullable', 'date', 'before_or_equal:today', 'required_if:event_type,reconnection'],
            'notes' => ['nullable', 'string'],
        ]);

        $event = DB::transaction(function () use ($request, $customer, $data): CustomerConnectionEvent {
            $charge = null;
            $fee = (float) ($data['fee'] ?? 0);

            if ($fee > 0 && $data['status'] !== 'cancelled') {
                $charge = $customer->charges()->create([
                    'created_by' => $request->user()?->id,
                    'title' => $data['event_type'] === 'reconnection' ? 'Reconnection fee' : 'Disconnection fee',
                    'type' => $data['event_type'] === 'reconnection' ? 'reconnection_fee' : 'penalty',
                    'amount' => $fee,
                    'charge_date' => $data['reconnected_at'] ?? $data['disconnected_at'] ?? now()->toDateString(),
                    'status' => 'posted',
                    'notes' => $data['reason'] ?? null,
                ]);
                $this->billing->issueChargeInvoice($charge);
            }

            $event = $customer->connectionEvents()->create($data + [
                'processed_by' => $request->user()?->id,
                'customer_charge_id' => $charge?->id,
                'fee' => $fee,
            ]);

            if ($data['status'] === 'completed') {
                $customer->update([
                    'status' => $data['event_type'] === 'disconnection' ? 'disconnected' : 'active',
                ]);
            }

            return $event;
        });

        return response()->json(['data' => $event->load(['processor:id,name', 'charge:id,title,amount,status'])], 201);
    }

    private function ledger(Customer $customer): array
    {
        $entries = [];

        if ((float) $customer->opening_balance > 0) {
            $entries[] = [
                'date' => optional($customer->subscription_date ?? $customer->created_at)->toDateString(),
                'reference' => $customer->subscription_code ?? 'Opening',
                'description' => 'Opening balance',
                'debit' => (float) $customer->opening_balance,
                'credit' => 0,
                'source' => 'opening_balance',
            ];
        }

        foreach ($customer->charges as $charge) {
            if ($charge->status !== 'posted' || $charge->invoice_id) {
                continue;
            }

            $entries[] = [
                'date' => optional($charge->charge_date)->toDateString(),
                'reference' => 'CHG-'.$charge->id,
                'description' => $charge->title,
                'debit' => (float) $charge->amount,
                'credit' => 0,
                'source' => 'charge',
            ];
        }

        foreach ($customer->invoices as $invoice) {
            if ($invoice->status === 'cancelled') {
                continue;
            }

            $entries[] = [
                'date' => optional($invoice->issue_date)->toDateString(),
                'reference' => $invoice->invoice_number,
                'description' => 'Water bill invoice',
                'debit' => (float) $invoice->total_amount,
                'credit' => 0,
                'source' => 'invoice',
            ];
        }

        foreach ($customer->payments as $payment) {
            if ($payment->status !== 'posted') {
                continue;
            }

            $entries[] = [
                'date' => optional($payment->paid_at)->toDateString(),
                'reference' => $payment->receipt_number,
                'description' => 'Customer payment',
                'debit' => 0,
                'credit' => (float) $payment->amount,
                'source' => 'payment',
            ];
        }

        usort($entries, fn ($a, $b) => [$a['date'], $a['reference']] <=> [$b['date'], $b['reference']]);

        $balance = 0;

        return array_map(function (array $entry) use (&$balance): array {
            $balance += $entry['debit'] - $entry['credit'];
            $entry['balance'] = $balance;

            return $entry;
        }, $entries);
    }

    private function ensureApprovedContract(Customer $customer): void
    {
        abort_unless($customer->contractAllowsWorkflow(), 422, 'Customer contract must be confirmed before this workflow can continue.');
    }

    private function technicianAssignmentRules(): array
    {
        return [
            'bail',
            'nullable',
            'integer',
            Rule::exists('users', 'id')->where(fn ($query) => $query->where('status', 'active')),
            function (string $attribute, mixed $value, $fail): void {
                if (! User::query()->find($value)?->hasRole('Technician')) {
                    $fail('Select an active technician.');
                }
            },
        ];
    }

    private function nextServiceRequestNumber(): string
    {
        return 'SR-'.now()->format('Ymd').'-'.str_pad((string) ((CustomerServiceRequest::query()->max('id') ?? 0) + 1), 5, '0', STR_PAD_LEFT);
    }
}
