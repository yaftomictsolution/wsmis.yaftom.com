<?php

namespace App\Services;

use App\Models\AccountingAccount;
use App\Models\AccountingTransaction;
use App\Models\FinancialCategory;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\PaymentMethod;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CustomerPaymentRefundService
{
    public function __construct(
        private readonly AccountingWorkflowService $accounting,
        private readonly CustomerBillingService $billing,
    ) {}

    public function refund(Payment $payment, array $data, User $user): Payment
    {
        $this->accounting->ensureDateIsOpen($data['refunded_at']);

        return DB::transaction(function () use ($payment, $data, $user): Payment {
            $payment = Payment::query()
                ->with(['customer', 'allocations.invoice', 'allocations.charge'])
                ->whereKey($payment->id)
                ->lockForUpdate()
                ->firstOrFail();

            abort_unless($payment->status === 'posted', 422, 'Only a posted customer payment can be refunded.');
            abort_if($payment->customer_deposit_id, 422, 'Legacy contract deposits must use the deposit refund workflow.');

            $amount = round(max(0, (float) $payment->amount - (float) $payment->refunded_amount), 2);
            abort_if($amount <= 0.005, 422, 'This payment has already been fully refunded.');
            [$account, $refundPaymentMethodId] = $this->resolveRefundAccount($payment, $data);
            $refundReceipt = Payment::nextRefundReceiptNumber();
            $transaction = $this->createRefundTransaction(
                $payment,
                $account,
                $refundPaymentMethodId,
                $amount,
                $refundReceipt,
                'customer_payment_refund',
                $payment->id,
                $data,
                $user,
            );

            foreach ($payment->allocations as $allocation) {
                $allocationRefund = round(max(0, (float) $allocation->amount - (float) $allocation->refunded_amount), 2);
                if ($allocationRefund <= 0.005) {
                    continue;
                }
                $allocation->update([
                    'refunded_amount' => (float) $allocation->refunded_amount + $allocationRefund,
                    'refunded_by' => $user->id,
                    'refund_transaction_id' => $transaction->id,
                    'refunded_at' => $data['refunded_at'],
                    'refund_receipt_number' => $refundReceipt,
                    'refund_reference' => $data['refund_reference'] ?? null,
                    'refund_reason' => $data['refund_reason'],
                ]);
            }

            $payment->update([
                'refunded_by' => $user->id,
                'refund_transaction_id' => $transaction->id,
                'refunded_amount' => min((float) $payment->amount, (float) $payment->refunded_amount + $amount),
                'refunded_at' => $data['refunded_at'],
                'refund_receipt_number' => $refundReceipt,
                'refund_reference' => $data['refund_reference'] ?? null,
                'refund_reason' => $data['refund_reason'],
                'status' => 'refunded',
            ]);

            $invoiceIds = $payment->allocations->pluck('invoice_id')->filter()->unique();
            foreach ($invoiceIds as $invoiceId) {
                $this->billing->syncInvoice((int) $invoiceId);
            }
            $this->billing->syncCustomerBalance($payment->customer_id);

            return $payment->fresh()->load([
                'customer:id,name,phone,house_number',
                'paymentMethod:id,name,code',
                'account:id,name,code,type,current_balance',
                'receiver:id,name',
                'refunder:id,name',
                'refundTransaction.account:id,name,code,type,current_balance',
                'allocations.invoice:id,invoice_number,invoice_type,total_amount,paid_amount,remaining_amount,status',
            ]);
        });
    }

    public function refundInvoiceAllocation(Payment $payment, int $invoiceId, array $data, User $user): Payment
    {
        $this->accounting->ensureDateIsOpen($data['refunded_at']);

        return DB::transaction(function () use ($payment, $invoiceId, $data, $user): Payment {
            $payment = Payment::query()
                ->with(['customer'])
                ->whereKey($payment->id)
                ->lockForUpdate()
                ->firstOrFail();

            abort_unless($payment->status === 'posted', 422, 'Only a posted customer payment can be refunded.');
            abort_if($payment->customer_deposit_id, 422, 'Legacy contract deposits must use the deposit refund workflow.');

            $allocations = PaymentAllocation::query()
                ->with('invoice')
                ->where('payment_id', $payment->id)
                ->where('invoice_id', $invoiceId)
                ->lockForUpdate()
                ->get();
            $amount = round((float) $allocations->sum(fn (PaymentAllocation $allocation): float => max(0, (float) $allocation->amount - (float) $allocation->refunded_amount)), 2);
            abort_if($amount <= 0.005, 422, 'This receipt has no refundable amount for the selected invoice.');

            [$account, $refundPaymentMethodId] = $this->resolveRefundAccount($payment, $data);
            $refundReceipt = Payment::nextRefundReceiptNumber();
            $transaction = $this->createRefundTransaction(
                $payment,
                $account,
                $refundPaymentMethodId,
                $amount,
                $refundReceipt,
                'customer_payment_allocation_refund',
                $allocations->first()->id,
                $data,
                $user,
            );

            foreach ($allocations as $allocation) {
                $allocationRefund = round(max(0, (float) $allocation->amount - (float) $allocation->refunded_amount), 2);
                if ($allocationRefund <= 0.005) {
                    continue;
                }
                $allocation->update([
                    'refunded_amount' => (float) $allocation->refunded_amount + $allocationRefund,
                    'refunded_by' => $user->id,
                    'refund_transaction_id' => $transaction->id,
                    'refunded_at' => $data['refunded_at'],
                    'refund_receipt_number' => $refundReceipt,
                    'refund_reference' => $data['refund_reference'] ?? null,
                    'refund_reason' => $data['refund_reason'],
                ]);
            }

            $refunded = round(min((float) $payment->amount, (float) $payment->refunded_amount + $amount), 2);
            $payment->update([
                'refunded_by' => $user->id,
                'refund_transaction_id' => $transaction->id,
                'refunded_amount' => $refunded,
                'refunded_at' => $data['refunded_at'],
                'refund_receipt_number' => $refundReceipt,
                'refund_reference' => $data['refund_reference'] ?? null,
                'refund_reason' => $data['refund_reason'],
                'status' => $refunded + 0.005 >= (float) $payment->amount ? 'refunded' : 'posted',
            ]);

            $this->billing->syncInvoice($invoiceId);
            $this->billing->syncCustomerBalance($payment->customer_id);

            return $payment->fresh()->load([
                'customer:id,name,phone,house_number',
                'paymentMethod:id,name,code',
                'account:id,name,code,type,current_balance',
                'receiver:id,name',
                'refunder:id,name',
                'refundTransaction.account:id,name,code,type,current_balance',
                'allocations.invoice:id,invoice_number,invoice_type,total_amount,paid_amount,remaining_amount,status',
            ]);
        });
    }

    private function createRefundTransaction(
        Payment $payment,
        AccountingAccount $account,
        int $paymentMethodId,
        float $amount,
        string $refundReceipt,
        string $sourceType,
        int $sourceId,
        array $data,
        User $user,
    ): AccountingTransaction {
        if ((float) $account->current_balance + 0.005 < $amount) {
            throw ValidationException::withMessages([
                'accounting_account_id' => ['The selected refund account does not have enough balance for this refund.'],
            ]);
        }

        $category = FinancialCategory::query()->firstOrCreate(
            ['code' => 'customer_payment_refund'],
            ['name' => 'Customer Payment Refunds', 'type' => 'expense', 'status' => 'active'],
        );

        $transaction = AccountingTransaction::query()->create([
            'financial_category_id' => $category->id,
            'payment_method_id' => $paymentMethodId,
            'accounting_account_id' => $account->id,
            'customer_id' => $payment->customer_id,
            'recorded_by' => $user->id,
            'reviewed_by' => $user->id,
            'approved_by' => $user->id,
            'transaction_number' => AccountingTransaction::nextNumber('customer_refund'),
            'type' => 'customer_refund',
            'title' => 'Customer payment refund - '.$payment->receipt_number,
            'amount' => $amount,
            'paid_to' => $payment->customer?->name ?? 'Customer',
            'transaction_date' => $data['refunded_at'],
            'receipt_number' => $refundReceipt,
            'reference' => $data['refund_reference'] ?? null,
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'status' => 'approved',
            'reviewed_at' => now(),
            'approved_at' => now(),
            'description' => $data['refund_reason'],
        ]);
        $transaction->postToAccount();

        return $transaction;
    }

    private function resolveRefundAccount(Payment $payment, array $data): array
    {
        $accountId = (int) ($data['accounting_account_id'] ?? $payment->accounting_account_id);
        $account = AccountingAccount::query()
            ->whereKey($accountId)
            ->lockForUpdate()
            ->firstOrFail();
        if ($account->status !== 'active') {
            throw ValidationException::withMessages([
                'accounting_account_id' => ['The selected refund account must be active.'],
            ]);
        }

        $canonicalMethodCode = match ($account->type) {
            'bank' => 'bank_transfer',
            'mobile_money' => 'mobile_money',
            'check' => 'check',
            'online' => 'online_payment',
            default => 'cash',
        };

        $paymentMethod = PaymentMethod::query()
            ->whereKey($payment->payment_method_id)
            ->where('status', 'active')
            ->first();
        if ($paymentMethod && $this->accountTypeForPaymentMethod($paymentMethod) !== $account->type) {
            $paymentMethod = null;
        }

        $paymentMethod ??= PaymentMethod::query()
            ->where('code', $canonicalMethodCode)
            ->where('status', 'active')
            ->first();
        $paymentMethod ??= PaymentMethod::query()
            ->where('status', 'active')
            ->get()
            ->first(fn (PaymentMethod $method): bool => $this->accountTypeForPaymentMethod($method) === $account->type);

        if (! $paymentMethod) {
            throw ValidationException::withMessages([
                'accounting_account_id' => ["No active payment method is compatible with the selected {$account->type} account."],
            ]);
        }

        return [$account, $paymentMethod->id];
    }

    private function accountTypeForPaymentMethod(PaymentMethod $method): string
    {
        $code = strtolower(str_replace(['-', ' '], '_', trim($method->code)));

        return match (true) {
            $code === 'bank', str_starts_with($code, 'bank_') => 'bank',
            $code === 'mobile', str_starts_with($code, 'mobile_') => 'mobile_money',
            $code === 'check', str_starts_with($code, 'check_') => 'check',
            $code === 'online', str_starts_with($code, 'online_') => 'online',
            default => 'cash',
        };
    }
}
