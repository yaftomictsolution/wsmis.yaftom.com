<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->foreignId('agreement_payment_method_id')
                ->nullable()
                ->after('agreement_paid_amount')
                ->constrained('payment_methods')
                ->nullOnDelete();
            $table->foreignId('agreement_accounting_account_id')
                ->nullable()
                ->after('agreement_payment_method_id')
                ->constrained('accounting_accounts')
                ->nullOnDelete();
            $table->foreignId('agreement_payment_received_by')
                ->nullable()
                ->after('agreement_accounting_account_id')
                ->constrained('users')
                ->nullOnDelete();
            $table->date('agreement_payment_date')->nullable()->after('agreement_payment_received_by');
            $table->string('agreement_payment_reference')->nullable()->after('agreement_payment_date');
            $table->foreignId('agreement_payment_id')
                ->nullable()
                ->after('agreement_payment_reference')
                ->constrained('payments')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('agreement_payment_method_id');
            $table->dropConstrainedForeignId('agreement_accounting_account_id');
            $table->dropConstrainedForeignId('agreement_payment_received_by');
            $table->dropConstrainedForeignId('agreement_payment_id');
            $table->dropColumn([
                'agreement_payment_date',
                'agreement_payment_reference',
            ]);
        });
    }
};
