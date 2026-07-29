<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_charges', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('financial_category_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('accounting_transaction_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->string('type')->default('other');
            $table->decimal('amount', 16, 2);
            $table->date('charge_date');
            $table->string('status')->default('posted');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['customer_id', 'status']);
            $table->index(['charge_date', 'status']);
        });

        Schema::create('customer_service_requests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('request_number')->unique();
            $table->string('type')->default('complaint');
            $table->string('priority')->default('normal');
            $table->text('description');
            $table->string('status')->default('open');
            $table->date('requested_at');
            $table->timestamp('resolved_at')->nullable();
            $table->text('resolution')->nullable();
            $table->timestamps();

            $table->index(['customer_id', 'status']);
            $table->index(['requested_at', 'priority']);
        });

        Schema::create('customer_connection_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('processed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('customer_charge_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event_type');
            $table->text('reason')->nullable();
            $table->decimal('fee', 16, 2)->default(0);
            $table->string('status')->default('completed');
            $table->date('disconnected_at')->nullable();
            $table->date('reconnected_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['customer_id', 'event_type']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_connection_events');
        Schema::dropIfExists('customer_service_requests');
        Schema::dropIfExists('customer_charges');
    }
};
