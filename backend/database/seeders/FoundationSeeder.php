<?php

namespace Database\Seeders;

use App\Models\AccountingAccount;
use App\Models\BillingPeriod;
use App\Models\FinancialCategory;
use App\Models\PaymentMethod;
use App\Models\ServiceArea;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class FoundationSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $modules = [
            'dashboard', 'users', 'roles', 'settings',
            'service-areas', 'customers', 'customer-contracts', 'customer-deposits',
            'meters', 'meter-assignments', 'billing-periods', 'meter-readings', 'invoices', 'payments',
            'accounting', 'finance-transactions', 'expenses', 'expense-types',
            'suppliers', 'assets', 'asset-purchases', 'warehouses', 'inventory', 'goods',
            'employees', 'attendance', 'leave-requests', 'leave-policies', 'work-schedules',
            'salary-advances', 'employee-adjustments', 'performance-reviews',
            'payroll', 'payroll-deductions', 'employee-terminations', 'biometric-imports',
            'shareholders', 'reconciliation', 'financial-closing', 'financial-reports', 'reports',
        ];

        foreach ($modules as $module) {
            foreach (['view', 'create', 'update', 'delete'] as $action) {
                Permission::query()->firstOrCreate([
                    'name' => "{$module}.{$action}",
                    'guard_name' => 'web',
                ]);
            }
        }

        $roleModules = [
            'Manager' => array_values(array_diff($modules, ['roles'])),
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
                'biometric-imports', 'reports',
            ],
            'Meter Reader' => [
                'dashboard', 'service-areas', 'customers', 'meters', 'meter-assignments',
                'billing-periods', 'meter-readings',
            ],
            'Collector' => [
                'dashboard', 'customers', 'customer-contracts', 'customer-deposits',
                'invoices', 'payments',
            ],
            'Warehouse Officer' => [
                'dashboard', 'suppliers', 'warehouses', 'inventory', 'goods', 'assets',
            ],
            'Technician' => [
                'dashboard', 'customers', 'meters', 'meter-assignments', 'assets', 'inventory',
            ],
            'Viewer' => ['dashboard', 'reports'],
        ];

        $adminRole = Role::findOrCreate('Admin', 'web');
        $adminRole->syncPermissions(Permission::query()->get());
        foreach ($roleModules as $roleName => $allowedModules) {
            $role = Role::findOrCreate($roleName, 'web');
            $role->syncPermissions(
                Permission::query()
                    ->where(function ($query) use ($allowedModules): void {
                        foreach ($allowedModules as $module) {
                            $query->orWhere('name', 'like', "{$module}.%");
                        }
                    })
                    ->get(),
            );
        }

        $users = [
            ['name' => 'WaterNet Admin', 'email' => 'admin@waternet.local', 'phone' => '0799000000', 'role' => 'Admin'],
            ['name' => 'Nadia Safi', 'email' => 'manager@waternet.local', 'phone' => '0799000001', 'role' => 'Manager'],
            ['name' => 'Laila Rahimi', 'email' => 'accountant@waternet.local', 'phone' => '0799000002', 'role' => 'Accountant'],
            ['name' => 'Maryam Habibi', 'email' => 'hr@waternet.local', 'phone' => '0799000003', 'role' => 'HR'],
            ['name' => 'Ahmad Karimi', 'email' => 'technician@waternet.local', 'phone' => '0799000004', 'role' => 'Technician'],
            ['name' => 'Omid Azizi', 'email' => 'reader@waternet.local', 'phone' => '0799000005', 'role' => 'Meter Reader'],
            ['name' => 'Farzana Noori', 'email' => 'collector@waternet.local', 'phone' => '0799000006', 'role' => 'Collector'],
            ['name' => 'Habib Wardak', 'email' => 'warehouse@waternet.local', 'phone' => '0799000007', 'role' => 'Warehouse Officer'],
            ['name' => 'Report Viewer', 'email' => 'viewer@waternet.local', 'phone' => '0799000008', 'role' => 'Viewer'],
        ];
        foreach ($users as $record) {
            $user = User::query()->updateOrCreate(
                ['email' => $record['email']],
                [
                    'name' => $record['name'],
                    'phone' => $record['phone'],
                    'password' => 'password',
                    'status' => 'active',
                ],
            );
            $user->syncRoles([$record['role']]);
        }

        SystemSetting::query()->updateOrCreate(
            ['key' => 'system_profile'],
            ['value' => [
                'company_name' => 'WaterNet MIS',
                'system_name' => 'Water Supply Management Information System',
                'currency' => 'AFN',
                'language' => 'en',
                'phone' => '0799000000',
                'address' => 'Kabul, Afghanistan',
            ]],
        );

        foreach ([
            ['name' => 'Cash', 'code' => 'cash'],
            ['name' => 'Bank Transfer', 'code' => 'bank_transfer'],
            ['name' => 'Mobile Money', 'code' => 'mobile_money'],
            ['name' => 'Check', 'code' => 'check'],
            ['name' => 'Online Payment', 'code' => 'online_payment'],
        ] as $method) {
            PaymentMethod::query()->updateOrCreate(
                ['code' => $method['code']],
                $method + ['status' => 'active'],
            );
        }

        foreach ([
            ['name' => 'Water Bill Income', 'code' => 'water_bill_income', 'type' => 'income'],
            ['name' => 'Connection Fee Income', 'code' => 'connection_fee_income', 'type' => 'income'],
            ['name' => 'Meter Fee Income', 'code' => 'meter_fee_income', 'type' => 'income'],
            ['name' => 'Service Income', 'code' => 'service_income', 'type' => 'income'],
            ['name' => 'Late Payment Penalty', 'code' => 'late_payment_penalty', 'type' => 'income'],
            ['name' => 'Salary Expense', 'code' => 'salary_expense', 'type' => 'expense'],
            ['name' => 'Office Rent', 'code' => 'office_rent', 'type' => 'expense'],
            ['name' => 'Fuel Expense', 'code' => 'fuel_expense', 'type' => 'expense'],
            ['name' => 'Electricity Expense', 'code' => 'electricity_expense', 'type' => 'expense'],
            ['name' => 'Maintenance Expense', 'code' => 'maintenance_expense', 'type' => 'expense'],
            ['name' => 'Asset Purchase', 'code' => 'asset_purchase', 'type' => 'expense'],
        ] as $category) {
            FinancialCategory::query()->updateOrCreate(
                ['code' => $category['code']],
                $category + ['status' => 'active'],
            );
        }

        foreach ([
            [
                'name' => 'Main Cash Account', 'code' => 'cash_on_hand', 'type' => 'cash',
                'opening_balance' => 500000, 'notes' => 'Counter collections and daily cash expenses.',
            ],
            [
                'name' => 'Operating Bank Account', 'code' => 'bank_account', 'type' => 'bank',
                'opening_balance' => 1500000, 'notes' => 'Primary bank account for payroll and major purchases.',
            ],
            [
                'name' => 'Mobile Money Wallet', 'code' => 'mobile_wallet', 'type' => 'mobile_money',
                'opening_balance' => 100000, 'notes' => 'Mobile-money customer collections.',
            ],
        ] as $account) {
            AccountingAccount::query()->updateOrCreate(
                ['code' => $account['code']],
                $account + [
                    'current_balance' => $account['opening_balance'],
                    'status' => 'active',
                ],
            );
        }

        foreach ([
            [
                'name' => 'Karte Parwan Zone', 'mosque_name' => 'Omar Mosque', 'district' => 'District 4',
                'street_block_village' => 'Block A', 'representative_name' => 'Ahmad Zia',
                'representative_phone' => '0788000000', 'households_count' => 120, 'rate_per_cubic_meter' => 65,
            ],
            [
                'name' => 'Khair Khana Zone', 'mosque_name' => 'Bilal Mosque', 'district' => 'District 11',
                'street_block_village' => 'Street 7', 'representative_name' => 'Karim Shah',
                'representative_phone' => '0788111222', 'households_count' => 95, 'rate_per_cubic_meter' => 70,
            ],
            [
                'name' => 'Dasht-e-Barchi Zone', 'mosque_name' => 'Rahman Mosque', 'district' => 'District 13',
                'street_block_village' => 'Block C', 'representative_name' => 'Samiullah Wardak',
                'representative_phone' => '0788222333', 'households_count' => 110, 'rate_per_cubic_meter' => 60,
            ],
        ] as $area) {
            ServiceArea::query()->updateOrCreate(
                ['name' => $area['name']],
                $area + ['status' => 'active'],
            );
        }

        foreach ([
            ['name' => 'April 2026', 'code' => '2026-04', 'starts_on' => '2026-04-01', 'ends_on' => '2026-04-30', 'status' => 'closed'],
            ['name' => 'May 2026', 'code' => '2026-05', 'starts_on' => '2026-05-01', 'ends_on' => '2026-05-31', 'status' => 'locked', 'locked_at' => '2026-06-01 08:00:00'],
            ['name' => 'June 2026', 'code' => '2026-06', 'starts_on' => '2026-06-01', 'ends_on' => '2026-06-30', 'status' => 'closed'],
        ] as $period) {
            BillingPeriod::query()->updateOrCreate(['code' => $period['code']], $period);
        }
    }
}
