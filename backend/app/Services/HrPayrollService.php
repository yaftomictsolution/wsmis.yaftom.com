<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\EmployeeAdjustment;
use App\Models\EmployeePayrollDeduction;
use App\Models\PayrollAdvanceAllocation;
use App\Models\PayrollDeductionAllocation;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\SalaryAdvance;
use App\Models\TerminationAdvanceAllocation;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class HrPayrollService
{
    public function __construct(private readonly AttendanceService $attendanceService) {}

    public function eligibleEmployees(string $periodStart, string $periodEnd): Collection
    {
        $reservedEmployeeIds = $this->reservedEmployeeIds($periodStart, $periodEnd);

        return $this->employmentEligibleQuery($periodStart, $periodEnd)
            ->when($reservedEmployeeIds->isNotEmpty(), fn (Builder $query) => $query->whereNotIn('id', $reservedEmployeeIds))
            ->with('position:id,title')
            ->orderBy('employee_number')
            ->get();
    }

    public function attendanceIssues(Employee $employee, string $periodStart, string $periodEnd): array
    {
        return $this->attendanceContext($employee, $periodStart, $periodEnd)['issues'];
    }

    public function generate(array $data, int $creatorId): PayrollRun
    {
        return DB::transaction(function () use ($data, $creatorId): PayrollRun {
            $employmentEligible = $this->employmentEligibleQuery($data['period_start'], $data['period_end'])
                ->lockForUpdate()
                ->get();
            if ($employmentEligible->isEmpty()) {
                throw ValidationException::withMessages([
                    'employee_ids' => ['No active employees are available for this payroll period.'],
                ]);
            }

            $requestedIds = collect($data['employee_ids'] ?? [])
                ->map(fn ($id): int => (int) $id)
                ->unique()
                ->values();
            $reservedEmployeeIds = $this->reservedEmployeeIds($data['period_start'], $data['period_end']);

            if (array_key_exists('employee_ids', $data)) {
                $unavailableIds = $requestedIds->diff($employmentEligible->pluck('id'));
                if ($unavailableIds->isNotEmpty()) {
                    throw ValidationException::withMessages([
                        'employee_ids' => ['One or more selected employees are not active during this payroll period.'],
                    ]);
                }

                $conflictingIds = $requestedIds->intersect($reservedEmployeeIds);
                if ($conflictingIds->isNotEmpty()) {
                    $names = $employmentEligible
                        ->whereIn('id', $conflictingIds)
                        ->pluck('full_name')
                        ->join(', ');
                    throw ValidationException::withMessages([
                        'employee_ids' => [($names ?: 'A selected employee').' already belongs to another payroll for an overlapping period.'],
                    ]);
                }

                $employees = $employmentEligible
                    ->whereIn('id', $requestedIds)
                    ->sortBy('employee_number')
                    ->values();
            } else {
                $employees = $employmentEligible
                    ->whereNotIn('id', $reservedEmployeeIds)
                    ->sortBy('employee_number')
                    ->values();
            }

            if ($employees->isEmpty()) {
                throw ValidationException::withMessages([
                    'employee_ids' => ['All eligible employees already belong to another payroll for this period.'],
                ]);
            }

            $payroll = PayrollRun::query()->create([
                'accounting_account_id' => $data['accounting_account_id'],
                'payment_method_id' => $data['payment_method_id'],
                'created_by' => $creatorId,
                'payroll_number' => PayrollRun::nextNumber(),
                'title' => $data['title'],
                'generated_from_hr' => true,
                'period_start' => $data['period_start'],
                'period_end' => $data['period_end'],
                'payment_date' => $data['payment_date'],
                'status' => 'draft',
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($employees as $employee) {
                $this->createPayrollItem($payroll, $employee, $data['period_start'], $data['period_end']);
            }
            $payroll->refreshTotals();

            return $payroll->fresh();
        });
    }

    public function recalculate(PayrollRun $payroll): PayrollRun
    {
        if (! $payroll->generated_from_hr) {
            throw ValidationException::withMessages([
                'payroll' => ['Only payroll generated from HR records can be recalculated.'],
            ]);
        }
        if (! in_array($payroll->status, ['draft', 'pending_review'], true)) {
            throw ValidationException::withMessages([
                'payroll' => ['Payroll can only be recalculated before manager review.'],
            ]);
        }

        return DB::transaction(function () use ($payroll): PayrollRun {
            $lockedPayroll = PayrollRun::query()->lockForUpdate()->findOrFail($payroll->id);
            if (! $lockedPayroll->generated_from_hr || ! in_array($lockedPayroll->status, ['draft', 'pending_review'], true)) {
                throw ValidationException::withMessages([
                    'payroll' => ['Payroll changed and can no longer be recalculated. Refresh the page and try again.'],
                ]);
            }
            $employeeIds = $lockedPayroll->items()
                ->whereNotNull('employee_id')
                ->pluck('employee_id')
                ->unique()
                ->values();
            if ($employeeIds->isEmpty()) {
                throw ValidationException::withMessages([
                    'payroll' => ['This payroll has no linked employees to recalculate.'],
                ]);
            }

            $employees = Employee::query()
                ->whereIn('id', $employeeIds)
                ->orderBy('employee_number')
                ->get();
            if ($employees->count() !== $employeeIds->count()) {
                throw ValidationException::withMessages([
                    'payroll' => ['One or more payroll employees no longer exist.'],
                ]);
            }

            $lockedPayroll->items()->delete();
            foreach ($employees as $employee) {
                $this->createPayrollItem(
                    $lockedPayroll,
                    $employee,
                    $lockedPayroll->period_start->toDateString(),
                    $lockedPayroll->period_end->toDateString(),
                );
            }
            $lockedPayroll->refreshTotals();
            if ($lockedPayroll->accounting_transaction_id) {
                $lockedPayroll->transaction()
                    ->where('status', 'pending_review')
                    ->update(['amount' => $lockedPayroll->fresh()->total_net]);
            }

            return $lockedPayroll->fresh();
        });
    }

    private function employmentEligibleQuery(string $periodStart, string $periodEnd): Builder
    {
        return Employee::query()
            ->whereIn('status', ['active', 'on_leave'])
            ->whereDate('hire_date', '<=', $periodEnd)
            ->where(fn (Builder $query) => $query
                ->whereNull('termination_date')
                ->orWhereDate('termination_date', '>=', $periodStart));
    }

    private function reservedEmployeeIds(string $periodStart, string $periodEnd): Collection
    {
        return PayrollItem::query()
            ->whereNotNull('employee_id')
            ->whereHas('payrollRun', fn (Builder $query) => $query
                ->whereDate('period_start', '<=', $periodEnd)
                ->whereDate('period_end', '>=', $periodStart)
                ->whereNotIn('status', ['cancelled']))
            ->pluck('employee_id')
            ->unique()
            ->values();
    }

    public function applyPosting(PayrollRun $payroll): void
    {
        $payroll->loadMissing('items.advanceAllocations.salaryAdvance', 'items.adjustments');
        foreach ($payroll->items as $item) {
            $item->update(['payment_status' => 'paid', 'paid_at' => now()]);
            $item->adjustments()->where('status', 'approved')->update(['status' => 'applied']);

            foreach ($item->advanceAllocations as $allocation) {
                $advance = SalaryAdvance::query()->lockForUpdate()->findOrFail($allocation->salary_advance_id);
                $deducted = min((float) $advance->amount, (float) $advance->deducted_amount + (float) $allocation->amount);
                $advance->update([
                    'deducted_amount' => $deducted,
                    'status' => $deducted + 0.005 >= (float) $advance->amount ? 'deducted' : 'partially_deducted',
                ]);
            }
        }
    }

    public function reversePosting(PayrollRun $payroll): void
    {
        $payroll->loadMissing('items.advanceAllocations.salaryAdvance', 'items.adjustments');
        foreach ($payroll->items as $item) {
            $item->update(['payment_status' => 'reversed', 'paid_at' => null]);
            $item->adjustments()->where('status', 'applied')->update(['status' => 'approved', 'payroll_item_id' => null]);

            foreach ($item->advanceAllocations as $allocation) {
                $advance = SalaryAdvance::query()->lockForUpdate()->findOrFail($allocation->salary_advance_id);
                $deducted = max(0, (float) $advance->deducted_amount - (float) $allocation->amount);
                $advance->update([
                    'deducted_amount' => $deducted,
                    'status' => $deducted <= 0.005 ? 'approved' : 'partially_deducted',
                ]);
            }
        }
    }

    private function createPayrollItem(PayrollRun $payroll, Employee $employee, string $periodStart, string $periodEnd): void
    {
        $context = $this->attendanceContext($employee, $periodStart, $periodEnd);
        if ($context['issues'] !== []) {
            $visibleIssues = collect($context['issues'])
                ->take(5)
                ->map(fn (array $issue): string => "{$issue['date']} ({$issue['reason']})")
                ->implode(', ');
            $remaining = count($context['issues']) - 5;
            $suffix = $remaining > 0 ? " and {$remaining} more" : '';

            throw ValidationException::withMessages([
                'employee_ids' => ["Complete and approve attendance for {$employee->full_name} before generating payroll. Unresolved dates: {$visibleIssues}{$suffix}."],
            ]);
        }

        $scheduledDates = $context['scheduled_dates'];
        $holidayDates = $context['holiday_dates'];
        /** @var Collection<string, AttendanceRecord> $records */
        $records = $context['records']->where('approval_status', 'approved');

        $presentDays = 0.0;
        $paidLeaveDays = 0.0;
        $absenceFractions = array_fill_keys($scheduledDates, 0.0);
        foreach ($scheduledDates as $date) {
            if (array_key_exists($date, $holidayDates)) {
                if ($holidayDates[$date]) {
                    $paidLeaveDays += 1;
                } else {
                    $absenceFractions[$date] = 1.0;
                }

                continue;
            }
            $record = $records->get($date);
            if (! $record) {
                continue;
            }
            if ($record->attendance_status === 'present') {
                $presentDays += 1;
            } elseif ($record->attendance_status === 'half_day') {
                $presentDays += 0.5;
                $absenceFractions[$date] = 0.5;
            } elseif (in_array($record->attendance_status, ['leave', 'holiday'], true) && $record->is_paid) {
                $paidLeaveDays += 1;
            } else {
                $absenceFractions[$date] = 1.0;
            }
        }

        $scheduledDays = (float) count($scheduledDates);
        $absentDays = round((float) array_sum($absenceFractions), 2);
        $salaryRates = $this->salaryRatesByDate($employee, $scheduledDates);
        $salaryMonths = collect($scheduledDates)
            ->map(fn (string $date): string => substr($date, 0, 7))
            ->unique()
            ->count();
        $contractedSalary = $employee->salary_type === 'fixed'
            ? round((float) $employee->base_salary * $salaryMonths, 2)
            : round((float) array_sum($salaryRates), 2);
        $absenceDeduction = 0.0;
        foreach ($absenceFractions as $date => $fraction) {
            $absenceDeduction += (float) ($salaryRates[$date] ?? 0) * $fraction;
        }
        $absenceDeduction = round($absenceDeduction, 2);

        $lateMinutes = 0;
        $lateDeduction = 0.0;
        foreach ($scheduledDates as $date) {
            if (array_key_exists($date, $holidayDates)) {
                continue;
            }
            $record = $records->get($date);
            if (! $record || ! in_array($record->attendance_status, ['present', 'half_day'], true)) {
                continue;
            }

            $minutes = max(0, (int) $record->late_minutes);
            $lateMinutes += $minutes;
            if ($minutes === 0) {
                continue;
            }

            $dayRate = (float) ($salaryRates[$date] ?? 0);
            $payableMinutes = $this->payableMinutes($employee, $date);
            $availableDayPay = $dayRate * max(0, 1 - (float) ($absenceFractions[$date] ?? 0));
            $lateDeduction += min($availableDayPay, ($dayRate / $payableMinutes) * $minutes);
        }
        $lateDeduction = round($lateDeduction, 2);

        $payableRecords = $records->filter(fn (AttendanceRecord $record): bool => in_array($record->attendance_status, ['present', 'half_day'], true));
        $overtimeMinutes = (int) $payableRecords->sum('overtime_minutes');
        $overtimeHours = round($overtimeMinutes / 60, 2);
        $overtimeAmount = round(($overtimeMinutes / 60) * $employee->effectiveOvertimeHourlyRate(), 2);
        $adjustments = EmployeeAdjustment::query()
            ->where('employee_id', $employee->id)
            ->where('status', 'approved')
            ->whereNull('payroll_item_id')
            ->whereDate('effective_date', '>=', $periodStart)
            ->whereDate('effective_date', '<=', $periodEnd)
            ->lockForUpdate()
            ->get();
        $bonus = (float) $adjustments->where('type', 'bonus')->sum('amount');
        $otherDeduction = (float) $adjustments->where('type', 'deduction')->sum('amount');
        $beforeRecurring = max(0, $contractedSalary + $bonus + $overtimeAmount - $absenceDeduction - $lateDeduction - $otherDeduction);
        [$taxDeduction, $recurringDeduction, $deductionAllocations] = $this->recurringDeductions(
            $employee,
            $periodStart,
            $periodEnd,
            $beforeRecurring,
        );
        $beforeAdvance = max(0, $beforeRecurring - $taxDeduction - $recurringDeduction);
        [$advanceDeduction, $advanceAllocations] = $this->advanceAllocations($employee, $periodEnd, $beforeAdvance);
        $net = round(max(0, $beforeAdvance - $advanceDeduction), 2);

        $item = $payroll->items()->create([
            'user_id' => $employee->user_id,
            'employee_id' => $employee->id,
            'employee_name' => $employee->full_name,
            'salary_type' => $employee->salary_type,
            'contracted_salary' => $employee->base_salary,
            'base_salary' => $contractedSalary,
            'scheduled_days' => $scheduledDays,
            'present_days' => $presentDays,
            'paid_leave_days' => $paidLeaveDays,
            'absent_days' => $absentDays,
            'late_minutes' => $lateMinutes,
            'overtime_hours' => $overtimeHours,
            'bonus' => $bonus,
            'overtime_amount' => $overtimeAmount,
            'absence_deduction' => $absenceDeduction,
            'late_deduction' => $lateDeduction,
            'advance_deduction' => $advanceDeduction,
            'tax_deduction' => $taxDeduction,
            'recurring_deduction' => $recurringDeduction,
            'other_deduction' => $otherDeduction,
            'net_amount' => $net,
            'payment_status' => 'pending',
        ]);

        EmployeeAdjustment::query()->whereKey($adjustments->pluck('id'))->update(['payroll_item_id' => $item->id]);
        foreach ($advanceAllocations as $allocation) {
            PayrollAdvanceAllocation::query()->create($allocation + ['payroll_item_id' => $item->id]);
        }
        foreach ($deductionAllocations as $allocation) {
            PayrollDeductionAllocation::query()->create($allocation + ['payroll_item_id' => $item->id]);
        }
    }

    private function attendanceContext(Employee $employee, string $periodStart, string $periodEnd): array
    {
        $requestedStart = Carbon::parse($periodStart)->startOfDay();
        $requestedEnd = Carbon::parse($periodEnd)->startOfDay();
        $start = $employee->hire_date->greaterThan($requestedStart) ? $employee->hire_date->copy() : $requestedStart;
        $end = $employee->termination_date && $employee->termination_date->lessThan($requestedEnd)
            ? $employee->termination_date->copy()
            : $requestedEnd;
        $scheduledDates = $this->attendanceService->scheduledDays($employee, $start->toDateString(), $end->toDateString());
        $holidayDates = $this->attendanceService->holidayDates($start->toDateString(), $end->toDateString());
        $records = AttendanceRecord::query()
            ->where('employee_id', $employee->id)
            ->whereDate('attendance_date', '>=', $start->toDateString())
            ->whereDate('attendance_date', '<=', $end->toDateString())
            ->get()
            ->keyBy(fn (AttendanceRecord $record): string => $record->attendance_date->toDateString());

        $issues = [];
        foreach ($scheduledDates as $date) {
            if (array_key_exists($date, $holidayDates)) {
                continue;
            }

            $record = $records->get($date);
            if (! $record) {
                $issues[] = ['date' => $date, 'reason' => 'missing'];

                continue;
            }
            if ($record->approval_status !== 'approved') {
                $issues[] = ['date' => $date, 'reason' => str_replace('_', ' ', $record->approval_status)];

                continue;
            }
            if (in_array($record->attendance_status, ['present', 'half_day'], true) && (! $record->check_in || ! $record->check_out)) {
                $issues[] = ['date' => $date, 'reason' => 'missing check-in or check-out'];
            }
        }

        return [
            'start' => $start,
            'end' => $end,
            'scheduled_dates' => $scheduledDates,
            'holiday_dates' => $holidayDates,
            'records' => $records,
            'issues' => $issues,
        ];
    }

    private function salaryRatesByDate(Employee $employee, array $scheduledDates): array
    {
        if ($employee->salary_type === 'daily') {
            return collect($scheduledDates)
                ->mapWithKeys(fn (string $date): array => [$date => (float) $employee->daily_rate])
                ->all();
        }

        $rates = [];
        foreach (collect($scheduledDates)->groupBy(fn (string $date): string => substr($date, 0, 7)) as $monthDates) {
            $month = Carbon::parse($monthDates->first())->startOfMonth();
            $monthlyScheduledDays = count($this->attendanceService->scheduledDays(
                $employee,
                $month->toDateString(),
                $month->copy()->endOfMonth()->toDateString(),
            ));
            $dailyRate = $monthlyScheduledDays > 0
                ? (float) $employee->base_salary / $monthlyScheduledDays
                : 0.0;

            foreach ($monthDates as $date) {
                $rates[$date] = $dailyRate;
            }
        }

        return $rates;
    }

    private function payableMinutes(Employee $employee, string $date): int
    {
        $schedule = $this->attendanceService->schedule($employee, $date);
        $start = Carbon::parse("{$date} {$schedule['start_time']}");
        $end = Carbon::parse("{$date} {$schedule['end_time']}");
        if ($end->lessThanOrEqualTo($start)) {
            $end->addDay();
        }

        return max(1, $start->diffInMinutes($end) - (int) $schedule['break_minutes']);
    }

    private function advanceAllocations(Employee $employee, string $periodEnd, float $maximum): array
    {
        $remainingCapacity = $maximum;
        $total = 0.0;
        $allocations = [];
        $advances = SalaryAdvance::query()
            ->where('employee_id', $employee->id)
            ->whereIn('status', ['approved', 'partially_deducted'])
            ->whereDate('deduction_start_date', '<=', $periodEnd)
            ->orderBy('deduction_start_date')
            ->lockForUpdate()
            ->get();

        foreach ($advances as $advance) {
            $reserved = (float) PayrollAdvanceAllocation::query()
                ->where('salary_advance_id', $advance->id)
                ->whereHas('payrollItem.payrollRun', fn ($query) => $query->whereNotIn('status', ['cancelled']))
                ->sum('amount');
            $reserved += (float) TerminationAdvanceAllocation::query()
                ->where('salary_advance_id', $advance->id)
                ->whereHas('termination', fn ($query) => $query->whereNotIn('status', ['rejected', 'cancelled']))
                ->sum('amount');
            $available = max(0, (float) $advance->amount - (float) $advance->deducted_amount - $reserved);
            $amount = round(min($available, $remainingCapacity), 2);
            if ($amount <= 0) {
                continue;
            }
            $allocations[] = ['salary_advance_id' => $advance->id, 'amount' => $amount];
            $total += $amount;
            $remainingCapacity -= $amount;
            if ($remainingCapacity <= 0.005) {
                break;
            }
        }

        return [round($total, 2), $allocations];
    }

    private function recurringDeductions(Employee $employee, string $periodStart, string $periodEnd, float $maximum): array
    {
        $remaining = $maximum;
        $tax = 0.0;
        $recurring = 0.0;
        $allocations = [];
        $deductions = EmployeePayrollDeduction::query()
            ->with('rule')
            ->where('employee_id', $employee->id)
            ->where('status', 'active')
            ->whereDate('effective_from', '<=', $periodEnd)
            ->where(fn ($query) => $query->whereNull('effective_to')->orWhereDate('effective_to', '>=', $periodStart))
            ->get()
            ->filter(fn (EmployeePayrollDeduction $deduction): bool => $deduction->rule?->status === 'active')
            ->sortBy(fn (EmployeePayrollDeduction $deduction): int => $deduction->rule?->type === 'tax' ? 0 : 1);

        foreach ($deductions as $deduction) {
            $rule = $deduction->rule;
            $value = $deduction->override_value !== null ? (float) $deduction->override_value : (float) $rule->value;
            $base = max(0, $maximum - (float) $rule->threshold_amount);
            $amount = $rule->calculation_type === 'percentage' ? $base * $value / 100 : $value;
            if ($rule->maximum_amount !== null) {
                $amount = min($amount, (float) $rule->maximum_amount);
            }
            $amount = round(min(max(0, $amount), $remaining), 2);
            if ($amount <= 0) {
                continue;
            }

            if ($rule->type === 'tax') {
                $tax += $amount;
            } else {
                $recurring += $amount;
            }
            $remaining -= $amount;
            $allocations[] = [
                'employee_payroll_deduction_id' => $deduction->id,
                'payroll_deduction_rule_id' => $rule->id,
                'code' => $rule->code,
                'name' => $rule->name,
                'type' => $rule->type,
                'calculation_type' => $rule->calculation_type,
                'value_snapshot' => $value,
                'amount' => $amount,
            ];
            if ($remaining <= 0.005) {
                break;
            }
        }

        return [round($tax, 2), round($recurring, 2), $allocations];
    }
}
