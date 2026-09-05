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

        $permissions = collect(['view', 'create', 'update', 'delete'])
            ->map(fn (string $action) => Permission::query()->firstOrCreate([
                'name' => "attendance-devices.{$action}",
                'guard_name' => 'web',
            ]));

        Role::query()
            ->where('guard_name', 'web')
            ->whereIn('name', ['Admin', 'Super Admin', 'Manager', 'HR'])
            ->get()
            ->each(fn (Role $role) => $role->givePermissionTo($permissions));

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        $permissions = Permission::query()
            ->where('guard_name', 'web')
            ->where('name', 'like', 'attendance-devices.%')
            ->get();

        Role::query()
            ->where('guard_name', 'web')
            ->get()
            ->each(fn (Role $role) => $role->revokePermissionTo($permissions));

        $permissions->each->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
