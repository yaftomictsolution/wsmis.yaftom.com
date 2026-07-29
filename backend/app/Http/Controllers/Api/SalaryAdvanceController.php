<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AuthorizesHrRequests;
use App\Http\Controllers\Controller;
use App\Models\AccountingTransaction;
use App\Models\Employee;
use App\Models\FinancialCategory;
use App\Models\SalaryAdvance;
use App\Notifications\HrWorkflowNotification;
use App\Services\AccountingWorkflowService;
use App\Services\HrNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SalaryAdvanceController extends Controller
{
    use AuthorizesHrRequests;

    public function __construct(
        private readonly AccountingWorkflowService $workflow,
        private readonly HrNotificationService $notifications,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizePayrollWork($request);
        $advances = SalaryAdvance::query()
            ->with($this->relations())
            ->when($request->filled('employee_id'), fn ($query) => $query->where('employee_id', $request->integer('employee_id')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->latest('payment_date')
            ->latest()
            ->get();

        return response()->json(['data' => $advances]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizePayrollWork($request);
        $data = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'payment_method_id' => ['required', 'integer', 'exists:payment_methods,id'],
            'accounting_account_id' => ['required', 'integer', 'exists:accounting_accounts,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_date' => ['required', 'date'],
            'deduction_start_date' => ['required', 'date', 'after_or_equal:payment_date'],
            'reason' => ['required', 'string', 'max:1000'],
            'notes' => ['nullable', 'string'],
        ]);
        $employee = Employee::query()->findOrFail($data['employee_id']);
        abort_if($employee->status === 'terminated', 422, 'A terminated employee cannot receive a salary advance.');
        $this->workflow->ensureDateIsOpen($data['payment_date']);
        $this->workflow->ensureCompatibleAccount((int) $data['payment_method_id'], (int) $data['accounting_account_id']);

        $advance = DB::transaction(function () use ($data, $employee, $request): SalaryAdvance {
            $category = FinancialCategory::query()->firstOrCreate(
                ['code' => 'salary_advance'],
                ['name' => 'Salary Advance', 'type' => 'expense', 'status' => 'active'],
            );
            $advance = SalaryAdvance::query()->create($data + [
                'created_by' => $request->user()->id,
                'advance_number' => SalaryAdvance::nextNumber(),
                'status' => 'pending_review',
            ]);
            $transaction = AccountingTransaction::query()->create([
                'financial_category_id' => $category->id,
                'payment_method_id' => $data['payment_method_id'],
                'accounting_account_id' => $data['accounting_account_id'],
                'recorded_by' => $request->user()->id,
                'transaction_number' => AccountingTransaction::nextNumber('employee_advance'),
                'type' => 'expense',
                'title' => "Salary advance - {$employee->full_name}",
                'amount' => $data['amount'],
                'paid_to' => $employee->full_name,
                'transaction_date' => $data['payment_date'],
                'reference' => $advance->advance_number,
                'source_type' => 'salary_advance',
                'source_id' => $advance->id,
                'status' => 'pending_review',
                'description' => $data['reason'],
            ]);
            $advance->update(['accounting_transaction_id' => $transaction->id]);

            return $advance->fresh();
        });

        $this->notifications->notifyRoles(
            ['Manager', 'Admin'],
            new HrWorkflowNotification('salary_advance_submitted', 'Salary advance awaiting review', "{$advance->advance_number} for {$employee->full_name} requires review.", '/dashboard/hr?tab=advances', ['salary_advance_id' => $advance->id, 'employee_id' => $employee->id]),
            $request->user()->id,
        );

        return response()->json(['data' => $advance->load($this->relations())], 201);
    }

    public function review(Request $request, SalaryAdvance $salaryAdvance): JsonResponse
    {
        $this->authorizeHrApproval($request);
        $this->workflow->review($salaryAdvance->transaction()->firstOrFail(), $request->user());

        return response()->json(['data' => $salaryAdvance->fresh()->load($this->relations())]);
    }

    public function approve(Request $request, SalaryAdvance $salaryAdvance): JsonResponse
    {
        abort_unless($request->user()?->hasAnyRole(['Admin', 'Super Admin']), 403, 'Only admins can approve salary advances.');
        $this->workflow->approve($salaryAdvance->transaction()->firstOrFail(), $request->user());
        $employeeUser = $salaryAdvance->employee?->user;
        if ($employeeUser) {
            $employeeUser->notify(new HrWorkflowNotification('salary_advance_approved', 'Salary advance approved', "Your salary advance {$salaryAdvance->advance_number} was approved.", '/dashboard/hr', ['salary_advance_id' => $salaryAdvance->id]));
        }

        return response()->json(['data' => $salaryAdvance->fresh()->load($this->relations())]);
    }

    public function reject(Request $request, SalaryAdvance $salaryAdvance): JsonResponse
    {
        abort_unless($request->user()?->hasAnyRole(['Admin', 'Super Admin']), 403, 'Only admins can reject salary advances.');
        $data = $request->validate(['rejection_reason' => ['required', 'string', 'max:1000']]);
        $this->workflow->reject($salaryAdvance->transaction()->firstOrFail(), $request->user(), $data['rejection_reason']);

        return response()->json(['data' => $salaryAdvance->fresh()->load($this->relations())]);
    }

    public function cancel(Request $request, SalaryAdvance $salaryAdvance): JsonResponse
    {
        abort_unless($request->user()?->hasAnyRole(['Admin', 'Super Admin']), 403, 'Only admins can reverse salary advances.');
        abort_if((float) $salaryAdvance->deducted_amount > 0, 422, 'Reverse payroll deductions before reversing this salary advance.');
        $this->workflow->cancel($salaryAdvance->transaction()->firstOrFail());

        return response()->json(['data' => $salaryAdvance->fresh()->load($this->relations())]);
    }

    private function relations(): array
    {
        return ['employee:id,user_id,employee_number,first_name,last_name', 'employee.user:id,name,email', 'paymentMethod:id,name,code', 'account:id,name,code,type,current_balance', 'transaction:id,transaction_number,status,posted_at', 'creator:id,name', 'reviewer:id,name', 'approver:id,name', 'rejector:id,name'];
    }
}
