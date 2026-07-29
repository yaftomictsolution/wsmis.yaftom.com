<?php

namespace App\Services;

use App\Models\AccountingAccount;
use App\Models\Customer;
use App\Models\CustomerCharge;
use App\Models\FinancialPeriodClosing;
use App\Models\InventoryItem;
use App\Models\Invoice;
use App\Models\PayrollRun;
use App\Models\Shareholder;
use App\Models\ShareholderDistribution;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DemoDataAuditService
{
    public function __construct(
        private readonly FinancialReportingService $financialReports,
        private readonly OperationalReportingService $operationalReports,
    ) {}

    public function audit(): array
    {
        $results = [];
        $this->auditCoverage($results);
        $this->auditBilling($results);
        $this->auditAccounts($results);
        $this->auditInventory($results);
        $this->auditPayroll($results);
        $this->auditShareholders($results);
        $this->auditClosingsAndReports($results);

        return $results;
    }

    private function auditCoverage(array &$results): void
    {
        $tables = [
            'users' => 'Users',
            'roles' => 'Roles',
            'service_areas' => 'Service Areas',
            'customers' => 'Customers',
            'customer_contracts' => 'Customer Contracts',
            'customer_documents' => 'Customer Documents',
            'customer_charges' => 'Customer Charges',
            'customer_service_requests' => 'Service Requests',
            'customer_connection_events' => 'Connection Events',
            'meters' => 'Meters',
            'meter_assignments' => 'Meter Assignments',
            'meter_seals' => 'Meter Seals',
            'billing_periods' => 'Billing Periods',
            'meter_readings' => 'Meter Readings',
            'invoices' => 'Invoices',
            'payments' => 'Payments',
            'accounting_accounts' => 'Accounting Accounts',
            'financial_categories' => 'Financial Categories',
            'accounting_transactions' => 'Accounting Transactions',
            'suppliers' => 'Suppliers',
            'warehouses' => 'Warehouses',
            'goods' => 'Goods',
            'inventory_items' => 'Inventory Stock',
            'inventory_requests' => 'Purchases and Issues',
            'assets' => 'Assets',
            'asset_purchases' => 'Asset Purchases',
            'asset_maintenance' => 'Asset Maintenance',
            'departments' => 'Departments',
            'job_positions' => 'Job Positions',
            'employees' => 'Employees',
            'employee_documents' => 'Employee Documents',
            'attendance_records' => 'Attendance',
            'leave_requests' => 'Leave Requests',
            'work_shifts' => 'Work Shifts',
            'public_holidays' => 'Public Holidays',
            'salary_advances' => 'Salary Advances',
            'employee_adjustments' => 'Employee Adjustments',
            'performance_reviews' => 'Performance Reviews',
            'payroll_deduction_rules' => 'Payroll Deduction Rules',
            'employee_terminations' => 'Employee Terminations',
            'biometric_import_batches' => 'Biometric Imports',
            'payroll_runs' => 'Payroll Runs',
            'shareholders' => 'Shareholders',
            'account_reconciliations' => 'Account Reconciliations',
            'financial_period_closings' => 'Monthly Closings',
            'shareholder_distributions' => 'Shareholder Distributions',
            'shareholder_payments' => 'Shareholder Payments',
        ];

        foreach ($tables as $table => $label) {
            $count = DB::table($table)->count();
            $this->assert($count >= 3, "{$label} requires at least three demo records; found {$count}.");
            $results[] = ['section' => $label, 'records' => $count, 'status' => 'PASS'];
        }

        $this->assert(DB::table('supplier_installments')->count() === 0, 'Retired supplier installments must remain empty.');
    }

    private function auditBilling(array &$results): void
    {
        foreach (Invoice::query()->with('items')->get() as $invoice) {
            $lineTotal = round((float) $invoice->items->sum('amount'), 2);
            $posted = round((float) $invoice->allocations()
                ->whereHas('payment', fn ($query) => $query->where('status', 'posted'))
                ->sum('amount'), 2);
            $remaining = round(max(0, (float) $invoice->total_amount - $posted), 2);

            $this->assertClose($lineTotal, (float) $invoice->total_amount, "Invoice {$invoice->invoice_number} line total");
            $this->assertClose($posted, (float) $invoice->paid_amount, "Invoice {$invoice->invoice_number} paid amount");
            $this->assertClose($remaining, (float) $invoice->remaining_amount, "Invoice {$invoice->invoice_number} remaining amount");
        }

        foreach (Customer::query()->get() as $customer) {
            $expected = round((float) $customer->invoices()
                ->where('status', '!=', 'cancelled')
                ->sum('remaining_amount'), 2);
            $this->assertClose($expected, (float) $customer->current_balance, "Customer {$customer->subscription_code} balance");
        }

        $results[] = [
            'section' => 'Billing reconciliation',
            'records' => Invoice::query()->count(),
            'status' => 'PASS',
        ];
    }

    private function auditAccounts(array &$results): void
    {
        foreach (AccountingAccount::query()->get() as $account) {
            $expected = $this->financialReports->bookBalance($account, '9999-12-31');
            $this->assertClose($expected, (float) $account->current_balance, "Account {$account->code} balance");
        }

        $results[] = [
            'section' => 'Account reconciliation',
            'records' => AccountingAccount::query()->count(),
            'status' => 'PASS',
        ];
    }

    private function auditInventory(array &$results): void
    {
        foreach (InventoryItem::query()->get() as $item) {
            $movement = round((float) $item->transactions()->sum('quantity'), 2);
            $this->assertClose($movement, (float) $item->quantity, "Inventory item {$item->code} quantity");
            $this->assert((float) $item->quantity >= 0, "Inventory item {$item->code} cannot have negative stock.");
            if ($item->category === 'meter') {
                $availableSerials = $item->meters()
                    ->where('status', 'available')
                    ->where('current_warehouse_id', $item->warehouse_id)
                    ->count();
                $this->assertClose(
                    (float) $item->quantity,
                    (float) $availableSerials,
                    "Serialized meter stock {$item->code}",
                );
            }
        }

        $results[] = [
            'section' => 'Inventory reconciliation',
            'records' => InventoryItem::query()->count(),
            'status' => 'PASS',
        ];
    }

    private function auditPayroll(array &$results): void
    {
        foreach (PayrollRun::query()->with('items')->get() as $payroll) {
            $this->assertClose((float) $payroll->items->sum('base_salary'), (float) $payroll->total_base_salary, "Payroll {$payroll->payroll_number} base");
            $this->assertClose((float) $payroll->items->sum('bonus'), (float) $payroll->total_bonus, "Payroll {$payroll->payroll_number} bonus");
            $this->assertClose((float) $payroll->items->sum('net_amount'), (float) $payroll->total_net, "Payroll {$payroll->payroll_number} net");
        }

        $results[] = [
            'section' => 'Payroll reconciliation',
            'records' => PayrollRun::query()->count(),
            'status' => 'PASS',
        ];
    }

    private function auditShareholders(array &$results): void
    {
        $ownership = (float) Shareholder::query()->where('status', 'active')->sum('ownership_percentage');
        $this->assertClose(100, $ownership, 'Active shareholder ownership');

        foreach (ShareholderDistribution::query()->with(['items.shareholder', 'items.payments'])->get() as $distribution) {
            $allocated = round((float) $distribution->items->sum('entitlement_amount'), 2);
            $paid = round((float) $distribution->items->sum('paid_amount'), 2);
            $this->assertClose((float) $distribution->distributable_amount, $allocated, "Distribution {$distribution->distribution_number} allocation");
            $this->assertClose($allocated, (float) $distribution->allocated_amount, "Distribution {$distribution->distribution_number} allocated total");
            $this->assertClose($paid, (float) $distribution->paid_amount, "Distribution {$distribution->distribution_number} paid total");

            foreach ($distribution->items as $item) {
                $expected = round((float) $distribution->distributable_amount * ((float) $item->percentage_snapshot / 100), 2);
                $this->assert(
                    abs($expected - (float) $item->entitlement_amount) <= 0.01,
                    "Shareholder entitlement is incorrect for {$item->shareholder?->name}.",
                );
                $paidPayments = round((float) $item->payments->where('status', 'paid')->sum('amount'), 2);
                $this->assertClose($paidPayments, (float) $item->paid_amount, "Shareholder payment total for item {$item->id}");
            }
        }

        $results[] = [
            'section' => 'Shareholder calculation',
            'records' => ShareholderDistribution::query()->count(),
            'status' => 'PASS',
        ];
    }

    private function auditClosingsAndReports(array &$results): void
    {
        foreach (FinancialPeriodClosing::query()->where('status', 'closed')->get() as $closing) {
            $snapshot = $this->financialReports->periodSnapshot(
                $closing->period_start->toDateString(),
                $closing->period_end->toDateString(),
            );
            $this->assertClose($snapshot['total_income'], (float) $closing->total_income, "Closing {$closing->period_code} income");
            $this->assertClose($snapshot['total_expense'], (float) $closing->total_expense, "Closing {$closing->period_code} expense");
            $this->assertClose($snapshot['net_income'], (float) $closing->net_income, "Closing {$closing->period_code} net income");
        }

        $expectedReceivables = round(
            (float) Invoice::query()->whereIn('status', ['unpaid', 'partially_paid', 'overdue'])->sum('remaining_amount')
            + (float) CustomerCharge::query()->whereNull('invoice_id')->where('status', 'posted')->sum('remaining_amount'),
            2,
        );
        $financial = $this->financialReports->report('2026-04-01', '2026-07-31');
        $this->assertClose($expectedReceivables, (float) $financial['summary']['receivables'], 'Financial report receivables');

        $operational = $this->operationalReports->report('all', '2026-04-01', '2026-07-31');
        $this->assert(
            (int) $operational['summary']['total_customers'] === Customer::query()->count(),
            'Operational report customer total does not match the database.',
        );
        $this->assert(
            (int) $operational['summary']['inventory_items'] === InventoryItem::query()->count(),
            'Operational report inventory total does not match the database.',
        );

        $results[] = [
            'section' => 'Dynamic reports',
            'records' => FinancialPeriodClosing::query()->count(),
            'status' => 'PASS',
        ];
    }

    private function assertClose(float $expected, float $actual, string $label): void
    {
        $this->assert(abs($expected - $actual) < 0.01, "{$label}: expected {$expected}, got {$actual}.");
    }

    private function assert(bool $condition, string $message): void
    {
        if (! $condition) {
            throw new RuntimeException("Demo data audit failed: {$message}");
        }
    }
}
