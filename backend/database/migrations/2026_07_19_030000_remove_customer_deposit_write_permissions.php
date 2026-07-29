<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    private const WRITE_PERMISSIONS = [
        'customer-deposits.create',
        'customer-deposits.update',
        'customer-deposits.delete',
    ];

    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        Permission::query()
            ->whereIn('name', self::WRITE_PERMISSIONS)
            ->where('guard_name', 'web')
            ->get()
            ->each(fn (Permission $permission) => $permission->delete());

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permissions = collect(self::WRITE_PERMISSIONS)
            ->map(fn (string $name) => Permission::query()->firstOrCreate([
                'name' => $name,
                'guard_name' => 'web',
            ]));

        Role::query()
            ->whereIn('name', ['Admin', 'Super Admin', 'Manager'])
            ->where('guard_name', 'web')
            ->get()
            ->each(fn (Role $role) => $role->givePermissionTo($permissions));

        $financePermissions = $permissions->whereIn('name', [
            'customer-deposits.create',
            'customer-deposits.update',
        ]);
        Role::query()
            ->whereIn('name', ['Accountant', 'Collector'])
            ->where('guard_name', 'web')
            ->get()
            ->each(fn (Role $role) => $role->givePermissionTo($financePermissions));

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
