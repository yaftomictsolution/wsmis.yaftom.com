<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\EmployeeLeaveBalance;
use App\Models\LeavePolicy;
use App\Models\User;
use App\Services\LeaveBalanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class LeaveSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_manage_simple_leave_settings_without_losing_balance_adjustments(): void
    {
        $admin = $this->userWithRole('Admin');
        $hr = $this->userWithRole('HR');
        $employee = Employee::query()->create([
            'employee_number' => 'EMP-LEAVE-01',
            'first_name' => 'Tamim',
            'last_name' => 'Khan',
            'hire_date' => '2026-07-20',
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
        ]);
        $annual = LeavePolicy::query()->where('code', 'annual')->firstOrFail();
        $balance = app(LeaveBalanceService::class)->ensure($employee, $annual, 2026);
        $balance->update(['adjustment_days' => 10, 'notes' => 'Opening HR correction']);

        Sanctum::actingAs($hr);
        $this->getJson('/api/settings/leave')->assertForbidden();
        $this->putJson('/api/settings/leave', [
            'annual_leave_days' => 24,
            'carry_forward_days' => 4,
            'sick_leave_days' => 12,
            'emergency_leave_days' => 6,
        ])->assertForbidden();

        Sanctum::actingAs($admin);
        $this->getJson('/api/settings/leave')
            ->assertOk()
            ->assertJsonPath('data.annual_leave_days', 20)
            ->assertJsonPath('data.carry_forward_days', 5);
        $this->putJson('/api/settings/leave', [
            'annual_leave_days' => 24,
            'carry_forward_days' => 4,
            'sick_leave_days' => 12,
            'emergency_leave_days' => 6,
        ])->assertOk()
            ->assertJsonPath('data.annual_leave_days', 24)
            ->assertJsonPath('data.sick_leave_days', 12);

        $annualBalance = EmployeeLeaveBalance::query()
            ->where('employee_id', $employee->id)
            ->where('leave_policy_id', $annual->id)
            ->where('year', 2026)
            ->firstOrFail();
        $this->assertSame(12.0, (float) $annualBalance->entitlement_days);
        $this->assertSame(10.0, (float) $annualBalance->adjustment_days);
        $this->assertSame('Opening HR correction', $annualBalance->notes);
        $this->assertSame(6.0, (float) $this->balanceFor($employee, 'sick')->entitlement_days);
        $this->assertSame(3.0, (float) $this->balanceFor($employee, 'emergency')->entitlement_days);
        $this->assertDatabaseHas('leave_policies', ['code' => 'other', 'status' => 'inactive']);
        $this->assertDatabaseHas('leave_policies', ['code' => 'unpaid', 'status' => 'active', 'tracks_balance' => false]);

        $this->putJson('/api/settings/leave', [
            'annual_leave_days' => 3,
            'carry_forward_days' => 4,
            'sick_leave_days' => 12,
            'emergency_leave_days' => 6,
        ])->assertUnprocessable()->assertJsonValidationErrors('carry_forward_days');
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole(Role::findOrCreate($role, 'web'));

        return $user;
    }

    private function balanceFor(Employee $employee, string $policyCode): EmployeeLeaveBalance
    {
        $policy = LeavePolicy::query()->where('code', $policyCode)->firstOrFail();

        return EmployeeLeaveBalance::query()
            ->where('employee_id', $employee->id)
            ->where('leave_policy_id', $policy->id)
            ->where('year', 2026)
            ->firstOrFail();
    }
}
