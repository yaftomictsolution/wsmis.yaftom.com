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

        foreach (['customer-contracts', 'customer-deposits'] as $module) {
            foreach (['view', 'create', 'update', 'delete'] as $action) {
                Permission::query()->firstOrCreate([
                    'name' => "{$module}.{$action}",
                    'guard_name' => 'web',
                ]);
            }
        }

        $all = Permission::query()->whereIn('name', $this->allPermissions())->get();
        foreach (['Admin', 'Super Admin'] as $roleName) {
            Role::query()->where('name', $roleName)->where('guard_name', 'web')->first()?->givePermissionTo($all);
        }

        $manager = Role::query()->where('name', 'Manager')->where('guard_name', 'web')->first();
        $manager?->givePermissionTo($all);

        $financePermissions = Permission::query()->whereIn('name', [
            'customer-contracts.view',
            'customer-deposits.view',
            'customer-deposits.create',
            'customer-deposits.update',
        ])->get();
        foreach (['Accountant', 'Collector'] as $roleName) {
            Role::query()->where('name', $roleName)->where('guard_name', 'web')->first()?->givePermissionTo($financePermissions);
        }

        $contractView = Permission::query()->where('name', 'customer-contracts.view')->first();
        if ($contractView) {
            Role::query()->whereIn('name', ['Technician', 'Meter Reader'])->where('guard_name', 'web')->get()
                ->each(fn (Role $role) => $role->givePermissionTo($contractView));
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    private function allPermissions(): array
    {
        return [
            'customer-contracts.view', 'customer-contracts.create', 'customer-contracts.update', 'customer-contracts.delete',
            'customer-deposits.view', 'customer-deposits.create', 'customer-deposits.update', 'customer-deposits.delete',
        ];
    }

    public function down(): void
    {
        Permission::query()->whereIn('name', $this->allPermissions())->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
