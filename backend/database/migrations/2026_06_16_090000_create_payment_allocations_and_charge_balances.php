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
            $table->dropForeign(['invoice_id']);
            $table->unsignedBigInteger('invoice_id')->nullable()->change();
            $table->foreign('invoice_id')->references('id')->on('invoices')->cascadeOnUpdate()->restrictOnDelete();
        });

        Schema::table('customer_charges', function (Blueprint $table): void {
            $table->decimal('paid_amount', 16, 2)->default(0)->after('amount');
            $table->decimal('remaining_amount', 16, 2)->default(0)->after('paid_amount');
            $table->timestamp('paid_at')->nullable()->after('charge_date');
        });

        DB::table('customer_charges')->update([
            'remaining_amount' => DB::raw('amount'),
        ]);

        Schema::create('payment_allocations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('payment_id')->constrained()->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('invoice_id')->nullable()->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('customer_charge_id')->nullable()->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->decimal('amount', 16, 2);
            $table->timestamps();

            $table->index(['invoice_id']);
            $table->index(['customer_charge_id']);
        });

        DB::table('payments')
            ->whereNotNull('invoice_id')
            ->where('amount', '>', 0)
            ->orderBy('id')
            ->get()
            ->each(function ($payment): void {
                DB::table('payment_allocations')->insert([
                    'payment_id' => $payment->id,
                    'invoice_id' => $payment->invoice_id,
                    'customer_charge_id' => null,
                    'amount' => $payment->amount,
                    'created_at' => $payment->created_at,
                    'updated_at' => $payment->updated_at,
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_allocations');

        Schema::table('customer_charges', function (Blueprint $table): void {
            $table->dropColumn(['paid_amount', 'remaining_amount', 'paid_at']);
        });

        Schema::table('payments', function (Blueprint $table): void {
            $table->dropForeign(['invoice_id']);
            $table->unsignedBigInteger('invoice_id')->nullable(false)->change();
            $table->foreign('invoice_id')->references('id')->on('invoices')->cascadeOnUpdate()->restrictOnDelete();
        });
    }
};
