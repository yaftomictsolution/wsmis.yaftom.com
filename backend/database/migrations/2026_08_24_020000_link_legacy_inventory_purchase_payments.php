<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('inventory_purchase_payments')
            ->whereNotNull('accounting_transaction_id')
            ->where('receipt_number', 'like', 'IPP-LEGACY-%')
            ->orderBy('id')
            ->each(function ($payment): void {
                DB::table('accounting_transactions')
                    ->where('id', $payment->accounting_transaction_id)
                    ->where('source_type', 'inventory_request')
                    ->update([
                        'source_type' => 'inventory_purchase_payment',
                        'source_id' => $payment->id,
                    ]);
            });
    }

    public function down(): void
    {
        DB::table('inventory_purchase_payments')
            ->whereNotNull('accounting_transaction_id')
            ->where('receipt_number', 'like', 'IPP-LEGACY-%')
            ->orderBy('id')
            ->each(function ($payment): void {
                DB::table('accounting_transactions')
                    ->where('id', $payment->accounting_transaction_id)
                    ->where('source_type', 'inventory_purchase_payment')
                    ->where('source_id', $payment->id)
                    ->update([
                        'source_type' => 'inventory_request',
                        'source_id' => $payment->inventory_request_id,
                    ]);
            });
    }
};
