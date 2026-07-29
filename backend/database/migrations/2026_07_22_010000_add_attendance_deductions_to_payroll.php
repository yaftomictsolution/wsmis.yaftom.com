<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll_runs', function (Blueprint $table): void {
            $table->decimal('total_late_deduction', 16, 2)->default(0)->after('total_absence_deduction');
        });

        Schema::table('payroll_items', function (Blueprint $table): void {
            $table->decimal('late_deduction', 16, 2)->default(0)->after('absence_deduction');
        });
    }

    public function down(): void
    {
        Schema::table('payroll_items', function (Blueprint $table): void {
            $table->dropColumn('late_deduction');
        });

        Schema::table('payroll_runs', function (Blueprint $table): void {
            $table->dropColumn('total_late_deduction');
        });
    }
};
