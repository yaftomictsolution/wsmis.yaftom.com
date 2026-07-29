<?php

namespace Tests\Feature;

use App\Models\AccountingAccount;
use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\EmployeeAdjustment;
use App\Models\PaymentMethod;
use App\Models\SalaryAdvance;
use App\Models\User;
use Carbon\CarbonPeriod;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PhaseSixHrPayrollTest extends TestCase
{
    use RefreshDatabase;

    public function test_attendance_adjustments_and_advance_generate_and_post_correct_payroll(): void
    {
        [$hr, $manager, $admin] = $this->workflowUsers();
        [$account, $method] = $this->cashSetup(10000);

        Sanctum::actingAs($hr);
        $departmentId = $this->postJson('/api/hr/departments', [
            'code' => 'OPS', 'name' => 'Operations', 'status' => 'active',
        ])->assertCreated()->json('data.id');
        $positionId = $this->postJson('/api/hr/positions', [
            'department_id' => $departmentId, 'code' => 'TECH', 'title' => 'Technician', 'status' => 'active',
        ])->assertCreated()->json('data.id');
        $employeeId = $this->postJson('/api/employees', $this->employeePayload($positionId, [
            'salary_type' => 'attendance',
            'base_salary' => 40500,
            'overtime_hourly_rate' => 100,
            'work_days' => [1, 2, 3, 4, 5, 6],
        ]))->assertCreated()->json('data.id');

        $attendanceId = $this->postJson('/api/attendance', [
            'employee_id' => $employeeId,
            'attendance_date' => '2026-07-01',
            'check_in' => '08:00',
            'check_out' => '17:00',
            'attendance_status' => 'present',
        ])->assertCreated()->assertJsonPath('data.overtime_minutes', 60)->json('data.id');

        $absenceId = $this->postJson('/api/attendance', [
            'employee_id' => $employeeId,
            'attendance_date' => '2026-07-02',
            'attendance_status' => 'absent',
        ])->assertCreated()->json('data.id');

        Sanctum::actingAs($manager);
        $this->postJson("/api/attendance/{$attendanceId}/resolve", ['action' => 'approve'])
            ->assertOk()->assertJsonPath('data.approval_status', 'approved');
        $this->postJson("/api/attendance/{$absenceId}/resolve", ['action' => 'approve'])
            ->assertOk()->assertJsonPath('data.approval_status', 'approved');

        Sanctum::actingAs($hr);
        $adjustmentId = $this->postJson('/api/employee-adjustments', [
            'employee_id' => $employeeId,
            'type' => 'bonus',
            'amount' => 200,
            'effective_date' => '2026-07-02',
            'title' => 'Emergency repair bonus',
        ])->assertCreated()->json('data.id');

        Sanctum::actingAs($manager);
        $this->postJson("/api/employee-adjustments/{$adjustmentId}/resolve", ['action' => 'approve'])
            ->assertOk()->assertJsonPath('data.status', 'approved');

        Sanctum::actingAs($hr);
        $advanceId = $this->postJson('/api/salary-advances', [
            'employee_id' => $employeeId,
            'payment_method_id' => $method->id,
            'accounting_account_id' => $account->id,
            'amount' => 500,
            'payment_date' => '2026-07-01',
            'deduction_start_date' => '2026-07-01',
            'reason' => 'Family emergency',
        ])->assertCreated()->assertJsonPath('data.status', 'pending_review')->json('data.id');

        Sanctum::actingAs($manager);
        $this->postJson("/api/salary-advances/{$advanceId}/review")->assertOk()->assertJsonPath('data.status', 'pending_approval');
        Sanctum::actingAs($admin);
        $this->postJson("/api/salary-advances/{$advanceId}/approve")->assertOk()->assertJsonPath('data.status', 'approved');
        $this->assertEquals(9500, (float) $account->fresh()->current_balance);

        Sanctum::actingAs($hr);
        $payrollId = $this->postJson('/api/payroll-runs/generate', [
            'title' => 'July HR Payroll',
            'period_start' => '2026-07-01',
            'period_end' => '2026-07-02',
            'payment_date' => '2026-07-02',
            'payment_method_id' => $method->id,
            'accounting_account_id' => $account->id,
        ])->assertCreated()
            ->assertJsonPath('data.generated_from_hr', true)
            ->assertJsonPath('data.items.0.scheduled_days', '2.00')
            ->assertJsonPath('data.items.0.present_days', '1.00')
            ->assertJsonPath('data.items.0.absent_days', '1.00')
            ->assertJsonPath('data.items.0.absence_deduction', '1500.00')
            ->assertJsonPath('data.items.0.overtime_amount', '100.00')
            ->assertJsonPath('data.items.0.bonus', '200.00')
            ->assertJsonPath('data.items.0.advance_deduction', '500.00')
            ->assertJsonPath('data.items.0.net_amount', '1300.00')
            ->json('data.id');

        $this->postJson('/api/payroll-runs/generate', [
            'title' => 'Overlapping Payroll',
            'period_start' => '2026-07-02',
            'period_end' => '2026-07-03',
            'payment_date' => '2026-07-03',
            'payment_method_id' => $method->id,
            'accounting_account_id' => $account->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('employee_ids');

        $this->postJson("/api/payroll-runs/{$payrollId}/submit")->assertOk()->assertJsonPath('data.status', 'pending_review');
        Sanctum::actingAs($manager);
        $this->postJson("/api/payroll-runs/{$payrollId}/review")->assertOk()->assertJsonPath('data.status', 'pending_approval');
        Sanctum::actingAs($admin);
        $approved = $this->postJson("/api/payroll-runs/{$payrollId}/approve")
            ->assertOk()->assertJsonPath('data.status', 'approved');

        $this->assertEquals(8200, (float) $account->fresh()->current_balance);
        $this->assertDatabaseHas('salary_advances', ['id' => $advanceId, 'status' => 'deducted', 'deducted_amount' => 500]);
        $this->assertDatabaseHas('employee_adjustments', ['id' => $adjustmentId, 'status' => 'applied']);
        $itemId = $approved->json('data.items.0.id');
        $this->getJson("/api/payroll-items/{$itemId}/payslip")
            ->assertOk()->assertJsonPath('data.payment_status', 'paid')->assertJsonPath('data.net_amount', '1300.00');

        $this->getJson('/api/hr/reports?from=2026-07-01&to=2026-07-02')
            ->assertOk()
            ->assertJsonPath('data.filters.from', '2026-07-01')
            ->assertJsonPath('data.filters.to', '2026-07-02')
            ->assertJsonPath('data.rows.0.employee_id', $employeeId)
            ->assertJsonPath('data.rows.0.present_days', 1)
            ->assertJsonPath('data.rows.0.absent_days', 1)
            ->assertJsonPath('data.rows.0.overtime_minutes', 60)
            ->assertJsonPath('data.rows.0.net_salary', 1300)
            ->assertJsonPath('data.rows.0.advance_balance', 0);
    }

    public function test_employee_self_service_leave_documents_and_attendance_preserve_history(): void
    {
        [$hr, $manager] = $this->workflowUsers();
        $employeeUser = User::factory()->create(['status' => 'active']);

        Sanctum::actingAs($hr);
        $employee = Employee::query()->create($this->employeePayload(null, [
            'user_id' => $employeeUser->id,
            'employee_number' => 'EMP-SELF',
            'created_by' => $hr->id,
            'updated_by' => $hr->id,
        ]));

        Storage::fake('public');
        $this->post('/api/employees/'.$employee->id.'/documents', [
            'document_type' => 'contract',
            'documents' => [UploadedFile::fake()->create('contract.pdf', 100, 'application/pdf')],
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.0.document_type', 'contract');

        Sanctum::actingAs($employeeUser);
        $leaveId = $this->postJson('/api/leave-requests', [
            'leave_type' => 'annual',
            'start_date' => '2026-07-06',
            'end_date' => '2026-07-07',
            'reason' => 'Family event',
        ])->assertCreated()->assertJsonPath('data.total_days', '2.00')->json('data.id');

        Sanctum::actingAs($manager);
        $this->postJson("/api/leave-requests/{$leaveId}/resolve", ['action' => 'approve'])
            ->assertOk()->assertJsonPath('data.status', 'approved');
        $this->assertDatabaseCount('attendance_records', 2);
        $this->assertTrue($employee->attendanceRecords()
            ->whereDate('attendance_date', '2026-07-06')
            ->where('attendance_status', 'leave')
            ->where('approval_status', 'approved')
            ->where('is_paid', true)
            ->exists());

        Sanctum::actingAs($employeeUser);
        $this->getJson('/api/hr/reports?from=2026-07-06&to=2026-07-06')
            ->assertForbidden();
        $this->getJson('/api/employees/me')->assertOk()->assertJsonPath('data.employee_number', 'EMP-SELF');
        $this->getJson('/api/leave-requests')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/employees')->assertForbidden();
    }

    public function test_employee_creation_atomically_creates_and_controls_login_credentials(): void
    {
        [, , $admin] = $this->workflowUsers();
        Role::findOrCreate('Technician', 'web');

        Sanctum::actingAs($admin);
        $employeeId = $this->postJson('/api/employees', $this->employeePayload(null, [
            'first_name' => 'Ahmad',
            'last_name' => 'Noori',
            'email' => 'ahmad.noori@example.com',
            'phone' => '0799001122',
            'login_enabled' => true,
            'login_password' => 'SecurePass123',
            'login_password_confirmation' => 'SecurePass123',
            'login_role' => 'Technician',
            'login_status' => 'active',
        ]))->assertCreated()
            ->assertJsonPath('data.full_name', 'Ahmad Noori')
            ->assertJsonPath('data.user.email', 'ahmad.noori@example.com')
            ->assertJsonPath('data.user.roles.0.name', 'Technician')
            ->json('data.id');

        $user = User::query()->where('email', 'ahmad.noori@example.com')->firstOrFail();
        $this->assertDatabaseHas('employees', ['id' => $employeeId, 'user_id' => $user->id]);
        $this->assertTrue($user->hasRole('Technician'));

        $this->postJson('/api/auth/login', [
            'email' => 'ahmad.noori@example.com',
            'password' => 'SecurePass123',
        ])->assertOk()->assertJsonPath('user.id', $user->id);

        Sanctum::actingAs($user);
        $this->getJson('/api/employees/me')
            ->assertOk()
            ->assertJsonPath('data.id', $employeeId)
            ->assertJsonPath('data.employee_number', 'EMP-00001');

        Sanctum::actingAs($admin);
        $this->postJson('/api/employees', $this->employeePayload(null, [
            'first_name' => 'Duplicate',
            'email' => 'ahmad.noori@example.com',
            'login_enabled' => true,
            'login_password' => 'SecurePass123',
            'login_password_confirmation' => 'SecurePass123',
            'login_role' => 'Technician',
            'login_status' => 'active',
        ]))->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->assertDatabaseCount('employees', 1);
        $this->assertDatabaseCount('users', 4);

        $this->putJson("/api/employees/{$employeeId}", $this->employeePayload(null, [
            'first_name' => 'Ahmad',
            'last_name' => 'Noori',
            'email' => 'ahmad.noori@example.com',
            'phone' => '0799001122',
            'login_enabled' => false,
        ]))->assertOk()->assertJsonPath('data.user.status', 'inactive');

        $this->postJson('/api/auth/login', [
            'email' => 'ahmad.noori@example.com',
            'password' => 'SecurePass123',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_payroll_can_be_generated_for_one_multiple_or_all_available_employees(): void
    {
        [$hr] = $this->workflowUsers();
        [$account, $method] = $this->cashSetup(50000);
        $accountantRole = Role::findOrCreate('Accountant', 'web');
        $accountant = User::factory()->create(['status' => 'active']);
        $accountant->assignRole($accountantRole);

        Sanctum::actingAs($hr);
        $employeeIds = collect([
            ['first_name' => 'Ahmad', 'last_name' => 'Karimi'],
            ['first_name' => 'Fatima', 'last_name' => 'Noori'],
            ['first_name' => 'Tamim', 'last_name' => 'Khan'],
        ])->map(fn (array $name): int => $this->postJson('/api/employees', $this->employeePayload(null, $name))
            ->assertCreated()
            ->json('data.id'));
        $this->seedApprovedAttendance($employeeIds->all(), '2026-07-01', '2026-07-10');

        $payload = [
            'title' => 'July Payroll',
            'period_start' => '2026-07-01',
            'period_end' => '2026-07-10',
            'payment_date' => '2026-07-10',
            'payment_method_id' => $method->id,
            'accounting_account_id' => $account->id,
        ];

        Sanctum::actingAs($accountant);
        $this->getJson('/api/employees')->assertForbidden();
        $this->getJson('/api/payroll-runs/eligible-employees?period_start=2026-07-01&period_end=2026-07-10')
            ->assertOk()
            ->assertJsonCount(3, 'data');

        $singlePayrollId = $this->postJson('/api/payroll-runs/generate', array_merge($payload, [
            'title' => 'Ahmad Payroll',
            'employee_ids' => [$employeeIds[0]],
        ]))->assertCreated()
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.employee_id', $employeeIds[0])
            ->json('data.id');

        $this->getJson('/api/payroll-runs/eligible-employees?period_start=2026-07-01&period_end=2026-07-10')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->postJson('/api/payroll-runs/generate', array_merge($payload, [
            'title' => 'Fatima and Tamim Payroll',
            'employee_ids' => [$employeeIds[1], $employeeIds[2]],
        ]))->assertCreated()
            ->assertJsonCount(2, 'data.items');

        $this->postJson('/api/payroll-runs/generate', array_merge($payload, [
            'title' => 'Duplicate Ahmad Payroll',
            'employee_ids' => [$employeeIds[0]],
        ]))->assertUnprocessable()->assertJsonValidationErrors('employee_ids');

        $this->deleteJson("/api/payroll-runs/{$singlePayrollId}")->assertOk();
        $this->postJson('/api/payroll-runs/generate', array_merge($payload, [
            'title' => 'All Remaining Employees',
        ]))->assertCreated()
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.employee_id', $employeeIds[0]);
    }

    public function test_fixed_salary_bonus_and_advance_produce_the_expected_net_salary(): void
    {
        [$hr] = $this->workflowUsers();
        [$account, $method] = $this->cashSetup(50000);

        Sanctum::actingAs($hr);
        $employeeId = $this->postJson('/api/employees', $this->employeePayload(null, [
            'first_name' => 'Ahmad',
            'last_name' => 'Khan',
            'hire_date' => '2026-07-22',
            'base_salary' => 10000,
            'work_days' => [1, 2, 3, 4, 5, 6, 7],
        ]))->assertCreated()->json('data.id');

        EmployeeAdjustment::query()->create([
            'employee_id' => $employeeId,
            'created_by' => $hr->id,
            'approved_by' => $hr->id,
            'adjustment_number' => EmployeeAdjustment::nextNumber(),
            'type' => 'bonus',
            'amount' => 500,
            'effective_date' => '2026-07-22',
            'status' => 'approved',
            'approved_at' => now(),
            'title' => 'Monthly performance bonus',
        ]);
        SalaryAdvance::query()->create([
            'employee_id' => $employeeId,
            'payment_method_id' => $method->id,
            'accounting_account_id' => $account->id,
            'created_by' => $hr->id,
            'approved_by' => $hr->id,
            'advance_number' => SalaryAdvance::nextNumber(),
            'amount' => 500,
            'deducted_amount' => 0,
            'payment_date' => '2026-07-22',
            'deduction_start_date' => '2026-07-22',
            'status' => 'approved',
            'approved_at' => now(),
            'reason' => 'Employee advance',
        ]);
        $this->seedApprovedAttendance([$employeeId], '2026-07-22', '2026-07-22');

        $payrollId = $this->postJson('/api/payroll-runs/generate', [
            'title' => 'Ahmad July Payroll',
            'period_start' => '2026-07-01',
            'period_end' => '2026-07-22',
            'payment_date' => '2026-07-22',
            'payment_method_id' => $method->id,
            'accounting_account_id' => $account->id,
            'employee_ids' => [$employeeId],
        ])->assertCreated()
            ->assertJsonPath('data.items.0.contracted_salary', '10000.00')
            ->assertJsonPath('data.items.0.base_salary', '10000.00')
            ->assertJsonPath('data.items.0.bonus', '500.00')
            ->assertJsonPath('data.items.0.advance_deduction', '500.00')
            ->assertJsonPath('data.items.0.net_amount', '10000.00')
            ->assertJsonPath('data.total_net', '10000.00')
            ->json('data.id');

        AttendanceRecord::query()
            ->where('employee_id', $employeeId)
            ->whereDate('attendance_date', '2026-07-22')
            ->update(['check_in' => '08:20', 'check_out' => '17:00', 'late_minutes' => 20, 'overtime_minutes' => 60]);
        $this->postJson("/api/payroll-runs/{$payrollId}/recalculate")
            ->assertOk()
            ->assertJsonPath('data.items.0.base_salary', '10000.00')
            ->assertJsonPath('data.items.0.late_minutes', 20)
            ->assertJsonPath('data.items.0.late_deduction', '13.44')
            ->assertJsonPath('data.items.0.overtime_hours', '1.00')
            ->assertJsonPath('data.items.0.overtime_amount', '41.67')
            ->assertJsonPath('data.items.0.net_amount', '10028.23')
            ->assertJsonPath('data.total_net', '10028.23');

        $this->postJson("/api/payroll-runs/{$payrollId}/submit")
            ->assertOk()
            ->assertJsonPath('data.status', 'pending_review');
        AttendanceRecord::query()
            ->where('employee_id', $employeeId)
            ->whereDate('attendance_date', '2026-07-22')
            ->update(['check_in' => '08:10', 'late_minutes' => 10]);
        $recalculated = $this->postJson("/api/payroll-runs/{$payrollId}/recalculate")
            ->assertOk()
            ->assertJsonPath('data.status', 'pending_review')
            ->assertJsonPath('data.total_overtime', '41.67')
            ->assertJsonPath('data.total_net', '10034.95');
        $this->assertDatabaseHas('accounting_transactions', [
            'id' => $recalculated->json('data.accounting_transaction_id'),
            'status' => 'pending_review',
            'amount' => 10034.95,
        ]);
    }

    private function seedApprovedAttendance(array $employeeIds, string $from, string $to): void
    {
        foreach ($employeeIds as $employeeId) {
            foreach (CarbonPeriod::create($from, $to) as $date) {
                if ($date->dayOfWeekIso === 7) {
                    continue;
                }

                AttendanceRecord::query()->create([
                    'employee_id' => $employeeId,
                    'attendance_date' => $date->toDateString(),
                    'check_in' => '08:00',
                    'check_out' => '16:00',
                    'attendance_status' => 'present',
                    'is_paid' => true,
                    'worked_minutes' => 480,
                    'late_minutes' => 0,
                    'overtime_minutes' => 0,
                    'source' => 'manual',
                    'approval_status' => 'approved',
                ]);
            }
        }
    }

    private function workflowUsers(): array
    {
        $users = [];
        foreach (['HR', 'Manager', 'Admin'] as $roleName) {
            $role = Role::findOrCreate($roleName, 'web');
            $user = User::factory()->create(['status' => 'active']);
            $user->assignRole($role);
            $users[] = $user;
        }

        return $users;
    }

    private function cashSetup(float $opening): array
    {
        $method = PaymentMethod::query()->firstOrCreate(['code' => 'cash'], ['name' => 'Cash', 'status' => 'active']);
        $account = AccountingAccount::query()->create([
            'name' => 'HR Cash', 'code' => 'hr_cash', 'type' => 'cash',
            'opening_balance' => $opening, 'current_balance' => $opening, 'status' => 'active',
        ]);

        return [$account, $method];
    }

    private function employeePayload(?int $positionId = null, array $overrides = []): array
    {
        return array_merge([
            'job_position_id' => $positionId,
            'first_name' => 'Ahmad',
            'last_name' => 'Karimi',
            'hire_date' => '2026-01-01',
            'employment_type' => 'permanent',
            'salary_type' => 'fixed',
            'base_salary' => 3000,
            'daily_rate' => 0,
            'overtime_hourly_rate' => 0,
            'standard_daily_hours' => 8,
            'work_start_time' => '08:00',
            'work_end_time' => '16:00',
            'work_days' => [1, 2, 3, 4, 5, 6],
            'status' => 'active',
        ], $overrides);
    }
}
