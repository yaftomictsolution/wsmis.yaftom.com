<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('contract_cancellation_requests', 'refund_accounting_account_id')) {
            Schema::table('contract_cancellation_requests', function (Blueprint $table): void {
                $table->foreignId('refund_accounting_account_id')
                    ->nullable()
                    ->after('refund_posted_payments');
            });
        }

        Schema::table('contract_cancellation_requests', function (Blueprint $table): void {
            $table->foreign('refund_accounting_account_id', 'ccr_refund_account_fk')
                ->references('id')
                ->on('accounting_accounts')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('contract_cancellation_requests', function (Blueprint $table): void {
            $table->dropForeign('ccr_refund_account_fk');
            $table->dropColumn('refund_accounting_account_id');
        });
    }
};
