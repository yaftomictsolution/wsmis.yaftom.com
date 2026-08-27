<?php

namespace App\Services;

use App\Models\BillingPeriod;
use App\Models\Customer;
use App\Models\CustomerCharge;
use App\Models\CustomerContract;
use App\Models\FinancialCategory;
use App\Models\Invoice;
use App\Models\MeterReading;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class CustomerBillingService
{
    public function issueWaterInvoice(
        MeterReading $reading,
        BillingPeriod $period,
        float $previousBalance,
        float $rate,
        float $waterAmount,
        ?string $dueDate,
    ): Invoice {
        $existing = Invoice::query()
            ->where('source_type', 'meter_reading')
            ->where('source_id', $reading->id)
            ->first();
        if ($existing) {
            return $existing->load(['items.category', 'customer', 'billingPeriod', 'meterReading']);
        }

        $category = FinancialCategory::query()->firstOrCreate(
            ['code' => 'water_bill_income'],
            ['name' => 'Water Bill Income', 'type' => 'income', 'status' => 'active'],
        );
        $invoice = Invoice::query()->create([
            'invoice_type' => 'water',
            'billing_period_id' => $period->id,
            'customer_id' => $reading->customer_id,
            'customer_contract_id' => null,
            'meter_reading_id' => $reading->id,
            'source_type' => 'meter_reading',
            'source_id' => $reading->id,
            'invoice_number' => Invoice::nextNumber('water'),
            'issue_date' => $reading->reading_date,
            'due_date' => $dueDate,
            'previous_balance' => $previousBalance,
            'consumption' => $reading->consumption,
            'rate_per_cubic_meter' => $rate,
            'water_amount' => $waterAmount,
            'penalty_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => $waterAmount,
            'paid_amount' => 0,
            'remaining_amount' => $waterAmount,
            'status' => $waterAmount > 0.005 ? 'unpaid' : 'paid',
        ]);
        $invoice->items()->create([
            'financial_category_id' => $category->id,
            'item_type' => 'water_usage',
            'description' => 'Water consumption',
            'quantity' => max(0, (float) $reading->consumption),
            'unit_price' => $rate,
            'discount_amount' => 0,
            'amount' => $waterAmount,
            'notes' => 'Current billing period usage only. Previous outstanding invoices remain separate.',
        ]);

        $this->syncCustomerBalance($reading->customer_id);

        return $invoice->fresh()->load(['items.category', 'customer', 'billingPeriod', 'meterReading']);
    }

    public function issueChargeInvoice(CustomerCharge $charge, ?string $dueDate = null): Invoice
    {
        if ($charge->invoice_id) {
            return Invoice::query()->with(['items.category', 'customer'])->findOrFail($charge->invoice_id);
        }

        $existing = Invoice::query()
            ->where('source_type', 'customer_charge')
            ->where('source_id', $charge->id)
            ->first();
        if ($existing) {
            $charge->update(['invoice_id' => $existing->id]);

            return $existing->load(['items.category', 'customer']);
        }

        $issueDate = $charge->charge_date->toDateString();
        $invoice = Invoice::query()->create([
            'invoice_type' => 'service',
            'billing_period_id' => null,
            'customer_id' => $charge->customer_id,
            'customer_contract_id' => $charge->customer_contract_id,
            'meter_reading_id' => null,
            'source_type' => 'customer_charge',
            'source_id' => $charge->id,
            'invoice_number' => Invoice::nextNumber('service'),
            'issue_date' => $issueDate,
            'due_date' => $dueDate ?? Carbon::parse($issueDate)->addDays(15)->toDateString(),
            'previous_balance' => 0,
            'consumption' => 0,
            'rate_per_cubic_meter' => 0,
            'water_amount' => 0,
            'penalty_amount' => $charge->type === 'penalty' ? (float) $charge->amount : 0,
            'discount_amount' => 0,
            'total_amount' => $charge->amount,
            'paid_amount' => (float) ($charge->paid_amount ?? 0),
            'remaining_amount' => (float) ($charge->remaining_amount ?? $charge->amount),
            'status' => $charge->status === 'cancelled' ? 'cancelled' : $charge->payment_status,
            'notes' => $charge->notes,
        ]);
        $invoice->items()->create([
            'customer_charge_id' => $charge->id,
            'financial_category_id' => $charge->financial_category_id,
            'item_type' => $charge->type === 'penalty' ? 'penalty' : 'service',
            'description' => $charge->title,
            'quantity' => 1,
            'unit_price' => $charge->amount,
            'discount_amount' => 0,
            'amount' => $charge->amount,
            'notes' => $charge->notes,
        ]);
        $charge->update(['invoice_id' => $invoice->id]);
        $this->syncCustomerBalance($charge->customer_id);

        return $invoice->fresh()->load(['items.category', 'customer']);
    }

    public function issueContractInvoice(CustomerContract $contract, Collection $charges, ?string $issueDate = null): Invoice
    {
        $existing = Invoice::query()
            ->where('source_type', 'customer_contract')
            ->where('source_id', $contract->id)
            ->first();
        if ($existing) {
            $charges->each(fn (CustomerCharge $charge) => $charge->update(['invoice_id' => $existing->id]));

            return $existing->load(['items.category', 'customer', 'contract']);
        }

        $issueDate ??= optional($contract->subscription_date)->toDateString()
            ?? optional($contract->confirmed_at)->toDateString()
            ?? optional($contract->approved_at)->toDateString()
            ?? now()->toDateString();
        $invoice = Invoice::query()->create([
            'invoice_type' => 'contract',
            'billing_period_id' => null,
            'customer_id' => $contract->customer_id,
            'customer_contract_id' => $contract->id,
            'meter_reading_id' => null,
            'source_type' => 'customer_contract',
            'source_id' => $contract->id,
            'invoice_number' => Invoice::nextNumber('contract'),
            'issue_date' => $issueDate,
            'due_date' => Carbon::parse($issueDate)->addDays(15)->toDateString(),
            'previous_balance' => 0,
            'consumption' => 0,
            'rate_per_cubic_meter' => 0,
            'water_amount' => 0,
            'penalty_amount' => 0,
            'discount_amount' => $contract->discount_amount,
            'total_amount' => $contract->net_amount,
            'paid_amount' => 0,
            'remaining_amount' => $contract->net_amount,
            'status' => (float) $contract->net_amount > 0.005 ? 'unpaid' : 'paid',
            'notes' => 'Issued automatically after the customer contract was confirmed.',
        ]);

        foreach ($charges as $charge) {
            $grossAmount = match ($charge->type) {
                'connection_fee' => (float) $contract->connection_fee,
                'meter_fee' => (float) $contract->meter_fee,
                default => (float) $charge->amount,
            };
            $lineDiscount = max(0, $grossAmount - (float) $charge->amount);
            $invoice->items()->create([
                'customer_charge_id' => $charge->id,
                'financial_category_id' => $charge->financial_category_id,
                'item_type' => 'contract_fee',
                'description' => $charge->title,
                'quantity' => 1,
                'unit_price' => $grossAmount,
                'discount_amount' => $lineDiscount,
                'amount' => $charge->amount,
                'notes' => $charge->notes,
            ]);
            $charge->update(['invoice_id' => $invoice->id]);
        }

        $this->syncInvoice($invoice);

        return $invoice->fresh()->load(['items.category', 'customer', 'contract']);
    }

    public function syncInvoice(Invoice|int $invoice, ?string $paidAt = null): Invoice
    {
        $invoice = $invoice instanceof Invoice
            ? $invoice->fresh()
            : Invoice::query()->findOrFail($invoice);
        $invoice->load('items.charge');

        if ($invoice->status === 'cancelled') {
            $this->syncCustomerBalance($invoice->customer_id);

            return $invoice;
        }

        $paid = round((float) $invoice->allocations()
            ->whereHas('payment', fn ($query) => $query->where('status', 'posted'))
            ->selectRaw('COALESCE(SUM(amount - refunded_amount), 0) as total')
            ->value('total'), 2);
        $paid = min((float) $invoice->total_amount, max(0, $paid));
        $paymentDiscount = round((float) $invoice->allocations()
            ->whereHas('payment', fn ($query) => $query->where('status', 'posted'))
            ->selectRaw('COALESCE(SUM(CASE WHEN amount > 0 AND refunded_amount + 0.005 >= amount THEN 0 ELSE discount_amount END), 0) as total')
            ->value('total'), 2);
        $paymentDiscount = min(
            max(0, (float) $invoice->total_amount - $paid),
            max(0, $paymentDiscount),
        );
        $remaining = round(max(0, (float) $invoice->total_amount - $paid - $paymentDiscount), 2);
        $invoice->update([
            'paid_amount' => $paid,
            'payment_discount_amount' => $paymentDiscount,
            'remaining_amount' => $remaining,
            'status' => $remaining <= 0.005 ? 'paid' : (($paid + $paymentDiscount) > 0.005 ? 'partially_paid' : 'unpaid'),
        ]);

        $unappliedPaid = $paid;
        foreach ($invoice->items as $item) {
            $lineAmount = max(0, (float) $item->amount);
            $linePaid = min($lineAmount, $unappliedPaid);
            if ($item->charge) {
                $lineRemaining = round(max(0, $lineAmount - $linePaid), 2);
                $item->charge->update([
                    'paid_amount' => $linePaid,
                    'remaining_amount' => $lineRemaining,
                    'paid_at' => $lineRemaining <= 0.005
                        ? ($paidAt ?? $item->charge->paid_at ?? now())
                        : null,
                ]);
            }
            $unappliedPaid = max(0, $unappliedPaid - $lineAmount);
        }

        if ($invoice->customer_contract_id) {
            $invoice->contract()->update([
                'remaining_amount' => $remaining,
            ]);
            $invoice->customer()->update([
                'agreement_paid_amount' => $paid,
                'agreement_remaining_amount' => $remaining,
            ]);
        }

        $this->syncCustomerBalance($invoice->customer_id);

        return $invoice->fresh()->load(['items.category', 'contract']);
    }

    public function cancelInvoice(Invoice $invoice): Invoice
    {
        $invoice->load('items.charge');
        $invoice->update([
            'paid_amount' => 0,
            'remaining_amount' => 0,
            'status' => 'cancelled',
        ]);
        foreach ($invoice->items as $item) {
            if ($item->charge) {
                $item->charge->update([
                    'paid_amount' => 0,
                    'remaining_amount' => 0,
                    'paid_at' => null,
                    'status' => 'cancelled',
                ]);
            }
        }
        if ($invoice->customer_contract_id) {
            $invoice->contract()->update(['remaining_amount' => 0]);
        }
        $this->syncCustomerBalance($invoice->customer_id);

        return $invoice->fresh()->load('items');
    }

    public function syncCustomerBalance(Customer|int $customer): float
    {
        $customerId = $customer instanceof Customer ? $customer->id : $customer;
        $balance = round((float) Invoice::query()
            ->where('customer_id', $customerId)
            ->where('status', '!=', 'cancelled')
            ->sum('remaining_amount'), 2);
        Customer::query()->whereKey($customerId)->update(['current_balance' => max(0, $balance)]);

        return max(0, $balance);
    }

    public function accountingCategory(Invoice $invoice): FinancialCategory
    {
        $invoice->loadMissing('items.category');
        $lineCategory = $invoice->items->first(fn ($item) => $item->category)?->category;
        if ($lineCategory) {
            return $lineCategory;
        }

        [$code, $name] = match ($invoice->invoice_type) {
            'contract' => ['contract_fee_income', 'Contract Fee Income'],
            'service' => ['customer_charge_income', 'Customer Charge Income'],
            default => ['water_bill_income', 'Water Bill Income'],
        };

        return FinancialCategory::query()->firstOrCreate(
            ['code' => $code],
            ['name' => $name, 'type' => 'income', 'status' => 'active'],
        );
    }
}
