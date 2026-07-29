<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('warehouses', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('code')->unique();
            $table->text('address')->nullable();
            $table->foreignId('service_area_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('code');
            $table->index('status');
        });

        Schema::create('inventory_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('warehouse_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code')->unique();
            $table->enum('category', ['pipe', 'meter', 'chemical', 'fuel', 'solar', 'technical', 'office', 'other']);
            $table->string('unit')->default('piece');  // piece, meter, liter, kg
            $table->decimal('quantity', 14, 2)->default(0);
            $table->decimal('unit_cost', 16, 2)->default(0);  // Average cost
            $table->decimal('unit_price', 16, 2)->default(0);  // Selling price
            $table->decimal('reorder_level', 14, 2)->default(10);  // Alert when below this
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['warehouse_id', 'category']);
            $table->index('code');
        });

        Schema::create('inventory_transactions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('inventory_item_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['purchase', 'sale', 'internal_use', 'return', 'adjustment', 'transfer']);
            $table->decimal('quantity', 14, 2)->default(0);  // Positive = in, Negative = out
            $table->decimal('unit_cost', 16, 2)->nullable();
            $table->decimal('unit_price', 16, 2)->nullable();
            $table->decimal('total_amount', 16, 2)->nullable();
            $table->date('transaction_date');
            $table->morphs('reference');  // Polymorphic: purchase, sale, etc.
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['inventory_item_id', 'type']);
            $table->index('transaction_date');
        });

        Schema::create('inventory_issues', function (Blueprint $table): void {
            $table->id();
            $table->string('issue_number')->unique();
            $table->date('issue_date');
            $table->enum('type', ['internal', 'customer']);
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('customer_contract_id')->nullable()->constrained('customer_contracts')->nullOnDelete();
            $table->enum('status', ['draft', 'pending_approval', 'approved', 'issued', 'cancelled'])->default('draft');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('issue_number');
            $table->index(['type', 'status']);
            $table->index('customer_id');
            $table->index('department_id');
        });

        Schema::create('inventory_issue_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('inventory_issue_id')->constrained()->cascadeOnDelete();
            $table->foreignId('inventory_item_id')->constrained()->cascadeOnDelete();
            $table->decimal('quantity', 14, 2);
            $table->decimal('unit_cost', 16, 2)->nullable();
            $table->decimal('unit_price', 16, 2)->nullable();
            $table->decimal('total_cost', 16, 2)->nullable();
            $table->decimal('total_price', 16, 2)->nullable();
            $table->timestamps();

            $table->index('inventory_issue_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_issue_items');
        Schema::dropIfExists('inventory_issues');
        Schema::dropIfExists('inventory_transactions');
        Schema::dropIfExists('inventory_items');
        Schema::dropIfExists('warehouses');
    }
};
