<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesHrRequests;
use App\Http\Controllers\Controller;
use App\Models\EmployeeAdjustment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EmployeeAdjustmentController extends Controller
{
    use AuthorizesHrRequests;

    public function index(Request $request): JsonResponse
    {
        $this->authorizePayrollWork($request);
        $records = EmployeeAdjustment::query()
            ->with($this->relations())
            ->when($request->filled('employee_id'), fn ($query) => $query->where('employee_id', $request->integer('employee_id')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->latest('effective_date')
            ->latest()
            ->get();

        return response()->json(['data' => $records]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizePayrollWork($request);
        $record = EmployeeAdjustment::query()->create($this->validated($request) + [
            'created_by' => $request->user()->id,
            'adjustment_number' => EmployeeAdjustment::nextNumber(),
            'status' => 'pending',
        ]);

        return response()->json(['data' => $record->load($this->relations())], 201);
    }

    public function update(Request $request, EmployeeAdjustment $employeeAdjustment): JsonResponse
    {
        $this->authorizePayrollWork($request);
        abort_unless(in_array($employeeAdjustment->status, ['pending', 'rejected'], true), 422, 'Only pending or rejected adjustments can be edited.');
        $employeeAdjustment->update($this->validated($request) + ['status' => 'pending', 'rejection_reason' => null]);

        return response()->json(['data' => $employeeAdjustment->fresh()->load($this->relations())]);
    }

    public function resolve(Request $request, EmployeeAdjustment $employeeAdjustment): JsonResponse
    {
        $this->authorizeHrApproval($request);
        $data = $request->validate([
            'action' => ['required', Rule::in(['approve', 'reject'])],
            'rejection_reason' => ['nullable', 'required_if:action,reject', 'string', 'max:1000'],
        ]);
        abort_unless($employeeAdjustment->status === 'pending', 422, 'Only pending adjustments can be resolved.');
        $employeeAdjustment->update([
            'status' => $data['action'] === 'approve' ? 'approved' : 'rejected',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'rejection_reason' => $data['action'] === 'reject' ? $data['rejection_reason'] : null,
        ]);

        return response()->json(['data' => $employeeAdjustment->fresh()->load($this->relations())]);
    }

    public function destroy(Request $request, EmployeeAdjustment $employeeAdjustment): JsonResponse
    {
        $this->authorizePayrollWork($request);
        abort_if($employeeAdjustment->status === 'applied' || $employeeAdjustment->payroll_item_id, 422, 'An adjustment included in payroll cannot be deleted.');
        $employeeAdjustment->delete();

        return response()->json(['message' => 'Employee adjustment deleted.']);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'type' => ['required', Rule::in(['bonus', 'deduction'])],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'effective_date' => ['required', 'date'],
            'title' => ['required', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);
    }

    private function relations(): array
    {
        return ['employee:id,employee_number,first_name,last_name', 'creator:id,name', 'approver:id,name', 'payrollItem:id,payroll_run_id,net_amount'];
    }
}
