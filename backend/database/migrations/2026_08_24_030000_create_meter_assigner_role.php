<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $role = Role::findOrCreate('Meter Assigner', 'web');
        $permissions = [
            'dashboard.view',
            'customers.view',
            'meters.view',
            'meter-assignments.view',
            'meter-assignments.create',
            'meter-assignments.update',
        ];

        foreach ($permissions as $permissionName) {
            $role->givePermissionTo(Permission::findOrCreate($permissionName, 'web'));
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        Role::query()
            ->where('name', 'Meter Assigner')
            ->where('guard_name', 'web')
            ->first()?->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
