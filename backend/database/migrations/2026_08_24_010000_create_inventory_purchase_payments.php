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
            $table->decimal('paid_amount', 16, 2)->default(0)->after('initial_payment_amount');
            $table->decimal('remaining_amount', 16, 2)->default(0)->after('paid_amount');
            $table->string('payment_status', 30)->default('unpaid')->after('remaining_amount');
            $table->index(['type', 'payment_status']);
        });

        Schema::create('inventory_purchase_payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('inventory_request_id')->constrained('inventory_requests')->cascadeOnDelete();
            $table->foreignId('accounting_account_id')->nullable()->constrained('accounting_accounts')->nullOnDelete();
            $table->foreignId('payment_method_id')->nullable()->constrained('payment_methods')->nullOnDelete();
            $table->foreignId('accounting_transaction_id')->nullable()->unique()->constrained('accounting_transactions')->nullOnDelete();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('receipt_number')->unique();
            $table->decimal('amount', 16, 2);
            $table->date('paid_at');
            $table->string('reference')->nullable();
            $table->string('status', 30)->default('posted');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['inventory_request_id', 'status']);
            $table->index('paid_at');
        });

        DB::table('inventory_requests')
            ->where('type', 'purchase')
            ->orderBy('id')
            ->chunkById(100, function ($requests): void {
                foreach ($requests as $request) {
                    $transactions = DB::table('accounting_transactions')
                        ->where('source_type', 'inventory_request')
                        ->where('source_id', $request->id)
                        ->where('type', 'expense')
                        ->where('status', 'approved')
                        ->whereNull('reversed_at')
                        ->orderBy('id')
                        ->get();

                    foreach ($transactions as $transaction) {
                        DB::table('inventory_purchase_payments')->insert([
                            'inventory_request_id' => $request->id,
                            'accounting_account_id' => $transaction->accounting_account_id,
                            'payment_method_id' => $transaction->payment_method_id,
                            'accounting_transaction_id' => $transaction->id,
                            'recorded_by' => $transaction->recorded_by,
                            'receipt_number' => 'IPP-LEGACY-'.str_pad((string) $transaction->id, 8, '0', STR_PAD_LEFT),
                            'amount' => $transaction->amount,
                            'paid_at' => $transaction->transaction_date,
                            'reference' => $transaction->reference ?: $request->request_number,
                            'status' => 'posted',
                            'notes' => 'Imported from the original purchase payment.',
                            'created_at' => $transaction->created_at,
                            'updated_at' => $transaction->updated_at,
                        ]);
                    }

                    $total = round((float) $request->total_amount, 2);
                    $paid = min($total, round((float) $transactions->sum('amount'), 2));
                    $remaining = max(0, round($total - $paid, 2));

                    DB::table('inventory_requests')->where('id', $request->id)->update([
                        'paid_amount' => $paid,
                        'remaining_amount' => $remaining,
                        'payment_status' => $remaining <= 0.005
                            ? 'paid'
                            : ($paid > 0.005 ? 'partially_paid' : 'unpaid'),
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_purchase_payments');

        Schema::table('inventory_requests', function (Blueprint $table): void {
            $table->dropIndex(['type', 'payment_status']);
            $table->dropColumn(['paid_amount', 'remaining_amount', 'payment_status']);
        });
    }
};
