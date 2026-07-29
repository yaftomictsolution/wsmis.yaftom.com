<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_requests', function (Blueprint $table): void {
            $table->id();
            $table->string('request_number')->unique();
            $table->enum('type', ['purchase', 'issue']);
            $table->enum('status', ['pending', 'approved', 'rejected', 'processed'])->default('pending');

            // For purchases
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('warehouse_id')->nullable()->constrained()->nullOnDelete();

            // Accounting
            $table->foreignId('accounting_account_id')->nullable()->constrained('accounting_accounts')->nullOnDelete();

            // Request details
            $table->date('request_date');
            $table->text('notes')->nullable();
            $table->decimal('total_amount', 16, 2)->default(0);
            $table->integer('total_items')->default(0);

            // Approval tracking
            $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('approval_notes')->nullable();

            $table->timestamps();

            $table->index(['status', 'type']);
            $table->index('request_date');
        });

        Schema::create('inventory_request_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('inventory_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('good_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('inventory_item_id')->nullable()->constrained('inventory_items')->nullOnDelete();
            $table->string('description');
            $table->decimal('quantity', 14, 2);
            $table->decimal('unit_price', 16, 2);
            $table->decimal('total_price', 16, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_request_items');
        Schema::dropIfExists('inventory_requests');
    }
};
