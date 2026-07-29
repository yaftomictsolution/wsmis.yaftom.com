<?php

namespace Tests\Feature;

use App\Models\AccountingAccount;
use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\EmployeeTermination;
use App\Models\LeavePolicy;
use App\Models\LeaveRequest;
use App\Models\PaymentMethod;
use App\Models\SalaryAdvance;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PhaseSixCompletionTest extends TestCase
{
    use RefreshDatabase;

    public function test_attendance_and_leave_cannot_be_recorded_outside_employment_dates(): void
    {
        [$hr] = $this->users(['HR']);
        $employee = $this->employee([
            'hire_date' => '2026-07-22',
            'termination_date' => '2026-07-25',
        ]);
        Sanctum::actingAs($hr);

        $this->postJson('/api/attendance', [
            'employee_id' => $employee->id,
            'attendance_date' => '2026-07-21',
            'attendance_status' => 'absent',
        ])->assertUnprocessable()->assertJsonValidationErrors('attendance_date');

        $this->postJson('/api/leave-requests', [
            'employee_id' => $employee->id,
            'leave_policy_id' => LeavePolicy::query()->where('code', 'unpaid')->value('id'),
            'start_date' => '2026-07-21',
            'end_date' => '2026-07-21',
            'reason' => 'Invalid pre-employment leave',
        ])->assertUnprocessable()->assertJsonValidationErrors('start_date');

        $this->postJson('/api/attendance', [
            'employee_id' => $employee->id,
            'attendance_date' => '2026-07-26',
            'attendance_status' => 'absent',
        ])->assertUnprocessable()->assertJsonValidationErrors('attendance_date');
    }

    public function test_leave_balances_holidays_and_shift_rosters_control_attendance_and_leave(): void
    {
        [$hr, $manager] = $this->users(['HR', 'Manager']);
        $employee = $this->employee();

        Sanctum::actingAs($hr);
        $shiftId = $this->postJson('/api/work-shifts', [
            'code' => 'field', 'name' => 'Field Shift', 'start_time' => '07:30', 'end_time' => '15:30',
            'break_minutes' => 30, 'late_grace_minutes' => 10, 'overtime_after_minutes' => 15,
            'status' => 'active',
        ])->assertCreated()->json('data.id');
        $this->postJson('/api/shift-assignments', [
            'employee_id' => $employee->id, 'work_shift_id' => $shiftId,
            'effective_from' => '2026-07-01', 'work_days' => [1, 2, 3, 4, 5, 6],
        ])->assertCreated();
        $this->postJson('/api/public-holidays', [
            'holiday_date' => '2026-07-04', 'name' => 'Water Service Day', 'is_paid' => true, 'status' => 'active',
        ])->assertCreated();

        $attendanceId = $this->postJson('/api/attendance', [
            'employee_id' => $employee->id, 'attendance_date' => '2026-07-01',
            'check_in' => '07:45', 'check_out' => '16:00', 'attendance_status' => 'present',
        ])->assertCreated()
            ->assertJsonPath('data.worked_minutes', 465)
            ->assertJsonPath('data.late_minutes', 5)
            ->assertJsonPath('data.overtime_minutes', 30)
            ->json('data.id');

        Sanctum::actingAs($manager);
        $this->postJson("/api/attendance/{$attendanceId}/resolve", ['action' => 'approve'])->assertOk();

        Sanctum::actingAs($hr);
        $policies = $this->getJson("/api/leave-policies?employee_id={$employee->id}&year=2026")
            ->assertOk()
            ->assertJsonCount(5, 'data.policies');
        $annualPolicyId = collect($policies->json('data.policies'))->firstWhere('code', 'annual')['id'];
        $this->postJson('/api/leave-requests', [
            'employee_id' => $employee->id,
            'leave_policy_id' => $annualPolicyId,
            'start_date' => '2026-07-02',
            'end_date' => '2026-07-04',
            'reason' => 'Family visit',
        ])->assertCreated()
            ->assertJsonPath('data.total_days', '2.00')
            ->assertJsonPath('data.is_paid', true);
        $leaveId = (int) LeaveRequest::query()->value('id');

        Sanctum::actingAs($manager);
        $this->postJson("/api/leave-requests/{$leaveId}/resolve", ['action' => 'approve'])->assertOk();
        $this->assertSame(1, AttendanceRecord::query()->where('employee_id', $employee->id)->whereDate('attendance_date', '2026-07-02')->where('source', 'leave')->count());
        $this->assertSame(0, AttendanceRecord::query()->where('employee_id', $employee->id)->whereDate('attendance_date', '2026-07-04')->where('source', 'leave')->count());

        Sanctum::actingAs($hr);
        $balances = $this->getJson("/api/leave-policies?employee_id={$employee->id}&year=2026")->assertOk();
        $annual = collect($balances->json('data.balances'))->firstWhere('policy.code', 'annual');
        $this->assertSame(2.0, (float) $annual['used_days']);

        $profile = $this->getJson("/api/employees/{$employee->id}")->assertOk();
        $profileAnnual = collect($profile->json('data.leave_balances'))->firstWhere('policy.code', 'annual');
        $this->assertSame(2.0, (float) $profileAnnual['used_days']);
        $this->assertArrayHasKey('available_days', $profileAnnual);
    }

    public function test_payroll_requires_resolved_attendance_and_deducts_absence_half_day_and_late_time(): void
    {
        [$hr, $manager] = $this->users(['HR', 'Manager']);
        [$method, $account] = $this->cash(20000);
        $employee = $this->employee([
            'base_salary' => 10000,
            'work_days' => [1],
        ]);

        Sanctum::actingAs($hr);
        $shiftId = $this->postJson('/api/work-shifts', [
            'code' => 'monday_shift', 'name' => 'Monday Shift', 'start_time' => '08:00', 'end_time' => '16:00',
            'break_minutes' => 60, 'late_grace_minutes' => 15, 'overtime_after_minutes' => 15,
            'status' => 'active',
        ])->assertCreated()->json('data.id');
        $this->postJson('/api/shift-assignments', [
            'employee_id' => $employee->id, 'work_shift_id' => $shiftId,
            'effective_from' => '2026-06-01', 'work_days' => [1],
        ])->assertCreated();
        $this->postJson('/api/public-holidays', [
            'holiday_date' => '2026-06-29', 'name' => 'Paid Service Holiday',
            'is_paid' => true, 'status' => 'active',
        ])->assertCreated();

        $attendanceIds = [];
        foreach ([
            ['attendance_date' => '2026-06-01', 'check_in' => '08:00', 'check_out' => '16:00', 'attendance_status' => 'present'],
            ['attendance_date' => '2026-06-08', 'attendance_status' => 'absent'],
            ['attendance_date' => '2026-06-15', 'check_in' => '08:30', 'check_out' => '12:00', 'attendance_status' => 'half_day'],
            ['attendance_date' => '2026-06-22', 'check_in' => '08:00', 'attendance_status' => 'present'],
        ] as $attendance) {
            $attendanceIds[] = $this->postJson('/api/attendance', ['employee_id' => $employee->id] + $attendance)
                ->assertCreated()
                ->json('data.id');
        }

        Sanctum::actingAs($manager);
        foreach (array_slice($attendanceIds, 0, 3) as $attendanceId) {
            $this->postJson("/api/attendance/{$attendanceId}/resolve", ['action' => 'approve'])->assertOk();
        }
        $this->postJson("/api/attendance/{$attendanceIds[3]}/resolve", ['action' => 'approve'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('attendance');

        Sanctum::actingAs($hr);
        $this->getJson('/api/payroll-runs/eligible-employees?period_start=2026-06-01&period_end=2026-06-30')
            ->assertOk()
            ->assertJsonPath('data.0.attendance_ready', false)
            ->assertJsonPath('data.0.incomplete_attendance_count', 1);
        $payrollPayload = [
            'title' => 'June Attendance Payroll', 'period_start' => '2026-06-01', 'period_end' => '2026-06-30',
            'payment_date' => '2026-06-30', 'payment_method_id' => $method->id,
            'accounting_account_id' => $account->id, 'employee_ids' => [$employee->id],
        ];
        $this->postJson('/api/payroll-runs/generate', $payrollPayload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('employee_ids');

        $this->putJson("/api/attendance/{$attendanceIds[3]}", [
            'employee_id' => $employee->id, 'attendance_date' => '2026-06-22',
            'check_in' => '08:00', 'check_out' => '16:00', 'attendance_status' => 'present',
        ])->assertOk();
        Sanctum::actingAs($manager);
        $this->postJson("/api/attendance/{$attendanceIds[3]}/resolve", ['action' => 'approve'])->assertOk();

        Sanctum::actingAs($hr);
        $this->getJson('/api/payroll-runs/eligible-employees?period_start=2026-06-01&period_end=2026-06-30')
            ->assertOk()
            ->assertJsonPath('data.0.attendance_ready', true)
            ->assertJsonPath('data.0.incomplete_attendance_count', 0);
        $this->postJson('/api/payroll-runs/generate', $payrollPayload)
            ->assertCreated()
            ->assertJsonPath('data.items.0.scheduled_days', '5.00')
            ->assertJsonPath('data.items.0.present_days', '2.50')
            ->assertJsonPath('data.items.0.paid_leave_days', '1.00')
            ->assertJsonPath('data.items.0.absent_days', '1.50')
            ->assertJsonPath('data.items.0.base_salary', '10000.00')
            ->assertJsonPath('data.items.0.absence_deduction', '3000.00')
            ->assertJsonPath('data.items.0.late_minutes', 15)
            ->assertJsonPath('data.items.0.late_deduction', '71.43')
            ->assertJsonPath('data.items.0.net_amount', '6928.57')
            ->assertJsonPath('data.total_late_deduction', '71.43');
    }

    public function test_configurable_tax_and_recurring_deductions_flow_into_payroll_and_reports(): void
    {
        [$hr, $manager, $admin] = $this->users(['HR', 'Manager', 'Admin']);
        [$method, $account] = $this->cash(10000);
        $employee = $this->employee(['salary_type' => 'attendance', 'base_salary' => 40500]);
        AttendanceRecord::query()->insert([
            ['employee_id' => $employee->id, 'attendance_date' => '2026-07-01', 'check_in' => '08:00', 'check_out' => '16:00', 'attendance_status' => 'present', 'is_paid' => true, 'source' => 'manual', 'approval_status' => 'approved', 'worked_minutes' => 480, 'late_minutes' => 0, 'overtime_minutes' => 0, 'created_at' => now(), 'updated_at' => now()],
            ['employee_id' => $employee->id, 'attendance_date' => '2026-07-02', 'check_in' => '08:00', 'check_out' => '16:00', 'attendance_status' => 'present', 'is_paid' => true, 'source' => 'manual', 'approval_status' => 'approved', 'worked_minutes' => 480, 'late_minutes' => 0, 'overtime_minutes' => 0, 'created_at' => now(), 'updated_at' => now()],
        ]);

        Sanctum::actingAs($hr);
        $taxRule = $this->postJson('/api/payroll-deduction-rules', [
            'code' => 'income_tax', 'name' => 'Income Tax', 'type' => 'tax',
            'calculation_type' => 'percentage', 'value' => 10, 'threshold_amount' => 1000,
            'status' => 'active',
        ])->assertCreated()->json('data.id');
        $insuranceRule = $this->postJson('/api/payroll-deduction-rules', [
            'code' => 'insurance', 'name' => 'Insurance', 'type' => 'insurance',
            'calculation_type' => 'fixed', 'value' => 50, 'threshold_amount' => 0,
            'status' => 'active',
        ])->assertCreated()->json('data.id');
        foreach ([$taxRule, $insuranceRule] as $ruleId) {
            $this->postJson('/api/employee-payroll-deductions', [
                'employee_id' => $employee->id, 'payroll_deduction_rule_id' => $ruleId,
                'effective_from' => '2026-07-01', 'status' => 'active',
            ])->assertCreated();
        }

        $payrollId = $this->postJson('/api/payroll-runs/generate', [
            'title' => 'July Completion Payroll', 'period_start' => '2026-07-01', 'period_end' => '2026-07-02',
            'payment_date' => '2026-07-02', 'payment_method_id' => $method->id, 'accounting_account_id' => $account->id,
        ])->assertCreated()
            ->assertJsonPath('data.items.0.tax_deduction', '200.00')
            ->assertJsonPath('data.items.0.recurring_deduction', '50.00')
            ->assertJsonPath('data.items.0.net_amount', '2750.00')
            ->json('data.id');
        $this->postJson("/api/payroll-runs/{$payrollId}/submit")->assertOk();
        Sanctum::actingAs($manager);
        $this->postJson("/api/payroll-runs/{$payrollId}/review")->assertOk();
        Sanctum::actingAs($admin);
        $this->postJson("/api/payroll-runs/{$payrollId}/approve")->assertOk();
        $this->assertEquals(7250, (float) $account->fresh()->current_balance);

        $this->getJson('/api/payroll-reports/monthly?from=2026-07-01&to=2026-07-31')
            ->assertOk()
            ->assertJsonPath('data.totals.tax_deduction', 200)
            ->assertJsonPath('data.totals.recurring_deduction', 50)
            ->assertJsonPath('data.totals.net_payroll', 2750);
        $this->get('/api/payroll-reports/export?from=2026-07-01&to=2026-07-31')
            ->assertOk()
            ->assertDownload('payroll-summary-2026-07-01-to-2026-07-31.csv');
    }

    public function test_final_settlement_terminates_employee_and_reverses_safely(): void
    {
        [$hr, $manager, $admin] = $this->users(['HR', 'Manager', 'Admin']);
        [$method, $account] = $this->cash(10000);
        $login = User::factory()->create(['status' => 'active']);
        $employee = $this->employee(['user_id' => $login->id]);
        AttendanceRecord::query()->insert([
            ['employee_id' => $employee->id, 'attendance_date' => '2026-07-01', 'attendance_status' => 'present', 'is_paid' => true, 'source' => 'manual', 'approval_status' => 'approved', 'worked_minutes' => 480, 'late_minutes' => 0, 'overtime_minutes' => 0, 'created_at' => now(), 'updated_at' => now()],
            ['employee_id' => $employee->id, 'attendance_date' => '2026-07-02', 'attendance_status' => 'present', 'is_paid' => true, 'source' => 'manual', 'approval_status' => 'approved', 'worked_minutes' => 480, 'late_minutes' => 0, 'overtime_minutes' => 0, 'created_at' => now(), 'updated_at' => now()],
        ]);
        $advance = SalaryAdvance::query()->create([
            'employee_id' => $employee->id, 'payment_method_id' => $method->id, 'accounting_account_id' => $account->id,
            'advance_number' => 'ADV-TERMINATION', 'amount' => 500, 'deducted_amount' => 0,
            'payment_date' => '2026-06-01', 'deduction_start_date' => '2026-07-01', 'status' => 'approved',
        ]);

        Sanctum::actingAs($hr);
        $terminationId = $this->postJson('/api/employee-terminations', [
            'employee_id' => $employee->id, 'payment_method_id' => $method->id, 'accounting_account_id' => $account->id,
            'last_working_date' => '2026-07-02', 'termination_type' => 'resignation',
            'reason' => 'Employee resignation', 'severance_amount' => 100,
        ])->assertCreated()
            ->assertJsonPath('data.status', 'pending_review')
            ->json('data.id');
        $settlement = EmployeeTermination::query()->findOrFail($terminationId);
        $opening = (float) $account->current_balance;

        Sanctum::actingAs($manager);
        $this->postJson("/api/employee-terminations/{$terminationId}/review")->assertOk()->assertJsonPath('data.status', 'pending_approval');
        Sanctum::actingAs($admin);
        $this->postJson("/api/employee-terminations/{$terminationId}/approve")->assertOk()->assertJsonPath('data.status', 'approved');
        $this->assertSame('2026-07-02', $employee->fresh()->termination_date?->toDateString());
        $this->assertSame('terminated', $employee->fresh()->status);
        $this->assertDatabaseHas('users', ['id' => $login->id, 'status' => 'inactive']);
        $this->assertEquals(500, (float) $advance->fresh()->deducted_amount);
        $this->assertEquals($opening - (float) $settlement->net_settlement, (float) $account->fresh()->current_balance);

        $this->postJson("/api/employee-terminations/{$terminationId}/cancel")->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertDatabaseHas('employees', ['id' => $employee->id, 'status' => 'active', 'termination_date' => null]);
        $this->assertEquals(0, (float) $advance->fresh()->deducted_amount);
        $this->assertEquals($opening, (float) $account->fresh()->current_balance);
    }

    public function test_biometric_csv_import_preserves_batch_and_row_errors(): void
    {
        Storage::fake('local');
        [$hr] = $this->users(['HR']);
        $employee = $this->employee(['biometric_id' => 'BIO-101']);
        Sanctum::actingAs($hr);
        $csv = "employee_number,attendance_date,check_in,check_out,external_reference\n".
            "BIO-101,2026-07-01,08:00,16:00,DEVICE-1\n".
            "UNKNOWN,2026-07-01,08:00,16:00,DEVICE-2\n";

        $this->post('/api/biometric-imports', [
            'file' => UploadedFile::fake()->createWithContent('attendance.csv', $csv),
        ], ['Accept' => 'application/json'])->assertCreated()
            ->assertJsonPath('data.total_rows', 2)
            ->assertJsonPath('data.imported_rows', 1)
            ->assertJsonPath('data.failed_rows', 1)
            ->assertJsonPath('data.status', 'completed_with_errors');

        $this->assertSame(1, AttendanceRecord::query()
            ->where('employee_id', $employee->id)
            ->whereDate('attendance_date', '2026-07-01')
            ->where('source', 'biometric')
            ->where('external_reference', 'DEVICE-1')
            ->where('approval_status', 'pending')
            ->count());
        $this->get('/api/biometric-imports/template')->assertOk()->assertDownload('biometric-attendance-template.csv');
    }

    private function users(array $roles): array
    {
        return collect($roles)->map(function (string $roleName): User {
            $user = User::factory()->create(['status' => 'active']);
            $user->assignRole(Role::findOrCreate($roleName, 'web'));

            return $user;
        })->all();
    }

    private function employee(array $overrides = []): Employee
    {
        return Employee::query()->create(array_merge([
            'employee_number' => 'EMP-00001', 'first_name' => 'Ahmad', 'last_name' => 'Karimi',
            'hire_date' => '2026-01-01', 'employment_type' => 'permanent', 'salary_type' => 'fixed',
            'base_salary' => 3000, 'daily_rate' => 0, 'overtime_hourly_rate' => 0,
            'standard_daily_hours' => 8, 'work_start_time' => '08:00', 'work_end_time' => '16:00',
            'work_days' => [1, 2, 3, 4, 5, 6], 'status' => 'active',
        ], $overrides));
    }

    private function cash(float $opening): array
    {
        $method = PaymentMethod::query()->firstOrCreate(['code' => 'cash'], ['name' => 'Cash', 'status' => 'active']);
        $account = AccountingAccount::query()->create([
            'name' => 'HR Cash', 'code' => 'hr_cash_completion', 'type' => 'cash',
            'opening_balance' => $opening, 'current_balance' => $opening, 'status' => 'active',
        ]);

        return [$method, $account];
    }
}
