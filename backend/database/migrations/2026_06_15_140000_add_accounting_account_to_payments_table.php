<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->foreignId('accounting_account_id')
                ->nullable()
                ->after('payment_method_id')
                ->constrained()
                ->nullOnDelete();
        });

        DB::table('accounting_transactions')
            ->where('source_type', 'customer_payment')
            ->whereNotNull('source_id')
            ->whereNotNull('accounting_account_id')
            ->select(['id', 'source_id', 'accounting_account_id'])
            ->orderBy('id')
            ->chunkById(100, function ($transactions): void {
                foreach ($transactions as $transaction) {
                    DB::table('payments')
                        ->where('id', $transaction->source_id)
                        ->update(['accounting_account_id' => $transaction->accounting_account_id]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('accounting_account_id');
        });
    }
};
