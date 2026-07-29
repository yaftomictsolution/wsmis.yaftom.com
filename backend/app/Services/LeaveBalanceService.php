<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeLeaveBalance;
use App\Models\LeavePolicy;
use App\Models\LeaveRequest;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class LeaveBalanceService
{
    public function balances(Employee $employee, int $year): Collection
    {
        return LeavePolicy::query()->where('status', 'active')->orderBy('name')->get()
            ->map(fn (LeavePolicy $policy): EmployeeLeaveBalance => $this->decorate(
                $this->ensure($employee, $policy, $year),
            ));
    }

    public function ensure(Employee $employee, LeavePolicy $policy, int $year): EmployeeLeaveBalance
    {
        $balance = EmployeeLeaveBalance::query()->where([
            'employee_id' => $employee->id,
            'leave_policy_id' => $policy->id,
            'year' => $year,
        ])->first();
        if ($balance) {
            return $balance->loadMissing('policy');
        }

        return $this->refresh($employee, $policy, $year);
    }

    public function refresh(Employee $employee, LeavePolicy $policy, int $year): EmployeeLeaveBalance
    {
        [$entitlement, $carried] = $this->calculatedValues($employee, $policy, $year);
        $balance = EmployeeLeaveBalance::query()->firstOrNew([
            'employee_id' => $employee->id,
            'leave_policy_id' => $policy->id,
            'year' => $year,
        ]);
        $balance->fill([
            'entitlement_days' => $policy->tracks_balance ? $entitlement : 0,
            'carried_forward_days' => $policy->tracks_balance ? $carried : 0,
        ]);
        $balance->save();

        return $balance->load('policy');
    }

    private function calculatedValues(Employee $employee, LeavePolicy $policy, int $year): array
    {
        $entitlement = (float) $policy->days_per_year;
        if ($employee->hire_date->year === $year) {
            $months = max(1, 13 - $employee->hire_date->month);
            $entitlement = round($entitlement * $months / 12, 2);
        }
        if ($employee->hire_date->year > $year) {
            $entitlement = 0;
        }

        $carried = 0.0;
        if ((float) $policy->carry_forward_limit > 0 && $year > $employee->hire_date->year) {
            $previous = $this->decorate($this->ensure($employee, $policy, $year - 1));
            $carried = min((float) $policy->carry_forward_limit, max(0, (float) $previous->available_days));
        }

        return [$entitlement, $carried];
    }

    public function decorate(EmployeeLeaveBalance $balance, ?int $exceptLeaveId = null): EmployeeLeaveBalance
    {
        $balance->loadMissing('policy', 'employee');
        $usage = LeaveRequest::query()
            ->where('employee_id', $balance->employee_id)
            ->where('leave_policy_id', $balance->leave_policy_id)
            ->whereYear('start_date', $balance->year)
            ->when($exceptLeaveId, fn ($query) => $query->whereKeyNot($exceptLeaveId))
            ->whereIn('status', ['pending', 'approved'])
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'approved' THEN total_days ELSE 0 END), 0) as used_days")
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'pending' THEN total_days ELSE 0 END), 0) as pending_days")
            ->first();
        $used = (float) ($usage?->used_days ?? 0);
        $pending = (float) ($usage?->pending_days ?? 0);
        $total = (float) $balance->entitlement_days + (float) $balance->carried_forward_days + (float) $balance->adjustment_days;

        $balance->setAttribute('used_days', round($used, 2));
        $balance->setAttribute('pending_days', round($pending, 2));
        $balance->setAttribute('available_days', round(max(0, $total - $used - $pending), 2));

        return $balance;
    }

    public function assertAvailable(
        Employee $employee,
        LeavePolicy $policy,
        string $startDate,
        string $endDate,
        float $days,
        ?int $exceptLeaveId = null,
    ): void {
        $start = Carbon::parse($startDate);
        $end = Carbon::parse($endDate);
        if ($policy->tracks_balance && $start->year !== $end->year) {
            throw ValidationException::withMessages(['end_date' => ['Balanced leave must start and end in the same calendar year.']]);
        }
        if ($policy->max_consecutive_days !== null && $days > (float) $policy->max_consecutive_days) {
            throw ValidationException::withMessages([
                'end_date' => ["This leave policy allows at most {$policy->max_consecutive_days} consecutive working days."],
            ]);
        }
        if (! $policy->tracks_balance) {
            return;
        }

        $balance = $this->decorate($this->ensure($employee, $policy, $start->year), $exceptLeaveId);
        if ($days > (float) $balance->available_days + 0.005) {
            throw ValidationException::withMessages([
                'end_date' => ["Only {$balance->available_days} days remain under {$policy->name}."],
            ]);
        }
    }

    public function terminationPayout(Employee $employee, string $date, float $dailyRate): float
    {
        $year = Carbon::parse($date)->year;

        return round((float) LeavePolicy::query()
            ->where('status', 'active')
            ->where('tracks_balance', true)
            ->where('payout_on_termination', true)
            ->get()
            ->sum(function (LeavePolicy $policy) use ($employee, $year, $dailyRate): float {
                $balance = $this->decorate($this->ensure($employee, $policy, $year));

                return (float) $balance->available_days * $dailyRate;
            }), 2);
    }
}
