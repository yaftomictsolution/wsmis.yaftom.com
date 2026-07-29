<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table): void {
            $table->dropForeign(['billing_period_id']);
            $table->dropForeign(['meter_reading_id']);
        });

        Schema::table('invoices', function (Blueprint $table): void {
            $table->unsignedBigInteger('billing_period_id')->nullable()->change();
            $table->unsignedBigInteger('meter_reading_id')->nullable()->change();
            $table->string('invoice_type')->default('water')->after('id');
            $table->foreignId('customer_contract_id')->nullable()->after('customer_id')->constrained()->nullOnDelete();
            $table->string('source_type')->nullable()->after('meter_reading_id');
            $table->unsignedBigInteger('source_id')->nullable()->after('source_type');
            $table->foreign('billing_period_id')->references('id')->on('billing_periods')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreign('meter_reading_id')->references('id')->on('meter_readings')->cascadeOnUpdate()->restrictOnDelete();
        });

        Schema::table('customer_charges', function (Blueprint $table): void {
            $table->foreignId('invoice_id')->nullable()->after('customer_contract_id')->constrained()->nullOnDelete();
        });

        Schema::create('invoice_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('customer_charge_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('financial_category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('item_type')->default('service');
            $table->string('description');
            $table->decimal('quantity', 14, 2)->default(1);
            $table->decimal('unit_price', 16, 2)->default(0);
            $table->decimal('discount_amount', 16, 2)->default(0);
            $table->decimal('amount', 16, 2);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['invoice_id', 'item_type']);
            $table->index('customer_charge_id');
        });

        $this->backfillWaterInvoices();
        $this->backfillContractInvoices();
        $this->backfillStandaloneChargeInvoices();
        $this->recalculateCustomerBalances();

        Schema::table('invoices', function (Blueprint $table): void {
            $table->unique(['source_type', 'source_id'], 'invoices_source_unique');
            $table->index(['invoice_type', 'status']);
        });
    }

    private function backfillWaterInvoices(): void
    {
        DB::table('invoices')->orderBy('id')->get()->each(function (object $invoice): void {
            DB::table('invoices')->where('id', $invoice->id)->update([
                'invoice_type' => 'water',
                'source_type' => 'meter_reading',
                'source_id' => $invoice->meter_reading_id,
            ]);

            $now = $invoice->created_at ?? now();
            $lineTotal = 0.0;
            $waterAmount = (float) $invoice->water_amount;
            if ($waterAmount > 0.005) {
                DB::table('invoice_items')->insert([
                    'invoice_id' => $invoice->id,
                    'item_type' => 'water_usage',
                    'description' => 'Water consumption',
                    'quantity' => max(1, (float) $invoice->consumption),
                    'unit_price' => (float) $invoice->rate_per_cubic_meter,
                    'discount_amount' => 0,
                    'amount' => $waterAmount,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $lineTotal += $waterAmount;
            }

            $previousBalance = (float) $invoice->previous_balance;
            if ($previousBalance > 0.005) {
                DB::table('invoice_items')->insert([
                    'invoice_id' => $invoice->id,
                    'item_type' => 'legacy_balance',
                    'description' => 'Previous balance carried forward (legacy invoice)',
                    'quantity' => 1,
                    'unit_price' => $previousBalance,
                    'discount_amount' => 0,
                    'amount' => $previousBalance,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $lineTotal += $previousBalance;
            }

            $penalty = (float) $invoice->penalty_amount;
            if ($penalty > 0.005) {
                DB::table('invoice_items')->insert([
                    'invoice_id' => $invoice->id,
                    'item_type' => 'penalty',
                    'description' => 'Penalty',
                    'quantity' => 1,
                    'unit_price' => $penalty,
                    'discount_amount' => 0,
                    'amount' => $penalty,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $lineTotal += $penalty;
            }

            $discount = (float) $invoice->discount_amount;
            if ($discount > 0.005) {
                DB::table('invoice_items')->insert([
                    'invoice_id' => $invoice->id,
                    'item_type' => 'discount',
                    'description' => 'Discount',
                    'quantity' => 1,
                    'unit_price' => -$discount,
                    'discount_amount' => $discount,
                    'amount' => -$discount,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $lineTotal -= $discount;
            }

            $adjustment = round((float) $invoice->total_amount - $lineTotal, 2);
            if (abs($adjustment) > 0.005) {
                DB::table('invoice_items')->insert([
                    'invoice_id' => $invoice->id,
                    'item_type' => 'legacy_adjustment',
                    'description' => 'Legacy invoice adjustment',
                    'quantity' => 1,
                    'unit_price' => $adjustment,
                    'discount_amount' => 0,
                    'amount' => $adjustment,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        });
    }

    private function backfillContractInvoices(): void
    {
        DB::table('customer_charges')
            ->whereNotNull('customer_contract_id')
            ->select('customer_contract_id')
            ->distinct()
            ->orderBy('customer_contract_id')
            ->pluck('customer_contract_id')
            ->each(function (int $contractId): void {
                $contract = DB::table('customer_contracts')->where('id', $contractId)->first();
                if (! $contract) {
                    return;
                }

                $charges = DB::table('customer_charges')
                    ->where('customer_contract_id', $contractId)
                    ->where('status', 'posted')
                    ->orderBy('id')
                    ->get();
                if ($charges->isEmpty()) {
                    return;
                }

                $total = round((float) $charges->sum('amount'), 2);
                $paid = round((float) $charges->sum('paid_amount'), 2);
                $remaining = round(max(0, (float) $charges->sum('remaining_amount')), 2);
                $issueDate = Carbon::parse($contract->approved_at ?? $contract->activated_at ?? $contract->created_at ?? now())->toDateString();
                $invoiceId = DB::table('invoices')->insertGetId([
                    'invoice_type' => 'contract',
                    'billing_period_id' => null,
                    'customer_id' => $contract->customer_id,
                    'customer_contract_id' => $contractId,
                    'meter_reading_id' => null,
                    'source_type' => 'customer_contract',
                    'source_id' => $contractId,
                    'invoice_number' => 'INV-C-MIG-'.str_pad((string) $contractId, 6, '0', STR_PAD_LEFT),
                    'issue_date' => $issueDate,
                    'due_date' => Carbon::parse($issueDate)->addDays(15)->toDateString(),
                    'previous_balance' => 0,
                    'consumption' => 0,
                    'rate_per_cubic_meter' => 0,
                    'water_amount' => 0,
                    'penalty_amount' => 0,
                    'discount_amount' => (float) $contract->discount_amount,
                    'total_amount' => $total,
                    'paid_amount' => min($total, $paid),
                    'remaining_amount' => $remaining,
                    'status' => $this->paymentStatus($paid, $remaining),
                    'notes' => 'Migrated contract billing invoice.',
                    'created_at' => $contract->created_at ?? now(),
                    'updated_at' => now(),
                ]);

                $this->attachChargesToInvoice($charges, $invoiceId, 'contract_fee');
            });
    }

    private function backfillStandaloneChargeInvoices(): void
    {
        DB::table('customer_charges')
            ->whereNull('invoice_id')
            ->orderBy('id')
            ->get()
            ->each(function (object $charge): void {
                $issueDate = Carbon::parse($charge->charge_date ?? $charge->created_at ?? now())->toDateString();
                $remaining = max(0, (float) $charge->remaining_amount);
                $paid = max(0, (float) $charge->paid_amount);
                $invoiceId = DB::table('invoices')->insertGetId([
                    'invoice_type' => 'service',
                    'billing_period_id' => null,
                    'customer_id' => $charge->customer_id,
                    'customer_contract_id' => null,
                    'meter_reading_id' => null,
                    'source_type' => 'customer_charge',
                    'source_id' => $charge->id,
                    'invoice_number' => 'INV-S-MIG-'.str_pad((string) $charge->id, 6, '0', STR_PAD_LEFT),
                    'issue_date' => $issueDate,
                    'due_date' => Carbon::parse($issueDate)->addDays(15)->toDateString(),
                    'previous_balance' => 0,
                    'consumption' => 0,
                    'rate_per_cubic_meter' => 0,
                    'water_amount' => 0,
                    'penalty_amount' => $charge->type === 'penalty' ? (float) $charge->amount : 0,
                    'discount_amount' => 0,
                    'total_amount' => (float) $charge->amount,
                    'paid_amount' => min((float) $charge->amount, $paid),
                    'remaining_amount' => $remaining,
                    'status' => $charge->status === 'cancelled' ? 'cancelled' : $this->paymentStatus($paid, $remaining),
                    'notes' => $charge->notes,
                    'created_at' => $charge->created_at ?? now(),
                    'updated_at' => now(),
                ]);

                $this->attachChargesToInvoice(collect([$charge]), $invoiceId, 'service');
            });
    }

    private function attachChargesToInvoice($charges, int $invoiceId, string $itemType): void
    {
        $chargeIds = $charges->pluck('id')->all();
        foreach ($charges as $charge) {
            DB::table('invoice_items')->insert([
                'invoice_id' => $invoiceId,
                'customer_charge_id' => $charge->id,
                'financial_category_id' => $charge->financial_category_id,
                'item_type' => $itemType,
                'description' => $charge->title,
                'quantity' => 1,
                'unit_price' => $charge->amount,
                'discount_amount' => 0,
                'amount' => $charge->amount,
                'notes' => $charge->notes,
                'created_at' => $charge->created_at ?? now(),
                'updated_at' => now(),
            ]);
        }

        DB::table('customer_charges')->whereIn('id', $chargeIds)->update(['invoice_id' => $invoiceId]);
        DB::table('payment_allocations')
            ->whereIn('customer_charge_id', $chargeIds)
            ->whereNull('invoice_id')
            ->update(['invoice_id' => $invoiceId]);

        $paymentIds = DB::table('payment_allocations')
            ->where('invoice_id', $invoiceId)
            ->pluck('payment_id')
            ->unique()
            ->all();
        if ($paymentIds) {
            DB::table('payments')->whereIn('id', $paymentIds)->whereNull('invoice_id')->update(['invoice_id' => $invoiceId]);
        }
    }

    private function recalculateCustomerBalances(): void
    {
        DB::table('customers')->orderBy('id')->pluck('id')->each(function (int $customerId): void {
            $balance = (float) DB::table('invoices')
                ->where('customer_id', $customerId)
                ->where('status', '!=', 'cancelled')
                ->sum('remaining_amount');
            DB::table('customers')->where('id', $customerId)->update(['current_balance' => round(max(0, $balance), 2)]);
        });
    }

    private function paymentStatus(float $paid, float $remaining): string
    {
        if ($remaining <= 0.005) {
            return 'paid';
        }

        return $paid > 0.005 ? 'partially_paid' : 'unpaid';
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table): void {
            $table->dropUnique('invoices_source_unique');
            $table->dropIndex(['invoice_type', 'status']);
        });

        $genericInvoiceIds = DB::table('invoices')->where('invoice_type', '!=', 'water')->pluck('id');
        if ($genericInvoiceIds->isNotEmpty()) {
            DB::table('payment_allocations')->whereIn('invoice_id', $genericInvoiceIds)->update(['invoice_id' => null]);
            DB::table('payments')->whereIn('invoice_id', $genericInvoiceIds)->update(['invoice_id' => null]);
            DB::table('customer_charges')->whereIn('invoice_id', $genericInvoiceIds)->update(['invoice_id' => null]);
        }

        Schema::dropIfExists('invoice_items');

        Schema::table('customer_charges', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('invoice_id');
        });

        DB::table('invoices')->where('invoice_type', '!=', 'water')->delete();

        Schema::table('invoices', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('customer_contract_id');
            $table->dropForeign(['billing_period_id']);
            $table->dropForeign(['meter_reading_id']);
            $table->dropColumn(['invoice_type', 'source_type', 'source_id']);
        });

        Schema::table('invoices', function (Blueprint $table): void {
            $table->unsignedBigInteger('billing_period_id')->nullable(false)->change();
            $table->unsignedBigInteger('meter_reading_id')->nullable(false)->change();
            $table->foreign('billing_period_id')->references('id')->on('billing_periods')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreign('meter_reading_id')->references('id')->on('meter_readings')->cascadeOnUpdate()->restrictOnDelete();
        });
    }
};
