<?php

namespace App\Services;

use App\Models\AccountingAccount;
use App\Models\AccountingTransaction;
use App\Models\Asset;
use App\Models\AssetPurchase;
use App\Models\EmployeeTermination;
use App\Models\FinancialPeriodClosing;
use App\Models\InventoryPurchasePayment;
use App\Models\PaymentMethod;
use App\Models\PayrollRun;
use App\Models\SalaryAdvance;
use App\Models\ShareholderDistributionItem;
use App\Models\ShareholderPayment;
use App\Models\SupplierInstallment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AccountingWorkflowService
{
    public function __construct(
        private readonly HrPayrollService $hrPayroll,
        private readonly TerminationSettlementService $terminationSettlements,
    ) {}

    public function ensureDateIsOpen(string $date): void
    {
        if (FinancialPeriodClosing::isDateClosed($date)) {
            throw ValidationException::withMessages([
                'transaction_date' => ['This financial period is closed. Reopen the period before posting or reversing transactions.'],
            ]);
        }
    }

    public function ensureCompatibleAccount(int $paymentMethodId, int $accountId): AccountingAccount
    {
        $method = PaymentMethod::query()->findOrFail($paymentMethodId);
        $account = AccountingAccount::query()->findOrFail($accountId);
        $expectedType = match ($method->code) {
            'bank_transfer' => 'bank',
            'mobile_money' => 'mobile_money',
            'check' => 'check',
            'online_payment' => 'online',
            default => 'cash',
        };

        if ($method->status !== 'active') {
            throw ValidationException::withMessages([
                'payment_method_id' => ['The selected payment method must be active.'],
            ]);
        }

        if ($account->status !== 'active') {
            throw ValidationException::withMessages([
                'accounting_account_id' => ['The selected account must be active.'],
            ]);
        }

        if ($account->type !== $expectedType) {
            throw ValidationException::withMessages([
                'accounting_account_id' => ["The selected account must be a {$expectedType} account for this payment method."],
            ]);
        }

        return $account;
    }

    public function review(AccountingTransaction $transaction, User $user): AccountingTransaction
    {
        abort_unless($transaction->status === 'pending_review', 422, 'Only transactions awaiting review can be reviewed.');

        return DB::transaction(function () use ($transaction, $user): AccountingTransaction {
            $transaction->update([
                'status' => 'pending_approval',
                'reviewed_by' => $user->id,
                'reviewed_at' => now(),
            ]);
            $this->synchronizeSource($transaction->fresh(), 'reviewed');

            return $transaction->fresh();
        });
    }

    public function approve(AccountingTransaction $transaction, User $user): AccountingTransaction
    {
        abort_unless(in_array($transaction->status, ['pending_review', 'pending_approval'], true), 422, 'Only pending transactions can be approved.');
        $this->ensureDateIsOpen($transaction->transaction_date->toDateString());

        return DB::transaction(function () use ($transaction, $user): AccountingTransaction {
            $locked = AccountingTransaction::query()->whereKey($transaction->id)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($locked->status, ['pending_review', 'pending_approval'], true), 422, 'This transaction has already been processed.');

            if (! $locked->isAccountInflow() && $locked->accounting_account_id) {
                $account = AccountingAccount::query()->whereKey($locked->accounting_account_id)->lockForUpdate()->firstOrFail();
                if ((float) $account->current_balance + 0.005 < (float) $locked->amount) {
                    throw ValidationException::withMessages([
                        'accounting_account_id' => ['The selected account has insufficient available balance for this payment.'],
                    ]);
                }
            }

            $updates = [
                'status' => 'approved',
                'approved_by' => $user->id,
                'approved_at' => now(),
                'rejected_by' => null,
                'rejected_at' => null,
                'rejection_reason' => null,
            ];
            if (! $locked->reviewed_by) {
                $updates['reviewed_by'] = $user->id;
                $updates['reviewed_at'] = now();
            }

            $locked->update($updates);
            $locked->postToAccount();
            $this->synchronizeSource($locked->fresh(), 'approved');

            return $locked->fresh();
        });
    }

    public function reject(AccountingTransaction $transaction, User $user, string $reason): AccountingTransaction
    {
        abort_unless(in_array($transaction->status, ['pending_review', 'pending_approval'], true), 422, 'Only pending transactions can be rejected.');

        return DB::transaction(function () use ($transaction, $user, $reason): AccountingTransaction {
            $transaction->update([
                'status' => 'rejected',
                'rejected_by' => $user->id,
                'rejected_at' => now(),
                'rejection_reason' => $reason,
            ]);
            $this->synchronizeSource($transaction->fresh(), 'rejected');

            return $transaction->fresh();
        });
    }

    public function cancel(AccountingTransaction $transaction): AccountingTransaction
    {
        abort_unless($transaction->status === 'approved', 422, 'Only approved transactions can be cancelled.');
        $this->ensureDateIsOpen($transaction->transaction_date->toDateString());

        return DB::transaction(function () use ($transaction): AccountingTransaction {
            $transaction->reverseFromAccount();
            $transaction->update(['status' => 'cancelled']);
            $this->synchronizeSource($transaction->fresh(), 'cancelled');

            return $transaction->fresh();
        });
    }

    private function synchronizeSource(AccountingTransaction $transaction, string $event): void
    {
        match ($transaction->source_type) {
            'asset_purchase' => $this->synchronizeAssetPurchase($transaction, $event),
            'inventory_purchase_payment' => $this->synchronizeInventoryPurchasePayment($transaction, $event),
            'supplier_installment' => $this->synchronizeSupplierInstallment($transaction, $event),
            'payroll_run' => $this->synchronizePayroll($transaction, $event),
            'salary_advance' => $this->synchronizeSalaryAdvance($transaction, $event),
            'employee_termination' => $this->synchronizeEmployeeTermination($transaction, $event),
            'shareholder_payment' => $this->synchronizeShareholderPayment($transaction, $event),
            default => null,
        };
    }

    private function synchronizeInventoryPurchasePayment(AccountingTransaction $transaction, string $event): void
    {
        $payment = InventoryPurchasePayment::query()
            ->whereKey($transaction->source_id)
            ->lockForUpdate()
            ->first();
        if (! $payment) {
            return;
        }

        if ($event === 'cancelled') {
            $payment->update(['status' => 'cancelled']);
            $payment->purchase?->refreshPurchasePaymentStatus();
        }
    }

    private function synchronizeAssetPurchase(AccountingTransaction $transaction, string $event): void
    {
        $purchase = AssetPurchase::query()
            ->whereKey($transaction->source_id)
            ->lockForUpdate()
            ->first();
        if (! $purchase) {
            return;
        }

        if ($event === 'reviewed') {
            $purchase->update(['status' => 'pending_approval']);

            return;
        }
        if ($event === 'rejected') {
            $purchase->update(['status' => 'rejected']);

            return;
        }
        if ($event === 'approved') {
            if (! $purchase->assets()->exists()) {
                $existingCode = Asset::query()
                    ->whereIn('asset_code', $purchase->generatedAssetCodes())
                    ->lockForUpdate()
                    ->value('asset_code');
                if ($existingCode) {
                    throw ValidationException::withMessages([
                        'asset_code_prefix' => ["The generated asset code already exists: {$existingCode}"],
                    ]);
                }

                foreach ($purchase->generatedAssetCodes() as $assetCode) {
                    Asset::query()->create([
                        'asset_purchase_id' => $purchase->id,
                        'asset_code' => $assetCode,
                        'name' => $purchase->name,
                        'type' => $purchase->type,
                        'status' => $purchase->asset_status,
                        'service_area_id' => $purchase->service_area_id,
                        'address' => $purchase->address,
                        'purchase_cost' => $purchase->unit_cost,
                        'purchase_date' => $purchase->purchase_date,
                        'warranty_expiry' => $purchase->warranty_expiry,
                        'supplier_id' => $purchase->supplier_id,
                        'attributes' => $purchase->attributes,
                        'created_by' => $purchase->created_by,
                        'notes' => $purchase->notes,
                    ]);
                }
            }
            $purchase->update(['status' => 'approved']);

            return;
        }
        if ($event === 'cancelled') {
            $assetIds = $purchase->assets()->pluck('id');
            if (Asset::query()->whereIn('id', $assetIds)->whereHas('maintenance')->exists()) {
                throw ValidationException::withMessages([
                    'asset_purchase' => ['This purchase cannot be reversed because one of its assets has maintenance history.'],
                ]);
            }
            Asset::query()->whereIn('id', $assetIds)->update(['status' => 'retired']);
            $purchase->update(['status' => 'cancelled']);
        }
    }

    private function synchronizeSupplierInstallment(AccountingTransaction $transaction, string $event): void
    {
        $installment = SupplierInstallment::with('contract')->find($transaction->supplier_installment_id ?: $transaction->source_id);
        if (! $installment) {
            return;
        }

        if ($event === 'reviewed') {
            $installment->update(['status' => 'pending_approval']);
        }
        if ($event === 'approved') {
            $installment->update([
                'payment_method_id' => $transaction->payment_method_id,
                'accounting_account_id' => $transaction->accounting_account_id,
                'accounting_transaction_id' => $transaction->id,
                'recorded_by' => $transaction->recorded_by,
                'paid_amount' => $transaction->amount,
                'paid_at' => $transaction->transaction_date,
                'status' => 'paid',
                'receipt_number' => $transaction->receipt_number ?? $transaction->transaction_number,
            ]);
        }
        if ($event === 'rejected') {
            $installment->update(['status' => 'pending', 'accounting_transaction_id' => null]);
        }
        if ($event === 'cancelled') {
            $installment->update([
                'paid_amount' => 0,
                'paid_at' => null,
                'status' => 'pending',
                'accounting_transaction_id' => null,
            ]);
        }

        $installment->contract?->refreshPaymentStatus();
    }

    private function synchronizePayroll(AccountingTransaction $transaction, string $event): void
    {
        $payroll = PayrollRun::query()->find($transaction->source_id);
        if (! $payroll) {
            return;
        }

        $updates = match ($event) {
            'reviewed' => ['status' => 'pending_approval', 'reviewed_by' => $transaction->reviewed_by, 'reviewed_at' => $transaction->reviewed_at],
            'approved' => ['status' => 'approved', 'approved_by' => $transaction->approved_by, 'approved_at' => $transaction->approved_at],
            'rejected' => ['status' => 'rejected', 'rejected_by' => $transaction->rejected_by, 'rejected_at' => $transaction->rejected_at, 'rejection_reason' => $transaction->rejection_reason],
            'cancelled' => ['status' => 'cancelled'],
            default => [],
        };
        if ($updates) {
            $payroll->update($updates);
        }
        if ($event === 'approved') {
            $this->hrPayroll->applyPosting($payroll);
        }
        if ($event === 'cancelled') {
            $this->hrPayroll->reversePosting($payroll);
        }
    }

    private function synchronizeSalaryAdvance(AccountingTransaction $transaction, string $event): void
    {
        $advance = SalaryAdvance::query()->whereKey($transaction->source_id)->lockForUpdate()->first();
        if (! $advance) {
            return;
        }

        $updates = match ($event) {
            'reviewed' => [
                'status' => 'pending_approval',
                'reviewed_by' => $transaction->reviewed_by,
                'reviewed_at' => $transaction->reviewed_at,
            ],
            'approved' => [
                'status' => 'approved',
                'reviewed_by' => $transaction->reviewed_by,
                'reviewed_at' => $transaction->reviewed_at,
                'approved_by' => $transaction->approved_by,
                'approved_at' => $transaction->approved_at,
                'rejected_by' => null,
                'rejected_at' => null,
                'rejection_reason' => null,
            ],
            'rejected' => [
                'status' => 'rejected',
                'rejected_by' => $transaction->rejected_by,
                'rejected_at' => $transaction->rejected_at,
                'rejection_reason' => $transaction->rejection_reason,
            ],
            'cancelled' => ['status' => 'cancelled'],
            default => [],
        };
        if ($updates) {
            $advance->update($updates);
        }
    }

    private function synchronizeEmployeeTermination(AccountingTransaction $transaction, string $event): void
    {
        $termination = EmployeeTermination::query()->whereKey($transaction->source_id)->lockForUpdate()->first();
        if (! $termination) {
            return;
        }

        $updates = match ($event) {
            'reviewed' => [
                'status' => 'pending_approval',
                'reviewed_by' => $transaction->reviewed_by,
                'reviewed_at' => $transaction->reviewed_at,
            ],
            'approved' => [
                'status' => 'approved',
                'reviewed_by' => $transaction->reviewed_by,
                'reviewed_at' => $transaction->reviewed_at,
                'approved_by' => $transaction->approved_by,
                'approved_at' => $transaction->approved_at,
                'rejected_by' => null,
                'rejected_at' => null,
                'rejection_reason' => null,
            ],
            'rejected' => [
                'status' => 'rejected',
                'rejected_by' => $transaction->rejected_by,
                'rejected_at' => $transaction->rejected_at,
                'rejection_reason' => $transaction->rejection_reason,
            ],
            'cancelled' => ['status' => 'cancelled'],
            default => [],
        };
        if ($updates) {
            $termination->update($updates);
        }
        if ($event === 'approved') {
            $this->terminationSettlements->apply($termination->fresh());
        }
        if ($event === 'cancelled') {
            $this->terminationSettlements->reverse($termination->fresh());
        }
    }

    private function synchronizeShareholderPayment(AccountingTransaction $transaction, string $event): void
    {
        $payment = ShareholderPayment::query()->whereKey($transaction->source_id)->lockForUpdate()->first();
        if (! $payment) {
            return;
        }

        if ($event === 'reviewed') {
            $payment->update(['status' => 'pending_approval']);

            return;
        }
        if ($event === 'rejected') {
            $payment->update(['status' => 'rejected']);

            return;
        }

        $item = ShareholderDistributionItem::query()->whereKey($payment->shareholder_distribution_item_id)->lockForUpdate()->firstOrFail();
        if ($event === 'approved' && $payment->status !== 'paid') {
            $paid = (float) $item->paid_amount + (float) $payment->amount;
            $item->update([
                'paid_amount' => $paid,
                'status' => $paid + 0.005 >= (float) $item->entitlement_amount ? 'paid' : 'partially_paid',
            ]);
            $payment->update(['status' => 'paid']);
        }
        if ($event === 'cancelled' && $payment->status === 'paid') {
            $paid = max(0, (float) $item->paid_amount - (float) $payment->amount);
            $item->update([
                'paid_amount' => $paid,
                'status' => $paid <= 0 ? 'pending' : 'partially_paid',
            ]);
            $payment->update(['status' => 'cancelled']);
        }

        $item->distribution?->refreshPaymentStatus();
    }
}
