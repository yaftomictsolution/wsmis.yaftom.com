<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table): void {
            $table->decimal('payment_discount_amount', 16, 2)->default(0)->after('discount_amount');
        });

        Schema::table('payments', function (Blueprint $table): void {
            $table->string('idempotency_key', 100)->nullable()->unique()->after('receipt_number');
            $table->decimal('discount_amount', 16, 2)->default(0)->after('amount');
            $table->foreignId('discount_authority_id')
                ->nullable()
                ->after('discount_amount')
                ->constrained('authorities')
                ->cascadeOnUpdate()
                ->restrictOnDelete();
        });

        Schema::table('payment_allocations', function (Blueprint $table): void {
            $table->decimal('discount_amount', 16, 2)->default(0)->after('amount');
        });
    }

    public function down(): void
    {
        Schema::table('payment_allocations', function (Blueprint $table): void {
            $table->dropColumn('discount_amount');
        });

        Schema::table('payments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('discount_authority_id');
            $table->dropUnique(['idempotency_key']);
            $table->dropColumn(['idempotency_key', 'discount_amount']);
        });

        Schema::table('invoices', function (Blueprint $table): void {
            $table->dropColumn('payment_discount_amount');
        });
    }
};
