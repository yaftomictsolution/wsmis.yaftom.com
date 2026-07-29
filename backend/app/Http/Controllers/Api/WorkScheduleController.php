<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesHrRequests;
use App\Http\Controllers\Controller;
use App\Models\EmployeeShiftAssignment;
use App\Models\PayrollRun;
use App\Models\PublicHoliday;
use App\Models\WorkShift;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class WorkScheduleController extends Controller
{
    use AuthorizesHrRequests;

    public function index(Request $request): JsonResponse
    {
        $assignments = EmployeeShiftAssignment::query()->with($this->assignmentRelations());
        if (! $this->canManageHr($request)) {
            $employee = $this->currentEmployee($request);
            abort_unless($employee, 403, 'Your login is not linked to an employee profile.');
            $assignments->where('employee_id', $employee->id);
        }

        return response()->json(['data' => [
            'shifts' => WorkShift::query()->withCount('assignments')->orderBy('name')->get(),
            'assignments' => $assignments->latest('effective_from')->latest()->get(),
            'holidays' => PublicHoliday::query()->orderByDesc('holiday_date')->get(),
        ]]);
    }

    public function storeShift(Request $request): JsonResponse
    {
        $this->authorizeHrView($request);
        $shift = WorkShift::query()->create($this->shiftData($request));

        return response()->json(['data' => $shift], 201);
    }

    public function updateShift(Request $request, WorkShift $workShift): JsonResponse
    {
        $this->authorizeHrView($request);
        $workShift->update($this->shiftData($request, $workShift));

        return response()->json(['data' => $workShift->fresh()->loadCount('assignments')]);
    }

    public function destroyShift(Request $request, WorkShift $workShift): JsonResponse
    {
        $this->authorizeHrView($request);
        abort_if($workShift->assignments()->exists(), 422, 'This shift has assignment history. Set it to inactive instead.');
        $workShift->delete();

        return response()->json(['message' => 'Work shift deleted.']);
    }

    public function storeAssignment(Request $request): JsonResponse
    {
        $this->authorizeHrView($request);
        $data = $this->assignmentData($request);
        $this->ensureNoAssignmentOverlap($data);
        $assignment = EmployeeShiftAssignment::query()->create($data + ['assigned_by' => $request->user()->id]);

        return response()->json(['data' => $assignment->load($this->assignmentRelations())], 201);
    }

    public function updateAssignment(Request $request, EmployeeShiftAssignment $employeeShiftAssignment): JsonResponse
    {
        $this->authorizeHrView($request);
        $data = $this->assignmentData($request);
        $this->ensureNoAssignmentOverlap($data, $employeeShiftAssignment);
        $employeeShiftAssignment->update($data + ['assigned_by' => $request->user()->id]);

        return response()->json(['data' => $employeeShiftAssignment->fresh()->load($this->assignmentRelations())]);
    }

    public function destroyAssignment(Request $request, EmployeeShiftAssignment $employeeShiftAssignment): JsonResponse
    {
        $this->authorizeHrView($request);
        $employeeShiftAssignment->delete();

        return response()->json(['message' => 'Shift assignment deleted.']);
    }

    public function storeHoliday(Request $request): JsonResponse
    {
        $this->authorizeHrView($request);
        $holiday = PublicHoliday::query()->create($this->holidayData($request));

        return response()->json(['data' => $holiday], 201);
    }

    public function updateHoliday(Request $request, PublicHoliday $publicHoliday): JsonResponse
    {
        $this->authorizeHrView($request);
        $publicHoliday->update($this->holidayData($request, $publicHoliday));

        return response()->json(['data' => $publicHoliday->fresh()]);
    }

    public function destroyHoliday(Request $request, PublicHoliday $publicHoliday): JsonResponse
    {
        $this->authorizeHrView($request);
        $usedByPayroll = $publicHoliday->holiday_date && PayrollRun::query()
            ->whereNotIn('status', ['draft', 'rejected', 'cancelled'])
            ->whereDate('period_start', '<=', $publicHoliday->holiday_date)
            ->whereDate('period_end', '>=', $publicHoliday->holiday_date)
            ->exists();
        abort_if($usedByPayroll, 422, 'This holiday falls inside submitted payroll history and cannot be deleted.');
        $publicHoliday->delete();

        return response()->json(['message' => 'Public holiday deleted.']);
    }

    private function shiftData(Request $request, ?WorkShift $shift = null): array
    {
        return $request->validate([
            'code' => ['required', 'string', 'max:50', 'alpha_dash', Rule::unique('work_shifts', 'code')->ignore($shift)],
            'name' => ['required', 'string', 'max:255'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i', 'after:start_time'],
            'break_minutes' => ['required', 'integer', 'between:0,240'],
            'late_grace_minutes' => ['required', 'integer', 'between:0,120'],
            'overtime_after_minutes' => ['required', 'integer', 'between:0,240'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
    }

    private function assignmentData(Request $request): array
    {
        return $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'work_shift_id' => ['required', 'integer', Rule::exists('work_shifts', 'id')->where('status', 'active')],
            'effective_from' => ['required', 'date'],
            'effective_to' => ['nullable', 'date', 'after_or_equal:effective_from'],
            'work_days' => ['required', 'array', 'min:1'],
            'work_days.*' => ['integer', 'between:1,7', 'distinct'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
    }

    private function holidayData(Request $request, ?PublicHoliday $holiday = null): array
    {
        return $request->validate([
            'holiday_date' => ['required', 'date', Rule::unique('public_holidays', 'holiday_date')->ignore($holiday)],
            'name' => ['required', 'string', 'max:255'],
            'is_paid' => ['required', 'boolean'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
    }

    private function ensureNoAssignmentOverlap(array $data, ?EmployeeShiftAssignment $except = null): void
    {
        $overlap = EmployeeShiftAssignment::query()
            ->where('employee_id', $data['employee_id'])
            ->whereDate('effective_from', '<=', $data['effective_to'] ?? '9999-12-31')
            ->where(fn ($query) => $query->whereNull('effective_to')->orWhereDate('effective_to', '>=', $data['effective_from']))
            ->when($except, fn ($query) => $query->whereKeyNot($except->id))
            ->exists();
        if ($overlap) {
            throw ValidationException::withMessages(['effective_from' => ['This employee already has a shift during the selected period.']]);
        }
    }

    private function assignmentRelations(): array
    {
        return ['employee:id,employee_number,first_name,last_name', 'shift', 'assigner:id,name'];
    }
}
