<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_settings', function (Blueprint $table): void {
            $table->id();
            $table->string('key')->unique();
            $table->json('value')->nullable();
            $table->timestamps();
        });

        Schema::create('payment_methods', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('code')->unique();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('financial_categories', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('code')->unique();
            $table->string('type');
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('service_areas', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('mosque_name')->nullable();
            $table->string('district')->nullable();
            $table->string('street_block_village')->nullable();
            $table->string('representative_name')->nullable();
            $table->string('representative_phone')->nullable();
            $table->unsignedInteger('households_count')->default(0);
            $table->decimal('rate_per_cubic_meter', 12, 2)->default(0);
            $table->string('status')->default('active');
            $table->text('inactive_reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('customers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('service_area_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->string('name');
            $table->string('father_name')->nullable();
            $table->string('phone')->nullable();
            $table->string('secondary_phone')->nullable();
            $table->string('house_number')->nullable();
            $table->text('address')->nullable();
            $table->decimal('opening_balance', 14, 2)->default(0);
            $table->decimal('current_balance', 14, 2)->default(0);
            $table->string('status')->default('active');
            $table->json('documents')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('meters', function (Blueprint $table): void {
            $table->id();
            $table->string('meter_number')->unique();
            $table->string('type')->nullable();
            $table->string('status')->default('available');
            $table->text('condition_notes')->nullable();
            $table->date('purchased_at')->nullable();
            $table->timestamps();
        });

        Schema::create('meter_assignments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('meter_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('installed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('initial_reading', 14, 2)->default(0);
            $table->date('installation_date');
            $table->string('seal_number')->nullable();
            $table->string('status')->default('active');
            $table->timestamp('removed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['customer_id', 'status']);
            $table->index(['meter_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meter_assignments');
        Schema::dropIfExists('meters');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('service_areas');
        Schema::dropIfExists('financial_categories');
        Schema::dropIfExists('payment_methods');
        Schema::dropIfExists('system_settings');
    }
};
