<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesHrRequests;
use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\LeavePolicy;
use App\Services\LeaveBalanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LeavePolicyController extends Controller
{
    use AuthorizesHrRequests;

    public function __construct(private readonly LeaveBalanceService $balances) {}

    public function index(Request $request): JsonResponse
    {
        $year = $request->integer('year', (int) now()->year);
        abort_unless($year >= 2000 && $year <= 2200, 422, 'Select a valid leave balance year.');
        $employees = Employee::query()->whereIn('status', ['active', 'on_leave', 'suspended']);
        if ($this->canManageHr($request)) {
            $employees->when($request->filled('employee_id'), fn ($query) => $query->whereKey($request->integer('employee_id')));
        } else {
            $employee = $this->currentEmployee($request);
            abort_unless($employee, 403, 'Your login is not linked to an employee profile.');
            $employees->whereKey($employee->id);
        }

        $balanceRows = $employees->orderBy('employee_number')->get()
            ->flatMap(fn (Employee $employee) => $this->balances->balances($employee, $year))
            ->values();
        $balanceRows->each(fn ($balance) => $balance->load(['employee:id,employee_number,first_name,last_name', 'policy']));

        return response()->json(['data' => [
            'year' => $year,
            'policies' => LeavePolicy::query()->orderBy('name')->get(),
            'balances' => $balanceRows,
        ]]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeHrView($request);
        $policy = LeavePolicy::query()->create($this->validated($request));

        return response()->json(['data' => $policy], 201);
    }

    public function update(Request $request, LeavePolicy $leavePolicy): JsonResponse
    {
        $this->authorizeHrView($request);
        $leavePolicy->update($this->validated($request, $leavePolicy));

        return response()->json(['data' => $leavePolicy->fresh()]);
    }

    public function destroy(Request $request, LeavePolicy $leavePolicy): JsonResponse
    {
        $this->authorizeHrView($request);
        abort_if($leavePolicy->leaveRequests()->exists() || $leavePolicy->balances()->exists(), 422, 'This policy has employee history. Set it to inactive instead.');
        $leavePolicy->delete();

        return response()->json(['message' => 'Leave policy deleted.']);
    }

    public function adjustBalance(Request $request): JsonResponse
    {
        $this->authorizeHrView($request);
        $data = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'leave_policy_id' => ['required', 'integer', 'exists:leave_policies,id'],
            'year' => ['required', 'integer', 'between:2000,2200'],
            'adjustment_days' => ['required', 'numeric', 'between:-365,365'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
        $employee = Employee::query()->findOrFail($data['employee_id']);
        $policy = LeavePolicy::query()->findOrFail($data['leave_policy_id']);
        $balance = $this->balances->ensure($employee, $policy, (int) $data['year']);
        $balance->update([
            'adjustment_days' => $data['adjustment_days'],
            'notes' => $data['notes'] ?? null,
        ]);

        return response()->json(['data' => $this->balances->decorate($balance->fresh())->load(['employee', 'policy'])]);
    }

    private function validated(Request $request, ?LeavePolicy $policy = null): array
    {
        return $request->validate([
            'code' => ['required', 'string', 'max:50', 'alpha_dash', Rule::unique('leave_policies', 'code')->ignore($policy)],
            'name' => ['required', 'string', 'max:255'],
            'days_per_year' => ['required', 'numeric', 'between:0,365'],
            'is_paid' => ['required', 'boolean'],
            'tracks_balance' => ['required', 'boolean'],
            'carry_forward_limit' => ['required', 'numeric', 'between:0,365'],
            'max_consecutive_days' => ['nullable', 'numeric', 'between:0.5,365'],
            'attachment_after_days' => ['nullable', 'numeric', 'between:0.5,365'],
            'payout_on_termination' => ['required', 'boolean'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);
    }
}
