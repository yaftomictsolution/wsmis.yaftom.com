<?php

namespace Tests\Feature;

use Database\Seeders\PermissionCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PermissionCatalogSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_permission_catalog_and_standard_role_mappings_are_restored(): void
    {
        $this->seed(PermissionCatalogSeeder::class);

        $expectedCount = count(PermissionCatalogSeeder::MODULES) * 4;
        $this->assertSame($expectedCount, Permission::query()->where('guard_name', 'web')->count());

        $admin = Role::findByName('Admin', 'web');
        $this->assertCount($expectedCount, $admin->permissions);
        $this->assertTrue($admin->hasPermissionTo('authorities.create'));

        $manager = Role::findByName('Manager', 'web');
        $this->assertTrue($manager->hasPermissionTo('authorities.view'));
        $this->assertFalse($manager->hasPermissionTo('roles.update'));

        $viewer = Role::findByName('Viewer', 'web');
        $this->assertTrue($viewer->hasPermissionTo('reports.view'));
        $this->assertFalse($viewer->hasPermissionTo('customers.view'));

        $meterAssigner = Role::findByName('Meter Assigner', 'web');
        $this->assertTrue($meterAssigner->hasPermissionTo('meter-assignments.create'));
        $this->assertTrue($meterAssigner->hasPermissionTo('meters.view'));
        $this->assertFalse($meterAssigner->hasPermissionTo('meters.delete'));
        $this->assertFalse($meterAssigner->hasPermissionTo('customers.delete'));
        $this->assertFalse($meterAssigner->hasPermissionTo('meter-assignments.delete'));
    }
}
