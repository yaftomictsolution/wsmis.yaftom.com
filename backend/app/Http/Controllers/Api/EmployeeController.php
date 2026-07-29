<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesHrRequests;
use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\PayrollItem;
use App\Models\SalaryAdvance;
use App\Models\User;
use App\Services\LeaveBalanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class EmployeeController extends Controller
{
    use AuthorizesHrRequests;

    public function __construct(private readonly LeaveBalanceService $leaveBalances) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeHrView($request);
        $employees = Employee::query()
            ->with($this->listRelations())
            ->withCount(['documents', 'attendanceRecords', 'leaveRequests'])
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('department_id'), fn ($query) => $query->whereHas('position', fn ($position) => $position->where('department_id', $request->integer('department_id'))))
            ->orderBy('employee_number')
            ->get();

        return response()->json(['data' => $employees]);
    }

    public function summary(Request $request): JsonResponse
    {
        $this->authorizeHrView($request);
        $today = now()->toDateString();
        $monthStart = now()->startOfMonth()->toDateString();
        $monthEnd = now()->endOfMonth()->toDateString();

        return response()->json(['data' => [
            'total_employees' => Employee::query()->count(),
            'active_employees' => Employee::query()->where('status', 'active')->count(),
            'on_leave_employees' => Employee::query()->where('status', 'on_leave')->count(),
            'present_today' => AttendanceRecord::query()->whereDate('attendance_date', $today)->where('approval_status', 'approved')->whereIn('attendance_status', ['present', 'half_day'])->count(),
            'pending_attendance' => AttendanceRecord::query()->where('approval_status', 'pending')->count(),
            'pending_leave' => LeaveRequest::query()->where('status', 'pending')->count(),
            'outstanding_advances' => SalaryAdvance::query()->whereIn('status', ['approved', 'partially_deducted'])->get()->sum('remaining_amount'),
            'monthly_payroll' => PayrollItem::query()->whereHas('payrollRun', fn ($query) => $query->where('status', 'approved')->whereBetween('payment_date', [$monthStart, $monthEnd]))->sum('net_amount'),
        ]]);
    }

    public function report(Request $request): JsonResponse
    {
        $this->authorizeHrView($request);
        $filters = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        $from = $filters['from'] ?? now()->startOfMonth()->toDateString();
        $to = $filters['to'] ?? now()->toDateString();
        $attendance = AttendanceRecord::query()
            ->where('approval_status', 'approved')
            ->whereDate('attendance_date', '>=', $from)
            ->whereDate('attendance_date', '<=', $to)
            ->select('employee_id')
            ->selectRaw("SUM(CASE WHEN attendance_status = 'present' THEN 1 WHEN attendance_status = 'half_day' THEN 0.5 ELSE 0 END) as present_days")
            ->selectRaw("SUM(CASE WHEN attendance_status = 'absent' THEN 1 WHEN attendance_status = 'half_day' THEN 0.5 ELSE 0 END) as absent_days")
            ->selectRaw("SUM(CASE WHEN attendance_status = 'leave' THEN 1 ELSE 0 END) as leave_days")
            ->selectRaw('COALESCE(SUM(late_minutes), 0) as late_minutes')
            ->selectRaw('COALESCE(SUM(overtime_minutes), 0) as overtime_minutes')
            ->groupBy('employee_id')
            ->get()
            ->keyBy('employee_id');
        $payroll = PayrollItem::query()
            ->whereHas('payrollRun', fn ($query) => $query->where('status', 'approved')->whereDate('payment_date', '>=', $from)->whereDate('payment_date', '<=', $to))
            ->select('employee_id')
            ->selectRaw('COALESCE(SUM(net_amount), 0) as net_salary')
            ->groupBy('employee_id')
            ->pluck('net_salary', 'employee_id');
        $ratings = DB::table('performance_reviews')
            ->where('status', 'finalized')
            ->whereDate('period_start', '<=', $to)
            ->whereDate('period_end', '>=', $from)
            ->select('employee_id')
            ->selectRaw('AVG(rating) as average_rating')
            ->groupBy('employee_id')
            ->pluck('average_rating', 'employee_id');
        $advances = SalaryAdvance::query()
            ->whereIn('status', ['approved', 'partially_deducted'])
            ->select('employee_id')
            ->selectRaw('COALESCE(SUM(amount - deducted_amount), 0) as advance_balance')
            ->groupBy('employee_id')
            ->pluck('advance_balance', 'employee_id');

        $rows = Employee::query()
            ->with($this->listRelations())
            ->whereDate('hire_date', '<=', $to)
            ->orderBy('employee_number')
            ->get()
            ->map(function (Employee $employee) use ($attendance, $payroll, $ratings, $advances): array {
                $attendanceRow = $attendance->get($employee->id);

                return [
                    'employee_id' => $employee->id,
                    'employee_number' => $employee->employee_number,
                    'employee_name' => $employee->full_name,
                    'department' => $employee->position?->department?->name,
                    'position' => $employee->position?->title,
                    'status' => $employee->status,
                    'present_days' => round((float) ($attendanceRow?->present_days ?? 0), 2),
                    'absent_days' => round((float) ($attendanceRow?->absent_days ?? 0), 2),
                    'late_minutes' => (int) ($attendanceRow?->late_minutes ?? 0),
                    'overtime_minutes' => (int) ($attendanceRow?->overtime_minutes ?? 0),
                    'leave_days' => round((float) ($attendanceRow?->leave_days ?? 0), 2),
                    'net_salary' => round((float) ($payroll[$employee->id] ?? 0), 2),
                    'advance_balance' => round((float) ($advances[$employee->id] ?? 0), 2),
                    'average_rating' => $ratings->has($employee->id) ? round((float) $ratings[$employee->id], 2) : null,
                ];
            });

        return response()->json(['data' => ['filters' => compact('from', 'to'), 'rows' => $rows, 'generated_at' => now()]]);
    }

    public function me(Request $request): JsonResponse
    {
        $employee = $this->currentEmployee($request);

        return response()->json(['data' => $employee ? $this->loadDetails($employee) : null]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeHrView($request);
        $data = $this->validated($request);
        abort_if($data['status'] === 'terminated', 422, 'Create a final settlement to terminate an employee.');
        abort_if(! empty($data['termination_date']), 422, 'Termination date is managed by the final settlement workflow.');
        $login = $this->pullLoginData($data);
        $employee = DB::transaction(function () use ($request, $data, $login): Employee {
            if ($login['enabled']) {
                $this->ensureRoleCanBeAssigned($request, $login['role']);
                $user = $this->createLoginAccount($data, $login);
                $data['user_id'] = $user->id;
            }

            return Employee::query()->create($data + [
                'employee_number' => $data['employee_number'] ?? Employee::nextNumber(),
                'created_by' => $request->user()->id,
                'updated_by' => $request->user()->id,
                'work_days' => $data['work_days'] ?? [1, 2, 3, 4, 5, 6],
            ]);
        });

        return response()->json(['data' => $employee->load($this->listRelations())], 201);
    }

    public function show(Request $request, Employee $employee): JsonResponse
    {
        if (! $this->canManageHr($request)) {
            abort_unless($employee->user_id === $request->user()?->id, 403, 'You can only view your own employee profile.');
        }

        return response()->json(['data' => $this->loadDetails($employee)]);
    }

    public function update(Request $request, Employee $employee): JsonResponse
    {
        $this->authorizeHrView($request);
        $data = $this->validated($request, $employee);
        abort_if(
            $data['status'] !== $employee->status && ($data['status'] === 'terminated' || $employee->status === 'terminated'),
            422,
            'Employee termination status is managed by the final settlement workflow.',
        );
        abort_if($employee->status !== 'terminated' && ! empty($data['termination_date']), 422, 'Termination date is managed by the final settlement workflow.');
        $login = $this->pullLoginData($data);

        DB::transaction(function () use ($request, $employee, $data, $login): void {
            $user = $employee->user;
            if ($login['provided'] && $login['enabled']) {
                $this->ensureRoleCanBeAssigned($request, $login['role']);
                if ($user) {
                    $this->updateLoginAccount($user, $data, $login);
                } else {
                    $user = $this->createLoginAccount($data, $login);
                    $data['user_id'] = $user->id;
                }
            } elseif ($login['provided'] && $user) {
                $user->update([
                    'name' => $this->employeeName($data),
                    'email' => $data['email'] ?? $user->email,
                    'phone' => $data['phone'] ?? null,
                    'status' => 'inactive',
                ]);
                $user->tokens()->delete();
            } elseif ($user) {
                $user->update([
                    'name' => $this->employeeName($data),
                    'email' => $data['email'] ?? $user->email,
                    'phone' => $data['phone'] ?? null,
                    'status' => $this->loginStatus($data['status'], $user->status),
                ]);
                if ($user->status === 'inactive') {
                    $user->tokens()->delete();
                }
            }

            $employee->update($data + ['updated_by' => $request->user()->id]);
        });

        return response()->json(['data' => $this->loadDetails($employee->fresh())]);
    }

    public function destroy(Request $request, Employee $employee): JsonResponse
    {
        $this->authorizeHrApproval($request);
        abort_if($employee->user_id === $request->user()?->id, 422, 'You cannot delete your own employee record.');
        abort_if(
            $employee->attendanceRecords()->exists() || $employee->payrollItems()->exists() || $employee->salaryAdvances()->exists(),
            422,
            'This employee has HR or payroll history. Use the final settlement workflow instead of deleting the record.',
        );
        DB::transaction(function () use ($employee): void {
            $user = $employee->user;
            $employee->delete();
            if ($user) {
                $user->update(['status' => 'inactive']);
                $user->tokens()->delete();
            }
        });

        return response()->json(['message' => 'Employee deleted.']);
    }

    private function validated(Request $request, ?Employee $employee = null): array
    {
        $loginEnabled = $request->boolean('login_enabled');

        return $request->validate([
            'job_position_id' => ['nullable', 'integer', 'exists:job_positions,id'],
            'service_area_id' => ['nullable', 'integer', 'exists:service_areas,id'],
            'referred_by_shareholder_id' => ['nullable', 'integer', 'exists:shareholders,id'],
            'employee_number' => ['nullable', 'string', 'max:100', Rule::unique('employees', 'employee_number')->ignore($employee?->id)],
            'biometric_id' => ['nullable', 'string', 'max:100', Rule::unique('employees', 'biometric_id')->ignore($employee?->id)],
            'first_name' => ['required', 'string', 'max:120'],
            'last_name' => ['nullable', 'string', 'max:120'],
            'father_name' => ['nullable', 'string', 'max:120'],
            'grandfather_name' => ['nullable', 'string', 'max:120'],
            'gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'date_of_birth' => ['nullable', 'date', 'before:today'],
            'tazkira_number' => ['nullable', 'string', 'max:120', Rule::unique('employees', 'tazkira_number')->ignore($employee?->id)],
            'phone' => ['nullable', 'string', 'max:50'],
            'secondary_phone' => ['nullable', 'string', 'max:50'],
            'email' => [Rule::requiredIf($loginEnabled), 'nullable', 'email', 'max:255', Rule::unique('employees', 'email')->ignore($employee?->id), Rule::unique('users', 'email')->ignore($employee?->user_id)],
            'address' => ['nullable', 'string'],
            'emergency_contact_name' => ['nullable', 'string', 'max:255'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:50'],
            'hire_date' => ['required', 'date'],
            'termination_date' => ['nullable', 'date', 'after_or_equal:hire_date'],
            'employment_type' => ['required', Rule::in(['permanent', 'contract', 'temporary', 'daily'])],
            'salary_type' => ['required', Rule::in(['fixed', 'daily', 'attendance'])],
            'base_salary' => ['required', 'numeric', 'min:0'],
            'daily_rate' => ['nullable', 'numeric', 'min:0', 'required_if:salary_type,daily'],
            'overtime_hourly_rate' => ['nullable', 'numeric', 'min:0'],
            'standard_daily_hours' => ['nullable', 'numeric', 'min:1', 'max:24'],
            'work_start_time' => ['required', 'date_format:H:i'],
            'work_end_time' => ['required', 'date_format:H:i', 'after:work_start_time'],
            'work_days' => ['required', 'array', 'min:1'],
            'work_days.*' => ['integer', 'between:1,7', 'distinct'],
            'bank_name' => ['nullable', 'string', 'max:255'],
            'bank_account_number' => ['nullable', 'string', 'max:255'],
            'status' => ['required', Rule::in(['active', 'on_leave', 'suspended', 'terminated'])],
            'notes' => ['nullable', 'string'],
            'login_enabled' => ['sometimes', 'boolean'],
            'login_password' => ['nullable', Rule::requiredIf($loginEnabled && ! $employee?->user_id), 'string', 'min:8', 'confirmed'],
            'login_password_confirmation' => ['nullable', 'string', 'min:8'],
            'login_role' => ['nullable', Rule::requiredIf($loginEnabled), 'string', Rule::exists('roles', 'name')->where('guard_name', 'web')],
            'login_status' => ['nullable', Rule::requiredIf($loginEnabled), Rule::in(['active', 'inactive'])],
        ]);
    }

    private function pullLoginData(array &$data): array
    {
        $login = [
            'provided' => array_key_exists('login_enabled', $data),
            'enabled' => (bool) ($data['login_enabled'] ?? false),
            'password' => $data['login_password'] ?? null,
            'role' => $data['login_role'] ?? null,
            'status' => $data['login_status'] ?? 'active',
        ];
        unset($data['login_enabled'], $data['login_password'], $data['login_password_confirmation'], $data['login_role'], $data['login_status']);

        return $login;
    }

    private function createLoginAccount(array $employeeData, array $login): User
    {
        $user = User::query()->create([
            'name' => $this->employeeName($employeeData),
            'email' => $employeeData['email'],
            'phone' => $employeeData['phone'] ?? null,
            'password' => $login['password'],
            'status' => $this->loginStatus($employeeData['status'], $login['status']),
        ]);
        $user->syncRoles([$login['role']]);

        return $user;
    }

    private function updateLoginAccount(User $user, array $employeeData, array $login): void
    {
        $updates = [
            'name' => $this->employeeName($employeeData),
            'email' => $employeeData['email'],
            'phone' => $employeeData['phone'] ?? null,
            'status' => $this->loginStatus($employeeData['status'], $login['status']),
        ];
        if ($login['password']) {
            $updates['password'] = $login['password'];
        }

        $user->update($updates);
        $user->syncRoles([$login['role']]);
        if ($login['password'] || $user->status === 'inactive') {
            $user->tokens()->delete();
        }
    }

    private function ensureRoleCanBeAssigned(Request $request, ?string $role): void
    {
        abort_if(
            in_array($role, ['Admin', 'Super Admin'], true) && ! $request->user()?->hasAnyRole(['Admin', 'Super Admin']),
            403,
            'Only an administrator can assign an administrator role.',
        );
    }

    private function employeeName(array $data): string
    {
        return trim($data['first_name'].' '.($data['last_name'] ?? ''));
    }

    private function loginStatus(string $employeeStatus, string $requestedStatus): string
    {
        return in_array($employeeStatus, ['suspended', 'terminated'], true) ? 'inactive' : $requestedStatus;
    }

    private function listRelations(): array
    {
        return ['user:id,name,email,status', 'user.roles:id,name', 'position:id,department_id,code,title', 'position.department:id,code,name', 'serviceArea:id,name', 'referringShareholder:id,shareholder_number,name'];
    }

    private function loadDetails(Employee $employee): Employee
    {
        $this->leaveBalances->balances($employee, now()->year);
        $employee->load($this->detailRelations());
        $employee->leaveBalances->each(
            fn ($balance) => $this->leaveBalances->decorate($balance),
        );

        return $employee;
    }

    private function detailRelations(): array
    {
        return [
            ...$this->listRelations(),
            'documents.uploader:id,name',
            'attendanceRecords' => fn ($query) => $query->with('approver:id,name')->latest('attendance_date')->limit(60),
            'leaveRequests.reviewer:id,name',
            'leaveRequests.policy',
            'leaveBalances.policy',
            'shiftAssignments.shift',
            'payrollDeductions.rule',
            'terminations.transaction:id,transaction_number,status',
            'salaryAdvances.account:id,name,code,type',
            'salaryAdvances.paymentMethod:id,name,code',
            'adjustments.approver:id,name',
            'performanceReviews.reviewer:id,name',
            'payrollItems.payrollRun:id,payroll_number,period_start,period_end,payment_date,status',
        ];
    }
}
