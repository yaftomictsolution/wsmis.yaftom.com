<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BillingPeriod;
use App\Models\Customer;
use App\Models\CustomerContract;
use App\Models\CustomerDeposit;
use App\Models\Invoice;
use App\Models\Meter;
use App\Models\MeterAssignment;
use App\Models\MeterReading;
use App\Models\Payment;
use App\Models\ServiceArea;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([

            'data' => [
                'users' => User::query()->count(),
                'service_areas' => ServiceArea::query()->count(),
                'customers' => Customer::query()->count(),
                'active_customers' => Customer::query()->where('status', 'active')->count(),
                'contracts_draft' => CustomerContract::query()->whereIn('status', ['draft', 'printed'])->count(),
                'contracts_awaiting_installation' => CustomerContract::query()->where('status', 'installation_pending')->count(),
                'deposits_requiring_refund' => CustomerDeposit::query()->where('status', 'refund_required')->count(),
                'customer_deposits_held' => CustomerDeposit::query()->whereIn('status', ['pending', 'refund_required', 'partially_applied'])->get()->sum(fn (CustomerDeposit $deposit): float => $deposit->availableAmount()),
                'meters' => Meter::query()->count(),
                'available_meters' => Meter::query()->where('status', 'available')->count(),
                'assigned_meters' => MeterAssignment::query()->where('status', 'active')->count(),
                'billing_periods' => BillingPeriod::query()->count(),
                'meter_readings' => MeterReading::query()->count(),
                'invoices' => Invoice::query()->count(),
                'unpaid_invoices' => Invoice::query()->whereIn('status', ['unpaid', 'partially_paid'])->count(),
                'payments' => Payment::query()->where('status', 'posted')->count(),
                'outstanding_balance' => Invoice::query()->whereIn('status', ['unpaid', 'partially_paid'])->sum('remaining_amount'),
            ],
        ]);
    }
}
