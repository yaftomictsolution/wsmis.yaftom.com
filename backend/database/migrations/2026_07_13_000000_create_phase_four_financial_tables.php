<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_runs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('accounting_account_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('payment_method_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('financial_category_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('accounting_transaction_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('payroll_number')->unique();
            $table->string('title');
            $table->date('period_start');
            $table->date('period_end');
            $table->date('payment_date');
            $table->decimal('total_base_salary', 16, 2)->default(0);
            $table->decimal('total_bonus', 16, 2)->default(0);
            $table->decimal('total_overtime', 16, 2)->default(0);
            $table->decimal('total_advance_deduction', 16, 2)->default(0);
            $table->decimal('total_other_deduction', 16, 2)->default(0);
            $table->decimal('total_net', 16, 2)->default(0);
            $table->string('status')->default('draft');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['period_start', 'period_end']);
            $table->index(['status', 'payment_date']);
        });

        Schema::create('payroll_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('payroll_run_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('employee_name');
            $table->decimal('base_salary', 16, 2)->default(0);
            $table->decimal('bonus', 16, 2)->default(0);
            $table->decimal('overtime_amount', 16, 2)->default(0);
            $table->decimal('advance_deduction', 16, 2)->default(0);
            $table->decimal('other_deduction', 16, 2)->default(0);
            $table->decimal('net_amount', 16, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['payroll_run_id', 'user_id']);
        });

        Schema::create('shareholders', function (Blueprint $table): void {
            $table->id();
            $table->string('shareholder_number')->unique();
            $table->string('name');
            $table->string('father_name')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->decimal('investment_amount', 16, 2)->default(0);
            $table->decimal('ownership_percentage', 7, 4);
            $table->date('joined_on')->nullable();
            $table->string('status')->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['status', 'ownership_percentage']);
        });

        Schema::create('financial_period_closings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('prepared_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reopened_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('period_code')->unique();
            $table->date('period_start');
            $table->date('period_end');
            $table->decimal('total_income', 16, 2)->default(0);
            $table->decimal('total_expense', 16, 2)->default(0);
            $table->decimal('payroll_expense', 16, 2)->default(0);
            $table->decimal('net_income', 16, 2)->default(0);
            $table->decimal('receivables', 16, 2)->default(0);
            $table->decimal('supplier_payables', 16, 2)->default(0);
            $table->decimal('cash_balance', 16, 2)->default(0);
            $table->decimal('bank_balance', 16, 2)->default(0);
            $table->decimal('distributable_profit', 16, 2)->default(0);
            $table->boolean('reconciliation_complete')->default(false);
            $table->string('status')->default('draft');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('reopened_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->text('reopen_reason')->nullable();
            $table->json('report_snapshot')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['status', 'period_end']);
        });

        Schema::create('shareholder_distributions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('financial_period_closing_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('distribution_number')->unique();
            $table->decimal('distributable_amount', 16, 2);
            $table->decimal('allocated_amount', 16, 2)->default(0);
            $table->decimal('paid_amount', 16, 2)->default(0);
            $table->string('status')->default('draft');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('shareholder_distribution_items', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('shareholder_distribution_id');
            $table->foreign('shareholder_distribution_id', 'distribution_items_distribution_fk')->references('id')->on('shareholder_distributions')->cascadeOnDelete();
            $table->foreignId('shareholder_id')->constrained()->restrictOnDelete();
            $table->decimal('percentage_snapshot', 7, 4);
            $table->decimal('entitlement_amount', 16, 2);
            $table->decimal('paid_amount', 16, 2)->default(0);
            $table->string('status')->default('pending');
            $table->timestamps();

            $table->unique(['shareholder_distribution_id', 'shareholder_id'], 'shareholder_distribution_item_unique');
        });

        Schema::create('shareholder_payments', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('shareholder_distribution_item_id');
            $table->foreign('shareholder_distribution_item_id', 'shareholder_payments_item_fk')->references('id')->on('shareholder_distribution_items')->restrictOnDelete();
            $table->foreignId('accounting_account_id')->constrained()->restrictOnDelete();
            $table->foreignId('payment_method_id')->constrained()->restrictOnDelete();
            $table->foreignId('accounting_transaction_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('payment_number')->unique();
            $table->decimal('amount', 16, 2);
            $table->date('payment_date');
            $table->string('receipt_number')->nullable();
            $table->string('status')->default('pending_review');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['status', 'payment_date']);
        });

        Schema::create('account_reconciliations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('accounting_account_id')->constrained()->restrictOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reconciliation_number')->unique();
            $table->date('period_start');
            $table->date('period_end');
            $table->decimal('book_balance', 16, 2);
            $table->decimal('statement_balance', 16, 2);
            $table->decimal('adjusted_statement_balance', 16, 2);
            $table->decimal('difference', 16, 2);
            $table->string('status')->default('draft');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['accounting_account_id', 'period_end'], 'account_reconciliation_period_unique');
            $table->index(['status', 'period_end']);
        });

        Schema::create('account_reconciliation_items', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('account_reconciliation_id');
            $table->foreign('account_reconciliation_id', 'reconciliation_items_parent_fk')->references('id')->on('account_reconciliations')->cascadeOnDelete();
            $table->string('kind');
            $table->string('direction');
            $table->string('description');
            $table->string('reference')->nullable();
            $table->decimal('amount', 16, 2);
            $table->boolean('cleared')->default(false);
            $table->timestamps();
        });

        $now = now();
        foreach ([
            ['name' => 'Salary Expense', 'code' => 'salary_expense', 'type' => 'expense'],
            ['name' => 'Shareholder Distribution', 'code' => 'shareholder_distribution', 'type' => 'expense'],
        ] as $category) {
            DB::table('financial_categories')->updateOrInsert(
                ['code' => $category['code']],
                $category + ['status' => 'active', 'created_at' => $now, 'updated_at' => $now],
            );
        }

        $modules = ['finance-transactions', 'payroll', 'shareholders', 'reconciliation', 'financial-closing', 'financial-reports'];
        foreach ($modules as $module) {
            foreach (['view', 'create', 'update', 'delete'] as $action) {
                DB::table('permissions')->insertOrIgnore([
                    'name' => "{$module}.{$action}",
                    'guard_name' => 'web',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        $rolePermissions = [
            'Admin' => $modules,
            'Manager' => $modules,
            'Accountant' => $modules,
        ];

        foreach ($rolePermissions as $roleName => $roleModules) {
            $roleId = DB::table('roles')->where('name', $roleName)->where('guard_name', 'web')->value('id');
            if (!$roleId) {
                continue;
            }

            $permissionIds = DB::table('permissions')
                ->whereIn('name', collect($roleModules)->flatMap(
                    fn (string $module): array => collect(['view', 'create', 'update', 'delete'])
                        ->map(fn (string $action): string => "{$module}.{$action}")
                        ->all(),
                ))
                ->pluck('id');

            foreach ($permissionIds as $permissionId) {
                DB::table('role_has_permissions')->insertOrIgnore([
                    'permission_id' => $permissionId,
                    'role_id' => $roleId,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('account_reconciliation_items');
        Schema::dropIfExists('account_reconciliations');
        Schema::dropIfExists('shareholder_payments');
        Schema::dropIfExists('shareholder_distribution_items');
        Schema::dropIfExists('shareholder_distributions');
        Schema::dropIfExists('financial_period_closings');
        Schema::dropIfExists('shareholders');
        Schema::dropIfExists('payroll_items');
        Schema::dropIfExists('payroll_runs');

        $permissionNames = collect(['finance-transactions', 'payroll', 'shareholders', 'reconciliation', 'financial-closing', 'financial-reports'])
            ->flatMap(fn (string $module): array => collect(['view', 'create', 'update', 'delete'])
                ->map(fn (string $action): string => "{$module}.{$action}")
                ->all());
        $permissionIds = DB::table('permissions')->whereIn('name', $permissionNames)->pluck('id');
        DB::table('role_has_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('model_has_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();
    }
};
