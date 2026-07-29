<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesHrRequests;
use App\Http\Controllers\Controller;
use App\Models\PayrollRun;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PayrollReportController extends Controller
{
    use AuthorizesHrRequests;

    public function monthly(Request $request): JsonResponse
    {
        $this->authorizePayrollWork($request);
        [$from, $to] = $this->dates($request);
        $runs = $this->runs($from, $to);

        return response()->json(['data' => $this->report($runs, $from, $to)]);
    }

    public function export(Request $request): StreamedResponse
    {
        $this->authorizePayrollWork($request);
        [$from, $to] = $this->dates($request);
        $report = $this->report($this->runs($from, $to), $from, $to);

        return response()->streamDownload(function () use ($report): void {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['Month', 'Payroll Runs', 'Employees', 'Gross Earnings', 'Absence', 'Late Arrival', 'Advances', 'Tax', 'Recurring', 'Other Deductions', 'Net Payroll']);
            foreach ($report['months'] as $month) {
                fputcsv($handle, [
                    $month['month'], $month['runs'], $month['employees'], $month['gross_earnings'],
                    $month['absence_deduction'], $month['late_deduction'], $month['advance_deduction'], $month['tax_deduction'],
                    $month['recurring_deduction'], $month['other_deduction'], $month['net_payroll'],
                ]);
            }
            fputcsv($handle, []);
            fputcsv($handle, ['Employee ID', 'Employee', 'Gross Earnings', 'Absence', 'Late Arrival', 'Advances', 'Tax', 'Recurring', 'Other Deductions', 'Net Paid']);
            foreach ($report['employees'] as $employee) {
                fputcsv($handle, [
                    $employee['employee_number'], $employee['employee_name'], $employee['gross_earnings'],
                    $employee['absence_deduction'], $employee['late_deduction'], $employee['advance_deduction'],
                    $employee['tax_deduction'], $employee['recurring_deduction'], $employee['other_deduction'], $employee['net_paid'],
                ]);
            }
            fclose($handle);
        }, "payroll-summary-{$from}-to-{$to}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function dates(Request $request): array
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
        ]);

        return [$data['from'], $data['to']];
    }

    private function runs(string $from, string $to): Collection
    {
        return PayrollRun::query()
            ->with(['items.employee:id,employee_number,first_name,last_name', 'account:id,name,code,type'])
            ->where('status', 'approved')
            ->whereDate('period_start', '<=', $to)
            ->whereDate('period_end', '>=', $from)
            ->orderBy('period_end')
            ->get();
    }

    private function report(Collection $runs, string $from, string $to): array
    {
        $months = $runs->groupBy(fn (PayrollRun $run): string => $run->period_end->format('Y-m'))
            ->map(function (Collection $monthRuns, string $month): array {
                $items = $monthRuns->flatMap->items;

                return [
                    'month' => $month,
                    'runs' => $monthRuns->count(),
                    'employees' => $items->pluck('employee_id')->filter()->unique()->count(),
                    'gross_earnings' => round((float) $items->sum(fn ($item): float => (float) $item->base_salary + (float) $item->bonus + (float) $item->overtime_amount), 2),
                    'absence_deduction' => round((float) $items->sum('absence_deduction'), 2),
                    'late_deduction' => round((float) $items->sum('late_deduction'), 2),
                    'advance_deduction' => round((float) $items->sum('advance_deduction'), 2),
                    'tax_deduction' => round((float) $items->sum('tax_deduction'), 2),
                    'recurring_deduction' => round((float) $items->sum('recurring_deduction'), 2),
                    'other_deduction' => round((float) $items->sum('other_deduction'), 2),
                    'net_payroll' => round((float) $items->sum('net_amount'), 2),
                ];
            })->values();
        $employees = $runs->flatMap->items
            ->groupBy(fn ($item): string => (string) ($item->employee_id ?: $item->employee_name))
            ->map(function (Collection $items): array {
                $first = $items->first();

                return [
                    'employee_id' => $first->employee_id,
                    'employee_number' => $first->employee?->employee_number ?? '-',
                    'employee_name' => $first->employee?->full_name ?? $first->employee_name,
                    'gross_earnings' => round((float) $items->sum(fn ($item): float => (float) $item->base_salary + (float) $item->bonus + (float) $item->overtime_amount), 2),
                    'absence_deduction' => round((float) $items->sum('absence_deduction'), 2),
                    'late_deduction' => round((float) $items->sum('late_deduction'), 2),
                    'advance_deduction' => round((float) $items->sum('advance_deduction'), 2),
                    'tax_deduction' => round((float) $items->sum('tax_deduction'), 2),
                    'recurring_deduction' => round((float) $items->sum('recurring_deduction'), 2),
                    'other_deduction' => round((float) $items->sum('other_deduction'), 2),
                    'net_paid' => round((float) $items->sum('net_amount'), 2),
                ];
            })->sortBy('employee_number')->values();

        return [
            'filters' => ['from' => $from, 'to' => $to],
            'totals' => [
                'runs' => $runs->count(),
                'employees' => $runs->flatMap->items->pluck('employee_id')->filter()->unique()->count(),
                'gross_earnings' => round((float) $months->sum('gross_earnings'), 2),
                'absence_deduction' => round((float) $months->sum('absence_deduction'), 2),
                'late_deduction' => round((float) $months->sum('late_deduction'), 2),
                'advance_deduction' => round((float) $months->sum('advance_deduction'), 2),
                'tax_deduction' => round((float) $months->sum('tax_deduction'), 2),
                'recurring_deduction' => round((float) $months->sum('recurring_deduction'), 2),
                'other_deduction' => round((float) $months->sum('other_deduction'), 2),
                'net_payroll' => round((float) $months->sum('net_payroll'), 2),
            ],
            'months' => $months,
            'employees' => $employees,
            'generated_at' => now()->toIso8601String(),
        ];
    }
}
