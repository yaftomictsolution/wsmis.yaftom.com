<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_requests', function (Blueprint $table): void {
            $table->foreignId('customer_contract_id')
                ->nullable()
                ->after('customer_id')
                ->constrained('customer_contracts')
                ->nullOnDelete();
            $table->string('issue_purpose', 30)->nullable()->after('issue_type');
            $table->string('return_status', 30)->default('not_required')->after('status');
            $table->foreignId('returned_by')->nullable()->after('approved_by')->constrained('users')->nullOnDelete();
            $table->timestamp('returned_at')->nullable()->after('approved_at');

            $table->index(['customer_contract_id', 'issue_purpose', 'return_status'], 'inventory_contract_return_lookup');
        });

        Schema::create('contract_cancellation_requests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('customer_contract_id')->constrained('customer_contracts')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->string('status', 20)->default('pending');
            $table->text('reason');
            $table->boolean('materials_received_confirmed')->default(false);
            $table->boolean('refund_posted_payments')->default(false);
            $table->date('refunded_at')->nullable();
            $table->string('refund_reference')->nullable();
            $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->text('resolution_notes')->nullable();
            $table->timestamps();

            $table->index(['customer_contract_id', 'status'], 'contract_cancellation_status_lookup');
            $table->index(['status', 'created_at']);
        });

        Schema::create('contract_cancellation_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('contract_cancellation_request_id');
            $table->foreignId('inventory_request_id');
            $table->foreignId('inventory_request_item_id');
            $table->foreignId('inventory_item_id');
            $table->foreignId('good_id')->nullable();
            $table->foreignId('warehouse_id');
            $table->string('description');
            $table->string('unit', 50)->default('piece');
            $table->decimal('quantity', 14, 2);
            $table->decimal('unit_cost', 16, 2)->default(0);
            $table->decimal('unit_price', 16, 2)->default(0);
            $table->decimal('total_cost', 16, 2)->default(0);
            $table->decimal('total_price', 16, 2)->default(0);
            $table->timestamp('returned_at')->nullable();
            $table->timestamps();

            $table->unique(
                ['contract_cancellation_request_id', 'inventory_request_item_id'],
                'contract_cancellation_item_unique'
            );
            $table->foreign('contract_cancellation_request_id', 'cc_items_cancel_req_fk')
                ->references('id')->on('contract_cancellation_requests')->cascadeOnDelete();
            $table->foreign('inventory_request_id', 'cc_items_inventory_req_fk')
                ->references('id')->on('inventory_requests')->restrictOnDelete();
            $table->foreign('inventory_request_item_id', 'cc_items_request_item_fk')
                ->references('id')->on('inventory_request_items')->restrictOnDelete();
            $table->foreign('inventory_item_id', 'cc_items_inventory_item_fk')
                ->references('id')->on('inventory_items')->restrictOnDelete();
            $table->foreign('good_id', 'cc_items_good_fk')
                ->references('id')->on('goods')->nullOnDelete();
            $table->foreign('warehouse_id', 'cc_items_warehouse_fk')
                ->references('id')->on('warehouses')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contract_cancellation_items');
        Schema::dropIfExists('contract_cancellation_requests');

        Schema::table('inventory_requests', function (Blueprint $table): void {
            $table->dropForeign(['returned_by']);
            $table->dropForeign(['customer_contract_id']);
            $table->dropIndex('inventory_contract_return_lookup');
            $table->dropColumn([
                'customer_contract_id',
                'issue_purpose',
                'return_status',
                'returned_by',
                'returned_at',
            ]);
        });
    }
};
