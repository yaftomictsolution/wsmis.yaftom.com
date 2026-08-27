<?php

namespace Tests\Feature;

use App\Models\AccountingAccount;
use App\Models\FinancialCategory;
use App\Models\PaymentMethod;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AssetPurchaseExpenseWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_asset_purchase_posts_once_and_generates_individual_assets_after_approval(): void
    {
        [$accountant, $manager, $admin] = $this->financeUsers();
        [$account, $method, $category] = $this->financeSetup(1000);
        $supplier = Supplier::query()->create([
            'name' => 'Kabul Pump Supply',
            'supplier_type' => 'technical',
            'status' => 'active',
        ]);

        Sanctum::actingAs($accountant);
        $response = $this->postJson('/api/asset-purchases', [
            'asset_code_prefix' => 'PUMP',
            'name' => 'Distribution Pump',
            'type' => 'technical',
            'quantity' => 2,
            'unit_cost' => 100,
            'supplier_id' => $supplier->id,
            'financial_category_id' => $category->id,
            'payment_method_id' => $method->id,
            'accounting_account_id' => $account->id,
            'asset_status' => 'active',
            'purchase_date' => '2026-07-28',
        ])->assertCreated()
            ->assertJsonPath('data.total_amount', '200.00')
            ->assertJsonPath('data.status', 'pending_review');

        $purchaseId = $response->json('data.id');
        $transactionId = $response->json('data.accounting_transaction_id');
        $this->assertEquals(1000, (float) $account->fresh()->current_balance);
        $this->assertDatabaseCount('assets', 0);

        Sanctum::actingAs($manager);
        $this->postJson("/api/accounting/transactions/{$transactionId}/review")
            ->assertOk()
            ->assertJsonPath('data.status', 'pending_approval');
        $this->assertDatabaseHas('asset_purchases', ['id' => $purchaseId, 'status' => 'pending_approval']);
        $this->assertEquals(1000, (float) $account->fresh()->current_balance);

        Sanctum::actingAs($admin);
        $this->postJson("/api/accounting/transactions/{$transactionId}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->assertEquals(800, (float) $account->fresh()->current_balance);
        $this->assertDatabaseHas('asset_purchases', ['id' => $purchaseId, 'status' => 'approved']);
        $this->assertDatabaseHas('assets', ['asset_purchase_id' => $purchaseId, 'asset_code' => 'PUMP-001', 'purchase_cost' => 100]);
        $this->assertDatabaseHas('assets', ['asset_purchase_id' => $purchaseId, 'asset_code' => 'PUMP-002', 'purchase_cost' => 100]);

        $this->postJson("/api/accounting/transactions/{$transactionId}/cancel", [
            'reversal_reason' => 'Supplier cancelled the order.',
        ])->assertOk()->assertJsonPath('data.status', 'cancelled');

        $this->assertEquals(1000, (float) $account->fresh()->current_balance);
        $this->assertDatabaseHas('asset_purchases', ['id' => $purchaseId, 'status' => 'cancelled']);
        $this->assertDatabaseMissing('assets', ['asset_purchase_id' => $purchaseId, 'status' => 'active']);
    }

    public function test_asset_purchase_rejects_insufficient_balance_and_duplicate_generated_codes(): void
    {
        [$accountant] = $this->financeUsers();
        [$account, $method, $category] = $this->financeSetup(100);
        Sanctum::actingAs($accountant);

        $body = [
            'asset_code_prefix' => 'GEN',
            'name' => 'Backup Generator',
            'type' => 'generator',
            'quantity' => 2,
            'unit_cost' => 100,
            'financial_category_id' => $category->id,
            'payment_method_id' => $method->id,
            'accounting_account_id' => $account->id,
            'purchase_date' => '2026-07-28',
        ];

        $this->postJson('/api/asset-purchases', $body)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('accounting_account_id');

        $account->update(['current_balance' => 1000]);
        $this->postJson('/api/assets', [
            'asset_code' => 'GEN-001',
            'name' => 'Existing Generator',
            'type' => 'generator',
        ])->assertCreated();
        $this->postJson('/api/asset-purchases', $body)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('asset_code_prefix');
    }

    public function test_asset_purchase_rejects_a_stale_supplier_selection_with_a_clear_message(): void
    {
        [$accountant] = $this->financeUsers();
        [$account, $method, $category] = $this->financeSetup(1000);
        $supplier = Supplier::query()->create([
            'name' => 'Removed Supplier',
            'status' => 'active',
        ]);
        $supplierId = $supplier->id;
        $supplier->delete();

        Sanctum::actingAs($accountant);
        $this->postJson('/api/asset-purchases', [
            'asset_code_prefix' => 'GEN-STALE',
            'name' => 'Backup Generator',
            'type' => 'generator',
            'quantity' => 1,
            'unit_cost' => 100,
            'supplier_id' => $supplierId,
            'financial_category_id' => $category->id,
            'payment_method_id' => $method->id,
            'accounting_account_id' => $account->id,
            'purchase_date' => '2026-07-28',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('supplier_id')
            ->assertJsonPath(
                'errors.supplier_id.0',
                'The selected supplier no longer exists or is inactive. Refresh the supplier list and select it again.',
            );
    }

    public function test_manual_expenses_can_be_edited_or_deleted_before_posting_but_used_types_cannot_be_deleted(): void
    {
        [$accountant, , $admin] = $this->financeUsers();
        [$account, $method, $category] = $this->financeSetup(1000);
        Sanctum::actingAs($accountant);

        $expenseId = $this->postJson('/api/accounting/transactions', [
            'type' => 'expense',
            'financial_category_id' => $category->id,
            'payment_method_id' => $method->id,
            'accounting_account_id' => $account->id,
            'title' => 'Office supplies',
            'amount' => 50,
            'transaction_date' => '2026-07-28',
        ])->assertCreated()->json('data.id');

        $this->putJson("/api/accounting/transactions/{$expenseId}", [
            'type' => 'expense',
            'financial_category_id' => $category->id,
            'payment_method_id' => $method->id,
            'accounting_account_id' => $account->id,
            'title' => 'Office supplies corrected',
            'amount' => 60,
            'transaction_date' => '2026-07-28',
        ])->assertOk()
            ->assertJsonPath('data.amount', '60.00')
            ->assertJsonPath('data.status', 'pending_review');

        Sanctum::actingAs($admin);
        $this->deleteJson("/api/financial-categories/{$category->id}")
            ->assertUnprocessable();

        Sanctum::actingAs($accountant);
        $this->deleteJson("/api/accounting/transactions/{$expenseId}")
            ->assertOk();
        $this->assertDatabaseMissing('accounting_transactions', ['id' => $expenseId]);

        Sanctum::actingAs($admin);
        $this->deleteJson("/api/financial-categories/{$category->id}")
            ->assertOk();
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

    private function financeSetup(float $balance): array
    {
        $method = PaymentMethod::query()->firstOrCreate(
            ['code' => 'cash'],
            ['name' => 'Cash', 'status' => 'active'],
        );
        $account = AccountingAccount::query()->create([
            'name' => 'Asset Purchase Cash',
            'code' => 'asset_purchase_cash',
            'type' => 'cash',
            'opening_balance' => $balance,
            'current_balance' => $balance,
            'status' => 'active',
        ]);
        $category = FinancialCategory::query()->where('code', 'asset_purchase')->firstOrFail();

        return [$account, $method, $category];
    }
}
