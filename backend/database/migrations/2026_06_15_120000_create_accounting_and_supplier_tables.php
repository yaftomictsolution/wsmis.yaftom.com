<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounting_accounts', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('code')->unique();
            $table->string('type')->default('cash');
            $table->decimal('opening_balance', 16, 2)->default(0);
            $table->decimal('current_balance', 16, 2)->default(0);
            $table->string('status')->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('suppliers', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('supplier_type')->nullable();
            $table->string('phone')->nullable();
            $table->string('address')->nullable();
            $table->string('status')->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('supplier_purchase_contracts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('supplier_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('financial_category_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('contract_number')->unique();
            $table->string('item_type');
            $table->decimal('total_amount', 16, 2);
            $table->decimal('down_payment_amount', 16, 2)->default(0);
            $table->decimal('paid_amount', 16, 2)->default(0);
            $table->decimal('remaining_amount', 16, 2)->default(0);
            $table->unsignedInteger('installments_count')->default(0);
            $table->date('installment_start_date')->nullable();
            $table->date('installment_end_date')->nullable();
            $table->date('next_payment_date')->nullable();
            $table->string('status')->default('active');
            $table->string('attachment_path')->nullable();
            $table->string('attachment_original_name')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['supplier_id', 'status']);
            $table->index(['next_payment_date', 'status']);
        });

        Schema::create('supplier_installments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('supplier_purchase_contract_id')->constrained()->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('payment_method_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('accounting_account_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('installment_number');
            $table->date('due_date');
            $table->decimal('amount', 16, 2);
            $table->decimal('paid_amount', 16, 2)->default(0);
            $table->date('paid_at')->nullable();
            $table->string('status')->default('pending');
            $table->string('receipt_number')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['supplier_purchase_contract_id', 'installment_number'], 'supplier_installment_number_unique');
            $table->index(['due_date', 'status']);
        });

        Schema::create('accounting_transactions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('financial_category_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('payment_method_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('accounting_account_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('supplier_installment_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('transaction_number')->unique();
            $table->string('type');
            $table->string('title');
            $table->decimal('amount', 16, 2);
            $table->string('received_from')->nullable();
            $table->string('paid_to')->nullable();
            $table->date('transaction_date');
            $table->string('receipt_number')->nullable();
            $table->string('reference')->nullable();
            $table->string('source_type')->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('status')->default('pending_review');
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('posted_at')->nullable();
            $table->timestamp('reversed_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->string('attachment_path')->nullable();
            $table->string('attachment_original_name')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();

            $table->index(['type', 'status']);
            $table->index(['transaction_date', 'status']);
            $table->index(['source_type', 'source_id']);
        });

        Schema::table('supplier_installments', function (Blueprint $table): void {
            $table->foreignId('accounting_transaction_id')->nullable()->after('recorded_by')->constrained()->nullOnDelete();
        });

        $now = now();

        foreach ([
            ['name' => 'Cash on Hand', 'code' => 'cash_on_hand', 'type' => 'cash'],
            ['name' => 'Bank Account', 'code' => 'bank_account', 'type' => 'bank'],
            ['name' => 'Mobile Money Account', 'code' => 'mobile_money_account', 'type' => 'mobile_money'],
            ['name' => 'Check Clearing Account', 'code' => 'check_clearing_account', 'type' => 'check'],
            ['name' => 'Online Payment Account', 'code' => 'online_payment_account', 'type' => 'online'],
        ] as $account) {
            DB::table('accounting_accounts')->updateOrInsert(
                ['code' => $account['code']],
                $account + ['status' => 'active', 'created_at' => $now, 'updated_at' => $now],
            );
        }

        foreach ([
            ['name' => 'Cash', 'code' => 'cash'],
            ['name' => 'Bank Transfer', 'code' => 'bank_transfer'],
            ['name' => 'Mobile Money', 'code' => 'mobile_money'],
            ['name' => 'Check', 'code' => 'check'],
            ['name' => 'Online Payment', 'code' => 'online_payment'],
        ] as $method) {
            DB::table('payment_methods')->updateOrInsert(
                ['code' => $method['code']],
                $method + ['status' => 'active', 'created_at' => $now, 'updated_at' => $now],
            );
        }

        $incomeCategories = [
            'Water Bill Income',
            'Meter Installation Income',
            'Meter Replacement Income',
            'New Connection Fee',
            'Late Payment Penalty',
            'Shareholder Investment',
            'Service Income',
            'New Booklet Income',
            'Name Change Fee',
            'Warehouse Income',
            'Other Income',
        ];

        $expenseCategories = [
            'Salary Expense',
            'Office Rent',
            'Electricity Bill',
            'Internet Expense',
            'Fuel Expense',
            'Transport Expense',
            'Pipe Repair Expense',
            'Pump Repair Expense',
            'Generator Maintenance',
            'Water System Maintenance',
            'Equipment Purchase',
            'Meter Purchase',
            'Pipe Purchase',
            'Half Inch Purchase',
            'Solar Supplier Purchase',
            'Sprinkler Purchase',
            'Technical Expense',
            'Office Supplies',
            'Stationery',
            'Network Excavation Expense',
            'Damage Compensation',
            'Office Kitchen Expense',
            'Supplier Installment Payment',
            'Other Expense',
        ];

        foreach ($incomeCategories as $name) {
            DB::table('financial_categories')->updateOrInsert(
                ['code' => Str::slug($name, '_')],
                ['name' => $name, 'type' => 'income', 'status' => 'active', 'created_at' => $now, 'updated_at' => $now],
            );
        }

        foreach ($expenseCategories as $name) {
            DB::table('financial_categories')->updateOrInsert(
                ['code' => Str::slug($name, '_')],
                ['name' => $name, 'type' => 'expense', 'status' => 'active', 'created_at' => $now, 'updated_at' => $now],
            );
        }

        $accountByMethod = [
            'cash' => 'cash_on_hand',
            'bank_transfer' => 'bank_account',
            'mobile_money' => 'mobile_money_account',
            'check' => 'check_clearing_account',
            'online_payment' => 'online_payment_account',
        ];
        $incomeCategoryId = DB::table('financial_categories')->where('code', 'water_bill_income')->value('id')
            ?? DB::table('financial_categories')->where('code', 'customer_payment')->value('id');

        DB::table('payments')
            ->join('payment_methods', 'payment_methods.id', '=', 'payments.payment_method_id')
            ->where('payments.status', 'posted')
            ->select('payments.*', 'payment_methods.code as method_code')
            ->orderBy('payments.id')
            ->chunkById(100, function ($payments) use ($accountByMethod, $incomeCategoryId, $now): void {
                foreach ($payments as $payment) {
                    $accountCode = $accountByMethod[$payment->method_code] ?? 'cash_on_hand';
                    $accountId = DB::table('accounting_accounts')->where('code', $accountCode)->value('id');

                    DB::table('accounting_transactions')->insert([
                        'financial_category_id' => $incomeCategoryId,
                        'payment_method_id' => $payment->payment_method_id,
                        'accounting_account_id' => $accountId,
                        'customer_id' => $payment->customer_id,
                        'recorded_by' => $payment->received_by,
                        'approved_by' => $payment->received_by,
                        'transaction_number' => 'INC-'.now()->format('Ymd').'-'.str_pad((string) $payment->id, 5, '0', STR_PAD_LEFT),
                        'type' => 'income',
                        'title' => 'Water bill payment',
                        'amount' => $payment->amount,
                        'received_from' => 'Customer payment',
                        'transaction_date' => $payment->paid_at,
                        'receipt_number' => $payment->receipt_number,
                        'reference' => $payment->reference,
                        'source_type' => 'customer_payment',
                        'source_id' => $payment->id,
                        'status' => 'approved',
                        'approved_at' => $payment->created_at ?? $now,
                        'posted_at' => $payment->created_at ?? $now,
                        'description' => $payment->notes,
                        'created_at' => $payment->created_at ?? $now,
                        'updated_at' => $payment->updated_at ?? $now,
                    ]);

                    if ($accountId) {
                        DB::table('accounting_accounts')->where('id', $accountId)->increment('current_balance', (float) $payment->amount);
                    }
                }
            }, 'payments.id', 'id');
    }

    public function down(): void
    {
        Schema::table('supplier_installments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('accounting_transaction_id');
        });

        Schema::dropIfExists('accounting_transactions');
        Schema::dropIfExists('supplier_installments');
        Schema::dropIfExists('supplier_purchase_contracts');
        Schema::dropIfExists('suppliers');
        Schema::dropIfExists('accounting_accounts');
    }
};
