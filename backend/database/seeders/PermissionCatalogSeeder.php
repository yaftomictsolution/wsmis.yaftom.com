<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class PermissionCatalogSeeder extends Seeder
{
    public const MODULES = [
        'dashboard', 'users', 'roles', 'settings',
        'service-areas', 'authorities', 'customers', 'customer-contracts', 'customer-deposits',
        'meters', 'meter-assignments', 'billing-periods', 'meter-readings', 'invoices', 'payments',
        'accounting', 'finance-transactions', 'expenses', 'expense-types',
        'suppliers', 'assets', 'asset-purchases', 'warehouses', 'inventory', 'goods',
        'employees', 'attendance', 'leave-requests', 'leave-policies', 'work-schedules',
        'salary-advances', 'employee-adjustments', 'performance-reviews',
        'payroll', 'payroll-deductions', 'employee-terminations', 'biometric-imports', 'attendance-devices',
        'shareholders', 'reconciliation', 'financial-closing', 'financial-reports', 'reports',
    ];

    private const ACTIONS = ['view', 'create', 'update', 'delete'];

    private const ROLE_MODULES = [
        'Manager' => [
            'dashboard', 'users', 'settings', 'service-areas', 'authorities', 'customers',
            'customer-contracts', 'customer-deposits', 'meters', 'meter-assignments',
            'billing-periods', 'meter-readings', 'invoices', 'payments', 'accounting',
            'finance-transactions', 'expenses', 'expense-types', 'suppliers', 'assets',
            'asset-purchases', 'warehouses', 'inventory', 'goods', 'employees', 'attendance',
            'leave-requests', 'leave-policies', 'work-schedules', 'salary-advances',
            'employee-adjustments', 'performance-reviews', 'payroll', 'payroll-deductions',
            'employee-terminations', 'biometric-imports', 'attendance-devices', 'shareholders', 'reconciliation',
            'financial-closing', 'financial-reports', 'reports',
        ],
        'Accountant' => [
            'dashboard', 'customers', 'customer-contracts', 'customer-deposits', 'invoices', 'payments',
            'accounting', 'finance-transactions', 'expenses', 'expense-types', 'suppliers',
            'assets', 'asset-purchases', 'payroll', 'salary-advances', 'shareholders',
            'reconciliation', 'financial-closing', 'financial-reports', 'reports',
        ],
        'HR' => [
            'dashboard', 'users', 'service-areas', 'employees', 'attendance', 'leave-requests',
            'leave-policies', 'work-schedules', 'salary-advances', 'employee-adjustments',
            'performance-reviews', 'payroll', 'payroll-deductions', 'employee-terminations',
            'biometric-imports', 'attendance-devices', 'reports',
        ],
        'Meter Reader' => [
            'dashboard', 'service-areas', 'customers', 'meters', 'meter-assignments',
            'billing-periods', 'meter-readings',
        ],
        'Collector' => [
            'dashboard', 'customers', 'customer-contracts', 'customer-deposits', 'invoices', 'payments',
        ],
        'Warehouse Officer' => [
            'dashboard', 'suppliers', 'warehouses', 'inventory', 'goods', 'assets',
        ],
        'Technician' => [
            'dashboard', 'customers', 'meters', 'meter-assignments', 'assets', 'inventory',
        ],
        'Viewer' => ['dashboard', 'reports'],
    ];

    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (self::MODULES as $module) {
            foreach (self::ACTIONS as $action) {
                Permission::query()->firstOrCreate([
                    'name' => "{$module}.{$action}",
                    'guard_name' => 'web',
                ]);
            }
        }

        $allPermissions = Permission::query()->where('guard_name', 'web')->get();
        Role::findOrCreate('Admin', 'web')->syncPermissions($allPermissions);

        Role::query()
            ->where('guard_name', 'web')
            ->where('name', 'Super Admin')
            ->get()
            ->each(fn (Role $role) => $role->syncPermissions($allPermissions));

        foreach (self::ROLE_MODULES as $roleName => $modules) {
            $role = Role::findOrCreate($roleName, 'web');
            $role->syncPermissions(
                Permission::query()
                    ->where('guard_name', 'web')
                    ->where(function ($query) use ($modules): void {
                        foreach ($modules as $module) {
                            $query->orWhere('name', 'like', "{$module}.%");
                        }
                    })
                    ->get(),
            );
        }

        Role::findOrCreate('Meter Assigner', 'web')->syncPermissions(
            Permission::query()
                ->where('guard_name', 'web')
                ->whereIn('name', [
                    'dashboard.view',
                    'customers.view',
                    'meters.view',
                    'meter-assignments.view',
                    'meter-assignments.create',
                    'meter-assignments.update',
                ])
                ->get(),
        );

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
