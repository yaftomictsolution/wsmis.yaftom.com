<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesHrRequests;
use App\Http\Controllers\Controller;
use App\Models\AccountingTransaction;
use App\Models\Employee;
use App\Models\EmployeeTermination;
use App\Models\FinancialCategory;
use App\Models\PayrollRun;
use App\Notifications\HrWorkflowNotification;
use App\Services\AccountingWorkflowService;
use App\Services\HrNotificationService;
use App\Services\TerminationSettlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class EmployeeTerminationController extends Controller
{
    use AuthorizesHrRequests;

    public function __construct(
        private readonly TerminationSettlementService $settlements,
        private readonly AccountingWorkflowService $workflow,
        private readonly HrNotificationService $notifications,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizePayrollWork($request);

        return response()->json(['data' => EmployeeTermination::query()->with($this->relations())->latest('last_working_date')->latest()->get()]);
    }

    public function preview(Request $request): JsonResponse
    {
        $this->authorizePayrollWork($request);
        $data = $this->validated($request, false);
        $employee = Employee::query()->findOrFail($data['employee_id']);
        abort_if($employee->hire_date->isAfter($data['last_working_date']), 422, 'Last working date cannot be before the employee hire date.');

        return response()->json(['data' => $this->settlements->calculate($employee, $data['last_working_date'], $data)]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizePayrollWork($request);
        $data = $this->validated($request, true);
        $employee = Employee::query()->findOrFail($data['employee_id']);
        abort_if($employee->hire_date->isAfter($data['last_working_date']), 422, 'Last working date cannot be before the employee hire date.');
        abort_if($employee->status === 'terminated', 422, 'This employee is already terminated.');
        abort_if(EmployeeTermination::query()->where('employee_id', $employee->id)->whereNotIn('status', ['rejected', 'cancelled'])->exists(), 422, 'This employee already has an active termination workflow.');
        abort_if(PayrollRun::query()->whereNotIn('status', ['approved', 'cancelled'])
            ->whereHas('items', fn ($query) => $query->where('employee_id', $employee->id))
            ->exists(), 422, 'Resolve the employee pending payroll before creating a final settlement.');
        $this->workflow->ensureDateIsOpen($data['last_working_date']);
        $this->workflow->ensureCompatibleAccount((int) $data['payment_method_id'], (int) $data['accounting_account_id']);

        $termination = DB::transaction(function () use ($data, $employee, $request): EmployeeTermination {
            $settlement = $this->settlements->calculate($employee, $data['last_working_date'], $data);
            $category = FinancialCategory::query()->firstOrCreate(
                ['code' => 'employee_final_settlement'],
                ['name' => 'Employee Final Settlement', 'type' => 'expense', 'status' => 'active'],
            );
            $termination = EmployeeTermination::query()->create([
                ...$data,
                ...collect($settlement)->except(['paid_days', 'daily_rate', 'advance_allocations'])->all(),
                'created_by' => $request->user()->id,
                'termination_number' => EmployeeTermination::nextNumber(),
                'status' => 'pending_review',
            ]);
            foreach ($settlement['advance_allocations'] as $allocation) {
                $termination->advanceAllocations()->create($allocation);
            }
            $transaction = AccountingTransaction::query()->create([
                'financial_category_id' => $category->id,
                'payment_method_id' => $data['payment_method_id'],
                'accounting_account_id' => $data['accounting_account_id'],
                'recorded_by' => $request->user()->id,
                'transaction_number' => AccountingTransaction::nextNumber('final_settlement'),
                'type' => 'expense',
                'title' => "Final settlement - {$employee->full_name}",
                'amount' => $settlement['net_settlement'],
                'paid_to' => $employee->full_name,
                'transaction_date' => $data['last_working_date'],
                'reference' => $termination->termination_number,
                'source_type' => 'employee_termination',
                'source_id' => $termination->id,
                'status' => 'pending_review',
                'description' => $data['reason'],
            ]);
            $termination->update(['accounting_transaction_id' => $transaction->id]);

            return $termination->fresh();
        });

        $this->notifications->notifyRoles(
            ['Manager', 'Admin'],
            new HrWorkflowNotification('termination_submitted', 'Final settlement awaiting review', "{$termination->termination_number} for {$employee->full_name} requires review.", '/dashboard/hr?tab=terminations', ['employee_termination_id' => $termination->id, 'employee_id' => $employee->id]),
            $request->user()->id,
        );

        return response()->json(['data' => $termination->load($this->relations())], 201);
    }

    public function review(Request $request, EmployeeTermination $employeeTermination): JsonResponse
    {
        $this->authorizeHrApproval($request);
        $this->workflow->review($employeeTermination->transaction()->firstOrFail(), $request->user());

        return response()->json(['data' => $employeeTermination->fresh()->load($this->relations())]);
    }

    public function approve(Request $request, EmployeeTermination $employeeTermination): JsonResponse
    {
        abort_unless($request->user()?->hasAnyRole(['Admin', 'Super Admin']), 403, 'Only admins can approve final settlements.');
        $employeeUser = $employeeTermination->employee?->user;
        $this->workflow->approve($employeeTermination->transaction()->firstOrFail(), $request->user());
        if ($employeeUser) {
            $employeeUser->notify(new HrWorkflowNotification(
                'termination_approved',
                'Final settlement approved',
                "Your final settlement {$employeeTermination->termination_number} was approved.",
                '/dashboard/hr',
                ['employee_termination_id' => $employeeTermination->id],
            ));
        }

        return response()->json(['data' => $employeeTermination->fresh()->load($this->relations())]);
    }

    public function reject(Request $request, EmployeeTermination $employeeTermination): JsonResponse
    {
        abort_unless($request->user()?->hasAnyRole(['Admin', 'Super Admin']), 403, 'Only admins can reject final settlements.');
        $data = $request->validate(['rejection_reason' => ['required', 'string', 'max:1000']]);
        $this->workflow->reject($employeeTermination->transaction()->firstOrFail(), $request->user(), $data['rejection_reason']);

        return response()->json(['data' => $employeeTermination->fresh()->load($this->relations())]);
    }

    public function cancel(Request $request, EmployeeTermination $employeeTermination): JsonResponse
    {
        abort_unless($request->user()?->hasAnyRole(['Admin', 'Super Admin']), 403, 'Only admins can reverse final settlements.');
        $this->workflow->cancel($employeeTermination->transaction()->firstOrFail());

        return response()->json(['data' => $employeeTermination->fresh()->load($this->relations())]);
    }

    private function validated(Request $request, bool $withAccount): array
    {
        return $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'payment_method_id' => [$withAccount ? 'required' : 'nullable', 'integer', 'exists:payment_methods,id'],
            'accounting_account_id' => [$withAccount ? 'required' : 'nullable', 'integer', 'exists:accounting_accounts,id'],
            'last_working_date' => ['required', 'date', 'before_or_equal:today'],
            'termination_type' => ['required', Rule::in(['resignation', 'termination', 'end_of_contract', 'retirement', 'other'])],
            'reason' => ['required', 'string', 'max:2000'],
            'severance_amount' => ['nullable', 'numeric', 'min:0'],
            'other_earnings' => ['nullable', 'numeric', 'min:0'],
            'other_deductions' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
    }

    private function relations(): array
    {
        return [
            'employee:id,user_id,employee_number,first_name,last_name,status', 'employee.user:id,name,email,status',
            'paymentMethod:id,name,code', 'account:id,name,code,type,current_balance',
            'transaction:id,transaction_number,status,posted_at', 'advanceAllocations.salaryAdvance:id,advance_number,amount,deducted_amount,status',
            'creator:id,name', 'reviewer:id,name', 'approver:id,name', 'rejector:id,name',
        ];
    }
}
