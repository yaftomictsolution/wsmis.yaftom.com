<?php

namespace Database\Seeders;

use App\Http\Controllers\Api\AccountingController;
use App\Http\Controllers\Api\AccountReconciliationController;
use App\Http\Controllers\Api\AssetPurchaseController;
use App\Http\Controllers\Api\FinancialPeriodClosingController;
use App\Http\Controllers\Api\PayrollController;
use App\Http\Controllers\Api\ShareholderController;
use App\Http\Controllers\Api\ShareholderDistributionController;
use App\Models\AccountingAccount;
use App\Models\AccountingTransaction;
use App\Models\AccountReconciliation;
use App\Models\Asset;
use App\Models\AssetMaintenance;
use App\Models\AssetPurchase;
use App\Models\BiometricImportBatch;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\EmployeeAdjustment;
use App\Models\EmployeeDocument;
use App\Models\EmployeePayrollDeduction;
use App\Models\EmployeeTermination;
use App\Models\FinancialCategory;
use App\Models\FinancialPeriodClosing;
use App\Models\Good;
use App\Models\InventoryItem;
use App\Models\InventoryRequest;
use App\Models\PaymentMethod;
use App\Models\PayrollDeductionRule;
use App\Models\PayrollRun;
use App\Models\PerformanceReview;
use App\Models\PublicHoliday;
use App\Models\SalaryAdvance;
use App\Models\ServiceArea;
use App\Models\Shareholder;
use App\Models\ShareholderDistribution;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\AccountingWorkflowService;
use App\Services\FinancialReportingService;
use App\Services\InventoryRequestWorkflowService;
use Illuminate\Database\Seeder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class FullSystemDemoSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            'admin' => User::query()->where('email', 'admin@waternet.local')->firstOrFail(),
            'manager' => User::query()->where('email', 'manager@waternet.local')->firstOrFail(),
            'accountant' => User::query()->where('email', 'accountant@waternet.local')->firstOrFail(),
            'hr' => User::query()->where('email', 'hr@waternet.local')->firstOrFail(),
            'warehouse' => User::query()->where('email', 'warehouse@waternet.local')->firstOrFail(),
        ];

        $this->seedHrCoverage($users);
        $this->seedAccountingHistory($users);
        $this->seedPayrollHistory($users);
        $this->seedInventoryCoverage($users);
        $this->seedAssetPurchases($users);
        $distributions = $this->seedClosingsAndDistributions($users);
        $this->seedShareholderPayments($users, $distributions->firstOrFail());

        $this->command?->info('Full-system demo workflows have been created.');
    }

    private function seedAccountingHistory(array $users): void
    {
        $bank = AccountingAccount::query()->where('code', 'bank_account')->firstOrFail();
        $cash = AccountingAccount::query()->where('code', 'cash_on_hand')->firstOrFail();
        $bankMethod = PaymentMethod::query()->where('code', 'bank_transfer')->firstOrFail();
        $cashMethod = PaymentMethod::query()->where('code', 'cash')->firstOrFail();
        $incomeCategory = FinancialCategory::query()->where('code', 'service_income')->firstOrFail();

        foreach ([
            ['title' => 'April network service income', 'amount' => 300000, 'date' => '2026-04-20'],
            ['title' => 'May network service income', 'amount' => 320000, 'date' => '2026-05-20'],
            ['title' => 'June network service income', 'amount' => 450000, 'date' => '2026-06-20'],
        ] as $index => $record) {
            $this->approveManualTransaction($users, [
                'type' => 'income',
                'financial_category_id' => $incomeCategory->id,
                'payment_method_id' => $bankMethod->id,
                'accounting_account_id' => $bank->id,
                'title' => $record['title'],
                'amount' => $record['amount'],
                'received_from' => 'Water network operations',
                'transaction_date' => $record['date'],
                'receipt_number' => 'DEMO-INC-'.str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT),
                'reference' => 'FULL-DEMO-INCOME-'.($index + 1),
                'description' => 'Approved income used to verify monthly reports and shareholder profit.',
            ]);
        }

        $expenseRows = [
            ['category' => 'office_rent', 'title' => 'April office rent', 'amount' => 10000, 'date' => '2026-04-25', 'paid_to' => 'Kabul Property Services'],
            ['category' => 'fuel_expense', 'title' => 'May generator fuel', 'amount' => 8000, 'date' => '2026-05-25', 'paid_to' => 'Kabul Fuel Station'],
            ['category' => 'electricity_expense', 'title' => 'June electricity bill', 'amount' => 7000, 'date' => '2026-06-25', 'paid_to' => 'Electricity Utility'],
        ];
        foreach ($expenseRows as $index => $record) {
            $category = FinancialCategory::query()->where('code', $record['category'])->firstOrFail();
            $this->approveManualTransaction($users, [
                'type' => 'expense',
                'financial_category_id' => $category->id,
                'payment_method_id' => $cashMethod->id,
                'accounting_account_id' => $cash->id,
                'title' => $record['title'],
                'amount' => $record['amount'],
                'paid_to' => $record['paid_to'],
                'transaction_date' => $record['date'],
                'receipt_number' => 'DEMO-EXP-'.str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT),
                'reference' => 'FULL-DEMO-EXPENSE-'.($index + 1),
                'description' => 'Approved operating expense used by the dynamic reports.',
            ]);
        }
    }

    private function approveManualTransaction(array $users, array $data): void
    {
        $existing = AccountingTransaction::query()->where('reference', $data['reference'])->first();
        if ($existing) {
            return;
        }

        $created = $this->responseData(
            app(AccountingController::class)->storeTransaction($this->request($users['accountant'], $data)),
            201,
        );
        $transaction = AccountingTransaction::query()->findOrFail($created['id']);
        $workflow = app(AccountingWorkflowService::class);
        $workflow->review($transaction, $users['manager']);
        $workflow->approve($transaction->fresh(), $users['admin']);
    }

    private function seedPayrollHistory(array $users): void
    {
        $account = AccountingAccount::query()->where('code', 'payroll_bank')->firstOrFail();
        $method = PaymentMethod::query()->where('code', 'bank_transfer')->firstOrFail();
        $employees = Employee::query()->where('status', 'active')->orderBy('id')->take(2)->get();

        foreach ([
            [
                'title' => 'April 2026 Demo Payroll',
                'start' => '2026-04-01',
                'end' => '2026-04-30',
                'date' => '2026-04-30',
                'base' => 10000,
                'bonus' => 500,
                'deduction' => 250,
            ],
            [
                'title' => 'May 2026 Demo Payroll',
                'start' => '2026-05-01',
                'end' => '2026-05-31',
                'date' => '2026-05-31',
                'base' => 12000,
                'bonus' => 0,
                'deduction' => 300,
            ],
        ] as $index => $record) {
            if (PayrollRun::query()->where('title', $record['title'])->exists()) {
                continue;
            }

            $employee = $employees[$index];
            $created = $this->responseData(
                app(PayrollController::class)->store($this->request($users['accountant'], [
                    'title' => $record['title'],
                    'period_start' => $record['start'],
                    'period_end' => $record['end'],
                    'payment_date' => $record['date'],
                    'payment_method_id' => $method->id,
                    'accounting_account_id' => $account->id,
                    'notes' => 'Approved historical payroll for full-system report coverage.',
                    'items' => [[
                        'user_id' => $employee->user_id,
                        'employee_name' => $employee->full_name,
                        'base_salary' => $record['base'],
                        'bonus' => $record['bonus'],
                        'overtime_amount' => 0,
                        'absence_deduction' => $record['deduction'],
                        'late_deduction' => 0,
                        'advance_deduction' => 0,
                        'tax_deduction' => 0,
                        'recurring_deduction' => 0,
                        'other_deduction' => 0,
                    ]],
                ])),
                201,
            );
            $payrollId = (int) $created['id'];
            $this->responseData(
                app(PayrollController::class)->submit(
                    $this->request($users['accountant']),
                    PayrollRun::query()->findOrFail($payrollId),
                ),
                200,
            );
            $this->responseData(
                app(PayrollController::class)->review(
                    $this->request($users['manager']),
                    PayrollRun::query()->findOrFail($payrollId),
                ),
                200,
            );
            $this->responseData(
                app(PayrollController::class)->approve(
                    $this->request($users['admin']),
                    PayrollRun::query()->findOrFail($payrollId),
                ),
                200,
            );
        }
    }

    private function seedInventoryCoverage(array $users): void
    {
        $area = ServiceArea::query()->where('status', 'active')->orderBy('id')->skip(2)->firstOrFail();
        $warehouse = Warehouse::query()->updateOrCreate(
            ['code' => 'WH-NORTH'],
            ['name' => 'North Service Warehouse', 'service_area_id' => $area->id, 'status' => 'active', 'address' => 'North Kabul'],
        );
        $supplier = Supplier::query()->updateOrCreate(
            ['name' => 'Kabul Valve & Fittings'],
            ['supplier_type' => 'technical', 'phone' => '0798333444', 'status' => 'active'],
        );
        $good = Good::query()->updateOrCreate(
            ['code' => 'VALVE-HALF-DEMO'],
            [
                'name' => 'Half-inch Brass Valve',
                'category' => 'technical',
                'unit' => 'piece',
                'default_cost' => 30,
                'default_price' => 50,
                'status' => 'active',
            ],
        );
        $cash = AccountingAccount::query()->where('code', 'cash_on_hand')->firstOrFail();
        $cashMethod = PaymentMethod::query()->where('code', 'cash')->firstOrFail();
        $workflow = app(InventoryRequestWorkflowService::class);

        $purchase = InventoryRequest::query()->where('notes', 'FULL-DEMO:PURCHASE-VALVES')->first();
        if (! $purchase) {
            $purchase = $workflow->submit([
                'type' => 'purchase',
                'supplier_id' => $supplier->id,
                'accounting_account_id' => $cash->id,
                'warehouse_id' => $warehouse->id,
                'request_date' => '2026-07-23',
                'notes' => 'FULL-DEMO:PURCHASE-VALVES',
                'items' => [[
                    'good_id' => $good->id,
                    'quantity' => 50,
                    'unit_price' => 30,
                ]],
            ], $users['warehouse']);
        }
        if ($purchase->status === 'pending') {
            $workflow->resolve($purchase, ['status' => 'approved', 'approval_notes' => 'Approved demo purchase.'], $users['admin']);
        }

        $stock = InventoryItem::query()
            ->where('good_id', $good->id)
            ->where('warehouse_id', $warehouse->id)
            ->firstOrFail();
        $issue = InventoryRequest::query()->where('notes', 'FULL-DEMO:PARTIAL-CUSTOMER-ISSUE')->first();
        if (! $issue) {
            $customer = Customer::query()->where('subscription_code', 'TEST-SUB-0003')->firstOrFail();
            $issue = $workflow->submit([
                'type' => 'issue',
                'issue_type' => 'customer',
                'customer_id' => $customer->id,
                'accounting_account_id' => $cash->id,
                'payment_method_id' => $cashMethod->id,
                'amount_paid' => 80,
                'warehouse_id' => $warehouse->id,
                'request_date' => '2026-07-24',
                'notes' => 'FULL-DEMO:PARTIAL-CUSTOMER-ISSUE',
                'items' => [[
                    'inventory_item_id' => $stock->id,
                    'quantity' => 4,
                    'unit_price' => 50,
                ]],
            ], $users['warehouse']);
        }
        if ($issue->status === 'pending') {
            $workflow->resolve($issue, ['status' => 'approved', 'approval_notes' => 'Approved partial-payment demo issue.'], $users['admin']);
        }
    }

    private function seedAssetPurchases(array $users): void
    {
        $category = FinancialCategory::query()->where('code', 'asset_purchase')->firstOrFail();
        $areas = ServiceArea::query()->where('status', 'active')->orderBy('id')->take(3)->get();
        $suppliers = Supplier::query()->where('status', 'active')->orderBy('id')->take(3)->get();
        $financialSources = [
            [
                'method' => PaymentMethod::query()->where('code', 'bank_transfer')->firstOrFail(),
                'account' => AccountingAccount::query()->where('code', 'bank_account')->firstOrFail(),
            ],
            [
                'method' => PaymentMethod::query()->where('code', 'cash')->firstOrFail(),
                'account' => AccountingAccount::query()->where('code', 'cash_on_hand')->firstOrFail(),
            ],
            [
                'method' => PaymentMethod::query()->where('code', 'mobile_money')->firstOrFail(),
                'account' => AccountingAccount::query()->where('code', 'mobile_wallet')->firstOrFail(),
            ],
        ];
        $purchases = [
            ['prefix' => 'DEMO-SOLAR', 'name' => 'Solar Pump Panel', 'type' => 'solar', 'quantity' => 2, 'cost' => 15000, 'date' => '2026-07-22'],
            ['prefix' => 'DEMO-PUMP', 'name' => 'Submersible Water Pump', 'type' => 'technical', 'quantity' => 1, 'cost' => 45000, 'date' => '2026-07-23'],
            ['prefix' => 'DEMO-GEN', 'name' => 'Portable Field Generator', 'type' => 'generator', 'quantity' => 3, 'cost' => 8000, 'date' => '2026-07-24'],
        ];

        foreach ($purchases as $index => $record) {
            if (AssetPurchase::query()->where('asset_code_prefix', $record['prefix'])->exists()) {
                continue;
            }
            $source = $financialSources[$index];
            $created = $this->responseData(
                app(AssetPurchaseController::class)->store($this->request($users['accountant'], [
                    'asset_code_prefix' => $record['prefix'],
                    'name' => $record['name'],
                    'type' => $record['type'],
                    'quantity' => $record['quantity'],
                    'unit_cost' => $record['cost'],
                    'supplier_id' => $suppliers[$index]->id,
                    'service_area_id' => $areas[$index]->id,
                    'financial_category_id' => $category->id,
                    'payment_method_id' => $source['method']->id,
                    'accounting_account_id' => $source['account']->id,
                    'asset_status' => 'active',
                    'purchase_date' => $record['date'],
                    'warranty_expiry' => '2027-07-24',
                    'invoice_number' => 'DEMO-ASSET-INVOICE-'.($index + 1),
                    'address' => $areas[$index]->name,
                    'notes' => 'Approved asset purchase generated from the full-system demo.',
                ])),
                201,
            );
            $transaction = AccountingTransaction::query()
                ->where('source_type', 'asset_purchase')
                ->where('source_id', $created['id'])
                ->firstOrFail();
            $workflow = app(AccountingWorkflowService::class);
            $workflow->review($transaction, $users['manager']);
            $workflow->approve($transaction->fresh(), $users['admin']);
        }

        $asset = Asset::query()->where('asset_code', 'DEMO-SOLAR-001')->firstOrFail();
        AssetMaintenance::query()->updateOrCreate(
            ['asset_id' => $asset->id, 'title' => 'Solar panel electrical inspection'],
            [
                'maintenance_type' => 'preventive',
                'description' => 'Inspect panel connections and pump controller.',
                'cost' => 1200,
                'performed_at' => '2026-07-26',
                'next_due_date' => '2026-10-26',
                'status' => 'completed',
                'performed_by' => 'Ahmad Karimi',
                'created_by' => $users['admin']->id,
                'notes' => 'Third maintenance record for report verification.',
            ],
        );
    }

    private function seedHrCoverage(array $users): void
    {
        PublicHoliday::query()->updateOrCreate(
            ['holiday_date' => '2026-08-19'],
            ['name' => 'Independence Day', 'is_paid' => true, 'status' => 'active', 'notes' => 'Third public holiday demo record.'],
        );

        $rule = PayrollDeductionRule::query()->updateOrCreate(
            ['code' => 'staff_welfare_demo'],
            [
                'name' => 'Staff Welfare Contribution',
                'type' => 'other',
                'calculation_type' => 'fixed',
                'value' => 100,
                'threshold_amount' => 0,
                'status' => 'active',
                'description' => 'Optional recurring demo deduction.',
            ],
        );
        $employees = Employee::query()->orderBy('id')->take(4)->get();
        EmployeePayrollDeduction::query()->updateOrCreate(
            ['employee_id' => $employees[2]->id, 'payroll_deduction_rule_id' => $rule->id],
            [
                'assigned_by' => $users['hr']->id,
                'effective_from' => '2026-07-01',
                'status' => 'active',
                'notes' => 'Third deduction rule assignment.',
            ],
        );

        foreach ([
            ['employee' => $employees[0], 'number' => 'ADV-DEMO-00002', 'amount' => 1500, 'status' => 'pending_review', 'reason' => 'School expense request.'],
            ['employee' => $employees[1], 'number' => 'ADV-DEMO-00003', 'amount' => 2000, 'status' => 'rejected', 'reason' => 'Travel advance request.'],
        ] as $index => $record) {
            SalaryAdvance::query()->updateOrCreate(
                ['advance_number' => $record['number']],
                [
                    'employee_id' => $record['employee']->id,
                    'payment_method_id' => PaymentMethod::query()->where('code', 'bank_transfer')->value('id'),
                    'accounting_account_id' => AccountingAccount::query()->where('code', 'payroll_bank')->value('id'),
                    'created_by' => $users['hr']->id,
                    'rejected_by' => $record['status'] === 'rejected' ? $users['admin']->id : null,
                    'amount' => $record['amount'],
                    'deducted_amount' => 0,
                    'payment_date' => '2026-07-'.(20 + $index),
                    'deduction_start_date' => '2026-08-01',
                    'status' => $record['status'],
                    'rejected_at' => $record['status'] === 'rejected' ? '2026-07-22 10:00:00' : null,
                    'rejection_reason' => $record['status'] === 'rejected' ? 'Insufficient supporting information.' : null,
                    'reason' => $record['reason'],
                ],
            );
        }

        EmployeeAdjustment::query()->updateOrCreate(
            ['adjustment_number' => 'ADJ-DEMO-00003'],
            [
                'employee_id' => $employees[2]->id,
                'created_by' => $users['hr']->id,
                'approved_by' => $users['manager']->id,
                'type' => 'bonus',
                'amount' => 750,
                'effective_date' => '2026-07-31',
                'status' => 'approved',
                'approved_at' => '2026-07-27 09:00:00',
                'title' => 'Inventory reconciliation bonus',
                'notes' => 'Third adjustment record.',
            ],
        );

        foreach ([
            ['employee' => $employees[1], 'start' => '2026-01-01', 'end' => '2026-03-31', 'rating' => 5, 'status' => 'finalized'],
            ['employee' => $employees[2], 'start' => '2026-04-01', 'end' => '2026-06-30', 'rating' => 3, 'status' => 'draft'],
        ] as $record) {
            PerformanceReview::query()->updateOrCreate(
                [
                    'employee_id' => $record['employee']->id,
                    'period_start' => $record['start'],
                    'period_end' => $record['end'],
                ],
                [
                    'reviewed_by' => $users['manager']->id,
                    'rating' => $record['rating'],
                    'achievements' => 'Completed assigned operational targets.',
                    'goals' => 'Improve documentation and response time.',
                    'status' => $record['status'],
                    'finalized_at' => $record['status'] === 'finalized' ? '2026-04-02 09:00:00' : null,
                ],
            );
        }

        foreach ([
            ['employee' => $employees[1], 'number' => 'SET-DEMO-00002', 'status' => 'rejected', 'type' => 'termination'],
            ['employee' => $employees[2], 'number' => 'SET-DEMO-00003', 'status' => 'pending_review', 'type' => 'resignation'],
        ] as $record) {
            EmployeeTermination::query()->updateOrCreate(
                ['termination_number' => $record['number']],
                [
                    'employee_id' => $record['employee']->id,
                    'payment_method_id' => PaymentMethod::query()->where('code', 'bank_transfer')->value('id'),
                    'accounting_account_id' => AccountingAccount::query()->where('code', 'payroll_bank')->value('id'),
                    'created_by' => $users['hr']->id,
                    'rejected_by' => $record['status'] === 'rejected' ? $users['admin']->id : null,
                    'last_working_date' => '2026-08-15',
                    'termination_type' => $record['type'],
                    'reason' => 'Demonstration final-settlement workflow.',
                    'settlement_period_start' => '2026-08-01',
                    'final_salary' => 12000,
                    'unused_leave_payout' => 500,
                    'severance_amount' => 1000,
                    'other_earnings' => 0,
                    'advance_recovery' => 0,
                    'other_deductions' => 0,
                    'net_settlement' => 13500,
                    'status' => $record['status'],
                    'rejected_at' => $record['status'] === 'rejected' ? '2026-07-27 11:00:00' : null,
                    'rejection_reason' => $record['status'] === 'rejected' ? 'Employment review is incomplete.' : null,
                    'notes' => 'Additional termination workflow record.',
                ],
            );
        }

        foreach ([2, 3] as $number) {
            $path = "biometric-imports/full-system-demo-{$number}.csv";
            Storage::disk('local')->put($path, "employee_number,attendance_date,check_in,check_out\n");
            BiometricImportBatch::query()->updateOrCreate(
                ['batch_number' => 'BIO-DEMO-0000'.$number],
                [
                    'imported_by' => $users['hr']->id,
                    'original_name' => "full-system-demo-{$number}.csv",
                    'path' => $path,
                    'total_rows' => $number,
                    'imported_rows' => $number === 2 ? 2 : 0,
                    'failed_rows' => $number === 2 ? 0 : 3,
                    'status' => $number === 2 ? 'completed' : 'failed',
                    'errors' => $number === 2 ? null : [['row' => 2, 'message' => 'Invalid employee number.']],
                ],
            );
        }

        foreach ($employees->take(3) as $index => $employee) {
            $path = 'employee-documents/demo-employee-'.($index + 1).'.txt';
            Storage::disk('local')->put($path, "Demo employee document for {$employee->full_name}.\n");
            EmployeeDocument::query()->updateOrCreate(
                ['employee_id' => $employee->id, 'path' => $path],
                [
                    'uploaded_by' => $users['hr']->id,
                    'document_type' => 'identity',
                    'original_name' => 'demo-identity-'.($index + 1).'.txt',
                    'stored_name' => 'demo-employee-'.($index + 1).'.txt',
                    'mime_type' => 'text/plain',
                    'size' => Storage::disk('local')->size($path),
                    'notes' => 'Demo HR attachment.',
                ],
            );
        }
    }

    private function seedClosingsAndDistributions(array $users)
    {
        $this->seedShareholders($users);
        $reports = app(FinancialReportingService::class);
        $reconciliationController = app(AccountReconciliationController::class);
        $closingController = app(FinancialPeriodClosingController::class);
        $distributionController = app(ShareholderDistributionController::class);

        foreach ([
            ['start' => '2026-04-01', 'end' => '2026-04-30'],
            ['start' => '2026-05-01', 'end' => '2026-05-31'],
            ['start' => '2026-06-01', 'end' => '2026-06-30'],
        ] as $period) {
            foreach (AccountingAccount::query()->where('status', 'active')->orderBy('id')->get() as $account) {
                if (AccountReconciliation::query()
                    ->where('accounting_account_id', $account->id)
                    ->whereDate('period_end', $period['end'])
                    ->exists()) {
                    continue;
                }
                $created = $this->responseData(
                    $reconciliationController->store($this->request($users['accountant'], [
                        'accounting_account_id' => $account->id,
                        'period_start' => $period['start'],
                        'period_end' => $period['end'],
                        'statement_balance' => $reports->bookBalance($account, $period['end']),
                        'notes' => 'Balanced full-system demo reconciliation.',
                        'items' => [],
                    ])),
                    201,
                );
                $reconciliation = AccountReconciliation::query()->findOrFail($created['id']);
                $this->responseData($reconciliationController->submit($this->request($users['accountant']), $reconciliation), 200);
                $this->responseData($reconciliationController->review($this->request($users['manager']), $reconciliation->fresh()), 200);
                $this->responseData($reconciliationController->approve($this->request($users['admin']), $reconciliation->fresh()), 200);
            }

            $closing = FinancialPeriodClosing::query()
                ->where('period_code', substr($period['start'], 0, 7))
                ->first();
            if (! $closing) {
                $created = $this->responseData(
                    $closingController->store($this->request($users['accountant'], [
                        'period_start' => $period['start'],
                        'period_end' => $period['end'],
                        'notes' => 'Verified full-system demo month closing.',
                    ])),
                    201,
                );
                $closing = FinancialPeriodClosing::query()->findOrFail($created['id']);
                $this->responseData($closingController->submit($this->request($users['accountant']), $closing), 200);
                $this->responseData($closingController->review($this->request($users['manager']), $closing->fresh()), 200);
                $this->responseData($closingController->close($this->request($users['admin']), $closing->fresh()), 200);
            }

            if (! ShareholderDistribution::query()->where('financial_period_closing_id', $closing->id)->exists()) {
                $created = $this->responseData(
                    $distributionController->store($this->request($users['accountant'], [
                        'financial_period_closing_id' => $closing->id,
                        'notes' => 'Ownership-based demo profit distribution.',
                    ])),
                    201,
                );
                $distribution = ShareholderDistribution::query()->findOrFail($created['id']);
                $this->responseData($distributionController->submit($this->request($users['accountant']), $distribution), 200);
                $this->responseData($distributionController->review($this->request($users['manager']), $distribution->fresh()), 200);
                $this->responseData($distributionController->approve($this->request($users['admin']), $distribution->fresh()), 200);
            }
        }

        return ShareholderDistribution::query()->with('items')->orderBy('id')->get();
    }

    private function seedShareholders(array $users): void
    {
        $controller = app(ShareholderController::class);
        foreach ([
            ['name' => 'Abdul Rahman Safi', 'phone' => '0798111001', 'investment_amount' => 500000, 'ownership_percentage' => 50],
            ['name' => 'Farida Noori', 'phone' => '0798111002', 'investment_amount' => 300000, 'ownership_percentage' => 30],
            ['name' => 'Hamid Wardak', 'phone' => '0798111003', 'investment_amount' => 200000, 'ownership_percentage' => 20],
        ] as $record) {
            if (Shareholder::query()->where('phone', $record['phone'])->exists()) {
                continue;
            }
            $this->responseData(
                $controller->store($this->request($users['accountant'], $record + [
                    'status' => 'active',
                    'notes' => 'Full-system demo shareholder.',
                ])),
                201,
            );
        }
    }

    private function seedShareholderPayments(array $users, ShareholderDistribution $distribution): void
    {
        $controller = app(ShareholderDistributionController::class);
        $workflow = app(AccountingWorkflowService::class);
        $method = PaymentMethod::query()->where('code', 'bank_transfer')->firstOrFail();
        $account = AccountingAccount::query()->where('code', 'bank_account')->firstOrFail();

        foreach ($distribution->items()->orderBy('id')->get() as $index => $item) {
            if ($item->payments()->exists()) {
                continue;
            }
            $created = $this->responseData(
                $controller->pay($this->request($users['accountant'], [
                    'amount' => $item->entitlement_amount,
                    'payment_date' => '2026-07-'.(25 + $index),
                    'payment_method_id' => $method->id,
                    'accounting_account_id' => $account->id,
                    'receipt_number' => 'DEMO-SH-PAY-'.($index + 1),
                    'notes' => 'Paid first demo distribution entitlement in full.',
                ]), $item),
                201,
            );
            $transaction = AccountingTransaction::query()->findOrFail($created['transaction']['id']);
            $workflow->review($transaction, $users['manager']);
            $workflow->approve($transaction->fresh(), $users['admin']);
        }
    }

    private function request(User $user, array $data = [], string $method = 'POST'): Request
    {
        $request = Request::create('/api/full-system-demo', $method, $data, [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $request->setUserResolver(fn () => $user);

        return $request;
    }

    private function responseData(JsonResponse $response, int $expectedStatus): array
    {
        if ($response->getStatusCode() !== $expectedStatus) {
            throw new RuntimeException("Unexpected full-system demo API status {$response->getStatusCode()}: {$response->getContent()}");
        }

        return $response->getData(true)['data'] ?? [];
    }
}
