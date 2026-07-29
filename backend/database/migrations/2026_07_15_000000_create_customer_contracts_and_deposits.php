<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_contracts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('contract_number')->unique();
            $table->date('subscription_date')->nullable();
            $table->string('meter_size')->nullable();
            $table->decimal('connection_fee', 16, 2)->default(0);
            $table->decimal('meter_fee', 16, 2)->default(0);
            $table->decimal('discount_amount', 16, 2)->default(0);
            $table->decimal('net_amount', 16, 2)->default(0);
            $table->decimal('required_initial_payment', 16, 2)->default(0);
            $table->decimal('deposited_amount', 16, 2)->default(0);
            $table->decimal('applied_amount', 16, 2)->default(0);
            $table->decimal('remaining_amount', 16, 2)->default(0);
            $table->string('discount_approved_by')->nullable();
            $table->string('status')->default('draft');
            $table->timestamp('printed_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['customer_id', 'status']);
            $table->index(['status', 'submitted_at']);
        });

        Schema::create('customer_deposits', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('customer_contract_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('payment_method_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('accounting_account_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('applied_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('refunded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('accounting_transaction_id')->nullable()->constrained('accounting_transactions')->nullOnDelete();
            $table->foreignId('refund_transaction_id')->nullable()->constrained('accounting_transactions')->nullOnDelete();
            $table->foreignId('payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $table->string('receipt_number')->unique();
            $table->decimal('amount', 16, 2);
            $table->decimal('applied_amount', 16, 2)->default(0);
            $table->decimal('refunded_amount', 16, 2)->default(0);
            $table->date('received_at');
            $table->date('refunded_at')->nullable();
            $table->timestamp('applied_at')->nullable();
            $table->string('status')->default('pending');
            $table->string('reference')->nullable();
            $table->string('refund_receipt_number')->nullable()->unique();
            $table->string('refund_reference')->nullable();
            $table->text('refund_reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['customer_id', 'status']);
            $table->index(['customer_contract_id', 'status']);
        });

        Schema::create('customer_deposit_allocations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('customer_deposit_id')->constrained()->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('customer_charge_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->decimal('amount', 16, 2);
            $table->timestamps();

            $table->unique(['customer_deposit_id', 'customer_charge_id'], 'deposit_charge_unique');
        });

        Schema::table('meter_assignments', function (Blueprint $table): void {
            $table->foreignId('customer_contract_id')->nullable()->after('customer_id')->constrained()->nullOnDelete();
        });
        Schema::table('customer_charges', function (Blueprint $table): void {
            $table->foreignId('customer_contract_id')->nullable()->after('customer_id')->constrained()->nullOnDelete();
        });
        Schema::table('payments', function (Blueprint $table): void {
            $table->foreignId('customer_contract_id')->nullable()->after('customer_id')->constrained()->nullOnDelete();
            $table->foreignId('customer_deposit_id')->nullable()->after('customer_contract_id')->constrained()->nullOnDelete();
        });

        $this->migrateLegacyAgreements();
    }

    private function migrateLegacyAgreements(): void
    {
        DB::table('customers')
            ->orderBy('id')
            ->get()
            ->each(function (object $customer): void {
                $gross = (float) $customer->connection_fee + (float) $customer->meter_fee;
                $legacyStatus = (string) ($customer->agreement_status ?? 'draft');
                $hasAgreement = $gross > 0 || ! in_array($legacyStatus, ['', 'draft'], true);

                if (! $hasAgreement) {
                    return;
                }

                $payment = $customer->agreement_payment_id
                    ? DB::table('payments')->where('id', $customer->agreement_payment_id)->first()
                    : null;
                $appliedAmount = $payment && $payment->status === 'posted' ? (float) $payment->amount : 0;
                $netAmount = max(0, $gross - (float) $customer->agreement_discount_amount);
                $hasActiveMeter = DB::table('meter_assignments')
                    ->where('customer_id', $customer->id)
                    ->where('status', 'active')
                    ->exists();
                $status = match ($legacyStatus) {
                    'pending_approval' => 'pending_approval',
                    'approved', 'signed', 'active' => $hasActiveMeter ? 'active' : 'approved',
                    'rejected' => 'rejected',
                    'printed' => 'printed',
                    default => 'draft',
                };
                $now = now();

                $contractId = DB::table('customer_contracts')->insertGetId([
                    'customer_id' => $customer->id,
                    'approved_by' => $customer->approved_by,
                    'rejected_by' => $customer->rejected_by,
                    'contract_number' => 'CTR-LEGACY-'.str_pad((string) $customer->id, 6, '0', STR_PAD_LEFT),
                    'subscription_date' => $customer->subscription_date,
                    'meter_size' => $customer->meter_size,
                    'connection_fee' => $customer->connection_fee,
                    'meter_fee' => $customer->meter_fee,
                    'discount_amount' => $customer->agreement_discount_amount,
                    'net_amount' => $netAmount,
                    'required_initial_payment' => min($netAmount, (float) $customer->agreement_paid_amount),
                    'deposited_amount' => $appliedAmount,
                    'applied_amount' => $appliedAmount,
                    'remaining_amount' => max(0, $netAmount - $appliedAmount),
                    'discount_approved_by' => $customer->discount_approved_by,
                    'status' => $status,
                    'printed_at' => $customer->agreement_printed_at,
                    'submitted_at' => $customer->submitted_for_approval_at,
                    'approved_at' => $customer->approved_at,
                    'rejected_at' => $customer->rejected_at,
                    'activated_at' => $status === 'active' ? ($customer->approved_at ?? $now) : null,
                    'rejection_reason' => $customer->rejection_reason,
                    'notes' => $payment ? 'Migrated from the legacy embedded customer agreement.' : 'Migrated from the legacy embedded customer agreement. Any unposted paid amount must be reconciled before recording a deposit.',
                    'created_at' => $customer->created_at ?? $now,
                    'updated_at' => $now,
                ]);

                DB::table('meter_assignments')->where('customer_id', $customer->id)->update(['customer_contract_id' => $contractId]);
                DB::table('customer_charges')
                    ->where('customer_id', $customer->id)
                    ->whereIn('type', ['connection_fee', 'meter_fee'])
                    ->update(['customer_contract_id' => $contractId]);

                if (! $payment || $payment->status !== 'posted' || ! $payment->payment_method_id || ! $payment->accounting_account_id) {
                    return;
                }

                $depositId = DB::table('customer_deposits')->insertGetId([
                    'customer_contract_id' => $contractId,
                    'customer_id' => $customer->id,
                    'payment_method_id' => $payment->payment_method_id,
                    'accounting_account_id' => $payment->accounting_account_id,
                    'received_by' => $payment->received_by,
                    'applied_by' => $payment->received_by,
                    'payment_id' => $payment->id,
                    'receipt_number' => 'DEP-LEGACY-'.str_pad((string) $payment->id, 6, '0', STR_PAD_LEFT),
                    'amount' => $payment->amount,
                    'applied_amount' => $payment->amount,
                    'refunded_amount' => 0,
                    'received_at' => $payment->paid_at,
                    'applied_at' => $payment->created_at ?? $now,
                    'status' => 'applied',
                    'reference' => $payment->reference,
                    'notes' => 'Migrated from an already-posted legacy contract payment. No account balance was reposted.',
                    'created_at' => $payment->created_at ?? $now,
                    'updated_at' => $now,
                ]);

                DB::table('payments')->where('id', $payment->id)->update([
                    'customer_contract_id' => $contractId,
                    'customer_deposit_id' => $depositId,
                ]);
            });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('customer_deposit_id');
            $table->dropConstrainedForeignId('customer_contract_id');
        });
        Schema::table('customer_charges', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('customer_contract_id');
        });
        Schema::table('meter_assignments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('customer_contract_id');
        });

        Schema::dropIfExists('customer_deposit_allocations');
        Schema::dropIfExists('customer_deposits');
        Schema::dropIfExists('customer_contracts');
    }
};
