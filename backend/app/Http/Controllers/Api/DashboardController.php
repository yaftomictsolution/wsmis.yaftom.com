<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BillingPeriod;
use App\Models\AccountingTransaction;
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
use App\Services\BusinessClock;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __invoke(BusinessClock $clock): JsonResponse
    {
        $customerStats = Customer::query()
            ->selectRaw("COUNT(*) as total, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active")
            ->first();
        $contractStats = CustomerContract::query()
            ->selectRaw("SUM(CASE WHEN status IN ('draft', 'printed') THEN 1 ELSE 0 END) as draft")
            ->selectRaw("SUM(CASE WHEN status = 'installation_pending' THEN 1 ELSE 0 END) as awaiting_installation")
            ->first();
        $depositStats = CustomerDeposit::query()
            ->selectRaw("SUM(CASE WHEN status = 'refund_required' THEN 1 ELSE 0 END) as requiring_refund")
            ->selectRaw(
                "SUM(CASE WHEN status IN ('pending', 'refund_required', 'partially_applied') ".
                'THEN CASE WHEN amount - applied_amount - refunded_amount > 0 '.
                'THEN amount - applied_amount - refunded_amount ELSE 0 END ELSE 0 END) as held'
            )
            ->first();
        $meterStats = Meter::query()
            ->selectRaw("COUNT(*) as total, SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available")
            ->first();
        $invoiceStats = Invoice::query()
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN status IN ('unpaid', 'partially_paid') THEN 1 ELSE 0 END) as unpaid")
            ->selectRaw("SUM(CASE WHEN status IN ('unpaid', 'partially_paid') THEN remaining_amount ELSE 0 END) as outstanding")
            ->first();
        $activityEnd = Carbon::parse($clock->effectiveDate())->endOfMonth();
        $monthlyCashMovement = collect(range(5, 0))->map(function (int $monthsAgo) use ($activityEnd): array {
            $periodStart = $activityEnd->copy()->subMonths($monthsAgo)->startOfMonth();
            $periodEnd = $periodStart->copy()->endOfMonth();
            $posted = AccountingTransaction::query()
                ->whereNotNull('posted_at')
                ->whereNull('reversed_at')
                ->whereBetween('transaction_date', [$periodStart->toDateString(), $periodEnd->toDateString()]);
            $income = (float) (clone $posted)->whereIn('type', ['income', 'customer_advance'])->sum('amount');
            $expense = (float) (clone $posted)->whereIn('type', ['expense', 'final_settlement'])->sum('amount');

            return [
                'period' => $periodStart->format('Y-m'),
                'period_start' => $periodStart->toDateString(),
                'income' => $income,
                'expense' => $expense,
                'net' => $income - $expense,
            ];
        })->values();

        return response()->json([
            'data' => [
                'users' => User::query()->count(),
                'service_areas' => ServiceArea::query()->count(),
                'customers' => (int) ($customerStats?->total ?? 0),
                'active_customers' => (int) ($customerStats?->active ?? 0),
                'contracts_draft' => (int) ($contractStats?->draft ?? 0),
                'contracts_awaiting_installation' => (int) ($contractStats?->awaiting_installation ?? 0),
                'deposits_requiring_refund' => (int) ($depositStats?->requiring_refund ?? 0),
                'customer_deposits_held' => (float) ($depositStats?->held ?? 0),
                'meters' => (int) ($meterStats?->total ?? 0),
                'available_meters' => (int) ($meterStats?->available ?? 0),
                'assigned_meters' => MeterAssignment::query()->where('status', 'active')->count(),
                'billing_periods' => BillingPeriod::query()->count(),
                'meter_readings' => MeterReading::query()->count(),
                'invoices' => (int) ($invoiceStats?->total ?? 0),
                'unpaid_invoices' => (int) ($invoiceStats?->unpaid ?? 0),
                'payments' => Payment::query()->where('status', 'posted')->count(),
                'outstanding_balance' => (float) ($invoiceStats?->outstanding ?? 0),
                'monthly_cash_movement' => $monthlyCashMovement,
            ],
        ]);
    }
}
