<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add accounting_transaction_id to inventory_issues for tracking financial impact
        Schema::table('inventory_issues', function (Blueprint $table): void {
            $table->foreignId('accounting_transaction_id')->nullable()->after('customer_contract_id')
                ->constrained('accounting_transactions')->nullOnDelete();
            $table->decimal('total_cost', 16, 2)->default(0)->after('notes');
            $table->decimal('total_price', 16, 2)->default(0)->after('total_cost');
        });

        // Add invoice_id to inventory_issues for customer sales
        Schema::table('inventory_issues', function (Blueprint $table): void {
            $table->foreignId('invoice_id')->nullable()->after('accounting_transaction_id')
                ->constrained('invoices')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('inventory_issues', function (Blueprint $table): void {
            $table->dropForeign(['accounting_transaction_id']);
            $table->dropColumn('accounting_transaction_id');
            $table->dropColumn('total_cost');
            $table->dropColumn('total_price');
            $table->dropForeign(['invoice_id']);
            $table->dropColumn('invoice_id');
        });
    }
};
