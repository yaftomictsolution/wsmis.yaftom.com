<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('financial_categories', function (Blueprint $table): void {
            $table->text('description')->nullable()->after('type');
        });

        Schema::table('accounting_transactions', function (Blueprint $table): void {
            $table->text('reversal_reason')->nullable()->after('rejection_reason');
        });

        Schema::create('asset_purchases', function (Blueprint $table): void {
            $table->id();
            $table->string('purchase_number')->unique();
            $table->string('asset_code_prefix', 100);
            $table->string('name');
            $table->string('type', 50);
            $table->unsignedInteger('quantity');
            $table->decimal('unit_cost', 16, 2);
            $table->decimal('total_amount', 16, 2);
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('service_area_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('financial_category_id')->constrained()->restrictOnDelete();
            $table->foreignId('payment_method_id')->constrained()->restrictOnDelete();
            $table->foreignId('accounting_account_id')->constrained()->restrictOnDelete();
            $table->foreignId('accounting_transaction_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 30)->default('pending_review');
            $table->string('asset_status', 30)->default('active');
            $table->date('purchase_date');
            $table->date('warranty_expiry')->nullable();
            $table->string('invoice_number')->nullable();
            $table->text('address')->nullable();
            $table->string('attachment_path')->nullable();
            $table->string('attachment_original_name')->nullable();
            $table->json('attributes')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['status', 'purchase_date']);
            $table->index(['supplier_id', 'purchase_date']);
            $table->index(['accounting_account_id', 'purchase_date']);
        });

        Schema::table('assets', function (Blueprint $table): void {
            $table->foreignId('asset_purchase_id')
                ->nullable()
                ->after('id')
                ->constrained()
                ->restrictOnDelete();
        });

        DB::table('financial_categories')->updateOrInsert(
            ['code' => 'asset_purchase'],
            [
                'name' => 'Asset Purchase',
                'type' => 'expense',
                'description' => 'Purchase of fixed infrastructure and technical assets.',
                'status' => 'active',
                'updated_at' => now(),
                'created_at' => now(),
            ],
        );
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('asset_purchase_id');
        });

        Schema::dropIfExists('asset_purchases');

        Schema::table('accounting_transactions', function (Blueprint $table): void {
            $table->dropColumn('reversal_reason');
        });

        Schema::table('financial_categories', function (Blueprint $table): void {
            $table->dropColumn('description');
        });
    }
};
