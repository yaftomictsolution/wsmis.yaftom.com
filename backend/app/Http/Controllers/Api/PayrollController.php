<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingTransaction;
use App\Models\FinancialCategory;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Notifications\HrWorkflowNotification;
use App\Services\AccountingWorkflowService;
use App\Services\HrNotificationService;
use App\Services\HrPayrollService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PayrollController extends Controller
{
    public function __construct(
        private readonly AccountingWorkflowService $workflow,
        private readonly HrPayrollService $hrPayroll,
        private readonly HrNotificationService $notifications,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeCreate($request);

        return response()->json(['data' => PayrollRun::with($this->relations())->latest('period_end')->latest()->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeCreate($request);
        $data = $this->validatePayroll($request);

        $payroll = DB::transaction(fn (): PayrollRun => $this->persist(new PayrollRun, $data, $request->user()->id));

        return response()->json(['data' => $payroll->load($this->relations())], 201);
    }

    public function eligibleEmployees(Request $request): JsonResponse
    {
        $this->authorizeCreate($request);
        $data = $request->validate([
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start', 'before_or_equal:today'],
        ]);

        $employees = $this->hrPayroll
            ->eligibleEmployees($data['period_start'], $data['period_end'])
            ->map(function ($employee) use ($data): array {
                $attendanceIssues = $this->hrPayroll->attendanceIssues($employee, $data['period_start'], $data['period_end']);

                return [
                    'id' => $employee->id,
                    'employee_number' => $employee->employee_number,
                    'full_name' => $employee->full_name,
                    'status' => $employee->status,
                    'salary_type' => $employee->salary_type,
                    'base_salary' => $employee->base_salary,
                    'daily_rate' => $employee->daily_rate,
                    'attendance_ready' => $attendanceIssues === [],
                    'incomplete_attendance_count' => count($attendanceIssues),
                    'incomplete_attendance' => array_slice($attendanceIssues, 0, 5),
                    'position' => $employee->position ? [
                        'id' => $employee->position->id,
                        'title' => $employee->position->title,
                    ] : null,
                ];
            });

        return response()->json(['data' => $employees]);
    }

    public function generate(Request $request): JsonResponse
    {
        $this->authorizeCreate($request);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start', 'before_or_equal:today'],
            'payment_date' => ['required', 'date', 'after_or_equal:period_start'],
            'payment_method_id' => ['required', 'integer', 'exists:payment_methods,id'],
            'accounting_account_id' => ['required', 'integer', 'exists:accounting_accounts,id'],
            'employee_ids' => ['sometimes', 'array', 'min:1'],
            'employee_ids.*' => ['required', 'integer', 'distinct', 'exists:employees,id'],
            'notes' => ['nullable', 'string'],
        ]);
        $this->workflow->ensureDateIsOpen($data['payment_date']);
        $this->workflow->ensureCompatibleAccount((int) $data['payment_method_id'], (int) $data['accounting_account_id']);
        $payroll = $this->hrPayroll->generate($data, $request->user()->id);

        return response()->json(['data' => $payroll->load($this->relations())], 201);
    }

    public function recalculate(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $this->authorizeCreate($request);
        $payroll = $this->hrPayroll->recalculate($payrollRun);

        return response()->json(['data' => $payroll->load($this->relations())]);
    }

    public function show(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $this->authorizeCreate($request);

        return response()->json(['data' => $payrollRun->load($this->relations())]);
    }

    public function update(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $this->authorizeCreate($request);
        abort_unless(in_array($payrollRun->status, ['draft', 'rejected'], true), 422, 'Only draft or rejected payroll can be edited.');
        abort_if($payrollRun->generated_from_hr, 422, 'Attendance-generated payroll cannot be manually edited. Update HR records and regenerate it.');
        $data = $this->validatePayroll($request);

        $payroll = DB::transaction(fn (): PayrollRun => $this->persist($payrollRun, $data, $request->user()->id));

        return response()->json(['data' => $payroll->load($this->relations())]);
    }

    public function destroy(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $this->authorizeCreate($request);
        abort_unless(in_array($payrollRun->status, ['draft', 'rejected'], true), 422, 'Only draft or rejected payroll can be deleted.');
        $payrollRun->delete();

        return response()->json(['message' => 'Payroll deleted.']);
    }

    public function submit(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $this->authorizeCreate($request);
        abort_unless(in_array($payrollRun->status, ['draft', 'rejected'], true), 422, 'Only draft or rejected payroll can be submitted.');
        abort_if((float) $payrollRun->total_net <= 0, 422, 'Payroll must contain a positive net payment.');

        $this->workflow->ensureDateIsOpen($payrollRun->payment_date->toDateString());
        $this->workflow->ensureCompatibleAccount($payrollRun->payment_method_id, $payrollRun->accounting_account_id);

        $payroll = DB::transaction(function () use ($payrollRun, $request): PayrollRun {
            $category = FinancialCategory::query()->firstOrCreate(
                ['code' => 'salary_expense'],
                ['name' => 'Salary Expense', 'type' => 'expense', 'status' => 'active'],
            );
            $transaction = AccountingTransaction::query()->create([
                'financial_category_id' => $category->id,
                'payment_method_id' => $payrollRun->payment_method_id,
                'accounting_account_id' => $payrollRun->accounting_account_id,
                'recorded_by' => $request->user()->id,
                'transaction_number' => AccountingTransaction::nextNumber('expense'),
                'type' => 'expense',
                'title' => $payrollRun->title,
                'amount' => $payrollRun->total_net,
                'paid_to' => 'Employees',
                'transaction_date' => $payrollRun->payment_date,
                'reference' => $payrollRun->payroll_number,
                'source_type' => 'payroll_run',
                'source_id' => $payrollRun->id,
                'status' => 'pending_review',
                'description' => $payrollRun->notes,
            ]);
            $payrollRun->update([
                'financial_category_id' => $category->id,
                'accounting_transaction_id' => $transaction->id,
                'status' => 'pending_review',
                'submitted_at' => now(),
                'reviewed_by' => null,
                'reviewed_at' => null,
                'approved_by' => null,
                'approved_at' => null,
                'rejected_by' => null,
                'rejected_at' => null,
                'rejection_reason' => null,
            ]);

            return $payrollRun->fresh();
        });

        $this->notifications->notifyRoles(
            ['Manager', 'Admin'],
            new HrWorkflowNotification('payroll_submitted', 'Payroll awaiting review', "{$payroll->payroll_number} is ready for review.", '/dashboard/payroll', ['payroll_run_id' => $payroll->id]),
            $request->user()->id,
        );

        return response()->json(['data' => $payroll->load($this->relations())]);
    }

    public function review(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $this->authorizeReview($request);
        $transaction = $payrollRun->transaction()->firstOrFail();
        $this->workflow->review($transaction, $request->user());

        $this->notifications->notifyRoles(
            ['Admin'],
            new HrWorkflowNotification('payroll_reviewed', 'Payroll awaiting approval', "{$payrollRun->payroll_number} was reviewed and is ready for approval.", '/dashboard/payroll', ['payroll_run_id' => $payrollRun->id]),
            $request->user()->id,
        );

        return response()->json(['data' => $payrollRun->fresh()->load($this->relations())]);
    }

    public function approve(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $this->authorizeApprove($request);
        $transaction = $payrollRun->transaction()->firstOrFail();
        $this->workflow->approve($transaction, $request->user());

        $payrollRun->loadMissing('items.employee.user');
        $users = $payrollRun->items->map(fn (PayrollItem $item) => $item->employee?->user)->filter();
        $this->notifications->notifyUsers($users, new HrWorkflowNotification('payroll_paid', 'Salary paid', "Payroll {$payrollRun->payroll_number} was approved and paid.", '/dashboard/payroll', ['payroll_run_id' => $payrollRun->id]));

        return response()->json(['data' => $payrollRun->fresh()->load($this->relations())]);
    }

    public function reject(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $this->authorizeApprove($request);
        $data = $request->validate(['rejection_reason' => ['required', 'string', 'max:1000']]);
        $this->workflow->reject($payrollRun->transaction()->firstOrFail(), $request->user(), $data['rejection_reason']);

        return response()->json(['data' => $payrollRun->fresh()->load($this->relations())]);
    }

    public function cancel(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $this->authorizeApprove($request);
        $this->workflow->cancel($payrollRun->transaction()->firstOrFail());

        return response()->json(['data' => $payrollRun->fresh()->load($this->relations())]);
    }

    public function payslip(Request $request, PayrollItem $payrollItem): JsonResponse
    {
        $payrollItem->load(['payrollRun.account:id,name,code,type', 'payrollRun.paymentMethod:id,name,code', 'employee.position.department', 'employee.serviceArea', 'employee.user', 'deductionAllocations']);
        $canManage = $request->user()?->hasAnyRole(['HR', 'Accountant', 'Manager', 'Admin', 'Super Admin']);
        abort_unless($canManage || $payrollItem->employee?->user_id === $request->user()?->id, 403, 'You can only view your own payslip.');

        return response()->json(['data' => $payrollItem]);
    }

    private function persist(PayrollRun $payroll, array $data, int $userId): PayrollRun
    {
        $items = collect($data['items']);
        $userIds = $items->pluck('user_id')->filter();
        if ($userIds->duplicates()->isNotEmpty()) {
            throw ValidationException::withMessages(['items' => ['An employee can appear only once in a payroll run.']]);
        }

        $payrollData = collect($data)->except('items')->all();
        if (! $payroll->exists) {
            $payrollData += ['payroll_number' => PayrollRun::nextNumber(), 'created_by' => $userId, 'status' => 'draft'];
        } else {
            $payrollData += ['status' => 'draft', 'rejection_reason' => null];
        }
        $payroll->fill($payrollData)->save();
        $payroll->items()->delete();

        foreach ($items as $item) {
            $gross = (float) $item['base_salary'] + (float) ($item['bonus'] ?? 0) + (float) ($item['overtime_amount'] ?? 0);
            $deductions = (float) ($item['absence_deduction'] ?? 0)
                + (float) ($item['late_deduction'] ?? 0)
                + (float) ($item['advance_deduction'] ?? 0)
                + (float) ($item['tax_deduction'] ?? 0)
                + (float) ($item['recurring_deduction'] ?? 0)
                + (float) ($item['other_deduction'] ?? 0);
            if ($deductions > $gross) {
                throw ValidationException::withMessages(['items' => ["Deductions cannot exceed gross salary for {$item['employee_name']}."]]);
            }
            $payroll->items()->create($item + ['net_amount' => round($gross - $deductions, 2)]);
        }
        $payroll->refreshTotals();

        return $payroll->fresh();
    }

    private function validatePayroll(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start'],
            'payment_date' => ['required', 'date', 'after_or_equal:period_start'],
            'payment_method_id' => ['required', 'integer', 'exists:payment_methods,id'],
            'accounting_account_id' => ['required', 'integer', 'exists:accounting_accounts,id'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.user_id' => ['nullable', 'integer', 'exists:users,id'],
            'items.*.employee_name' => ['required', 'string', 'max:255'],
            'items.*.base_salary' => ['required', 'numeric', 'min:0'],
            'items.*.bonus' => ['nullable', 'numeric', 'min:0'],
            'items.*.overtime_amount' => ['nullable', 'numeric', 'min:0'],
            'items.*.absence_deduction' => ['nullable', 'numeric', 'min:0'],
            'items.*.late_deduction' => ['nullable', 'numeric', 'min:0'],
            'items.*.advance_deduction' => ['nullable', 'numeric', 'min:0'],
            'items.*.tax_deduction' => ['nullable', 'numeric', 'min:0'],
            'items.*.recurring_deduction' => ['nullable', 'numeric', 'min:0'],
            'items.*.other_deduction' => ['nullable', 'numeric', 'min:0'],
            'items.*.notes' => ['nullable', 'string'],
        ]);
    }

    private function relations(): array
    {
        return ['items.user:id,name,email', 'items.employee:id,user_id,employee_number,first_name,last_name,job_position_id', 'items.employee.position:id,department_id,title', 'items.advanceAllocations.salaryAdvance:id,advance_number,amount,deducted_amount,status', 'items.deductionAllocations', 'account:id,name,code,type,current_balance', 'paymentMethod:id,name,code', 'category:id,name,code', 'transaction:id,transaction_number,status', 'creator:id,name', 'reviewer:id,name', 'approver:id,name', 'rejector:id,name'];
    }

    private function authorizeCreate(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['HR', 'Accountant', 'Manager', 'Admin', 'Super Admin']), 403, 'You cannot manage payroll.');
    }

    private function authorizeReview(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['Manager', 'Admin', 'Super Admin']), 403, 'Only managers or admins can review payroll.');
    }

    private function authorizeApprove(Request $request): void
    {
        abort_unless($request->user()?->hasAnyRole(['Admin', 'Super Admin']), 403, 'Only admins can approve payroll.');
    }
}
