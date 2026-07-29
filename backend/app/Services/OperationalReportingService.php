<?php

namespace App\Services;

use App\Models\AccountingTransaction;
use App\Models\Asset;
use App\Models\AssetMaintenance;
use App\Models\AttendanceRecord;
use App\Models\Customer;
use App\Models\CustomerCharge;
use App\Models\Employee;
use App\Models\EmployeeLeaveBalance;
use App\Models\FinancialPeriodClosing;
use App\Models\InventoryItem;
use App\Models\InventoryTransaction;
use App\Models\Invoice;
use App\Models\LeaveRequest;
use App\Models\Payment;
use App\Models\PayrollRun;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class OperationalReportingService
{
    public function report(string $type, string $from, string $to): array
    {
        $data = [
            'filters' => compact('type', 'from', 'to'),
            'summary' => $this->summary($from, $to),
            'generated_at' => now()->toIso8601String(),
        ];

        return match ($type) {
            'customer' => $data + ['customer' => $this->customerReport($from, $to)],
            'inventory' => $data + ['inventory' => $this->inventoryReport($from, $to)],
            'hr' => $data + ['hr' => $this->hrReport($from, $to)],
            'asset' => $data + ['asset' => $this->assetReport($from, $to)],
            'all' => $data + [
                'customer' => $this->customerReport($from, $to),
                'inventory' => $this->inventoryReport($from, $to),
                'hr' => $this->hrReport($from, $to),
                'asset' => $this->assetReport($from, $to),
            ],
            default => $data + ['recent_reports' => $this->recentReports()],
        };
    }

    private function summary(string $from, string $to): array
    {
        $approved = AccountingTransaction::query()
            ->where('status', 'approved')
            ->whereDate('transaction_date', '>=', $from)
            ->whereDate('transaction_date', '<=', $to);

        return [
            'total_customers' => Customer::query()->whereDate('created_at', '<=', $to)->count(),
            'new_customers' => Customer::query()->whereDate('created_at', '>=', $from)->whereDate('created_at', '<=', $to)->count(),
            'revenue' => round((float) (clone $approved)->where('type', 'income')->sum('amount'), 2),
            'expenses' => round((float) (clone $approved)->where('type', 'expense')->sum('amount'), 2),
            'inventory_items' => InventoryItem::query()->count(),
            'inventory_quantity' => round((float) InventoryItem::query()->sum('quantity'), 2),
            'active_employees' => Employee::query()->where('status', 'active')->whereDate('hire_date', '<=', $to)->count(),
            'asset_count' => Asset::query()->whereDate('purchase_date', '<=', $to)->count(),
        ];
    }

    private function customerReport(string $from, string $to): array
    {
        $customers = Customer::query()
            ->with('serviceArea:id,name')
            ->whereDate('created_at', '<=', $to)
            ->orderByDesc('id')
            ->get();
        $receivables = (float) Invoice::query()
            ->whereIn('status', ['unpaid', 'partially_paid', 'overdue'])
            ->sum('remaining_amount')
            + (float) CustomerCharge::query()
                ->whereNull('invoice_id')
                ->where('status', 'posted')
                ->sum('remaining_amount');
        $payments = Payment::query()
            ->where('status', 'posted')
            ->whereDate('paid_at', '>=', $from)
            ->whereDate('paid_at', '<=', $to);

        $statusDistribution = $customers
            ->groupBy('status')
            ->map(fn (Collection $rows, string $status): array => [
                'name' => $status,
                'value' => $rows->count(),
            ])
            ->values();
        $ranges = [
            ['range' => '0-1,000', 'min' => 0, 'max' => 1000],
            ['range' => '1,000-5,000', 'min' => 1000, 'max' => 5000],
            ['range' => '5,000-10,000', 'min' => 5000, 'max' => 10000],
            ['range' => '10,000-50,000', 'min' => 10000, 'max' => 50000],
            ['range' => '50,000+', 'min' => 50000, 'max' => INF],
        ];

        return [
            'totals' => [
                'customers' => $customers->count(),
                'new_customers' => $customers->whereBetween('created_at', [
                    Carbon::parse($from)->startOfDay(),
                    Carbon::parse($to)->endOfDay(),
                ])->count(),
                'active_customers' => $customers->where('status', 'active')->count(),
                'pending_customers' => $customers->whereIn('status', ['awaiting_approval', 'awaiting_installation'])->count(),
                'receivables' => round($receivables, 2),
                'payments_received' => round((float) (clone $payments)->sum('amount'), 2),
                'payments_count' => (clone $payments)->count(),
            ],
            'status_distribution' => $statusDistribution,
            'balance_distribution' => collect($ranges)->map(fn (array $range): array => [
                'range' => $range['range'],
                'count' => $customers->filter(function (Customer $customer) use ($range): bool {
                    $balance = (float) $customer->current_balance;

                    return $balance >= $range['min'] && $balance < $range['max'];
                })->count(),
            ])->values(),
            'rows' => $customers->map(fn (Customer $customer): array => [
                'subscription_code' => $customer->subscription_code,
                'name' => trim($customer->name.' '.$customer->last_name),
                'phone' => $customer->phone,
                'service_area' => $customer->serviceArea?->name,
                'current_balance' => (float) $customer->current_balance,
                'status' => $customer->status,
                'registered_at' => $customer->created_at?->toDateString(),
            ])->values(),
        ];
    }

    private function inventoryReport(string $from, string $to): array
    {
        $items = InventoryItem::query()
            ->with(['good:id,name,code,category,unit', 'warehouse:id,name,code'])
            ->orderByDesc('quantity')
            ->get();
        $movements = InventoryTransaction::query()
            ->whereDate('transaction_date', '>=', $from)
            ->whereDate('transaction_date', '<=', $to)
            ->get();

        $categories = $items
            ->groupBy(fn (InventoryItem $item): string => $item->good?->category ?? $item->category ?? 'other')
            ->map(fn (Collection $rows, string $category): array => [
                'name' => $category,
                'quantity' => round((float) $rows->sum('quantity'), 2),
                'value' => round((float) $rows->sum(fn (InventoryItem $item): float => (float) $item->quantity * (float) $item->unit_cost), 2),
            ])
            ->values();

        return [
            'totals' => [
                'items' => $items->count(),
                'quantity' => round((float) $items->sum('quantity'), 2),
                'stock_value' => round((float) $items->sum(fn (InventoryItem $item): float => (float) $item->quantity * (float) $item->unit_cost), 2),
                'low_stock_items' => $items->filter(fn (InventoryItem $item): bool => (float) $item->quantity <= (float) $item->reorder_level)->count(),
                'purchased_quantity' => round((float) $movements->where('type', 'purchase')->sum('quantity'), 2),
                'purchase_cost' => round((float) $movements->where('type', 'purchase')->sum('total_amount'), 2),
                'issued_quantity' => round(abs((float) $movements->whereIn('type', ['sale', 'internal_use'])->sum('quantity')), 2),
                'issue_value' => round(abs((float) $movements->whereIn('type', ['sale', 'internal_use'])->sum('total_amount')), 2),
            ],
            'category_distribution' => $categories,
            'stock_levels' => $items->map(fn (InventoryItem $item): array => [
                'code' => $item->good?->code ?? $item->code,
                'name' => $item->good?->name ?? $item->name,
                'category' => $item->good?->category ?? $item->category,
                'warehouse' => $item->warehouse?->name,
                'quantity' => (float) $item->quantity,
                'reorder_level' => (float) $item->reorder_level,
                'unit_cost' => (float) $item->unit_cost,
                'stock_value' => round((float) $item->quantity * (float) $item->unit_cost, 2),
            ])->values(),
        ];
    }

    private function hrReport(string $from, string $to): array
    {
        $employees = Employee::query()
            ->with('position.department:id,name')
            ->whereDate('hire_date', '<=', $to)
            ->orderBy('employee_number')
            ->get();
        $payrollRuns = PayrollRun::query()
            ->whereDate('payment_date', '>=', $from)
            ->whereDate('payment_date', '<=', $to)
            ->orderBy('payment_date')
            ->get();
        $leaveRequests = LeaveRequest::query()
            ->with('policy:id,name,code')
            ->whereDate('start_date', '<=', $to)
            ->whereDate('end_date', '>=', $from)
            ->get();
        $year = Carbon::parse($to)->year;
        $balances = EmployeeLeaveBalance::query()
            ->with('policy:id,name,code')
            ->where('year', $year)
            ->get();
        $approvedUsed = LeaveRequest::query()
            ->where('status', 'approved')
            ->whereYear('start_date', $year)
            ->get()
            ->groupBy('leave_policy_id')
            ->map->sum('total_days');

        return [
            'totals' => [
                'employees' => $employees->count(),
                'active_employees' => $employees->where('status', 'active')->count(),
                'approved_leave_days' => round((float) $leaveRequests->where('status', 'approved')->sum('total_days'), 2),
                'pending_leave_requests' => $leaveRequests->where('status', 'pending')->count(),
                'payroll_runs' => $payrollRuns->count(),
                'payroll_cost' => round((float) $payrollRuns->whereIn('status', ['approved', 'paid'])->sum('total_net'), 2),
                'attendance_records' => AttendanceRecord::query()
                    ->whereDate('attendance_date', '>=', $from)
                    ->whereDate('attendance_date', '<=', $to)
                    ->count(),
            ],
            'department_distribution' => $employees
                ->groupBy(fn (Employee $employee): string => $employee->position?->department?->name ?? 'Unassigned')
                ->map(fn (Collection $rows, string $department): array => ['name' => $department, 'count' => $rows->count()])
                ->values(),
            'payroll_trend' => $payrollRuns->map(fn (PayrollRun $run): array => [
                'period' => $run->period_start->format('Y-m'),
                'payroll_number' => $run->payroll_number,
                'amount' => (float) $run->total_net,
                'status' => $run->status,
            ])->values(),
            'leave_balances' => $balances
                ->groupBy('leave_policy_id')
                ->map(function (Collection $rows, int|string $policyId) use ($approvedUsed): array {
                    $entitled = (float) $rows->sum(fn (EmployeeLeaveBalance $balance): float => (float) $balance->entitlement_days + (float) $balance->carried_forward_days + (float) $balance->adjustment_days);
                    $used = (float) ($approvedUsed[$policyId] ?? 0);

                    return [
                        'type' => $rows->first()?->policy?->name ?? 'Unknown',
                        'entitled' => round($entitled, 2),
                        'used' => round($used, 2),
                        'remaining' => round(max(0, $entitled - $used), 2),
                    ];
                })
                ->values(),
        ];
    }

    private function assetReport(string $from, string $to): array
    {
        $assets = Asset::query()
            ->with(['serviceArea:id,name', 'supplier:id,name'])
            ->whereDate('purchase_date', '<=', $to)
            ->orderBy('asset_code')
            ->get();
        $maintenance = AssetMaintenance::query()
            ->whereDate('performed_at', '>=', $from)
            ->whereDate('performed_at', '<=', $to)
            ->get();

        return [
            'totals' => [
                'assets' => $assets->count(),
                'active_assets' => $assets->where('status', 'active')->count(),
                'maintenance_assets' => $assets->where('status', 'maintenance')->count(),
                'asset_value' => round((float) $assets->sum('purchase_cost'), 2),
                'maintenance_events' => $maintenance->count(),
                'maintenance_cost' => round((float) $maintenance->sum('cost'), 2),
            ],
            'type_distribution' => $assets
                ->groupBy('type')
                ->map(fn (Collection $rows, string $type): array => ['name' => $type, 'count' => $rows->count()])
                ->values(),
            'status_distribution' => $assets
                ->groupBy('status')
                ->map(fn (Collection $rows, string $status): array => ['name' => $status, 'value' => $rows->count()])
                ->values(),
            'rows' => $assets->map(fn (Asset $asset): array => [
                'asset_code' => $asset->asset_code,
                'name' => $asset->name,
                'type' => $asset->type,
                'status' => $asset->status,
                'service_area' => $asset->serviceArea?->name,
                'supplier' => $asset->supplier?->name,
                'purchase_cost' => (float) $asset->purchase_cost,
                'purchase_date' => $asset->purchase_date?->toDateString(),
            ])->values(),
        ];
    }

    private function recentReports(): array
    {
        $closings = FinancialPeriodClosing::query()
            ->latest('period_end')
            ->limit(3)
            ->get()
            ->map(fn (FinancialPeriodClosing $closing): array => [
                'name' => 'Financial closing '.$closing->period_code,
                'date' => $closing->period_end->toDateString(),
                'type' => 'Financial',
                'status' => $closing->status,
                'href' => '/dashboard/month-closing',
            ]);
        $payroll = PayrollRun::query()
            ->latest('payment_date')
            ->limit(3)
            ->get()
            ->map(fn (PayrollRun $run): array => [
                'name' => $run->title,
                'date' => $run->payment_date->toDateString(),
                'type' => 'Payroll',
                'status' => $run->status,
                'href' => '/dashboard/payroll',
            ]);

        return $closings
            ->concat($payroll)
            ->sortByDesc('date')
            ->take(5)
            ->values()
            ->all();
    }
}
