<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\EmployeeShiftAssignment;
use App\Models\LeaveRequest;
use App\Models\PublicHoliday;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Validation\ValidationException;

class AttendanceService
{
    public function recalculate(AttendanceRecord $record, Employee $employee): AttendanceRecord
    {
        if (! in_array($record->attendance_status, ['present', 'half_day'], true)) {
            $record->forceFill([
                'worked_minutes' => 0,
                'late_minutes' => 0,
                'overtime_minutes' => 0,
            ]);

            return $record;
        }

        $date = $record->attendance_date->toDateString();
        $schedule = $this->schedule($employee, $date);
        $scheduledStart = Carbon::parse("{$date} {$schedule['start_time']}");
        $scheduledEnd = Carbon::parse("{$date} {$schedule['end_time']}");
        $checkIn = $record->check_in ? Carbon::parse("{$date} {$record->check_in}") : null;
        $checkOut = $record->check_out ? Carbon::parse("{$date} {$record->check_out}") : null;

        if ($checkIn && $checkOut && $checkOut->lessThanOrEqualTo($checkIn)) {
            throw ValidationException::withMessages(['check_out' => ['Check-out must be later than check-in.']]);
        }

        $worked = $checkIn && $checkOut ? max(0, $checkIn->diffInMinutes($checkOut) - $schedule['break_minutes']) : 0;
        $lateStartsAt = $scheduledStart->copy()->addMinutes($schedule['late_grace_minutes']);
        $overtimeStartsAt = $scheduledEnd->copy()->addMinutes($schedule['overtime_after_minutes']);
        $late = $checkIn && $checkIn->greaterThan($lateStartsAt) ? $lateStartsAt->diffInMinutes($checkIn) : 0;
        $overtime = $checkOut && $checkOut->greaterThan($overtimeStartsAt) ? $scheduledEnd->diffInMinutes($checkOut) : 0;

        $record->forceFill([
            'worked_minutes' => $worked,
            'late_minutes' => $late,
            'overtime_minutes' => $overtime,
        ]);

        return $record;
    }

    public function workingDays(Employee $employee, string $startDate, string $endDate): array
    {
        $holidays = PublicHoliday::query()
            ->where('status', 'active')
            ->whereDate('holiday_date', '>=', $startDate)
            ->whereDate('holiday_date', '<=', $endDate)
            ->pluck('holiday_date')
            ->map(fn ($date): string => Carbon::parse($date)->toDateString())
            ->all();

        return collect($this->scheduledDays($employee, $startDate, $endDate))
            ->reject(fn (string $date): bool => in_array($date, $holidays, true))
            ->values()
            ->all();
    }

    public function scheduledDays(Employee $employee, string $startDate, string $endDate): array
    {
        return collect(CarbonPeriod::create($startDate, $endDate))
            ->filter(function (Carbon $date) use ($employee): bool {
                $schedule = $this->schedule($employee, $date->toDateString());

                return in_array($date->dayOfWeekIso, $schedule['work_days'], true);
            })
            ->map(fn (Carbon $date): string => $date->toDateString())
            ->values()
            ->all();
    }

    public function holidayDates(string $startDate, string $endDate): array
    {
        return PublicHoliday::query()
            ->where('status', 'active')
            ->whereDate('holiday_date', '>=', $startDate)
            ->whereDate('holiday_date', '<=', $endDate)
            ->get()
            ->mapWithKeys(fn (PublicHoliday $holiday): array => [
                $holiday->holiday_date->toDateString() => (bool) $holiday->is_paid,
            ])
            ->all();
    }

    public function schedule(Employee $employee, string $date): array
    {
        $assignment = EmployeeShiftAssignment::query()
            ->with('shift')
            ->where('employee_id', $employee->id)
            ->whereDate('effective_from', '<=', $date)
            ->where(fn ($query) => $query->whereNull('effective_to')->orWhereDate('effective_to', '>=', $date))
            ->latest('effective_from')
            ->latest('id')
            ->first();

        if ($assignment?->shift && $assignment->shift->status === 'active') {
            return [
                'start_time' => $assignment->shift->start_time,
                'end_time' => $assignment->shift->end_time,
                'break_minutes' => (int) $assignment->shift->break_minutes,
                'late_grace_minutes' => (int) $assignment->shift->late_grace_minutes,
                'overtime_after_minutes' => (int) $assignment->shift->overtime_after_minutes,
                'work_days' => array_map('intval', $assignment->work_days ?: $employee->scheduledWorkDays()),
            ];
        }

        return [
            'start_time' => $employee->work_start_time,
            'end_time' => $employee->work_end_time,
            'break_minutes' => 0,
            'late_grace_minutes' => 0,
            'overtime_after_minutes' => 0,
            'work_days' => $employee->scheduledWorkDays(),
        ];
    }

    public function synchronizeApprovedLeave(LeaveRequest $leave): void
    {
        $employee = $leave->employee()->firstOrFail();
        foreach ($this->workingDays($employee, $leave->start_date->toDateString(), $leave->end_date->toDateString()) as $date) {
            $record = AttendanceRecord::query()
                ->where('employee_id', $employee->id)
                ->whereDate('attendance_date', $date)
                ->first();

            if ($record && $record->leave_request_id !== $leave->id && $record->approval_status === 'approved') {
                throw ValidationException::withMessages([
                    'start_date' => ["Attendance is already approved for {$date}. Resolve it before approving this leave."],
                ]);
            }

            AttendanceRecord::query()->updateOrCreate(
                ['employee_id' => $employee->id, 'attendance_date' => $date],
                [
                    'leave_request_id' => $leave->id,
                    'recorded_by' => $leave->reviewed_by,
                    'approved_by' => $leave->reviewed_by,
                    'attendance_status' => 'leave',
                    'is_paid' => $leave->is_paid,
                    'check_in' => null,
                    'check_out' => null,
                    'worked_minutes' => 0,
                    'late_minutes' => 0,
                    'overtime_minutes' => 0,
                    'source' => 'leave',
                    'approval_status' => 'approved',
                    'approved_at' => now(),
                    'rejection_reason' => null,
                    'notes' => $leave->leave_type,
                ],
            );
        }
    }

    public function removeLeaveAttendance(LeaveRequest $leave): void
    {
        AttendanceRecord::query()->where('leave_request_id', $leave->id)->delete();
    }
}
