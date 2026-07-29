<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_allocations', function (Blueprint $table): void {
            $table->decimal('refunded_amount', 16, 2)->default(0);
            $table->foreignId('refunded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('refund_transaction_id')->nullable()->constrained('accounting_transactions')->nullOnDelete();
            $table->date('refunded_at')->nullable();
            $table->string('refund_receipt_number')->nullable();
            $table->string('refund_reference')->nullable();
            $table->text('refund_reason')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('payment_allocations', function (Blueprint $table): void {
            $table->dropForeign(['refunded_by']);
            $table->dropForeign(['refund_transaction_id']);
            $table->dropColumn([
                'refunded_amount',
                'refunded_by',
                'refund_transaction_id',
                'refunded_at',
                'refund_receipt_number',
                'refund_reference',
                'refund_reason',
            ]);
        });
    }
};
