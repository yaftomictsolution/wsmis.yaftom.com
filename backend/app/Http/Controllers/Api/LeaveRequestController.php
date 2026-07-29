<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesHrRequests;
use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\LeavePolicy;
use App\Models\LeaveRequest;
use App\Models\PayrollItem;
use App\Notifications\HrWorkflowNotification;
use App\Services\AttendanceService;
use App\Services\HrNotificationService;
use App\Services\LeaveBalanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class LeaveRequestController extends Controller
{
    use AuthorizesHrRequests;

    public function __construct(
        private readonly AttendanceService $attendanceService,
        private readonly HrNotificationService $notifications,
        private readonly LeaveBalanceService $leaveBalances,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = LeaveRequest::query()->with($this->relations());
        if ($this->canManageHr($request)) {
            $query->when($request->filled('employee_id'), fn ($builder) => $builder->where('employee_id', $request->integer('employee_id')));
        } else {
            $employee = $this->currentEmployee($request);
            abort_unless($employee, 403, 'Your login is not linked to an employee profile.');
            $query->where('employee_id', $employee->id);
        }
        $leave = $query
            ->when($request->filled('status'), fn ($builder) => $builder->where('status', $request->string('status')))
            ->latest('start_date')
            ->latest()
            ->get();

        return response()->json(['data' => $leave]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        if ($this->canManageHr($request)) {
            $employee = Employee::query()->findOrFail($data['employee_id']);
        } else {
            $employee = $this->currentEmployee($request);
            abort_unless($employee, 403, 'Your login is not linked to an employee profile.');
            $data['employee_id'] = $employee->id;
        }
        $this->ensureEmploymentPeriod($employee, $data['start_date'], $data['end_date']);
        $this->ensureNoOverlap($employee, $data['start_date'], $data['end_date']);
        $policy = $this->policy($data);
        $totalDays = (float) count($this->attendanceService->workingDays($employee, $data['start_date'], $data['end_date']));
        abort_if($totalDays <= 0, 422, 'The selected dates contain no scheduled working days.');
        $this->leaveBalances->assertAvailable($employee, $policy, $data['start_date'], $data['end_date'], $totalDays);
        $this->ensureAttachment($request, $policy, $totalDays);
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $data['attachment_path'] = $file->store("employee-leave/{$employee->id}", 'public');
            $data['attachment_original_name'] = $file->getClientOriginalName();
        }
        unset($data['attachment']);
        $leave = LeaveRequest::query()->create(array_merge($data, [
            'created_by' => $request->user()->id,
            'leave_number' => LeaveRequest::nextNumber(),
            'leave_policy_id' => $policy->id,
            'leave_type' => $policy->code,
            'total_days' => $totalDays,
            'is_paid' => $policy->is_paid,
            'status' => 'pending',
        ]));

        $this->notifications->notifyRoles(
            ['Manager', 'Admin'],
            new HrWorkflowNotification('leave_submitted', 'Leave request awaiting review', "{$employee->full_name} submitted {$leave->leave_number}.", '/dashboard/attendance?tab=leave', ['leave_request_id' => $leave->id, 'employee_id' => $employee->id]),
            $request->user()->id,
        );

        return response()->json(['data' => $leave->load($this->relations())], 201);
    }

    public function update(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $this->authorizeOwnerOrHr($request, $leaveRequest);
        abort_unless(in_array($leaveRequest->status, ['pending', 'rejected'], true), 422, 'Only pending or rejected leave can be edited.');
        $data = $this->validated($request);
        $employee = Employee::query()->findOrFail($leaveRequest->employee_id);
        $this->ensureEmploymentPeriod($employee, $data['start_date'], $data['end_date']);
        $this->ensureNoOverlap($employee, $data['start_date'], $data['end_date'], $leaveRequest);
        $policy = $this->policy($data);
        $totalDays = (float) count($this->attendanceService->workingDays($employee, $data['start_date'], $data['end_date']));
        abort_if($totalDays <= 0, 422, 'The selected dates contain no scheduled working days.');
        $this->leaveBalances->assertAvailable($employee, $policy, $data['start_date'], $data['end_date'], $totalDays, $leaveRequest->id);
        $this->ensureAttachment($request, $policy, $totalDays, $leaveRequest);
        $oldAttachment = $leaveRequest->attachment_path;
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $data['attachment_path'] = $file->store("employee-leave/{$employee->id}", 'public');
            $data['attachment_original_name'] = $file->getClientOriginalName();
        }
        unset($data['attachment']);
        $leaveRequest->update(array_merge($data, [
            'leave_policy_id' => $policy->id,
            'leave_type' => $policy->code,
            'total_days' => $totalDays,
            'is_paid' => $policy->is_paid,
            'status' => 'pending',
            'reviewed_by' => null,
            'reviewed_at' => null,
            'rejection_reason' => null,
        ]));
        if ($oldAttachment && $oldAttachment !== $leaveRequest->attachment_path) {
            Storage::disk('public')->delete($oldAttachment);
        }

        return response()->json(['data' => $leaveRequest->fresh()->load($this->relations())]);
    }

    public function resolve(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $this->authorizeHrApproval($request);
        $data = $request->validate([
            'action' => ['required', Rule::in(['approve', 'reject'])],
            'rejection_reason' => ['nullable', 'required_if:action,reject', 'string', 'max:1000'],
        ]);
        abort_unless($leaveRequest->status === 'pending', 422, 'Only pending leave can be resolved.');

        if ($data['action'] === 'approve' && $leaveRequest->policy?->tracks_balance) {
            $this->leaveBalances->assertAvailable(
                $leaveRequest->employee,
                $leaveRequest->policy,
                $leaveRequest->start_date->toDateString(),
                $leaveRequest->end_date->toDateString(),
                (float) $leaveRequest->total_days,
                $leaveRequest->id,
            );
        }

        DB::transaction(function () use ($leaveRequest, $request, $data): void {
            $leaveRequest->update([
                'status' => $data['action'] === 'approve' ? 'approved' : 'rejected',
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
                'rejection_reason' => $data['action'] === 'reject' ? $data['rejection_reason'] : null,
            ]);
            if ($data['action'] === 'approve') {
                $this->attendanceService->synchronizeApprovedLeave($leaveRequest->fresh());
            }
        });

        $employeeUser = $leaveRequest->employee?->user;
        if ($employeeUser) {
            $employeeUser->notify(new HrWorkflowNotification(
                'leave_resolved',
                $data['action'] === 'approve' ? 'Leave approved' : 'Leave rejected',
                "Your leave request {$leaveRequest->leave_number} was {$data['action']}d.",
                '/dashboard/attendance?tab=leave',
                ['leave_request_id' => $leaveRequest->id],
            ));
        }

        return response()->json(['data' => $leaveRequest->fresh()->load($this->relations())]);
    }

    public function cancel(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $this->authorizeOwnerOrHr($request, $leaveRequest);
        abort_unless(in_array($leaveRequest->status, ['pending', 'approved'], true), 422, 'This leave request cannot be cancelled.');
        if ($leaveRequest->status === 'approved') {
            $usedByPayroll = PayrollItem::query()->where('employee_id', $leaveRequest->employee_id)
                ->whereHas('payrollRun', fn ($query) => $query->whereNotIn('status', ['draft', 'rejected', 'cancelled'])
                    ->whereDate('period_start', '<=', $leaveRequest->end_date)
                    ->whereDate('period_end', '>=', $leaveRequest->start_date))
                ->exists();
            abort_if($usedByPayroll, 422, 'This leave is already included in submitted or paid payroll and cannot be cancelled.');
        }
        DB::transaction(function () use ($leaveRequest): void {
            $this->attendanceService->removeLeaveAttendance($leaveRequest);
            $leaveRequest->update(['status' => 'cancelled']);
        });

        return response()->json(['data' => $leaveRequest->fresh()->load($this->relations())]);
    }

    public function download(Request $request, LeaveRequest $leaveRequest)
    {
        $this->authorizeOwnerOrHr($request, $leaveRequest);
        abort_unless($leaveRequest->attachment_path && Storage::disk('public')->exists($leaveRequest->attachment_path), 404, 'Leave attachment not found.');

        return Storage::disk('public')->download($leaveRequest->attachment_path, $leaveRequest->attachment_original_name ?: basename($leaveRequest->attachment_path));
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'employee_id' => ['nullable', 'integer', 'exists:employees,id'],
            'leave_policy_id' => ['nullable', 'integer', 'exists:leave_policies,id', 'required_without:leave_type'],
            'leave_type' => ['nullable', 'string', 'max:50', 'required_without:leave_policy_id'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'reason' => ['required', 'string', 'max:2000'],
            'attachment' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,doc,docx', 'max:10240'],
        ]);
    }

    private function policy(array $data): LeavePolicy
    {
        $policy = isset($data['leave_policy_id'])
            ? LeavePolicy::query()->find($data['leave_policy_id'])
            : LeavePolicy::query()->where('code', $data['leave_type'] ?? '')->first();
        if (! $policy || $policy->status !== 'active') {
            throw ValidationException::withMessages(['leave_policy_id' => ['Select an active leave policy.']]);
        }

        return $policy;
    }

    private function ensureAttachment(Request $request, LeavePolicy $policy, float $days, ?LeaveRequest $leave = null): void
    {
        if ($policy->attachment_after_days !== null
            && $days > (float) $policy->attachment_after_days
            && ! $request->hasFile('attachment')
            && ! $leave?->attachment_path) {
            throw ValidationException::withMessages([
                'attachment' => ["A supporting document is required when {$policy->name} exceeds {$policy->attachment_after_days} days."],
            ]);
        }
    }

    private function ensureNoOverlap(Employee $employee, string $start, string $end, ?LeaveRequest $except = null): void
    {
        $overlaps = LeaveRequest::query()
            ->where('employee_id', $employee->id)
            ->whereIn('status', ['pending', 'approved'])
            ->whereDate('start_date', '<=', $end)
            ->whereDate('end_date', '>=', $start)
            ->when($except, fn ($query) => $query->whereKeyNot($except->id))
            ->exists();
        if ($overlaps) {
            throw ValidationException::withMessages(['start_date' => ['This employee already has overlapping pending or approved leave.']]);
        }
    }

    private function ensureEmploymentPeriod(Employee $employee, string $start, string $end): void
    {
        if ($start < $employee->hire_date->toDateString()) {
            throw ValidationException::withMessages([
                'start_date' => ["Leave cannot start before the employee hire date ({$employee->hire_date->toDateString()})."],
            ]);
        }
        if ($employee->termination_date && $end > $employee->termination_date->toDateString()) {
            throw ValidationException::withMessages([
                'end_date' => ["Leave cannot end after the employee termination date ({$employee->termination_date->toDateString()})."],
            ]);
        }
    }

    private function authorizeOwnerOrHr(Request $request, LeaveRequest $leave): void
    {
        if (! $this->canManageHr($request)) {
            abort_unless($leave->employee()->where('user_id', $request->user()?->id)->exists(), 403, 'You can only manage your own leave requests.');
        }
    }

    private function relations(): array
    {
        return ['employee:id,user_id,employee_number,first_name,last_name', 'employee.user:id,name,email', 'policy', 'creator:id,name', 'reviewer:id,name'];
    }
}
