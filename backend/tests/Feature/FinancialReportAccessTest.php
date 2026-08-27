<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class FinancialReportAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_custom_role_with_view_permission_can_load_financial_reports(): void
    {
        $permission = Permission::findOrCreate('financial-reports.view', 'web');
        $auditorRole = Role::findOrCreate('Auditor', 'web');
        $auditorRole->givePermissionTo($permission);
        $auditor = User::factory()->create(['status' => 'active']);
        $auditor->assignRole($auditorRole);

        Sanctum::actingAs($auditor);

        $this->getJson('/api/financial-reports?from=2026-07-01&to=2026-07-31')
            ->assertOk()
            ->assertJsonPath('data.filters.from', '2026-07-01')
            ->assertJsonPath('data.filters.to', '2026-07-31');
    }

    public function test_a_user_without_a_financial_report_role_or_permission_is_forbidden(): void
    {
        $meterAssigner = User::factory()->create(['status' => 'active']);
        $meterAssigner->assignRole(Role::findOrCreate('Meter Assigner', 'web'));

        Sanctum::actingAs($meterAssigner);

        $this->getJson('/api/financial-reports?from=2026-07-01&to=2026-07-31')
            ->assertForbidden()
            ->assertJsonPath('message', 'You cannot view financial reports.');
    }
}
