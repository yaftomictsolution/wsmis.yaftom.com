<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_requests', function (Blueprint $table): void {
            $table->decimal('initial_payment_amount', 16, 2)->default(0)->after('total_amount');
            $table->foreignId('payment_method_id')
                ->nullable()
                ->after('accounting_account_id')
                ->constrained('payment_methods')
                ->nullOnDelete();
            $table->foreignId('invoice_id')
                ->nullable()
                ->after('payment_method_id')
                ->constrained('invoices')
                ->nullOnDelete();
        });

        DB::table('inventory_requests')
            ->where('type', 'issue')
            ->where('issue_type', 'customer')
            ->where('status', 'approved')
            ->orderBy('id')
            ->chunkById(100, function ($requests): void {
                foreach ($requests as $request) {
                    $invoice = DB::table('invoices')
                        ->where('invoice_type', 'inventory')
                        ->where(function ($query) use ($request): void {
                            $query
                                ->where(function ($sourceQuery) use ($request): void {
                                    $sourceQuery
                                        ->where('source_type', 'inventory_request')
                                        ->where('source_id', $request->id);
                                })
                                ->orWhere('notes', 'like', '%'.$request->request_number.'%');
                        })
                        ->orderByDesc('id')
                        ->first();

                    if (! $invoice) {
                        continue;
                    }

                    DB::table('invoices')
                        ->where('id', $invoice->id)
                        ->update([
                            'source_type' => 'inventory_request',
                            'source_id' => $request->id,
                        ]);

                    $payment = DB::table('payment_allocations')
                        ->join('payments', 'payments.id', '=', 'payment_allocations.payment_id')
                        ->where('payment_allocations.invoice_id', $invoice->id)
                        ->where('payments.status', 'posted')
                        ->orderBy('payments.id')
                        ->select([
                            'payments.payment_method_id',
                            'payments.accounting_account_id',
                        ])
                        ->first();

                    DB::table('inventory_requests')
                        ->where('id', $request->id)
                        ->update([
                            'invoice_id' => $invoice->id,
                            'payment_method_id' => $payment?->payment_method_id,
                            'accounting_account_id' => $payment?->accounting_account_id
                                ?? $request->accounting_account_id,
                            'initial_payment_amount' => min(
                                (float) $invoice->total_amount,
                                (float) $invoice->paid_amount,
                            ),
                        ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('inventory_requests', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('invoice_id');
            $table->dropConstrainedForeignId('payment_method_id');
            $table->dropColumn('initial_payment_amount');
        });
    }
};
