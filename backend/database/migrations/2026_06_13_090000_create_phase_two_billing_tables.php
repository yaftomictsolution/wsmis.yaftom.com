<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('billing_periods', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('code')->unique();
            $table->date('starts_on');
            $table->date('ends_on');
            $table->string('status')->default('open');
            $table->timestamp('locked_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('meter_readings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('billing_period_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('meter_assignment_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('meter_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('read_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('reading_date');
            $table->decimal('previous_reading', 14, 2);
            $table->decimal('current_reading', 14, 2);
            $table->decimal('consumption', 14, 2);
            $table->string('status')->default('recorded');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['billing_period_id', 'meter_assignment_id']);
            $table->index(['customer_id', 'billing_period_id']);
        });

        Schema::create('invoices', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('billing_period_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('meter_reading_id')->unique()->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->string('invoice_number')->unique();
            $table->date('issue_date');
            $table->date('due_date')->nullable();
            $table->decimal('previous_balance', 14, 2)->default(0);
            $table->decimal('consumption', 14, 2)->default(0);
            $table->decimal('rate_per_cubic_meter', 12, 2)->default(0);
            $table->decimal('water_amount', 14, 2)->default(0);
            $table->decimal('penalty_amount', 14, 2)->default(0);
            $table->decimal('discount_amount', 14, 2)->default(0);
            $table->decimal('total_amount', 14, 2)->default(0);
            $table->decimal('paid_amount', 14, 2)->default(0);
            $table->decimal('remaining_amount', 14, 2)->default(0);
            $table->string('status')->default('unpaid');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['customer_id', 'status']);
            $table->index(['billing_period_id', 'status']);
        });

        Schema::create('payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('payment_method_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('receipt_number')->unique();
            $table->decimal('amount', 14, 2);
            $table->date('paid_at');
            $table->string('reference')->nullable();
            $table->string('status')->default('posted');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['customer_id', 'paid_at']);
            $table->index(['invoice_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('meter_readings');
        Schema::dropIfExists('billing_periods');
    }
};
