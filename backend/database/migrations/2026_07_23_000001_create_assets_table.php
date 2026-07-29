<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assets', function (Blueprint $table): void {
            $table->id();
            $table->string('asset_code')->unique();
            $table->string('name');
            $table->enum('type', ['well', 'reservoir', 'generator', 'solar', 'technical']);
            $table->enum('status', ['active', 'inactive', 'maintenance', 'retired'])->default('active');

            // Location
            $table->foreignId('service_area_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->text('address')->nullable();

            // Financial
            $table->decimal('purchase_cost', 16, 2)->nullable();
            $table->date('purchase_date')->nullable();
            $table->date('warranty_expiry')->nullable();
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();

            // Type-specific attributes (JSON for flexibility)
            $table->json('attributes')->nullable();

            // Audit
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            // Indexes for performance
            $table->index(['type', 'status']);
            $table->index('asset_code');
            $table->index('service_area_id');
        });

        Schema::create('asset_maintenance', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->enum('maintenance_type', ['preventive', 'corrective', 'emergency']);
            $table->string('title');
            $table->text('description')->nullable();
            $table->decimal('cost', 16, 2)->nullable();
            $table->date('performed_at');
            $table->date('next_due_date')->nullable();
            $table->enum('status', ['scheduled', 'in_progress', 'completed', 'cancelled'])->default('scheduled');
            $table->string('performed_by')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['asset_id', 'status']);
            $table->index('next_due_date');
            $table->index('maintenance_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_maintenance');
        Schema::dropIfExists('assets');
    }
};
