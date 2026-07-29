<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\EmployeeTermination;
use App\Models\PayrollAdvanceAllocation;
use App\Models\PayrollRun;
use App\Models\SalaryAdvance;
use App\Models\TerminationAdvanceAllocation;
use Carbon\Carbon;

class TerminationSettlementService
{
    public function __construct(
        private readonly AttendanceService $attendance,
        private readonly LeaveBalanceService $leaveBalances,
    ) {}

    public function calculate(Employee $employee, string $lastWorkingDate, array $inputs = []): array
    {
        $lastDate = Carbon::parse($lastWorkingDate);
        $lastPayrollEnd = PayrollRun::query()
            ->where('status', 'approved')
            ->whereHas('items', fn ($query) => $query->where('employee_id', $employee->id))
            ->max('period_end');
        $periodStart = $lastDate->copy()->startOfMonth();
        if ($lastPayrollEnd) {
            $afterPayroll = Carbon::parse($lastPayrollEnd)->addDay();
            if ($afterPayroll->greaterThan($periodStart)) {
                $periodStart = $afterPayroll;
            }
        }
        if ($employee->hire_date->greaterThan($periodStart)) {
            $periodStart = $employee->hire_date->copy();
        }

        $monthScheduled = max(1, count($this->attendance->scheduledDays(
            $employee,
            $lastDate->copy()->startOfMonth()->toDateString(),
            $lastDate->copy()->endOfMonth()->toDateString(),
        )));
        $scheduled = $periodStart->greaterThan($lastDate)
            ? []
            : $this->attendance->scheduledDays($employee, $periodStart->toDateString(), $lastDate->toDateString());
        $holidays = $periodStart->greaterThan($lastDate)
            ? []
            : $this->attendance->holidayDates($periodStart->toDateString(), $lastDate->toDateString());
        $records = AttendanceRecord::query()
            ->where('employee_id', $employee->id)
            ->where('approval_status', 'approved')
            ->whereBetween('attendance_date', [$periodStart->toDateString(), $lastDate->toDateString()])
            ->get()
            ->keyBy(fn (AttendanceRecord $record): string => $record->attendance_date->toDateString());
        $paidDays = 0.0;
        foreach ($scheduled as $date) {
            if (($holidays[$date] ?? false) === true) {
                $paidDays += 1;

                continue;
            }
            $record = $records->get($date);
            if (! $record) {
                continue;
            }
            if ($record->attendance_status === 'present') {
                $paidDays += 1;
            } elseif ($record->attendance_status === 'half_day') {
                $paidDays += 0.5;
            } elseif (in_array($record->attendance_status, ['leave', 'holiday'], true) && $record->is_paid) {
                $paidDays += 1;
            }
        }

        $dailyRate = $employee->salary_type === 'daily'
            ? (float) $employee->daily_rate
            : round((float) $employee->base_salary / $monthScheduled, 2);
        $finalSalary = round($dailyRate * $paidDays, 2);
        $leavePayout = $this->leaveBalances->terminationPayout($employee, $lastDate->toDateString(), $dailyRate);
        $severance = max(0, (float) ($inputs['severance_amount'] ?? 0));
        $otherEarnings = max(0, (float) ($inputs['other_earnings'] ?? 0));
        $otherDeductions = max(0, (float) ($inputs['other_deductions'] ?? 0));
        $gross = $finalSalary + $leavePayout + $severance + $otherEarnings;
        $recoveryCapacity = max(0, $gross - $otherDeductions);
        [$advanceRecovery, $allocations] = $this->advanceAllocations($employee, $recoveryCapacity);

        return [
            'settlement_period_start' => $periodStart->toDateString(),
            'paid_days' => round($paidDays, 2),
            'daily_rate' => round($dailyRate, 2),
            'final_salary' => $finalSalary,
            'unused_leave_payout' => $leavePayout,
            'severance_amount' => round($severance, 2),
            'other_earnings' => round($otherEarnings, 2),
            'advance_recovery' => $advanceRecovery,
            'other_deductions' => round($otherDeductions, 2),
            'net_settlement' => round(max(0, $gross - $otherDeductions - $advanceRecovery), 2),
            'advance_allocations' => $allocations,
        ];
    }

    public function apply(EmployeeTermination $termination): void
    {
        $termination->loadMissing('advanceAllocations.salaryAdvance', 'employee.user');
        foreach ($termination->advanceAllocations as $allocation) {
            $advance = SalaryAdvance::query()->whereKey($allocation->salary_advance_id)->lockForUpdate()->firstOrFail();
            $deducted = min((float) $advance->amount, (float) $advance->deducted_amount + (float) $allocation->amount);
            $advance->update([
                'deducted_amount' => $deducted,
                'status' => $deducted + 0.005 >= (float) $advance->amount ? 'deducted' : 'partially_deducted',
            ]);
        }
        $termination->employee->update([
            'status' => 'terminated',
            'termination_date' => $termination->last_working_date->toDateString(),
        ]);
        if ($termination->employee->user) {
            $termination->employee->user->update(['status' => 'inactive']);
            $termination->employee->user->tokens()->delete();
        }
    }

    public function reverse(EmployeeTermination $termination): void
    {
        $termination->loadMissing('advanceAllocations.salaryAdvance', 'employee');
        foreach ($termination->advanceAllocations as $allocation) {
            $advance = SalaryAdvance::query()->whereKey($allocation->salary_advance_id)->lockForUpdate()->firstOrFail();
            $deducted = max(0, (float) $advance->deducted_amount - (float) $allocation->amount);
            $advance->update([
                'deducted_amount' => $deducted,
                'status' => $deducted <= 0.005 ? 'approved' : 'partially_deducted',
            ]);
        }
        $termination->employee->update(['status' => 'active', 'termination_date' => null]);
    }

    private function advanceAllocations(Employee $employee, float $maximum): array
    {
        $remaining = $maximum;
        $total = 0.0;
        $allocations = [];
        $advances = SalaryAdvance::query()
            ->where('employee_id', $employee->id)
            ->whereIn('status', ['approved', 'partially_deducted'])
            ->orderBy('deduction_start_date')
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
            $amount = round(min($available, $remaining), 2);
            if ($amount <= 0) {
                continue;
            }
            $allocations[] = ['salary_advance_id' => $advance->id, 'amount' => $amount];
            $total += $amount;
            $remaining -= $amount;
            if ($remaining <= 0.005) {
                break;
            }
        }

        return [round($total, 2), $allocations];
    }
}
