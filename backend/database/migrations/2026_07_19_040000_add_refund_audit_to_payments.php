<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->foreignId('refunded_by')->nullable()->after('received_by')->constrained('users')->nullOnDelete();
            $table->foreignId('refund_transaction_id')->nullable()->after('refunded_by')->constrained('accounting_transactions')->nullOnDelete();
            $table->decimal('refunded_amount', 16, 2)->default(0)->after('amount');
            $table->date('refunded_at')->nullable()->after('paid_at');
            $table->string('refund_receipt_number')->nullable()->unique()->after('receipt_number');
            $table->string('refund_reference')->nullable()->after('reference');
            $table->text('refund_reason')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('refunded_by');
            $table->dropConstrainedForeignId('refund_transaction_id');
            $table->dropUnique(['refund_receipt_number']);
            $table->dropColumn([
                'refunded_amount',
                'refunded_at',
                'refund_receipt_number',
                'refund_reference',
                'refund_reason',
            ]);
        });
    }
};
