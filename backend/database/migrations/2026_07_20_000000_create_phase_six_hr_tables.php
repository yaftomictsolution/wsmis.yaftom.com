<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('departments', function (Blueprint $table): void {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('job_positions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->string('code')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('employees', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->foreignId('job_position_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('service_area_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('referred_by_shareholder_id')->nullable()->constrained('shareholders')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('employee_number')->unique();
            $table->string('first_name');
            $table->string('last_name')->nullable();
            $table->string('father_name')->nullable();
            $table->string('grandfather_name')->nullable();
            $table->string('gender')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('tazkira_number')->nullable()->unique();
            $table->string('phone')->nullable();
            $table->string('secondary_phone')->nullable();
            $table->string('email')->nullable()->unique();
            $table->text('address')->nullable();
            $table->string('emergency_contact_name')->nullable();
            $table->string('emergency_contact_phone')->nullable();
            $table->date('hire_date');
            $table->date('termination_date')->nullable();
            $table->string('employment_type')->default('permanent');
            $table->string('salary_type')->default('fixed');
            $table->decimal('base_salary', 16, 2)->default(0);
            $table->decimal('daily_rate', 16, 2)->default(0);
            $table->decimal('overtime_hourly_rate', 16, 2)->default(0);
            $table->decimal('standard_daily_hours', 5, 2)->default(8);
            $table->time('work_start_time')->default('08:00:00');
            $table->time('work_end_time')->default('16:00:00');
            $table->json('work_days')->nullable();
            $table->string('bank_name')->nullable();
            $table->string('bank_account_number')->nullable();
            $table->string('status')->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['status', 'hire_date']);
        });

        Schema::create('employee_documents', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('document_type')->default('other');
            $table->string('original_name');
            $table->string('stored_name');
            $table->string('path');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->date('expires_on')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('leave_requests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('leave_number')->unique();
            $table->string('leave_type');
            $table->date('start_date');
            $table->date('end_date');
            $table->decimal('total_days', 6, 2)->default(0);
            $table->boolean('is_paid')->default(true);
            $table->text('reason');
            $table->string('status')->default('pending');
            $table->timestamp('reviewed_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->string('attachment_path')->nullable();
            $table->string('attachment_original_name')->nullable();
            $table->timestamps();
            $table->index(['employee_id', 'start_date', 'end_date']);
        });

        Schema::create('attendance_records', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('leave_request_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('attendance_date');
            $table->time('check_in')->nullable();
            $table->time('check_out')->nullable();
            $table->string('attendance_status')->default('present');
            $table->boolean('is_paid')->default(true);
            $table->unsignedInteger('worked_minutes')->default(0);
            $table->unsignedInteger('late_minutes')->default(0);
            $table->unsignedInteger('overtime_minutes')->default(0);
            $table->string('source')->default('manual');
            $table->string('approval_status')->default('pending');
            $table->timestamp('approved_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['employee_id', 'attendance_date']);
            $table->index(['attendance_date', 'approval_status']);
        });

        Schema::create('salary_advances', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')->constrained()->restrictOnDelete();
            $table->foreignId('payment_method_id')->constrained()->restrictOnDelete();
            $table->foreignId('accounting_account_id')->constrained()->restrictOnDelete();
            $table->foreignId('accounting_transaction_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('advance_number')->unique();
            $table->decimal('amount', 16, 2);
            $table->decimal('deducted_amount', 16, 2)->default(0);
            $table->date('payment_date');
            $table->date('deduction_start_date');
            $table->string('status')->default('pending_review');
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->text('reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['employee_id', 'status', 'deduction_start_date']);
        });

        Schema::create('employee_adjustments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payroll_item_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('adjustment_number')->unique();
            $table->string('type');
            $table->decimal('amount', 16, 2);
            $table->date('effective_date');
            $table->string('status')->default('pending');
            $table->timestamp('approved_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->string('title');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['employee_id', 'effective_date', 'status']);
        });

        Schema::create('performance_reviews', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('period_start');
            $table->date('period_end');
            $table->unsignedTinyInteger('rating');
            $table->text('achievements')->nullable();
            $table->text('concerns')->nullable();
            $table->text('goals')->nullable();
            $table->text('notes')->nullable();
            $table->string('status')->default('draft');
            $table->timestamp('finalized_at')->nullable();
            $table->timestamps();
        });

        Schema::table('payroll_runs', function (Blueprint $table): void {
            $table->boolean('generated_from_hr')->default(false)->after('title');
            $table->decimal('total_absence_deduction', 16, 2)->default(0)->after('total_overtime');
        });

        Schema::table('payroll_items', function (Blueprint $table): void {
            $table->foreignId('employee_id')->nullable()->after('user_id')->constrained()->nullOnDelete();
            $table->string('salary_type')->default('fixed')->after('employee_name');
            $table->decimal('contracted_salary', 16, 2)->default(0)->after('salary_type');
            $table->decimal('scheduled_days', 6, 2)->default(0)->after('base_salary');
            $table->decimal('present_days', 6, 2)->default(0)->after('scheduled_days');
            $table->decimal('paid_leave_days', 6, 2)->default(0)->after('present_days');
            $table->decimal('absent_days', 6, 2)->default(0)->after('paid_leave_days');
            $table->unsignedInteger('late_minutes')->default(0)->after('absent_days');
            $table->decimal('overtime_hours', 8, 2)->default(0)->after('late_minutes');
            $table->decimal('absence_deduction', 16, 2)->default(0)->after('overtime_amount');
            $table->string('payment_status')->default('pending')->after('net_amount');
            $table->timestamp('paid_at')->nullable()->after('payment_status');
            $table->unique(['payroll_run_id', 'employee_id'], 'payroll_run_employee_unique');
        });

        Schema::create('payroll_advance_allocations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('payroll_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('salary_advance_id')->constrained()->restrictOnDelete();
            $table->decimal('amount', 16, 2);
            $table->timestamps();
            $table->unique(['payroll_item_id', 'salary_advance_id'], 'payroll_advance_unique');
        });

        $this->installPermissions();
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_advance_allocations');
        Schema::table('payroll_items', function (Blueprint $table): void {
            $table->dropUnique('payroll_run_employee_unique');
            $table->dropConstrainedForeignId('employee_id');
            $table->dropColumn([
                'salary_type', 'contracted_salary', 'scheduled_days', 'present_days', 'paid_leave_days',
                'absent_days', 'late_minutes', 'overtime_hours', 'absence_deduction', 'payment_status', 'paid_at',
            ]);
        });
        Schema::table('payroll_runs', function (Blueprint $table): void {
            $table->dropColumn(['generated_from_hr', 'total_absence_deduction']);
        });
        Schema::dropIfExists('performance_reviews');
        Schema::dropIfExists('employee_adjustments');
        Schema::dropIfExists('salary_advances');
        Schema::dropIfExists('attendance_records');
        Schema::dropIfExists('leave_requests');
        Schema::dropIfExists('employee_documents');
        Schema::dropIfExists('employees');
        Schema::dropIfExists('job_positions');
        Schema::dropIfExists('departments');

        $permissionNames = collect(['employees', 'attendance', 'leave-requests', 'salary-advances', 'employee-adjustments', 'performance-reviews'])
            ->flatMap(fn (string $module): array => collect(['view', 'create', 'update', 'delete'])
                ->map(fn (string $action): string => "{$module}.{$action}")->all());
        $permissionIds = DB::table('permissions')->whereIn('name', $permissionNames)->pluck('id');
        DB::table('role_has_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('model_has_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();
    }

    private function installPermissions(): void
    {
        $modules = ['employees', 'attendance', 'leave-requests', 'salary-advances', 'employee-adjustments', 'performance-reviews'];
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

        $assignments = [
            'Admin' => $modules,
            'Manager' => $modules,
            'HR' => $modules,
            'Accountant' => ['salary-advances'],
        ];
        foreach ($assignments as $roleName => $roleModules) {
            $roleId = DB::table('roles')->where('name', $roleName)->where('guard_name', 'web')->value('id');
            if (! $roleId) {
                continue;
            }
            $permissionIds = DB::table('permissions')
                ->whereIn('name', collect($roleModules)->flatMap(fn (string $module): array => collect(['view', 'create', 'update', 'delete'])
                    ->map(fn (string $action): string => "{$module}.{$action}")->all()))
                ->pluck('id');
            foreach ($permissionIds as $permissionId) {
                DB::table('role_has_permissions')->insertOrIgnore(['permission_id' => $permissionId, 'role_id' => $roleId]);
            }
        }
    }
};
