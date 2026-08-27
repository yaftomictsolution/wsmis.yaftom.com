<?php

namespace App\Services;

use App\Models\AccountingAccount;
use App\Models\AccountingTransaction;
use App\Models\Customer;
use App\Models\CustomerCharge;
use App\Models\CustomerContract;
use App\Models\CustomerDeposit;
use App\Models\FinancialCategory;
use App\Models\Invoice;
use App\Models\MeterAssignment;
use App\Models\Payment;
use App\Models\User;
use App\Notifications\CustomerContractConfirmedNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

class CustomerContractWorkflowService
{
    public function __construct(
        private readonly AccountingWorkflowService $accounting,
        private readonly CustomerBillingService $billing,
        private readonly CustomerPaymentRefundService $paymentRefunds,
        private readonly MeterInventoryService $meterInventory,
    ) {}

    public function create(Customer $customer, array $data, User $user): CustomerContract
    {
        return DB::transaction(function () use ($customer, $data, $user): CustomerContract {
            $customer = Customer::query()->whereKey($customer->id)->lockForUpdate()->firstOrFail();
            $hasOpenContract = $customer->contracts()
                ->whereIn('status', ['draft', 'printed', 'installation_pending', 'pending_approval', 'approved', 'active'])
                ->exists();

            if ($hasOpenContract) {
                throw ValidationException::withMessages([
                    'customer_id' => ['This customer already has an open contract. Finish or cancel it before creating another contract.'],
                ]);
            }

            $financials = $this->validateFinancials($data);
            $contract = $customer->contracts()->create(array_merge($data, $financials, [
                'created_by' => $user->id,
                'updated_by' => $user->id,
                'contract_number' => CustomerContract::nextNumber(),
                'deposited_amount' => 0,
                'applied_amount' => 0,
                'remaining_amount' => $financials['net_amount'],
                'status' => 'draft',
            ]));

            $customer->update(['status' => 'registered']);
            $this->syncLegacyCustomer($contract->fresh());

            return $contract->fresh()->load($this->relations());
        });
    }

    public function update(CustomerContract $contract, array $data, User $user): CustomerContract
    {
        abort_unless(in_array($contract->status, ['draft', 'printed'], true), 422, 'Only draft contracts can be edited.');

        return DB::transaction(function () use ($contract, $data, $user): CustomerContract {
            $contract = CustomerContract::query()->whereKey($contract->id)->lockForUpdate()->firstOrFail();
            $values = array_merge($contract->only([
                'subscription_date', 'meter_size', 'connection_fee', 'meter_fee', 'discount_amount',
                'required_initial_payment', 'discount_approved_by', 'discount_authority_id', 'notes',
            ]), $data);
            $financials = $this->validateFinancials($values);
            $held = $this->heldDepositAmount($contract);

            if ($held > $financials['net_amount'] + 0.005) {
                throw ValidationException::withMessages([
                    'connection_fee' => ['The revised contract total cannot be less than deposits already received. Refund or correct the deposit first.'],
                ]);
            }

            $contract->update(array_merge($data, $financials, [
                'updated_by' => $user->id,
                'remaining_amount' => max(0, $financials['net_amount'] - $held),
            ]));
            $this->syncLegacyCustomer($contract->fresh());

            return $contract->fresh()->load($this->relations());
        });
    }

    public function markPrinted(CustomerContract $contract): CustomerContract
    {
        abort_unless(in_array($contract->status, ['draft', 'printed'], true), 422, 'Only a draft contract can be marked as printed.');
        $contract->update(['status' => 'printed', 'printed_at' => now()]);
        $this->syncLegacyCustomer($contract->fresh());

        return $contract->fresh()->load($this->relations());
    }

    public function confirm(CustomerContract $contract, User $user): CustomerContract
    {
        $confirmed = DB::transaction(function () use ($contract, $user): CustomerContract {
            $contract = CustomerContract::query()->whereKey($contract->id)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($contract->status, ['draft', 'printed', 'pending_approval', 'approved'], true), 422, 'Only a draft contract can be confirmed.');

            $contract->update([
                'status' => 'installation_pending',
                'confirmed_at' => now(),
                'confirmed_by' => $user->id,
                'updated_by' => $user->id,
                'rejected_by' => null,
                'rejected_at' => null,
                'rejection_reason' => null,
            ]);
            $invoice = $this->ensureContractInvoice($contract->fresh(), $user);
            $deposits = $contract->deposits()
                ->where('status', 'pending')
                ->orderBy('received_at')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            foreach ($deposits as $deposit) {
                $this->applyDeposit($contract, $deposit, $invoice, $user);
            }

            $contract->customer()->update(['status' => 'awaiting_installation']);
            $this->refreshAmounts($contract);
            $this->syncLegacyCustomer($contract->fresh());

            $existingActiveAssignment = MeterAssignment::query()
                ->where('customer_id', $contract->customer_id)
                ->where('status', 'active')
                ->where(function ($query) use ($contract): void {
                    $query->whereNull('customer_contract_id')
                        ->orWhere('customer_contract_id', $contract->id);
                })
                ->latest('installation_date')
                ->latest('id')
                ->lockForUpdate()
                ->first();

            if ($existingActiveAssignment) {
                $existingActiveAssignment->update(['customer_contract_id' => $contract->id]);

                return $this->activateConfirmedContract(
                    $contract->fresh(),
                    $user,
                    $existingActiveAssignment->installation_date?->toDateString(),
                );
            }

            return $contract->fresh()->load($this->relations());
        });

        $admins = User::query()
            ->where('status', 'active')
            ->whereHas('roles', fn ($query) => $query->whereIn('name', ['Admin', 'Super Admin']))
            ->get();
        Notification::send($admins, new CustomerContractConfirmedNotification($confirmed, $user));

        return $confirmed;
    }

    public function cancel(CustomerContract $contract, User $user, string $reason, array $options = []): CustomerContract
    {
        return DB::transaction(function () use ($contract, $user, $reason, $options): CustomerContract {
            $contract = CustomerContract::query()->whereKey($contract->id)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($contract->status, ['draft', 'printed', 'installation_pending', 'active'], true), 422, 'This contract cannot be cancelled.');

            $invoice = $contract->invoice()->with('allocations.payment')->lockForUpdate()->first();
            if ($invoice) {
                $ordinaryPayments = Payment::query()
                    ->with('allocations')
                    ->where('status', 'posted')
                    ->whereNull('customer_deposit_id')
                    ->whereHas('allocations', fn ($query) => $query->where('invoice_id', $invoice->id))
                    ->lockForUpdate()
                    ->get();

                if ($ordinaryPayments->isNotEmpty()) {
                    abort_unless(
                        (bool) ($options['refund_posted_payments'] ?? false),
                        422,
                        'This contract has posted payments. Confirm the customer refund in the cancellation form before cancelling the contract.',
                    );

                    foreach ($ordinaryPayments as $payment) {
                        $this->paymentRefunds->refundInvoiceAllocation($payment, $invoice->id, [
                            'refunded_at' => $options['refunded_at'] ?? now()->toDateString(),
                            'accounting_account_id' => $options['refund_accounting_account_id'] ?? null,
                            'refund_reference' => $options['refund_reference'] ?? null,
                            'refund_reason' => "Contract {$contract->contract_number} cancellation: {$reason}",
                        ], $user);
                    }
                }

                Payment::query()
                    ->where('status', 'posted')
                    ->whereNotNull('customer_deposit_id')
                    ->whereHas('allocations', fn ($query) => $query->where('invoice_id', $invoice->id))
                    ->update(['status' => 'cancelled']);

                $contract->deposits()
                    ->whereIn('status', ['applied', 'partially_applied'])
                    ->get()
                    ->each(function (CustomerDeposit $deposit): void {
                        $deposit->allocations()->delete();
                        $deposit->update([
                            'payment_id' => null,
                            'applied_by' => null,
                            'applied_amount' => 0,
                            'applied_at' => null,
                            'status' => 'refund_required',
                        ]);
                    });

                $this->billing->cancelInvoice($invoice);
            }

            $contract->deposits()->where('status', 'pending')->update(['status' => 'refund_required']);
            $this->removeActiveMeterAssignments($contract, $user, $reason);
            $this->refreshAmounts($contract);
            $contract->update([
                'status' => 'cancelled',
                'updated_by' => $user->id,
                'cancelled_at' => now(),
                'rejection_reason' => $reason,
                'remaining_amount' => 0,
            ]);
            $contract->customer()->update(['status' => 'registered']);
            $this->billing->syncCustomerBalance($contract->customer_id);
            $this->syncLegacyCustomer($contract->fresh());

            return $contract->fresh()->load($this->relations());
        });
    }

    private function removeActiveMeterAssignments(CustomerContract $contract, User $user, string $reason): void
    {
        $removedAt = now();
        $assignments = $contract->meterAssignments()
            ->with(['meter', 'seals'])
            ->where('status', 'active')
            ->lockForUpdate()
            ->get();

        foreach ($assignments as $assignment) {
            $assignment->seals()
                ->where('status', 'intact')
                ->latest('id')
                ->lockForUpdate()
                ->first()?->update([
                    'status' => 'removed',
                    'removed_by' => $user->id,
                    'removed_at' => $removedAt,
                    'removal_reason' => "Contract {$contract->contract_number} cancelled: {$reason}",
                ]);

            $assignment->update([
                'status' => 'removed',
                'removed_at' => $removedAt,
                'notes' => trim(($assignment->notes ? "{$assignment->notes}\n" : '')."Removed because contract {$contract->contract_number} was cancelled."),
            ]);

            if ($assignment->meter) {
                $this->meterInventory->releaseFromAssignment(
                    $assignment,
                    $user,
                    'return_to_stock',
                    $assignment->meter->source_warehouse_id,
                    "Contract {$contract->contract_number} cancelled: {$reason}",
                    $removedAt,
                );
            }
        }
    }

    public function refundDeposit(CustomerDeposit $deposit, array $data, User $user): CustomerDeposit
    {
        $this->accounting->ensureDateIsOpen($data['refunded_at']);

        return DB::transaction(function () use ($deposit, $data, $user): CustomerDeposit {
            $deposit = CustomerDeposit::query()->whereKey($deposit->id)->lockForUpdate()->firstOrFail();
            $deposit->loadMissing('contract');
            abort_unless($deposit->status === 'refund_required', 422, 'Only a deposit marked for refund can be refunded.');
            abort_unless(in_array($deposit->contract->status, ['rejected', 'cancelled'], true), 422, 'The contract must be rejected or cancelled before refunding its deposit.');

            $amount = $deposit->availableAmount();
            abort_if($amount <= 0, 422, 'This deposit has no refundable balance.');

            $account = AccountingAccount::query()->whereKey($deposit->accounting_account_id)->lockForUpdate()->firstOrFail();
            if ((float) $account->current_balance + 0.005 < $amount) {
                throw ValidationException::withMessages([
                    'accounting_account_id' => ['The original receiving account does not have enough balance for this refund.'],
                ]);
            }

            $category = FinancialCategory::query()->firstOrCreate(
                ['code' => 'customer_deposit_refund'],
                ['name' => 'Customer Deposit Refunds', 'type' => 'liability', 'status' => 'active'],
            );
            $refundReceipt = CustomerDeposit::nextRefundReceiptNumber();
            $transaction = AccountingTransaction::query()->create([
                'financial_category_id' => $category->id,
                'payment_method_id' => $deposit->payment_method_id,
                'accounting_account_id' => $deposit->accounting_account_id,
                'customer_id' => $deposit->customer_id,
                'recorded_by' => $user->id,
                'reviewed_by' => $user->id,
                'approved_by' => $user->id,
                'transaction_number' => AccountingTransaction::nextNumber('deposit_refund'),
                'type' => 'deposit_refund',
                'title' => 'Customer contract deposit refunded',
                'amount' => $amount,
                'paid_to' => $deposit->customer()->value('name'),
                'transaction_date' => $data['refunded_at'],
                'receipt_number' => $refundReceipt,
                'reference' => $data['refund_reference'] ?? null,
                'source_type' => 'customer_deposit_refund',
                'source_id' => $deposit->id,
                'status' => 'approved',
                'reviewed_at' => now(),
                'approved_at' => now(),
                'description' => $data['refund_reason'],
            ]);
            $transaction->postToAccount();

            $deposit->update([
                'refund_transaction_id' => $transaction->id,
                'refunded_by' => $user->id,
                'refunded_amount' => $amount,
                'refunded_at' => $data['refunded_at'],
                'refund_receipt_number' => $refundReceipt,
                'refund_reference' => $data['refund_reference'] ?? null,
                'refund_reason' => $data['refund_reason'],
                'status' => 'refunded',
            ]);
            $this->refreshAmounts($deposit->contract);
            $this->syncLegacyCustomer($deposit->contract->fresh());

            return $deposit->fresh()->load($this->depositRelations());
        });
    }

    public function activate(CustomerContract $contract, User $user, ?string $activationDate = null): CustomerContract
    {
        return DB::transaction(function () use ($contract, $user, $activationDate): CustomerContract {
            $contract = CustomerContract::query()->whereKey($contract->id)->lockForUpdate()->firstOrFail();
            abort_unless($contract->status === 'installation_pending', 422, 'The customer contract must be confirmed before the first meter is installed.');

            return $this->activateConfirmedContract($contract, $user, $activationDate);
        });
    }

    private function activateConfirmedContract(CustomerContract $contract, User $user, ?string $activationDate = null): CustomerContract
    {
        $invoice = $this->ensureContractInvoice($contract, $user);

        $deposits = $contract->deposits()->where('status', 'pending')->orderBy('received_at')->orderBy('id')->lockForUpdate()->get();
        foreach ($deposits as $deposit) {
            $this->applyDeposit($contract, $deposit, $invoice, $user);
        }

        $contract->update([
            'status' => 'active',
            'activated_at' => now(),
            'updated_by' => $user->id,
        ]);
        $contract->customer()->update(['status' => 'active']);

        $contract->deposits()
            ->with('allocations.charge')
            ->whereIn('status', ['applied', 'partially_applied'])
            ->get()
            ->each(function (CustomerDeposit $deposit) use ($contract, $user, $activationDate): void {
                foreach ($deposit->allocations as $allocation) {
                    if ($allocation->charge && (float) $allocation->amount > 0) {
                        $this->recognizeAppliedDepositRevenue(
                            $contract,
                            $deposit,
                            $allocation->charge,
                            $allocation->id,
                            (float) $allocation->amount,
                            $user,
                            $activationDate,
                        );
                    }
                }
            });

        $this->refreshAmounts($contract);
        $this->syncLegacyCustomer($contract->fresh());

        return $contract->fresh()->load($this->relations());
    }

    private function applyDeposit(CustomerContract $contract, CustomerDeposit $deposit, Invoice $invoice, User $user): void
    {
        $available = $deposit->availableAmount();
        $payable = (float) $invoice->fresh()->remaining_amount;
        $paymentAmount = min($available, $payable);
        if ($paymentAmount <= 0) {
            return;
        }

        $payment = Payment::query()->create([
            'invoice_id' => $invoice->id,
            'customer_id' => $contract->customer_id,
            'customer_contract_id' => $contract->id,
            'customer_deposit_id' => $deposit->id,
            'payment_method_id' => $deposit->payment_method_id,
            'accounting_account_id' => $deposit->accounting_account_id,
            'received_by' => $deposit->received_by,
            'receipt_number' => Payment::nextReceiptNumber(),
            'amount' => $paymentAmount,
            'paid_at' => $deposit->received_at,
            'reference' => $deposit->receipt_number,
            'status' => 'posted',
            'notes' => 'Legacy contract deposit applied to the confirmed contract invoice. Cash was posted when the deposit was received.',
        ]);
        $payment->allocations()->create([
            'invoice_id' => $invoice->id,
            'customer_charge_id' => null,
            'amount' => $paymentAmount,
        ]);

        $charges = $contract->charges()->where('status', 'posted')->orderBy('id')->get();
        $remaining = $paymentAmount;
        foreach ($charges as $charge) {
            if ($remaining <= 0 || (float) $charge->remaining_amount <= 0) {
                continue;
            }

            $amount = min($remaining, (float) $charge->remaining_amount);
            $deposit->allocations()->create(['customer_charge_id' => $charge->id, 'amount' => $amount]);
            $remaining -= $amount;
        }

        $applied = (float) $deposit->applied_amount + ($paymentAmount - $remaining);
        $deposit->update([
            'payment_id' => $payment->id,
            'applied_by' => $user->id,
            'applied_amount' => $applied,
            'applied_at' => now(),
            'status' => $applied + 0.005 >= (float) $deposit->amount ? 'applied' : 'partially_applied',
        ]);
        $this->billing->syncInvoice($invoice, $deposit->received_at->toDateString());
    }

    private function recognizeAppliedDepositRevenue(CustomerContract $contract, CustomerDeposit $deposit, CustomerCharge $charge, int $allocationId, float $amount, User $user, ?string $activationDate): void
    {
        AccountingTransaction::query()->firstOrCreate(
            ['source_type' => 'customer_deposit_application', 'source_id' => $allocationId],
            [
                'financial_category_id' => $charge->financial_category_id,
                'payment_method_id' => $deposit->payment_method_id,
                'accounting_account_id' => null,
                'customer_id' => $contract->customer_id,
                'recorded_by' => $user->id,
                'reviewed_by' => $user->id,
                'approved_by' => $user->id,
                'transaction_number' => AccountingTransaction::nextNumber('income'),
                'type' => 'income',
                'title' => $charge->title.' recognized from customer deposit',
                'amount' => $amount,
                'received_from' => $contract->customer()->value('name'),
                'transaction_date' => $activationDate ?? now()->toDateString(),
                'receipt_number' => $deposit->receipt_number,
                'reference' => $contract->contract_number,
                'status' => 'approved',
                'reviewed_at' => now(),
                'approved_at' => now(),
                'description' => 'Revenue recognized at service activation. The cash movement is recorded by the original customer deposit transaction.',
            ],
        );
    }

    private function ensureContractInvoice(CustomerContract $contract, User $user): Invoice
    {
        $charges = $contract->charges()->where('status', 'posted')->orderBy('id')->get();
        [$connectionAmount, $meterAmount] = $this->discountedChargeAmounts($contract);
        $issueDate = $contract->subscription_date?->toDateString()
            ?? $contract->confirmed_at?->toDateString()
            ?? $contract->approved_at?->toDateString()
            ?? now()->toDateString();

        if ($connectionAmount > 0) {
            $charges->push($this->createContractCharge(
                $contract,
                $user,
                'connection_fee',
                'Connection fee',
                $connectionAmount,
                'connection_fee_income',
                $issueDate,
            ));
        }
        if ($meterAmount > 0) {
            $charges->push($this->createContractCharge(
                $contract,
                $user,
                'meter_fee',
                'Meter installation fee',
                $meterAmount,
                'meter_installation_fee',
                $issueDate,
            ));
        }

        return $this->billing->issueContractInvoice($contract, $charges->unique('id')->values(), $issueDate);
    }

    private function createContractCharge(CustomerContract $contract, User $user, string $type, string $title, float $amount, string $categoryCode, ?string $activationDate): CustomerCharge
    {
        $existing = $contract->charges()
            ->where('type', $type)
            ->where('status', 'posted')
            ->first();
        if ($existing) {
            return $existing;
        }

        $category = FinancialCategory::query()->firstOrCreate(
            ['code' => $categoryCode],
            ['name' => $title.' Income', 'type' => 'income', 'status' => 'active'],
        );

        return CustomerCharge::query()->create([
            'customer_id' => $contract->customer_id,
            'customer_contract_id' => $contract->id,
            'financial_category_id' => $category->id,
            'created_by' => $user->id,
            'title' => $title,
            'type' => $type,
            'amount' => $amount,
            'paid_amount' => 0,
            'remaining_amount' => $amount,
            'charge_date' => $activationDate ?? now()->toDateString(),
            'status' => 'posted',
            'notes' => 'Created automatically when the customer contract was confirmed and invoiced.',
        ]);
    }

    private function validateFinancials(array $data): array
    {
        $connection = (float) ($data['connection_fee'] ?? 0);
        $meter = (float) ($data['meter_fee'] ?? 0);
        $discount = (float) ($data['discount_amount'] ?? 0);
        $gross = $connection + $meter;
        $net = $gross - $discount;

        if ($gross <= 0) {
            throw ValidationException::withMessages(['connection_fee' => ['The contract must contain a connection fee or meter fee.']]);
        }
        if ($discount > $gross + 0.005) {
            throw ValidationException::withMessages(['discount_amount' => ['Discount cannot be greater than the contract fees.']]);
        }
        if ($discount > 0 && empty($data['discount_authority_id'])) {
            throw ValidationException::withMessages(['discount_authority_id' => ['Select the authority who granted this discount.']]);
        }

        return ['net_amount' => round($net, 2), 'required_initial_payment' => 0];
    }

    private function discountedChargeAmounts(CustomerContract $contract): array
    {
        $discount = (float) $contract->discount_amount;
        $connection = max(0, (float) $contract->connection_fee - $discount);
        $remainingDiscount = max(0, $discount - (float) $contract->connection_fee);
        $meter = max(0, (float) $contract->meter_fee - $remainingDiscount);

        return [round($connection, 2), round($meter, 2)];
    }

    private function heldDepositAmount(CustomerContract $contract): float
    {
        return (float) $contract->deposits()
            ->selectRaw('COALESCE(SUM(amount - refunded_amount), 0) as total')
            ->value('total');
    }

    private function refreshAmounts(CustomerContract $contract): void
    {
        $deposited = $this->heldDepositAmount($contract);
        $applied = (float) $contract->deposits()->sum('applied_amount');
        $offset = $contract->status === 'active' ? $applied : $deposited;
        $invoiceRemaining = $contract->invoice()
            ->where('status', '!=', 'cancelled')
            ->value('remaining_amount');
        $contract->update([
            'deposited_amount' => $deposited,
            'applied_amount' => $applied,
            'remaining_amount' => $invoiceRemaining !== null
                ? max(0, (float) $invoiceRemaining)
                : max(0, (float) $contract->net_amount - $offset),
        ]);
    }

    private function syncLegacyCustomer(CustomerContract $contract): void
    {
        $payment = $contract->deposits()->whereNotNull('payment_id')->latest()->first();
        $firstDeposit = $contract->deposits()->oldest()->first();
        $invoice = $contract->invoice()->where('status', '!=', 'cancelled')->first();
        $contract->customer()->update([
            'subscription_date' => $contract->subscription_date,
            'meter_size' => $contract->meter_size,
            'connection_fee' => $contract->connection_fee,
            'meter_fee' => $contract->meter_fee,
            'agreement_discount_amount' => $contract->discount_amount,
            'agreement_paid_amount' => $invoice?->paid_amount ?? $contract->deposited_amount,
            'agreement_payment_method_id' => $firstDeposit?->payment_method_id,
            'agreement_accounting_account_id' => $firstDeposit?->accounting_account_id,
            'agreement_payment_received_by' => $firstDeposit?->received_by,
            'agreement_payment_date' => $firstDeposit?->received_at,
            'agreement_payment_reference' => $firstDeposit?->reference,
            'agreement_payment_id' => $payment?->payment_id,
            'agreement_remaining_amount' => $contract->remaining_amount,
            'discount_approved_by' => $contract->discount_approved_by,
            'agreement_status' => $contract->status,
            'agreement_printed_at' => $contract->printed_at,
            'submitted_for_approval_at' => $contract->confirmed_at ?? $contract->submitted_at,
            'approved_by' => $contract->approved_by,
            'approved_at' => $contract->approved_at,
            'rejected_by' => $contract->rejected_by,
            'rejected_at' => $contract->rejected_at,
            'rejection_reason' => $contract->rejection_reason,
        ]);
    }

    public function relations(): array
    {
        return [
            'customer:id,name,last_name,phone,house_number,service_area_id,status',
            'creator:id,name', 'updater:id,name', 'submitter:id,name', 'confirmer:id,name', 'approver:id,name', 'rejector:id,name',
            'discountAuthority:id,authority_number,name,father_name,title,status',
            'deposits.paymentMethod:id,name,code',
            'deposits.account:id,name,code,type,current_balance',
            'deposits.receiver:id,name', 'deposits.applier:id,name', 'deposits.refunder:id,name',
            'invoice.items.category:id,name,type',
            'invoice.allocations.payment.paymentMethod:id,name,code',
            'invoice.allocations.payment.account:id,name,code,type,current_balance',
            'invoice.allocations.payment.receiver:id,name',
            'invoice.allocations.payment.refunder:id,name',
            'meterAssignments.meter:id,meter_number,status',
            'pendingCancellation.requester:id,name',
            'pendingCancellation.resolver:id,name',
            'pendingCancellation.items.warehouse:id,name,code,status',
        ];
    }

    public function depositRelations(): array
    {
        return [
            'contract:id,customer_id,contract_number,status,net_amount,remaining_amount',
            'customer:id,name,phone,house_number',
            'paymentMethod:id,name,code', 'account:id,name,code,type,current_balance',
            'receiver:id,name', 'applier:id,name', 'refunder:id,name',
            'payment:id,receipt_number,amount,paid_at,status',
            'allocations.charge:id,title,type,amount,paid_amount,remaining_amount,status',
        ];
    }
}
