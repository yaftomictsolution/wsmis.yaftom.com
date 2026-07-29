<?php

namespace App\Services;

use App\Models\AccountingTransaction;
use App\Models\Customer;
use App\Models\CustomerCharge;
use App\Models\FinancialCategory;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CustomerContractAccountingService
{
    public function __construct(private readonly AccountingWorkflowService $workflow) {}

    public function approve(Customer $customer, User $approver): Customer
    {
        return DB::transaction(function () use ($customer, $approver): Customer {
            $customer = Customer::query()->whereKey($customer->id)->lockForUpdate()->firstOrFail();

            abort_if($customer->contractAllowsWorkflow(), 422, 'This customer contract is already approved.');

            $connectionFee = (float) $customer->connection_fee;
            $meterFee = (float) $customer->meter_fee;
            $discount = (float) $customer->agreement_discount_amount;
            $paid = (float) $customer->agreement_paid_amount;
            $grossAmount = $connectionFee + $meterFee;
            $netAmount = $grossAmount - $discount;

            if ($discount > $grossAmount + 0.005) {
                throw ValidationException::withMessages([
                    'agreement_discount_amount' => ['Discount cannot be greater than the connection and meter fees.'],
                ]);
            }

            if ($paid > $netAmount + 0.005) {
                throw ValidationException::withMessages([
                    'agreement_paid_amount' => ['Paid amount cannot be greater than the amount due after discount.'],
                ]);
            }

            if ($paid > 0) {
                $this->validatePaymentDestination($customer);
            }

            [$connectionAmount, $meterAmount] = $this->discountedFeeAmounts($connectionFee, $meterFee, $discount);
            $chargeDate = $customer->subscription_date?->toDateString() ?? now()->toDateString();
            $charges = collect();

            if ($connectionAmount > 0) {
                $charges->push($this->createCharge(
                    customer: $customer,
                    creator: $approver,
                    categoryCode: 'new_connection_fee',
                    categoryName: 'New Connection Fee',
                    title: 'Customer connection fee',
                    type: 'connection_fee',
                    amount: $connectionAmount,
                    chargeDate: $chargeDate,
                    notes: $discount > 0 ? 'Contract discount is applied to the connection fee first.' : null,
                ));
            }

            if ($meterAmount > 0) {
                $charges->push($this->createCharge(
                    customer: $customer,
                    creator: $approver,
                    categoryCode: 'meter_installation_income',
                    categoryName: 'Meter Installation Income',
                    title: 'Customer meter fee',
                    type: 'meter_fee',
                    amount: $meterAmount,
                    chargeDate: $chargeDate,
                ));
            }

            $payment = $paid > 0
                ? $this->createPayment($customer, $charges->all(), $paid, $approver)
                : null;
            $remainingAmount = max(0, $netAmount - $paid);

            $customer->forceFill([
                'agreement_status' => 'approved',
                'status' => 'active',
                'agreement_remaining_amount' => $remainingAmount,
                'opening_balance' => 0,
                'current_balance' => $remainingAmount,
                'agreement_payment_id' => $payment?->id,
                'approved_by' => $approver->id,
                'approved_at' => now(),
                'rejected_by' => null,
                'rejected_at' => null,
                'rejection_reason' => null,
            ])->save();

            return $customer->fresh();
        });
    }

    private function validatePaymentDestination(Customer $customer): void
    {
        $errors = [];

        if (! $customer->agreement_payment_method_id) {
            $errors['agreement_payment_method_id'] = ['Select a payment method for the paid amount.'];
        }
        if (! $customer->agreement_accounting_account_id) {
            $errors['agreement_accounting_account_id'] = ['Select the account that will receive the paid amount.'];
        }
        if (! $customer->agreement_payment_date) {
            $errors['agreement_payment_date'] = ['Select the date when the paid amount was received.'];
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        $date = $customer->agreement_payment_date->toDateString();
        $this->workflow->ensureDateIsOpen($date);
        $this->workflow->ensureCompatibleAccount(
            (int) $customer->agreement_payment_method_id,
            (int) $customer->agreement_accounting_account_id,
        );
    }

    private function discountedFeeAmounts(float $connectionFee, float $meterFee, float $discount): array
    {
        $connectionDiscount = min($connectionFee, $discount);
        $remainingDiscount = max(0, $discount - $connectionDiscount);

        return [
            max(0, $connectionFee - $connectionDiscount),
            max(0, $meterFee - min($meterFee, $remainingDiscount)),
        ];
    }

    private function createCharge(
        Customer $customer,
        User $creator,
        string $categoryCode,
        string $categoryName,
        string $title,
        string $type,
        float $amount,
        string $chargeDate,
        ?string $notes = null,
    ): CustomerCharge {
        $category = FinancialCategory::query()->firstOrCreate(
            ['code' => $categoryCode],
            ['name' => $categoryName, 'type' => 'income', 'status' => 'active'],
        );

        return CustomerCharge::query()->create([
            'customer_id' => $customer->id,
            'financial_category_id' => $category->id,
            'created_by' => $creator->id,
            'title' => $title,
            'type' => $type,
            'amount' => $amount,
            'paid_amount' => 0,
            'remaining_amount' => $amount,
            'charge_date' => $chargeDate,
            'status' => 'posted',
            'notes' => $notes,
        ]);
    }

    private function createPayment(Customer $customer, array $charges, float $amount, User $approver): Payment
    {
        $payment = Payment::query()->create([
            'invoice_id' => null,
            'customer_id' => $customer->id,
            'payment_method_id' => $customer->agreement_payment_method_id,
            'accounting_account_id' => $customer->agreement_accounting_account_id,
            'received_by' => $customer->agreement_payment_received_by ?: $approver->id,
            'receipt_number' => Payment::nextReceiptNumber(),
            'amount' => $amount,
            'paid_at' => $customer->agreement_payment_date,
            'reference' => $customer->agreement_payment_reference,
            'status' => 'posted',
            'notes' => 'Initial payment received with the approved customer contract.',
        ]);

        $unallocatedAmount = $amount;

        foreach ($charges as $charge) {
            if ($unallocatedAmount <= 0) {
                break;
            }

            $allocatedAmount = min((float) $charge->remaining_amount, $unallocatedAmount);
            if ($allocatedAmount <= 0) {
                continue;
            }

            $allocation = $payment->allocations()->create([
                'invoice_id' => null,
                'customer_charge_id' => $charge->id,
                'amount' => $allocatedAmount,
            ]);
            $remainingAmount = max(0, (float) $charge->amount - $allocatedAmount);

            $charge->update([
                'paid_amount' => $allocatedAmount,
                'remaining_amount' => $remainingAmount,
                'paid_at' => $remainingAmount <= 0 ? $customer->agreement_payment_date : null,
            ]);

            $this->postAllocationToAccounting($allocation, $charge, $payment, $customer, $approver);
            $unallocatedAmount -= $allocatedAmount;
        }

        if ($unallocatedAmount > 0.005) {
            throw ValidationException::withMessages([
                'agreement_paid_amount' => ['Paid amount could not be allocated to the contract fees.'],
            ]);
        }

        return $payment;
    }

    private function postAllocationToAccounting(
        PaymentAllocation $allocation,
        CustomerCharge $charge,
        Payment $payment,
        Customer $customer,
        User $approver,
    ): void {
        $transaction = AccountingTransaction::query()->create([
            'financial_category_id' => $charge->financial_category_id,
            'payment_method_id' => $payment->payment_method_id,
            'accounting_account_id' => $payment->accounting_account_id,
            'customer_id' => $customer->id,
            'recorded_by' => $payment->received_by,
            'reviewed_by' => $approver->id,
            'approved_by' => $approver->id,
            'transaction_number' => AccountingTransaction::nextNumber('income'),
            'type' => 'income',
            'title' => $charge->title.' payment',
            'amount' => $allocation->amount,
            'received_from' => $customer->name,
            'transaction_date' => $payment->paid_at,
            'receipt_number' => $payment->receipt_number,
            'reference' => $payment->reference,
            'source_type' => 'customer_contract_payment_allocation',
            'source_id' => $allocation->id,
            'status' => 'approved',
            'reviewed_at' => now(),
            'approved_at' => now(),
            'description' => 'Posted automatically when the customer contract was approved.',
        ]);

        $transaction->postToAccount();
    }
}
