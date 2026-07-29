<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesHrRequests;
use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Services\AttendanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AttendanceController extends Controller
{
    use AuthorizesHrRequests;

    public function __construct(private readonly AttendanceService $attendanceService) {}

    public function index(Request $request): JsonResponse
    {
        $query = AttendanceRecord::query()->with($this->relations());
        if ($this->canManageHr($request)) {
            $query->when($request->filled('employee_id'), fn ($builder) => $builder->where('employee_id', $request->integer('employee_id')));
        } else {
            $employee = $this->currentEmployee($request);
            abort_unless($employee, 403, 'Your login is not linked to an employee profile.');
            $query->where('employee_id', $employee->id);
        }
        $records = $query
            ->when($request->filled('from'), fn ($builder) => $builder->whereDate('attendance_date', '>=', $request->input('from')))
            ->when($request->filled('to'), fn ($builder) => $builder->whereDate('attendance_date', '<=', $request->input('to')))
            ->when($request->filled('approval_status'), fn ($builder) => $builder->where('approval_status', $request->string('approval_status')))
            ->latest('attendance_date')
            ->latest()
            ->get();

        return response()->json(['data' => $records]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeHrView($request);
        $data = $this->validated($request);
        $employee = Employee::query()->findOrFail($data['employee_id']);
        $this->ensureEmploymentDate($employee, $data['attendance_date']);
        $record = new AttendanceRecord($data + [
            'recorded_by' => $request->user()->id,
            'source' => 'manual',
            'approval_status' => 'pending',
            'is_paid' => ! in_array($data['attendance_status'], ['absent'], true),
        ]);
        $record->attendance_date = $data['attendance_date'];
        $this->attendanceService->recalculate($record, $employee)->save();

        return response()->json(['data' => $record->load($this->relations())], 201);
    }

    public function update(Request $request, AttendanceRecord $attendanceRecord): JsonResponse
    {
        $this->authorizeHrView($request);
        abort_if($attendanceRecord->source === 'leave', 422, 'Leave attendance must be changed from the leave request.');
        $data = $this->validated($request, $attendanceRecord);
        $employee = Employee::query()->findOrFail($data['employee_id']);
        $this->ensureEmploymentDate($employee, $data['attendance_date']);
        $attendanceRecord->fill($data + [
            'recorded_by' => $request->user()->id,
            'approval_status' => 'pending',
            'approved_by' => null,
            'approved_at' => null,
            'rejection_reason' => null,
            'is_paid' => ! in_array($data['attendance_status'], ['absent'], true),
        ]);
        $this->attendanceService->recalculate($attendanceRecord, $employee)->save();

        return response()->json(['data' => $attendanceRecord->fresh()->load($this->relations())]);
    }

    public function destroy(Request $request, AttendanceRecord $attendanceRecord): JsonResponse
    {
        $this->authorizeHrView($request);
        abort_unless(in_array($attendanceRecord->approval_status, ['pending', 'rejected'], true), 422, 'Only pending or rejected attendance can be deleted.');
        abort_if($attendanceRecord->source === 'leave', 422, 'Leave attendance must be changed from the leave request.');
        $attendanceRecord->delete();

        return response()->json(['message' => 'Attendance record deleted.']);
    }

    public function checkIn(Request $request): JsonResponse
    {
        $employee = $this->currentEmployee($request);
        abort_unless($employee && $employee->status === 'active', 403, 'Your active employee profile is required for check-in.');
        $date = now()->toDateString();
        $record = AttendanceRecord::query()->firstOrNew(['employee_id' => $employee->id, 'attendance_date' => $date]);
        abort_if($record->exists && $record->check_in, 422, 'You have already checked in today.');
        abort_if($record->exists && $record->source === 'leave', 422, 'You have approved leave today.');
        $record->fill([
            'recorded_by' => $request->user()->id,
            'attendance_status' => 'present',
            'is_paid' => true,
            'check_in' => now()->format('H:i:s'),
            'source' => 'self_service',
            'approval_status' => 'pending',
        ]);
        $record->attendance_date = $date;
        $this->attendanceService->recalculate($record, $employee)->save();

        return response()->json(['data' => $record->load($this->relations())]);
    }

    public function checkOut(Request $request): JsonResponse
    {
        $employee = $this->currentEmployee($request);
        abort_unless($employee, 403, 'Your login is not linked to an employee profile.');
        $record = AttendanceRecord::query()->where('employee_id', $employee->id)->whereDate('attendance_date', now()->toDateString())->firstOrFail();
        abort_unless($record->check_in, 422, 'Check in before checking out.');
        abort_if($record->check_out, 422, 'You have already checked out today.');
        $record->fill(['check_out' => now()->format('H:i:s'), 'approval_status' => 'pending']);
        $this->attendanceService->recalculate($record, $employee)->save();

        return response()->json(['data' => $record->load($this->relations())]);
    }

    public function resolve(Request $request, AttendanceRecord $attendanceRecord): JsonResponse
    {
        $this->authorizeHrApproval($request);
        $data = $request->validate([
            'action' => ['required', Rule::in(['approve', 'reject'])],
            'rejection_reason' => ['nullable', 'required_if:action,reject', 'string', 'max:1000'],
        ]);
        abort_unless(in_array($attendanceRecord->approval_status, ['pending', 'rejected'], true), 422, 'Only pending or rejected attendance can be resolved.');

        if ($data['action'] === 'approve') {
            if (in_array($attendanceRecord->attendance_status, ['present', 'half_day'], true) && (! $attendanceRecord->check_in || ! $attendanceRecord->check_out)) {
                throw ValidationException::withMessages([
                    'attendance' => ['Present and half-day attendance require both check-in and check-out before approval.'],
                ]);
            }
            $attendanceRecord->update([
                'approval_status' => 'approved',
                'approved_by' => $request->user()->id,
                'approved_at' => now(),
                'rejection_reason' => null,
            ]);
        } else {
            $attendanceRecord->update([
                'approval_status' => 'rejected',
                'approved_by' => $request->user()->id,
                'approved_at' => now(),
                'rejection_reason' => $data['rejection_reason'],
            ]);
        }

        return response()->json(['data' => $attendanceRecord->fresh()->load($this->relations())]);
    }

    private function validated(Request $request, ?AttendanceRecord $record = null): array
    {
        $data = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'attendance_date' => ['required', 'date', 'before_or_equal:today'],
            'check_in' => ['nullable', 'date_format:H:i'],
            'check_out' => ['nullable', 'date_format:H:i'],
            'attendance_status' => ['required', Rule::in(['present', 'absent', 'half_day', 'holiday'])],
            'notes' => ['nullable', 'string'],
        ]);
        $duplicate = AttendanceRecord::query()
            ->where('employee_id', $data['employee_id'])
            ->whereDate('attendance_date', $data['attendance_date'])
            ->when($record, fn ($query) => $query->whereKeyNot($record->id))
            ->exists();
        if ($duplicate) {
            throw ValidationException::withMessages(['attendance_date' => ['This employee already has attendance for the selected date.']]);
        }

        return $data;
    }

    private function ensureEmploymentDate(Employee $employee, string $date): void
    {
        if ($date < $employee->hire_date->toDateString()) {
            throw ValidationException::withMessages([
                'attendance_date' => ["Attendance cannot be recorded before the employee hire date ({$employee->hire_date->toDateString()})."],
            ]);
        }
        if ($employee->termination_date && $date > $employee->termination_date->toDateString()) {
            throw ValidationException::withMessages([
                'attendance_date' => ["Attendance cannot be recorded after the employee termination date ({$employee->termination_date->toDateString()})."],
            ]);
        }
    }

    private function relations(): array
    {
        return ['employee:id,employee_number,biometric_id,first_name,last_name,user_id,work_start_time,work_end_time', 'recorder:id,name', 'approver:id,name', 'leaveRequest:id,leave_number,leave_type', 'biometricImportBatch:id,batch_number'];
    }
}
