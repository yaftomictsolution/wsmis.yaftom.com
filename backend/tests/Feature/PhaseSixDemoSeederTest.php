<?php

namespace Tests\Feature;

use App\Models\AccountingAccount;
use App\Models\BiometricImportBatch;
use App\Models\Employee;
use App\Models\EmployeeTermination;
use App\Models\PayrollRun;
use App\Models\SalaryAdvance;
use App\Models\User;
use Database\Seeders\FoundationSeeder;
use Database\Seeders\PhaseSixDemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PhaseSixDemoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_phase_six_demo_data_reconciles_every_workflow(): void
    {
        $this->seed(FoundationSeeder::class);
        $this->seed(PhaseSixDemoSeeder::class);

        $this->assertDatabaseCount('employees', 5);
        $this->assertSame(4, Employee::query()->where('status', 'active')->count());
        $this->assertDatabaseHas('employees', ['employee_number' => 'EMP-00005', 'status' => 'terminated']);
        $this->assertDatabaseHas('users', ['email' => 'farid.safi@waternet.local', 'status' => 'inactive']);
        $this->assertDatabaseHas('leave_requests', ['status' => 'approved']);
        $this->assertDatabaseHas('leave_requests', ['status' => 'pending']);
        $this->assertDatabaseHas('leave_requests', ['status' => 'rejected']);
        $this->assertDatabaseCount('employee_shift_assignments', 5);
        $this->assertDatabaseCount('public_holidays', 2);
        $this->assertDatabaseCount('payroll_deduction_rules', 2);
        $this->assertDatabaseCount('employee_payroll_deductions', 7);
        $this->assertSame(2, BiometricImportBatch::query()->firstOrFail()->attendanceRecords()->where('approval_status', 'pending')->count());

        $payroll = PayrollRun::query()->firstOrFail();
        $termination = EmployeeTermination::query()->firstOrFail();
        $advance = SalaryAdvance::query()->firstOrFail();
        $account = AccountingAccount::query()->where('code', 'payroll_bank')->firstOrFail();

        $this->assertSame('approved', $payroll->status);
        $this->assertSame(5, $payroll->items()->count());
        $this->assertGreaterThan(0, (float) $payroll->total_tax_deduction);
        $this->assertGreaterThan(0, (float) $payroll->total_recurring_deduction);
        $this->assertSame('approved', $termination->status);
        $this->assertEquals(3000, (float) $termination->advance_recovery);
        $this->assertEquals(3000, (float) $advance->deducted_amount);
        $this->assertSame('deducted', $advance->status);
        $this->assertEqualsWithDelta(
            (float) $account->opening_balance
                - (float) $payroll->total_net
                - (float) $advance->amount
                - (float) $termination->net_settlement,
            (float) $account->current_balance,
            0.01,
        );

        $hr = User::query()->where('email', 'hr@waternet.local')->firstOrFail();
        $manager = User::query()->where('email', 'manager@waternet.local')->firstOrFail();
        $this->assertTrue($hr->hasRole('HR'));
        $this->assertTrue($hr->can('leave-policies.create'));
        $this->assertTrue($manager->can('employee-terminations.update'));
        $this->postJson('/api/auth/login', ['email' => 'hr@waternet.local', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('user.roles.0', 'HR');
    }
}
