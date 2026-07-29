<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leave_policies', function (Blueprint $table): void {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->decimal('days_per_year', 6, 2)->default(0);
            $table->boolean('is_paid')->default(true);
            $table->boolean('tracks_balance')->default(true);
            $table->decimal('carry_forward_limit', 6, 2)->default(0);
            $table->decimal('max_consecutive_days', 6, 2)->nullable();
            $table->decimal('attachment_after_days', 6, 2)->nullable();
            $table->boolean('payout_on_termination')->default(false);
            $table->string('status')->default('active');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('employee_leave_balances', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('leave_policy_id')->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('year');
            $table->decimal('entitlement_days', 6, 2)->default(0);
            $table->decimal('carried_forward_days', 6, 2)->default(0);
            $table->decimal('adjustment_days', 6, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['employee_id', 'leave_policy_id', 'year'], 'employee_policy_year_unique');
        });

        Schema::create('public_holidays', function (Blueprint $table): void {
            $table->id();
            $table->date('holiday_date')->unique();
            $table->string('name');
            $table->boolean('is_paid')->default(true);
            $table->string('status')->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('work_shifts', function (Blueprint $table): void {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->time('start_time');
            $table->time('end_time');
            $table->unsignedSmallInteger('break_minutes')->default(0);
            $table->unsignedSmallInteger('late_grace_minutes')->default(0);
            $table->unsignedSmallInteger('overtime_after_minutes')->default(0);
            $table->string('status')->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('employee_shift_assignments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('work_shift_id')->constrained()->restrictOnDelete();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->json('work_days');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['employee_id', 'effective_from', 'effective_to'], 'employee_shift_period_index');
        });

        Schema::create('payroll_deduction_rules', function (Blueprint $table): void {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('type')->default('other');
            $table->string('calculation_type')->default('fixed');
            $table->decimal('value', 16, 4)->default(0);
            $table->decimal('threshold_amount', 16, 2)->default(0);
            $table->decimal('maximum_amount', 16, 2)->nullable();
            $table->string('status')->default('active');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('employee_payroll_deductions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payroll_deduction_rule_id');
            $table->foreign('payroll_deduction_rule_id', 'employee_deduction_rule_fk')->references('id')->on('payroll_deduction_rules')->restrictOnDelete();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('override_value', 16, 4)->nullable();
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->string('status')->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['employee_id', 'effective_from', 'effective_to'], 'employee_deduction_period_index');
        });

        Schema::create('payroll_deduction_allocations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('payroll_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_payroll_deduction_id')->nullable();
            $table->foreign('employee_payroll_deduction_id', 'payroll_alloc_employee_deduction_fk')->references('id')->on('employee_payroll_deductions')->nullOnDelete();
            $table->foreignId('payroll_deduction_rule_id')->nullable();
            $table->foreign('payroll_deduction_rule_id', 'payroll_alloc_rule_fk')->references('id')->on('payroll_deduction_rules')->nullOnDelete();
            $table->string('code');
            $table->string('name');
            $table->string('type');
            $table->string('calculation_type');
            $table->decimal('value_snapshot', 16, 4);
            $table->decimal('amount', 16, 2);
            $table->timestamps();
        });

        Schema::create('employee_terminations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')->constrained()->restrictOnDelete();
            $table->foreignId('payment_method_id')->constrained()->restrictOnDelete();
            $table->foreignId('accounting_account_id')->constrained()->restrictOnDelete();
            $table->foreignId('accounting_transaction_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('termination_number')->unique();
            $table->date('last_working_date');
            $table->string('termination_type');
            $table->text('reason');
            $table->date('settlement_period_start');
            $table->decimal('final_salary', 16, 2)->default(0);
            $table->decimal('unused_leave_payout', 16, 2)->default(0);
            $table->decimal('severance_amount', 16, 2)->default(0);
            $table->decimal('other_earnings', 16, 2)->default(0);
            $table->decimal('advance_recovery', 16, 2)->default(0);
            $table->decimal('other_deductions', 16, 2)->default(0);
            $table->decimal('net_settlement', 16, 2)->default(0);
            $table->string('status')->default('pending_review');
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['employee_id', 'status', 'last_working_date'], 'employee_termination_status_index');
        });

        Schema::create('termination_advance_allocations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_termination_id')->constrained()->cascadeOnDelete();
            $table->foreignId('salary_advance_id')->constrained()->restrictOnDelete();
            $table->decimal('amount', 16, 2);
            $table->timestamps();
            $table->unique(['employee_termination_id', 'salary_advance_id'], 'termination_advance_unique');
        });

        Schema::create('biometric_import_batches', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('imported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('batch_number')->unique();
            $table->string('original_name');
            $table->string('path');
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('imported_rows')->default(0);
            $table->unsignedInteger('failed_rows')->default(0);
            $table->string('status')->default('processing');
            $table->json('errors')->nullable();
            $table->timestamps();
        });

        Schema::table('employees', function (Blueprint $table): void {
            $table->string('biometric_id')->nullable()->unique()->after('employee_number');
        });
        Schema::table('leave_requests', function (Blueprint $table): void {
            $table->foreignId('leave_policy_id')->nullable()->after('employee_id')->constrained()->nullOnDelete();
        });
        Schema::table('attendance_records', function (Blueprint $table): void {
            $table->foreignId('biometric_import_batch_id')->nullable()->after('leave_request_id')->constrained()->nullOnDelete();
            $table->string('external_reference')->nullable()->after('source');
        });
        Schema::table('payroll_items', function (Blueprint $table): void {
            $table->decimal('tax_deduction', 16, 2)->default(0)->after('advance_deduction');
            $table->decimal('recurring_deduction', 16, 2)->default(0)->after('tax_deduction');
        });
        Schema::table('payroll_runs', function (Blueprint $table): void {
            $table->decimal('total_tax_deduction', 16, 2)->default(0)->after('total_advance_deduction');
            $table->decimal('total_recurring_deduction', 16, 2)->default(0)->after('total_tax_deduction');
        });

        $this->seedDefaults();
        $this->installPermissions();
    }

    public function down(): void
    {
        Schema::table('payroll_runs', function (Blueprint $table): void {
            $table->dropColumn(['total_tax_deduction', 'total_recurring_deduction']);
        });
        Schema::table('payroll_items', function (Blueprint $table): void {
            $table->dropColumn(['tax_deduction', 'recurring_deduction']);
        });
        Schema::table('attendance_records', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('biometric_import_batch_id');
            $table->dropColumn('external_reference');
        });
        Schema::table('leave_requests', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('leave_policy_id');
        });
        Schema::table('employees', function (Blueprint $table): void {
            $table->dropUnique(['biometric_id']);
            $table->dropColumn('biometric_id');
        });

        Schema::dropIfExists('biometric_import_batches');
        Schema::dropIfExists('termination_advance_allocations');
        Schema::dropIfExists('employee_terminations');
        Schema::dropIfExists('payroll_deduction_allocations');
        Schema::dropIfExists('employee_payroll_deductions');
        Schema::dropIfExists('payroll_deduction_rules');
        Schema::dropIfExists('employee_shift_assignments');
        Schema::dropIfExists('work_shifts');
        Schema::dropIfExists('public_holidays');
        Schema::dropIfExists('employee_leave_balances');
        Schema::dropIfExists('leave_policies');

        $permissionNames = collect(['leave-policies', 'work-schedules', 'payroll-deductions', 'employee-terminations', 'biometric-imports'])
            ->flatMap(fn (string $module): array => collect(['view', 'create', 'update', 'delete'])
                ->map(fn (string $action): string => "{$module}.{$action}")->all());
        $permissionIds = DB::table('permissions')->whereIn('name', $permissionNames)->pluck('id');
        DB::table('role_has_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('model_has_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();
    }

    private function seedDefaults(): void
    {
        $now = now();
        DB::table('leave_policies')->insert([
            ['code' => 'annual', 'name' => 'Annual Leave', 'days_per_year' => 20, 'is_paid' => true, 'tracks_balance' => true, 'carry_forward_limit' => 5, 'max_consecutive_days' => 15, 'attachment_after_days' => null, 'payout_on_termination' => true, 'status' => 'active', 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'sick', 'name' => 'Sick Leave', 'days_per_year' => 10, 'is_paid' => true, 'tracks_balance' => true, 'carry_forward_limit' => 0, 'max_consecutive_days' => null, 'attachment_after_days' => 2, 'payout_on_termination' => false, 'status' => 'active', 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'emergency', 'name' => 'Emergency Leave', 'days_per_year' => 5, 'is_paid' => true, 'tracks_balance' => true, 'carry_forward_limit' => 0, 'max_consecutive_days' => 3, 'attachment_after_days' => null, 'payout_on_termination' => false, 'status' => 'active', 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'unpaid', 'name' => 'Unpaid Leave', 'days_per_year' => 0, 'is_paid' => false, 'tracks_balance' => false, 'carry_forward_limit' => 0, 'max_consecutive_days' => null, 'attachment_after_days' => null, 'payout_on_termination' => false, 'status' => 'active', 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'other', 'name' => 'Other Leave', 'days_per_year' => 0, 'is_paid' => false, 'tracks_balance' => false, 'carry_forward_limit' => 0, 'max_consecutive_days' => null, 'attachment_after_days' => null, 'payout_on_termination' => false, 'status' => 'active', 'created_at' => $now, 'updated_at' => $now],
        ]);
        DB::table('work_shifts')->insert([
            'code' => 'standard', 'name' => 'Standard Shift', 'start_time' => '08:00:00', 'end_time' => '16:00:00',
            'break_minutes' => 0, 'late_grace_minutes' => 10, 'overtime_after_minutes' => 0,
            'status' => 'active', 'created_at' => $now, 'updated_at' => $now,
        ]);

        DB::table('leave_policies')->get(['id', 'code'])->each(function (object $policy): void {
            DB::table('leave_requests')->where('leave_type', $policy->code)->update(['leave_policy_id' => $policy->id]);
        });
    }

    private function installPermissions(): void
    {
        $modules = ['leave-policies', 'work-schedules', 'payroll-deductions', 'employee-terminations', 'biometric-imports'];
        foreach ($modules as $module) {
            foreach (['view', 'create', 'update', 'delete'] as $action) {
                DB::table('permissions')->insertOrIgnore([
                    'name' => "{$module}.{$action}",
                    'guard_name' => 'web',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        foreach (['Admin', 'Manager', 'HR'] as $roleName) {
            $roleId = DB::table('roles')->where('name', $roleName)->where('guard_name', 'web')->value('id');
            if (! $roleId) {
                continue;
            }
            $permissionIds = DB::table('permissions')->whereIn('name', collect($modules)->flatMap(
                fn (string $module): array => collect(['view', 'create', 'update', 'delete'])
                    ->map(fn (string $action): string => "{$module}.{$action}")->all(),
            ))->pluck('id');
            foreach ($permissionIds as $permissionId) {
                DB::table('role_has_permissions')->insertOrIgnore(['permission_id' => $permissionId, 'role_id' => $roleId]);
            }
        }
    }
};
