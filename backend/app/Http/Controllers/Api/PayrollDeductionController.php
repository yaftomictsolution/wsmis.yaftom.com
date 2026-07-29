<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesHrRequests;
use App\Http\Controllers\Controller;
use App\Models\EmployeePayrollDeduction;
use App\Models\PayrollDeductionRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PayrollDeductionController extends Controller
{
    use AuthorizesHrRequests;

    public function index(Request $request): JsonResponse
    {
        $this->authorizePayrollWork($request);

        return response()->json(['data' => [
            'rules' => PayrollDeductionRule::query()->withCount('employeeDeductions')->orderBy('name')->get(),
            'assignments' => EmployeePayrollDeduction::query()->with($this->relations())->latest('effective_from')->latest()->get(),
        ]]);
    }

    public function storeRule(Request $request): JsonResponse
    {
        $this->authorizeHrView($request);
        $rule = PayrollDeductionRule::query()->create($this->ruleData($request));

        return response()->json(['data' => $rule], 201);
    }

    public function updateRule(Request $request, PayrollDeductionRule $payrollDeductionRule): JsonResponse
    {
        $this->authorizeHrView($request);
        $payrollDeductionRule->update($this->ruleData($request, $payrollDeductionRule));

        return response()->json(['data' => $payrollDeductionRule->fresh()->loadCount('employeeDeductions')]);
    }

    public function destroyRule(Request $request, PayrollDeductionRule $payrollDeductionRule): JsonResponse
    {
        $this->authorizeHrView($request);
        abort_if($payrollDeductionRule->employeeDeductions()->exists(), 422, 'This deduction rule has employee history. Set it to inactive instead.');
        $payrollDeductionRule->delete();

        return response()->json(['message' => 'Payroll deduction rule deleted.']);
    }

    public function storeAssignment(Request $request): JsonResponse
    {
        $this->authorizeHrView($request);
        $data = $this->assignmentData($request);
        $this->ensureNoOverlap($data);
        $assignment = EmployeePayrollDeduction::query()->create($data + ['assigned_by' => $request->user()->id]);

        return response()->json(['data' => $assignment->load($this->relations())], 201);
    }

    public function updateAssignment(Request $request, EmployeePayrollDeduction $employeePayrollDeduction): JsonResponse
    {
        $this->authorizeHrView($request);
        $data = $this->assignmentData($request);
        $this->ensureNoOverlap($data, $employeePayrollDeduction);
        $employeePayrollDeduction->update($data + ['assigned_by' => $request->user()->id]);

        return response()->json(['data' => $employeePayrollDeduction->fresh()->load($this->relations())]);
    }

    public function destroyAssignment(Request $request, EmployeePayrollDeduction $employeePayrollDeduction): JsonResponse
    {
        $this->authorizeHrView($request);
        abort_if($employeePayrollDeduction->allocations()->exists(), 422, 'This deduction has payroll history. Set it to inactive instead.');
        $employeePayrollDeduction->delete();

        return response()->json(['message' => 'Employee deduction deleted.']);
    }

    private function ruleData(Request $request, ?PayrollDeductionRule $rule = null): array
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:50', 'alpha_dash', Rule::unique('payroll_deduction_rules', 'code')->ignore($rule)],
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(['tax', 'insurance', 'pension', 'other'])],
            'calculation_type' => ['required', Rule::in(['fixed', 'percentage'])],
            'value' => ['required', 'numeric', 'min:0', 'max:100000000'],
            'threshold_amount' => ['required', 'numeric', 'min:0'],
            'maximum_amount' => ['nullable', 'numeric', 'min:0'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        if ($data['calculation_type'] === 'percentage' && (float) $data['value'] > 100) {
            throw ValidationException::withMessages(['value' => ['Percentage deductions cannot exceed 100%.']]);
        }

        return $data;
    }

    private function assignmentData(Request $request): array
    {
        $data = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'payroll_deduction_rule_id' => ['required', 'integer', Rule::exists('payroll_deduction_rules', 'id')->where('status', 'active')],
            'override_value' => ['nullable', 'numeric', 'min:0', 'max:100000000'],
            'effective_from' => ['required', 'date'],
            'effective_to' => ['nullable', 'date', 'after_or_equal:effective_from'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $rule = PayrollDeductionRule::query()->findOrFail($data['payroll_deduction_rule_id']);
        if ($rule->calculation_type === 'percentage' && isset($data['override_value']) && (float) $data['override_value'] > 100) {
            throw ValidationException::withMessages(['override_value' => ['Percentage deductions cannot exceed 100%.']]);
        }

        return $data;
    }

    private function ensureNoOverlap(array $data, ?EmployeePayrollDeduction $except = null): void
    {
        $exists = EmployeePayrollDeduction::query()
            ->where('employee_id', $data['employee_id'])
            ->where('payroll_deduction_rule_id', $data['payroll_deduction_rule_id'])
            ->whereDate('effective_from', '<=', $data['effective_to'] ?? '9999-12-31')
            ->where(fn ($query) => $query->whereNull('effective_to')->orWhereDate('effective_to', '>=', $data['effective_from']))
            ->when($except, fn ($query) => $query->whereKeyNot($except->id))
            ->exists();
        if ($exists) {
            throw ValidationException::withMessages(['effective_from' => ['This deduction rule already applies to the employee during the selected period.']]);
        }
    }

    private function relations(): array
    {
        return ['employee:id,employee_number,first_name,last_name', 'rule', 'assigner:id,name'];
    }
}
