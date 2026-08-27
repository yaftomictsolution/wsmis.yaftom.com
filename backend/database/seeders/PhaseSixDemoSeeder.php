<?php

namespace Database\Seeders;

use App\Models\AccountingAccount;
use App\Models\AccountingTransaction;
use App\Models\AttendanceRecord;
use App\Models\BiometricImportBatch;
use App\Models\Department;
use App\Models\Employee;
use App\Models\EmployeeAdjustment;
use App\Models\EmployeeLeaveBalance;
use App\Models\EmployeePayrollDeduction;
use App\Models\EmployeeShiftAssignment;
use App\Models\EmployeeTermination;
use App\Models\FinancialCategory;
use App\Models\JobPosition;
use App\Models\LeavePolicy;
use App\Models\LeaveRequest;
use App\Models\PaymentMethod;
use App\Models\PayrollDeductionRule;
use App\Models\PerformanceReview;
use App\Models\PublicHoliday;
use App\Models\SalaryAdvance;
use App\Models\ServiceArea;
use App\Models\User;
use App\Models\WorkShift;
use App\Notifications\HrWorkflowNotification;
use App\Services\AccountingWorkflowService;
use App\Services\AttendanceService;
use App\Services\HrPayrollService;
use App\Services\LeaveBalanceService;
use App\Services\TerminationSettlementService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;

class PhaseSixDemoSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::query()->where('email', 'admin@waternet.local')->firstOrFail();
        $manager = $this->user('manager@waternet.local', 'Nadia Safi', 'Manager', '0799001001');
        $hr = $this->user('hr@waternet.local', 'Maryam Habibi', 'HR', '0799001002');
        $accountant = $this->user('accountant@waternet.local', 'Laila Rahimi', 'Accountant', '0799001003');
        $technician = $this->user('technician@waternet.local', 'Ahmad Karimi', 'Technician', '0799111222');
        $technician->assignRole('Meter Assigner');
        $formerEmployee = $this->user('farid.safi@waternet.local', 'Farid Safi', 'Technician', '0799001004');

        $operations = Department::query()->create([
            'code' => 'operations', 'name' => 'Operations', 'description' => 'Water network field operations.', 'status' => 'active',
        ]);
        $humanResources = Department::query()->create([
            'code' => 'human_resources', 'name' => 'Human Resources', 'description' => 'People, attendance, leave, and payroll administration.', 'status' => 'active',
        ]);
        $finance = Department::query()->create([
            'code' => 'finance', 'name' => 'Finance', 'description' => 'Accounts and payroll processing.', 'status' => 'active',
        ]);
        $management = Department::query()->create([
            'code' => 'management', 'name' => 'Management', 'description' => 'Operational review and approval.', 'status' => 'active',
        ]);

        $positions = [
            'technician' => JobPosition::query()->create(['department_id' => $operations->id, 'code' => 'field_technician', 'title' => 'Field Technician', 'status' => 'active']),
            'hr' => JobPosition::query()->create(['department_id' => $humanResources->id, 'code' => 'hr_officer', 'title' => 'HR Officer', 'status' => 'active']),
            'accountant' => JobPosition::query()->create(['department_id' => $finance->id, 'code' => 'accountant', 'title' => 'Accountant', 'status' => 'active']),
            'manager' => JobPosition::query()->create(['department_id' => $management->id, 'code' => 'operations_manager', 'title' => 'Operations Manager', 'status' => 'active']),
        ];

        $areaId = ServiceArea::query()->value('id');
        $employees = [
            'ahmad' => $this->employee($technician, $positions['technician'], $areaId, [
                'employee_number' => 'EMP-00001', 'biometric_id' => 'BIO-1001', 'first_name' => 'Ahmad', 'last_name' => 'Karimi',
                'father_name' => 'Abdul Karim', 'phone' => '0799111222', 'hire_date' => '2025-01-10',
                'salary_type' => 'attendance', 'base_salary' => 18000, 'overtime_hourly_rate' => 120,
            ], $admin),
            'maryam' => $this->employee($hr, $positions['hr'], $areaId, [
                'employee_number' => 'EMP-00002', 'biometric_id' => 'BIO-1002', 'first_name' => 'Maryam', 'last_name' => 'Habibi',
                'father_name' => 'Habibullah', 'phone' => '0799001002', 'hire_date' => '2024-03-01',
                'salary_type' => 'fixed', 'base_salary' => 26000, 'overtime_hourly_rate' => 150,
            ], $admin),
            'laila' => $this->employee($accountant, $positions['accountant'], $areaId, [
                'employee_number' => 'EMP-00003', 'biometric_id' => 'BIO-1003', 'first_name' => 'Laila', 'last_name' => 'Rahimi',
                'father_name' => 'Rahim', 'phone' => '0799001003', 'hire_date' => '2024-06-15',
                'salary_type' => 'fixed', 'base_salary' => 24000, 'overtime_hourly_rate' => 140,
            ], $admin),
            'nadia' => $this->employee($manager, $positions['manager'], $areaId, [
                'employee_number' => 'EMP-00004', 'biometric_id' => 'BIO-1004', 'first_name' => 'Nadia', 'last_name' => 'Safi',
                'father_name' => 'Mohammad Safi', 'phone' => '0799001001', 'hire_date' => '2023-01-01',
                'salary_type' => 'fixed', 'base_salary' => 30000, 'overtime_hourly_rate' => 180,
            ], $admin),
            'farid' => $this->employee($formerEmployee, $positions['technician'], $areaId, [
                'employee_number' => 'EMP-00005', 'biometric_id' => 'BIO-1005', 'first_name' => 'Farid', 'last_name' => 'Safi',
                'father_name' => 'Abdul Wahid', 'phone' => '0799001004', 'hire_date' => '2025-02-01',
                'salary_type' => 'daily', 'base_salary' => 23400, 'daily_rate' => 900, 'overtime_hourly_rate' => 100,
            ], $admin),
        ];

        $standardShift = WorkShift::query()->where('code', 'standard')->firstOrFail();
        $fieldShift = WorkShift::query()->create([
            'code' => 'field', 'name' => 'Field Shift', 'start_time' => '07:30', 'end_time' => '15:30',
            'break_minutes' => 30, 'late_grace_minutes' => 10, 'overtime_after_minutes' => 15,
            'status' => 'active', 'notes' => 'Demo field roster for technicians.',
        ]);
        $officeShift = WorkShift::query()->create([
            'code' => 'office', 'name' => 'Office Shift', 'start_time' => '08:30', 'end_time' => '16:30',
            'break_minutes' => 30, 'late_grace_minutes' => 10, 'overtime_after_minutes' => 15,
            'status' => 'active', 'notes' => 'Demo office roster for HR and finance.',
        ]);

        foreach ($employees as $key => $employee) {
            EmployeeShiftAssignment::query()->create([
                'employee_id' => $employee->id,
                'work_shift_id' => in_array($key, ['ahmad', 'farid'], true) ? $fieldShift->id : ($key === 'nadia' ? $standardShift->id : $officeShift->id),
                'assigned_by' => $hr->id,
                'effective_from' => '2026-01-01',
                'work_days' => [1, 2, 3, 4, 5, 6],
                'notes' => 'Phase 6 demonstration roster.',
            ]);
        }

        PublicHoliday::query()->create([
            'holiday_date' => '2026-06-18', 'name' => 'Demo Paid Public Holiday',
            'is_paid' => true, 'status' => 'active', 'notes' => 'Included as a paid day in June payroll.',
        ]);
        PublicHoliday::query()->create([
            'holiday_date' => '2026-07-14', 'name' => 'Demo Unpaid Company Holiday',
            'is_paid' => false, 'status' => 'active', 'notes' => 'Excluded from paid days in final settlement.',
        ]);

        $attendance = app(AttendanceService::class);
        $annualPolicy = LeavePolicy::query()->where('code', 'annual')->firstOrFail();
        $sickPolicy = LeavePolicy::query()->where('code', 'sick')->firstOrFail();
        $emergencyPolicy = LeavePolicy::query()->where('code', 'emergency')->firstOrFail();

        $approvedLeave = $this->leave($employees['ahmad'], $annualPolicy, $technician, $manager, $attendance, [
            'start' => '2026-06-10', 'end' => '2026-06-11', 'status' => 'approved',
            'reason' => 'Family appointment.',
        ]);
        $attendance->synchronizeApprovedLeave($approvedLeave);
        $pendingLeave = $this->leave($employees['laila'], $sickPolicy, $accountant, null, $attendance, [
            'start' => '2026-07-21', 'end' => '2026-07-22', 'status' => 'pending',
            'reason' => 'Medical rest request awaiting manager decision.',
        ]);
        $this->leave($employees['maryam'], $emergencyPolicy, $hr, $manager, $attendance, [
            'start' => '2026-07-06', 'end' => '2026-07-06', 'status' => 'rejected',
            'reason' => 'Personal emergency.', 'rejection_reason' => 'Required office coverage was not available.',
        ]);

        foreach ($employees as $key => $employee) {
            $this->attendance(
                $employee,
                $hr,
                $manager,
                $attendance,
                '2026-06-01',
                '2026-06-30',
                $key === 'ahmad' ? ['2026-06-24'] : [],
                $key === 'ahmad' ? ['2026-06-05'] : [],
                $key === 'ahmad' ? ['2026-06-06'] : [],
            );
        }

        $balances = app(LeaveBalanceService::class);
        foreach ($employees as $employee) {
            $balances->balances($employee, 2026);
        }
        EmployeeLeaveBalance::query()
            ->where('employee_id', $employees['ahmad']->id)
            ->where('leave_policy_id', $annualPolicy->id)
            ->where('year', 2026)
            ->update(['adjustment_days' => 1, 'notes' => 'One-day HR carry adjustment for the demo.']);

        $taxRule = PayrollDeductionRule::query()->create([
            'code' => 'income_tax_demo', 'name' => 'Income Tax', 'type' => 'tax',
            'calculation_type' => 'percentage', 'value' => 5, 'threshold_amount' => 10000,
            'maximum_amount' => 1500, 'status' => 'active',
            'description' => 'Five percent of eligible salary above AFN 10,000.',
        ]);
        $insuranceRule = PayrollDeductionRule::query()->create([
            'code' => 'health_insurance_demo', 'name' => 'Health Insurance', 'type' => 'insurance',
            'calculation_type' => 'fixed', 'value' => 300, 'threshold_amount' => 0,
            'status' => 'active', 'description' => 'Fixed monthly employee contribution.',
        ]);
        foreach ($employees as $employee) {
            EmployeePayrollDeduction::query()->create([
                'employee_id' => $employee->id, 'payroll_deduction_rule_id' => $taxRule->id,
                'assigned_by' => $hr->id, 'effective_from' => '2026-01-01', 'status' => 'active',
                'notes' => 'Phase 6 tax demonstration.',
            ]);
        }
        foreach ([$employees['ahmad'], $employees['laila']] as $employee) {
            EmployeePayrollDeduction::query()->create([
                'employee_id' => $employee->id, 'payroll_deduction_rule_id' => $insuranceRule->id,
                'assigned_by' => $hr->id, 'effective_from' => '2026-01-01', 'status' => 'active',
                'notes' => 'Phase 6 recurring deduction demonstration.',
            ]);
        }

        EmployeeAdjustment::query()->create([
            'employee_id' => $employees['ahmad']->id, 'created_by' => $hr->id, 'approved_by' => $manager->id,
            'adjustment_number' => 'ADJ-DEMO-00001', 'type' => 'bonus', 'amount' => 1000,
            'effective_date' => '2026-06-30', 'status' => 'approved', 'approved_at' => '2026-06-29 10:00:00',
            'title' => 'Emergency repair bonus', 'notes' => 'Approved bonus included in June payroll.',
        ]);
        EmployeeAdjustment::query()->create([
            'employee_id' => $employees['laila']->id, 'created_by' => $hr->id, 'approved_by' => $manager->id,
            'adjustment_number' => 'ADJ-DEMO-00002', 'type' => 'deduction', 'amount' => 500,
            'effective_date' => '2026-06-30', 'status' => 'approved', 'approved_at' => '2026-06-29 10:05:00',
            'title' => 'Approved equipment deduction', 'notes' => 'Approved one-time deduction included in June payroll.',
        ]);

        $bankMethod = PaymentMethod::query()->where('code', 'bank_transfer')->firstOrFail();
        $payrollAccount = AccountingAccount::query()->create([
            'name' => 'Payroll Bank', 'code' => 'payroll_bank', 'type' => 'bank',
            'opening_balance' => 300000, 'current_balance' => 300000, 'status' => 'active',
            'notes' => 'Dedicated Phase 6 payroll and settlement demonstration account.',
        ]);
        $payroll = app(HrPayrollService::class)->generate([
            'title' => 'June 2026 Payroll', 'period_start' => '2026-06-01', 'period_end' => '2026-06-30',
            'payment_date' => '2026-06-30', 'payment_method_id' => $bankMethod->id,
            'accounting_account_id' => $payrollAccount->id,
            'notes' => 'Approved demo payroll generated from attendance, leave, overtime, bonuses, tax, and recurring deductions.',
        ], $hr->id);
        $salaryCategory = FinancialCategory::query()->where('code', 'salary_expense')->firstOrFail();
        $payrollTransaction = AccountingTransaction::query()->create([
            'financial_category_id' => $salaryCategory->id, 'payment_method_id' => $bankMethod->id,
            'accounting_account_id' => $payrollAccount->id, 'recorded_by' => $hr->id,
            'transaction_number' => AccountingTransaction::nextNumber('expense'), 'type' => 'expense',
            'title' => $payroll->title, 'amount' => $payroll->total_net, 'paid_to' => 'Employees',
            'transaction_date' => $payroll->payment_date, 'reference' => $payroll->payroll_number,
            'source_type' => 'payroll_run', 'source_id' => $payroll->id, 'status' => 'pending_review',
            'description' => $payroll->notes,
        ]);
        $payroll->update([
            'financial_category_id' => $salaryCategory->id,
            'accounting_transaction_id' => $payrollTransaction->id,
            'status' => 'pending_review', 'submitted_at' => '2026-06-29 09:00:00',
        ]);
        $workflow = app(AccountingWorkflowService::class);
        $workflow->review($payrollTransaction, $manager);
        $workflow->approve($payrollTransaction->fresh(), $admin);

        $advance = SalaryAdvance::query()->create([
            'employee_id' => $employees['farid']->id, 'payment_method_id' => $bankMethod->id,
            'accounting_account_id' => $payrollAccount->id, 'created_by' => $hr->id,
            'reviewed_by' => $manager->id, 'approved_by' => $admin->id,
            'advance_number' => 'ADV-DEMO-00001', 'amount' => 3000, 'deducted_amount' => 0,
            'payment_date' => '2026-07-01', 'deduction_start_date' => '2026-07-15',
            'status' => 'approved', 'reviewed_at' => '2026-07-01 09:15:00', 'approved_at' => '2026-07-01 09:30:00',
            'reason' => 'Emergency salary advance before employee resignation.',
        ]);
        $advanceCategory = FinancialCategory::query()->firstOrCreate(
            ['code' => 'salary_advance'],
            ['name' => 'Salary Advance', 'type' => 'expense', 'status' => 'active'],
        );
        $advanceTransaction = AccountingTransaction::query()->create([
            'financial_category_id' => $advanceCategory->id, 'payment_method_id' => $bankMethod->id,
            'accounting_account_id' => $payrollAccount->id, 'recorded_by' => $hr->id,
            'reviewed_by' => $manager->id, 'approved_by' => $admin->id,
            'transaction_number' => AccountingTransaction::nextNumber('employee_advance'), 'type' => 'expense',
            'title' => 'Salary advance - Farid Safi', 'amount' => $advance->amount, 'paid_to' => $employees['farid']->full_name,
            'transaction_date' => $advance->payment_date, 'reference' => $advance->advance_number,
            'source_type' => 'salary_advance', 'source_id' => $advance->id, 'status' => 'approved',
            'reviewed_at' => '2026-07-01 09:15:00', 'approved_at' => '2026-07-01 09:30:00',
            'description' => $advance->reason,
        ]);
        $advance->update(['accounting_transaction_id' => $advanceTransaction->id]);
        $advanceTransaction->postToAccount();

        $this->attendance($employees['farid'], $hr, $manager, $attendance, '2026-07-01', '2026-07-15');
        $settlementData = app(TerminationSettlementService::class)->calculate($employees['farid'], '2026-07-15', [
            'severance_amount' => 2000, 'other_earnings' => 500, 'other_deductions' => 500,
        ]);
        $terminationCategory = FinancialCategory::query()->firstOrCreate(
            ['code' => 'employee_final_settlement'],
            ['name' => 'Employee Final Settlement', 'type' => 'expense', 'status' => 'active'],
        );
        $termination = EmployeeTermination::query()->create([
            'employee_id' => $employees['farid']->id, 'payment_method_id' => $bankMethod->id,
            'accounting_account_id' => $payrollAccount->id, 'created_by' => $hr->id,
            'termination_number' => 'SET-DEMO-00001', 'last_working_date' => '2026-07-15',
            'termination_type' => 'resignation', 'reason' => 'Employee resignation after notice period.',
            ...collect($settlementData)->except(['paid_days', 'daily_rate', 'advance_allocations'])->all(),
            'status' => 'pending_review', 'notes' => 'Approved final settlement demonstration.',
        ]);
        foreach ($settlementData['advance_allocations'] as $allocation) {
            $termination->advanceAllocations()->create($allocation);
        }
        $terminationTransaction = AccountingTransaction::query()->create([
            'financial_category_id' => $terminationCategory->id, 'payment_method_id' => $bankMethod->id,
            'accounting_account_id' => $payrollAccount->id, 'recorded_by' => $hr->id,
            'transaction_number' => AccountingTransaction::nextNumber('final_settlement'), 'type' => 'expense',
            'title' => 'Final settlement - Farid Safi', 'amount' => $termination->net_settlement,
            'paid_to' => $employees['farid']->full_name, 'transaction_date' => '2026-07-15',
            'reference' => $termination->termination_number, 'source_type' => 'employee_termination',
            'source_id' => $termination->id, 'status' => 'pending_review', 'description' => $termination->reason,
        ]);
        $termination->update(['accounting_transaction_id' => $terminationTransaction->id]);
        $workflow->review($terminationTransaction, $manager);
        $workflow->approve($terminationTransaction->fresh(), $admin);

        $this->biometricDemo($employees, $hr, $attendance);
        PerformanceReview::query()->create([
            'employee_id' => $employees['ahmad']->id, 'reviewed_by' => $manager->id,
            'period_start' => '2026-04-01', 'period_end' => '2026-06-30', 'rating' => 4,
            'achievements' => 'Completed emergency pipe repairs and maintained good attendance.',
            'goals' => 'Complete advanced meter installation training.', 'status' => 'finalized',
            'finalized_at' => '2026-07-02 10:00:00',
        ]);

        $manager->notify(new HrWorkflowNotification(
            'leave_submitted', 'Leave request awaiting review',
            "{$employees['laila']->full_name} submitted {$pendingLeave->leave_number}.",
            '/dashboard/attendance?tab=leave', ['leave_request_id' => $pendingLeave->id, 'employee_id' => $employees['laila']->id],
        ));
        $technician->notify(new HrWorkflowNotification(
            'leave_resolved', 'Leave approved', "Your leave request {$approvedLeave->leave_number} was approved.",
            '/dashboard/attendance?tab=leave', ['leave_request_id' => $approvedLeave->id],
        ));
        $accountant->notify(new HrWorkflowNotification(
            'payroll_paid', 'Salary paid', "Payroll {$payroll->payroll_number} was approved and paid.",
            '/dashboard/payroll', ['payroll_run_id' => $payroll->id],
        ));
        $formerEmployee->notify(new HrWorkflowNotification(
            'termination_approved', 'Final settlement approved',
            "Your final settlement {$termination->termination_number} was approved.",
            '/dashboard/hr?tab=terminations', ['employee_termination_id' => $termination->id],
        ));
    }

    private function user(string $email, string $name, string $role, string $phone): User
    {
        $user = User::query()->updateOrCreate(
            ['email' => $email],
            ['name' => $name, 'phone' => $phone, 'password' => 'password', 'status' => 'active'],
        );
        $user->syncRoles([$role]);

        return $user;
    }

    private function employee(User $user, JobPosition $position, ?int $areaId, array $data, User $admin): Employee
    {
        return Employee::query()->updateOrCreate(['user_id' => $user->id], $data + [
            'user_id' => $user->id, 'job_position_id' => $position->id, 'service_area_id' => $areaId,
            'created_by' => $admin->id, 'updated_by' => $admin->id, 'email' => $user->email,
            'employment_type' => 'permanent', 'daily_rate' => 0, 'standard_daily_hours' => 8,
            'work_start_time' => '08:00', 'work_end_time' => '16:00', 'work_days' => [1, 2, 3, 4, 5, 6],
            'status' => 'active', 'address' => 'Kabul, Afghanistan',
            'emergency_contact_name' => 'Demo Emergency Contact', 'emergency_contact_phone' => '0799888777',
            'notes' => 'Phase 6 workflow demonstration employee.',
        ]);
    }

    private function leave(
        Employee $employee,
        LeavePolicy $policy,
        User $creator,
        ?User $reviewer,
        AttendanceService $attendance,
        array $data,
    ): LeaveRequest {
        $totalDays = count($attendance->workingDays($employee, $data['start'], $data['end']));

        return LeaveRequest::query()->create([
            'employee_id' => $employee->id, 'leave_policy_id' => $policy->id,
            'created_by' => $creator->id, 'reviewed_by' => $reviewer?->id,
            'leave_number' => LeaveRequest::nextNumber(), 'leave_type' => $policy->code,
            'start_date' => $data['start'], 'end_date' => $data['end'], 'total_days' => $totalDays,
            'is_paid' => $policy->is_paid, 'reason' => $data['reason'], 'status' => $data['status'],
            'reviewed_at' => $reviewer ? '2026-07-01 09:00:00' : null,
            'rejection_reason' => $data['rejection_reason'] ?? null,
        ]);
    }

    private function attendance(
        Employee $employee,
        User $recorder,
        User $approver,
        AttendanceService $service,
        string $from,
        string $to,
        array $absentDates = [],
        array $lateDates = [],
        array $overtimeDates = [],
    ): void {
        foreach ($service->workingDays($employee, $from, $to) as $date) {
            if (AttendanceRecord::query()->where('employee_id', $employee->id)->whereDate('attendance_date', $date)->exists()) {
                continue;
            }
            $schedule = $service->schedule($employee, $date);
            $absent = in_array($date, $absentDates, true);
            $checkIn = $absent ? null : Carbon::parse($schedule['start_time'])
                ->addMinutes(in_array($date, $lateDates, true) ? 20 : 0)
                ->format('H:i');
            $checkOut = $absent ? null : Carbon::parse($schedule['end_time'])
                ->addMinutes(in_array($date, $overtimeDates, true) ? 60 : 0)
                ->format('H:i');
            $record = new AttendanceRecord([
                'employee_id' => $employee->id, 'recorded_by' => $recorder->id,
                'approved_by' => $approver->id, 'attendance_date' => $date,
                'check_in' => $checkIn, 'check_out' => $checkOut,
                'attendance_status' => $absent ? 'absent' : 'present', 'is_paid' => ! $absent,
                'source' => 'manual', 'approval_status' => 'approved', 'approved_at' => "{$date} 17:00:00",
                'notes' => $absent ? 'Demo approved absence.' : 'Demo approved attendance.',
            ]);
            $service->recalculate($record, $employee)->save();
        }
    }

    private function biometricDemo(array $employees, User $hr, AttendanceService $attendance): void
    {
        $path = 'biometric-imports/phase-six-demo.csv';
        Storage::disk('local')->put($path, implode("\n", [
            'employee_number,attendance_date,check_in,check_out,external_reference',
            'BIO-1001,2026-07-16,07:32,15:35,DEVICE-DEMO-001',
            'BIO-1003,2026-07-16,08:31,16:32,DEVICE-DEMO-002',
            'UNKNOWN,2026-07-16,08:00,16:00,DEVICE-DEMO-003',
        ]));
        $batch = BiometricImportBatch::query()->create([
            'imported_by' => $hr->id, 'batch_number' => 'BIO-DEMO-00001',
            'original_name' => 'phase-six-demo.csv', 'path' => $path,
            'total_rows' => 3, 'imported_rows' => 2, 'failed_rows' => 1,
            'status' => 'completed_with_errors',
            'errors' => [['row' => 4, 'message' => 'Employee code UNKNOWN was not found.']],
        ]);

        foreach ([
            [$employees['ahmad'], '07:32', '15:35', 'DEVICE-DEMO-001'],
            [$employees['laila'], '08:31', '16:32', 'DEVICE-DEMO-002'],
        ] as [$employee, $checkIn, $checkOut, $reference]) {
            $record = new AttendanceRecord([
                'employee_id' => $employee->id, 'biometric_import_batch_id' => $batch->id,
                'recorded_by' => $hr->id, 'attendance_date' => '2026-07-16',
                'check_in' => $checkIn, 'check_out' => $checkOut,
                'attendance_status' => 'present', 'is_paid' => true, 'source' => 'biometric',
                'external_reference' => $reference, 'approval_status' => 'pending',
                'notes' => 'Imported from the Phase 6 demo biometric batch.',
            ]);
            $attendance->recalculate($record, $employee)->save();
        }
    }
}
