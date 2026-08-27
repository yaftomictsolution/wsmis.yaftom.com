<?php

namespace Tests\Feature;

use App\Models\AccountingAccount;
use App\Models\AccountingTransaction;
use App\Models\FinancialCategory;
use App\Models\PaymentMethod;
use App\Models\ShareholderDistributionItem;
use App\Models\User;
use App\Services\FinancialReportingService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PhaseFourFinanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_monthly_closing_blocks_open_month_and_names_each_missing_reconciliation(): void
    {
        Carbon::setTestNow('2026-08-01 09:00:00');

        try {
            [$accountant] = $this->financeUsers();
            [$cashAccount] = $this->cashSetup(1000);
            $bankAccount = AccountingAccount::query()->create([
                'name' => 'Phase Four Bank',
                'code' => 'phase_four_bank',
                'type' => 'bank',
                'opening_balance' => 2500,
                'current_balance' => 2500,
                'status' => 'active',
            ]);
            $bankAccount->forceFill(['created_at' => '2026-06-30 12:00:00'])->save();
            $futureAccount = AccountingAccount::query()->create([
                'name' => 'August Purchase Account',
                'code' => 'august_purchase_account',
                'type' => 'cash',
                'opening_balance' => 10000,
                'current_balance' => 10000,
                'status' => 'active',
            ]);

            $this->assertSame(0.0, app(FinancialReportingService::class)->bookBalance($futureAccount, '2026-07-31'));

            Sanctum::actingAs($accountant);
            $this->postJson('/api/financial-closings', [
                'period_start' => '2026-08-01',
                'period_end' => '2026-08-31',
            ])->assertUnprocessable()
                ->assertJsonPath('errors.period_end.0', 'August 2026 is still open. It can be closed after August 31, 2026. The latest completed month is July 2026.');

            $closingId = $this->postJson('/api/financial-closings', [
                'period_start' => '2026-07-01',
                'period_end' => '2026-07-31',
            ])->assertCreated()->json('data.id');

            $this->getJson('/api/financial-closings')
                ->assertOk()
                ->assertJsonPath('data.0.id', $closingId)
                ->assertJsonPath('data.0.readiness.period_ended', true)
                ->assertJsonPath('data.0.readiness.pending_transactions', 0)
                ->assertJsonPath('data.0.readiness.reconciliation.required_count', 2)
                ->assertJsonPath('data.0.readiness.reconciliation.approved_count', 0)
                ->assertJsonPath('data.0.readiness.reconciliation.complete', false)
                ->assertJsonFragment(['account_id' => $cashAccount->id, 'status' => 'missing'])
                ->assertJsonFragment(['account_id' => $bankAccount->id, 'status' => 'missing'])
                ->assertJsonMissing(['account_id' => $futureAccount->id]);

            $response = $this->postJson("/api/financial-closings/{$closingId}/submit")
                ->assertUnprocessable();
            $message = $response->json('errors.reconciliation.0');
            $this->assertStringContainsString('Phase Four Cash (not created)', $message);
            $this->assertStringContainsString('Phase Four Bank (not created)', $message);
            $this->assertStringContainsString('period end 2026-07-31', $message);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_payroll_posts_to_the_account_only_after_admin_approval(): void
    {
        [$accountant, $manager, $admin] = $this->financeUsers();
        [$account, $method] = $this->cashSetup(10000);
        $employee = User::factory()->create(['name' => 'Test Employee']);

        Sanctum::actingAs($accountant);
        $payrollId = $this->postJson('/api/payroll-runs', [
            'title' => 'July Payroll',
            'period_start' => '2026-07-01',
            'period_end' => '2026-07-31',
            'payment_date' => '2026-07-31',
            'payment_method_id' => $method->id,
            'accounting_account_id' => $account->id,
            'items' => [[
                'user_id' => $employee->id,
                'employee_name' => $employee->name,
                'base_salary' => 1200,
                'bonus' => 100,
                'overtime_amount' => 50,
                'advance_deduction' => 200,
                'other_deduction' => 150,
            ]],
        ])->assertCreated()->json('data.id');

        $this->postJson("/api/payroll-runs/{$payrollId}/submit")->assertOk()->assertJsonPath('data.status', 'pending_review');
        $this->assertEquals(10000, (float) $account->fresh()->current_balance);

        Sanctum::actingAs($manager);
        $this->postJson("/api/payroll-runs/{$payrollId}/review")->assertOk()->assertJsonPath('data.status', 'pending_approval');
        $this->assertEquals(10000, (float) $account->fresh()->current_balance);

        Sanctum::actingAs($admin);
        $this->postJson("/api/payroll-runs/{$payrollId}/approve")->assertOk()->assertJsonPath('data.status', 'approved');
        $this->assertEquals(9000, (float) $account->fresh()->current_balance);
        $this->assertDatabaseHas('accounting_transactions', ['source_type' => 'payroll_run', 'source_id' => $payrollId, 'status' => 'approved', 'amount' => 1000]);
        $accountsResponse = $this->getJson('/api/accounting/accounts')
            ->assertOk()
            ->assertHeader('Cache-Control', 'must-revalidate, no-cache, no-store, private');
        $accountPayload = collect($accountsResponse->json('data'))->firstWhere('id', $account->id);
        $this->assertSame('9000.00', $accountPayload['current_balance']);

        $this->getJson('/api/financial-reports?from=2026-07-01&to=2026-07-31')
            ->assertOk()
            ->assertJsonPath('data.summary.payroll_expense', 1000)
            ->assertJsonPath('data.summary.net_income', -1000);
    }

    public function test_reconciliation_closing_and_shareholder_payment_preserve_financial_rules(): void
    {
        [$accountant, $manager, $admin] = $this->financeUsers();
        [$account, $method] = $this->cashSetup(1000);
        $incomeCategory = FinancialCategory::query()->create(['name' => 'Service Income', 'code' => 'test_service_income', 'type' => 'income', 'status' => 'active']);
        $income = AccountingTransaction::query()->create([
            'financial_category_id' => $incomeCategory->id,
            'payment_method_id' => $method->id,
            'accounting_account_id' => $account->id,
            'recorded_by' => $admin->id,
            'reviewed_by' => $manager->id,
            'approved_by' => $admin->id,
            'transaction_number' => AccountingTransaction::nextNumber('income'),
            'type' => 'income',
            'title' => 'July service income',
            'amount' => 1000,
            'transaction_date' => '2026-07-15',
            'status' => 'approved',
            'reviewed_at' => now(),
            'approved_at' => now(),
        ]);
        $income->postToAccount();

        Sanctum::actingAs($accountant);
        $reconciliationId = $this->postJson('/api/account-reconciliations', [
            'accounting_account_id' => $account->id,
            'period_start' => '2026-07-01',
            'period_end' => '2026-07-31',
            'statement_balance' => 2000,
            'items' => [],
        ])->assertCreated()->assertJsonPath('data.difference', '0.00')->json('data.id');
        $this->postJson("/api/account-reconciliations/{$reconciliationId}/submit")->assertOk();

        Sanctum::actingAs($manager);
        $this->postJson("/api/account-reconciliations/{$reconciliationId}/review")->assertOk();

        Sanctum::actingAs($admin);
        $this->postJson("/api/account-reconciliations/{$reconciliationId}/approve")->assertOk()->assertJsonPath('data.status', 'approved');

        Sanctum::actingAs($accountant);
        $closingId = $this->postJson('/api/financial-closings', [
            'period_start' => '2026-07-01',
            'period_end' => '2026-07-31',
        ])->assertCreated()->assertJsonPath('data.net_income', '1000.00')->json('data.id');
        $this->postJson("/api/financial-closings/{$closingId}/submit")->assertOk();

        Sanctum::actingAs($manager);
        $this->postJson("/api/financial-closings/{$closingId}/review")->assertOk();

        Sanctum::actingAs($admin);
        $this->postJson("/api/financial-closings/{$closingId}/close")->assertOk()->assertJsonPath('data.status', 'closed');

        $this->postJson('/api/accounting/transactions', [
            'type' => 'income',
            'financial_category_id' => $incomeCategory->id,
            'payment_method_id' => $method->id,
            'accounting_account_id' => $account->id,
            'title' => 'Late July entry',
            'amount' => 10,
            'transaction_date' => '2026-07-20',
        ])->assertUnprocessable()->assertJsonValidationErrors('transaction_date');

        Sanctum::actingAs($accountant);
        $this->postJson('/api/shareholders', ['name' => 'Shareholder A', 'shareholder_type' => 'company', 'investment_amount' => 6000, 'ownership_percentage' => 60, 'status' => 'active'])
            ->assertCreated()
            ->assertJsonPath('data.shareholder_type', 'company');
        $this->postJson('/api/shareholders', ['name' => 'Shareholder B', 'investment_amount' => 4000, 'ownership_percentage' => 40, 'status' => 'active'])
            ->assertCreated()
            ->assertJsonPath('data.shareholder_type', 'individual');
        $distributionId = $this->postJson('/api/shareholder-distributions', [
            'financial_period_closing_id' => $closingId,
            'distributable_amount' => 1000,
        ])->assertCreated()->json('data.id');
        $this->postJson("/api/shareholder-distributions/{$distributionId}/submit")->assertOk();

        Sanctum::actingAs($manager);
        $this->postJson("/api/shareholder-distributions/{$distributionId}/review")->assertOk();

        Sanctum::actingAs($admin);
        $this->postJson("/api/shareholder-distributions/{$distributionId}/approve")->assertOk();
        $item = ShareholderDistributionItem::query()->where('shareholder_distribution_id', $distributionId)->where('entitlement_amount', 400)->firstOrFail();

        Sanctum::actingAs($accountant);
        $transactionId = $this->postJson("/api/shareholder-distribution-items/{$item->id}/payments", [
            'amount' => 400,
            'payment_date' => '2026-08-02',
            'payment_method_id' => $method->id,
            'accounting_account_id' => $account->id,
        ])->assertCreated()->json('data.transaction.id');

        Sanctum::actingAs($manager);
        $this->postJson("/api/accounting/transactions/{$transactionId}/review")->assertOk();
        Sanctum::actingAs($admin);
        $this->postJson("/api/accounting/transactions/{$transactionId}/approve")->assertOk();

        $this->assertEquals(1600, (float) $account->fresh()->current_balance);
        $this->assertDatabaseHas('shareholder_payments', ['accounting_transaction_id' => $transactionId, 'status' => 'paid', 'amount' => 400]);
        $this->getJson('/api/financial-reports?from=2026-08-01&to=2026-08-31')
            ->assertOk()
            ->assertJsonPath('data.summary.net_income', 0)
            ->assertJsonPath('data.summary.shareholder_payments', 400);
    }

    private function financeUsers(): array
    {
        $accountantRole = Role::findOrCreate('Accountant', 'web');
        $managerRole = Role::findOrCreate('Manager', 'web');
        $adminRole = Role::findOrCreate('Admin', 'web');
        $accountant = User::factory()->create(['status' => 'active']);
        $manager = User::factory()->create(['status' => 'active']);
        $admin = User::factory()->create(['status' => 'active']);
        $accountant->assignRole($accountantRole);
        $manager->assignRole($managerRole);
        $admin->assignRole($adminRole);

        return [$accountant, $manager, $admin];
    }

    private function cashSetup(float $openingBalance): array
    {
        $method = PaymentMethod::query()->firstOrCreate(['code' => 'cash'], ['name' => 'Cash', 'status' => 'active']);
        $account = AccountingAccount::query()->create([
            'name' => 'Phase Four Cash',
            'code' => 'phase_four_cash',
            'type' => 'cash',
            'opening_balance' => $openingBalance,
            'current_balance' => $openingBalance,
            'status' => 'active',
        ]);
        $account->forceFill(['created_at' => '2026-06-30 12:00:00'])->save();

        return [$account, $method];
    }
}
