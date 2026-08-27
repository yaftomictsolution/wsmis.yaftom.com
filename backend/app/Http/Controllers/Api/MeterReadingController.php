<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BillingPeriod;
use App\Models\MeterAssignment;
use App\Models\MeterReading;
use App\Services\CustomerBillingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class MeterReadingController extends Controller
{
    public function __construct(private readonly CustomerBillingService $billing) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => MeterReading::with([
                'billingPeriod:id,name,code',
                'customer:id,name,phone,house_number',
                'meter:id,meter_number',
                'meterAssignment:id,customer_id,meter_id',
                'reader:id,name',
                'invoice:id,meter_reading_id,invoice_number,total_amount,paid_amount,payment_discount_amount,remaining_amount,status',
            ])->latest()->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateReading($request);
        $readerId = $request->user()->id;
        $period = BillingPeriod::query()->findOrFail($data['billing_period_id']);

        abort_if($period->status !== 'open', 422, 'Readings can only be added to an open billing period.');

        $assignment = MeterAssignment::with(['customer.serviceArea', 'meter'])
            ->where('status', 'active')
            ->findOrFail($data['meter_assignment_id']);

        abort_unless($assignment->customer->contractAllowsWorkflow(), 422, 'Customer contract must be confirmed before meter reading.');

        $previousReading = $this->previousReading($assignment);
        $currentReading = (float) $data['current_reading'];

        if ($currentReading < $previousReading) {
            throw ValidationException::withMessages([
                'current_reading' => ['Current reading cannot be less than previous reading ('.number_format($previousReading, 2).' m3).'],
            ]);
        }

        $reading = DB::transaction(function () use ($data, $assignment, $currentReading, $previousReading, $readerId, $period) {
            $customer = $assignment->customer;
            $rate = (float) $customer->serviceArea->rate_per_cubic_meter;
            $consumption = $currentReading - $previousReading;
            $waterAmount = $consumption * $rate;
            $previousBalance = (float) $customer->current_balance;
            $reading = MeterReading::query()->create([
                'billing_period_id' => $data['billing_period_id'],
                'meter_assignment_id' => $assignment->id,
                'customer_id' => $customer->id,
                'meter_id' => $assignment->meter_id,
                'read_by' => $readerId,
                'reading_date' => $data['reading_date'],
                'previous_reading' => $previousReading,
                'current_reading' => $currentReading,
                'consumption' => $consumption,
                'status' => $data['status'] ?? 'recorded',
                'notes' => $data['notes'] ?? null,
            ]);

            $this->billing->issueWaterInvoice(
                $reading,
                $period,
                $previousBalance,
                $rate,
                $waterAmount,
                $data['due_date'] ?? null,
            );

            return $reading->load(['billingPeriod:id,name,code', 'customer:id,name,phone,house_number', 'meter:id,meter_number', 'reader:id,name', 'invoice.items']);
        });

        return response()->json(['data' => $reading], 201);
    }

    public function show(MeterReading $meterReading): JsonResponse
    {
        return response()->json([
            'data' => $meterReading->load(['billingPeriod', 'customer.serviceArea', 'meter', 'reader:id,name', 'invoice.payments']),
        ]);
    }

    public function destroy(MeterReading $meterReading): JsonResponse
    {
        abort_if($meterReading->invoice?->payments()->exists(), 422, 'A reading with payments cannot be deleted.');

        DB::transaction(function () use ($meterReading): void {
            $invoice = $meterReading->invoice;
            if ($invoice) {
                $customerId = $invoice->customer_id;
                $invoice->delete();
                $this->billing->syncCustomerBalance($customerId);
            }

            $meterReading->delete();
        });

        return response()->json(['message' => 'Meter reading deleted.']);
    }

    private function validateReading(Request $request): array
    {
        return $request->validate([
            'billing_period_id' => ['required', 'integer', 'exists:billing_periods,id'],
            'meter_assignment_id' => [
                'required',
                'integer',
                'exists:meter_assignments,id',
                Rule::unique('meter_readings', 'meter_assignment_id')->where(fn ($query) => $query->where('billing_period_id', $request->integer('billing_period_id'))),
            ],
            'reading_date' => ['required', 'date', 'before_or_equal:today'],
            'current_reading' => ['required', 'numeric', 'min:0'],
            'due_date' => ['nullable', 'date', 'after_or_equal:reading_date'],
            'status' => ['nullable', Rule::in(['recorded', 'reviewed'])],
            'notes' => ['nullable', 'string'],
        ], [
            'meter_assignment_id.unique' => 'This meter assignment already has a reading for the selected billing period.',
            'due_date.after_or_equal' => 'The invoice due date must be the same as or after the reading date.',
        ]);
    }

    private function previousReading(MeterAssignment $assignment): float
    {
        $latestReading = MeterReading::query()
            ->where('meter_assignment_id', $assignment->id)
            ->latest('reading_date')
            ->latest('id')
            ->first();

        return $latestReading ? (float) $latestReading->current_reading : (float) $assignment->initial_reading;
    }
}
