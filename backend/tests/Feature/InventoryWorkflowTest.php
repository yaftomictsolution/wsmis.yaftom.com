<?php

namespace Tests\Feature;

use App\Models\AccountingAccount;
use App\Models\Customer;
use App\Models\Department;
use App\Models\Good;
use App\Models\InventoryItem;
use App\Models\InventoryRequest;
use App\Models\InventoryTransaction;
use App\Models\PaymentMethod;
use App\Models\ServiceArea;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class InventoryWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_purchase_and_customer_issue_post_stock_and_account_balances_atomically(): void
    {
        [$staff, $admin] = $this->users();
        [$warehouse, $supplier, $good, $account] = $this->inventorySetup();

        Sanctum::actingAs($staff);
        $purchaseId = $this->postJson('/api/inventory-requests', [
            'type' => 'purchase',
            'supplier_id' => $supplier->id,
            'accounting_account_id' => $account->id,
            'warehouse_id' => $warehouse->id,
            'request_date' => '2026-07-27',
            'items' => [[
                'good_id' => $good->id,
                'quantity' => 10,
                'unit_price' => 200,
            ]],
        ])->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.warehouse.id', $warehouse->id)
            ->json('data.id');

        $this->assertDatabaseMissing('inventory_items', ['good_id' => $good->id]);
        $this->assertEquals(10000, (float) $account->fresh()->current_balance);

        Sanctum::actingAs($admin);
        $this->postJson("/api/inventory-requests/{$purchaseId}/approve", [
            'status' => 'approved',
        ])->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.items.0.inventory_item_id', fn ($value) => (int) $value > 0);

        $stock = InventoryItem::query()->where('good_id', $good->id)->where('warehouse_id', $warehouse->id)->firstOrFail();
        $this->assertEquals(10, (float) $stock->quantity);
        $this->assertEquals(200, (float) $stock->unit_cost);
        $this->assertEquals(8000, (float) $account->fresh()->current_balance);
        $this->assertDatabaseHas('inventory_transactions', [
            'inventory_item_id' => $stock->id,
            'type' => 'purchase',
            'quantity' => 10,
            'reference_id' => $purchaseId,
        ]);
        $this->assertDatabaseHas('accounting_transactions', [
            'source_type' => 'inventory_request',
            'source_id' => $purchaseId,
            'type' => 'expense',
            'amount' => 2000,
        ]);

        $customer = Customer::query()->create([
            'service_area_id' => ServiceArea::query()->firstOrFail()->id,
            'name' => 'Inventory Customer',
            'phone' => '0700000999',
            'status' => 'active',
        ]);
        $paymentMethod = PaymentMethod::query()->firstOrCreate(
            ['code' => 'cash'],
            ['name' => 'Cash', 'status' => 'active'],
        );

        Sanctum::actingAs($staff);
        $issueId = $this->postJson('/api/inventory-requests', [
            'type' => 'issue',
            'issue_type' => 'customer',
            'customer_id' => $customer->id,
            'accounting_account_id' => $account->id,
            'payment_method_id' => $paymentMethod->id,
            'amount_paid' => 400,
            'warehouse_id' => $warehouse->id,
            'request_date' => '2026-07-27',
            'items' => [[
                'inventory_item_id' => $stock->id,
                'quantity' => 3,
                'unit_price' => 350,
            ]],
        ])->assertCreated()
            ->assertJsonPath('data.issue_type', 'customer')
            ->assertJsonPath('data.total_amount', '1050.00')
            ->assertJsonPath('data.initial_payment_amount', '400.00')
            ->json('data.id');

        $this->assertEquals(10, (float) $stock->fresh()->quantity);
        $this->assertEquals(8000, (float) $account->fresh()->current_balance);

        Sanctum::actingAs($admin);
        $this->postJson("/api/inventory-requests/{$issueId}/approve", [
            'status' => 'approved',
        ])->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.invoice.total_amount', '1050.00')
            ->assertJsonPath('data.invoice.paid_amount', '400.00')
            ->assertJsonPath('data.invoice.remaining_amount', '650.00')
            ->assertJsonPath('data.invoice.status', 'partially_paid');

        $this->assertEquals(7, (float) $stock->fresh()->quantity);
        $this->assertEquals(8400, (float) $account->fresh()->current_balance);
        $this->assertDatabaseHas('inventory_transactions', [
            'inventory_item_id' => $stock->id,
            'type' => 'sale',
            'quantity' => -3,
            'reference_id' => $issueId,
        ]);
        $this->assertDatabaseHas('invoices', [
            'customer_id' => $customer->id,
            'invoice_type' => 'inventory',
            'total_amount' => 1050,
            'paid_amount' => 400,
            'remaining_amount' => 650,
            'status' => 'partially_paid',
        ]);
        $this->assertDatabaseHas('payments', [
            'customer_id' => $customer->id,
            'accounting_account_id' => $account->id,
            'amount' => 400,
            'status' => 'posted',
        ]);

        Sanctum::actingAs($staff);
        $invoiceId = InventoryRequest::query()->findOrFail($issueId)->invoice_id;
        $this->postJson('/api/payments', [
            'customer_id' => $customer->id,
            'payment_method_id' => $paymentMethod->id,
            'accounting_account_id' => $account->id,
            'paid_at' => '2026-07-27',
            'reference' => 'Second inventory sale payment',
            'items' => [[
                'type' => 'invoice',
                'id' => $invoiceId,
                'amount' => 250,
            ]],
        ])->assertCreated()
            ->assertJsonPath('data.amount', '250.00');

        $this->assertEquals(7, (float) $stock->fresh()->quantity);
        $this->assertEquals(8650, (float) $account->fresh()->current_balance);
        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'paid_amount' => 650,
            'remaining_amount' => 400,
            'status' => 'partially_paid',
        ]);

        $this->getJson('/api/inventory-requests?type=issue')
            ->assertOk()
            ->assertJsonPath('data.data.0.id', $issueId)
            ->assertJsonPath('data.data.0.items.0.description', $good->name)
            ->assertJsonPath('data.data.0.account.id', $account->id)
            ->assertJsonPath('data.data.0.warehouse.id', $warehouse->id)
            ->assertJsonPath('data.data.0.invoice.paid_amount', '650.00')
            ->assertJsonPath('data.data.0.invoice.remaining_amount', '400.00')
            ->assertJsonCount(2, 'data.data.0.invoice.allocations');
    }

    public function test_internal_issue_reduces_stock_without_changing_cash(): void
    {
        [$staff, $admin] = $this->users();
        [$warehouse, $supplier, $good, $account] = $this->inventorySetup();
        $stock = InventoryItem::query()->create([
            'good_id' => $good->id,
            'warehouse_id' => $warehouse->id,
            'name' => $good->name,
            'code' => $good->code,
            'category' => $good->category,
            'unit' => $good->unit,
            'quantity' => 8,
            'unit_cost' => 200,
            'unit_price' => 350,
            'reorder_level' => 2,
            'supplier_id' => $supplier->id,
        ]);
        $department = Department::query()->create([
            'code' => 'TECH',
            'name' => 'Technical',
            'status' => 'active',
        ]);

        Sanctum::actingAs($staff);
        $requestId = $this->postJson('/api/inventory-requests', [
            'type' => 'issue',
            'issue_type' => 'internal',
            'department_id' => $department->id,
            'warehouse_id' => $warehouse->id,
            'request_date' => '2026-07-27',
            'items' => [[
                'inventory_item_id' => $stock->id,
                'quantity' => 2,
                'unit_price' => 999,
            ]],
        ])->assertCreated()
            ->assertJsonPath('data.accounting_account_id', null)
            ->assertJsonPath('data.total_amount', '400.00')
            ->json('data.id');

        Sanctum::actingAs($admin);
        $this->postJson("/api/inventory-requests/{$requestId}/approve", [
            'status' => 'approved',
        ])->assertOk();

        $this->assertEquals(6, (float) $stock->fresh()->quantity);
        $this->assertEquals(10000, (float) $account->fresh()->current_balance);
        $this->assertDatabaseHas('inventory_transactions', [
            'type' => 'internal_use',
            'quantity' => -2,
            'total_amount' => 400,
        ]);
        $this->assertDatabaseHas('accounting_transactions', [
            'source_type' => 'inventory_request',
            'source_id' => $requestId,
            'type' => 'expense',
            'amount' => 400,
            'accounting_account_id' => null,
        ]);
    }

    public function test_customer_sale_can_be_unpaid_and_rejects_payment_above_the_sale_total(): void
    {
        [$staff, $admin] = $this->users();
        [$warehouse, $supplier, $good, $account] = $this->inventorySetup();
        $stock = InventoryItem::query()->create([
            'good_id' => $good->id,
            'warehouse_id' => $warehouse->id,
            'name' => $good->name,
            'code' => $good->code,
            'category' => $good->category,
            'unit' => $good->unit,
            'quantity' => 5,
            'unit_cost' => 200,
            'unit_price' => 350,
            'reorder_level' => 2,
            'supplier_id' => $supplier->id,
        ]);
        $customer = Customer::query()->create([
            'service_area_id' => ServiceArea::query()->firstOrFail()->id,
            'name' => 'Unpaid Inventory Customer',
            'phone' => '0700000777',
            'status' => 'active',
        ]);
        $cashMethod = PaymentMethod::query()->where('code', 'cash')->firstOrFail();

        Sanctum::actingAs($staff);
        $this->postJson('/api/inventory-requests', [
            'type' => 'issue',
            'issue_type' => 'customer',
            'customer_id' => $customer->id,
            'accounting_account_id' => $account->id,
            'payment_method_id' => $cashMethod->id,
            'amount_paid' => 701,
            'warehouse_id' => $warehouse->id,
            'request_date' => '2026-07-27',
            'items' => [[
                'inventory_item_id' => $stock->id,
                'quantity' => 2,
                'unit_price' => 350,
            ]],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('amount_paid');

        $requestId = $this->postJson('/api/inventory-requests', [
            'type' => 'issue',
            'issue_type' => 'customer',
            'customer_id' => $customer->id,
            'amount_paid' => 0,
            'warehouse_id' => $warehouse->id,
            'request_date' => '2026-07-27',
            'items' => [[
                'inventory_item_id' => $stock->id,
                'quantity' => 2,
                'unit_price' => 350,
            ]],
        ])->assertCreated()
            ->assertJsonPath('data.accounting_account_id', null)
            ->assertJsonPath('data.payment_method_id', null)
            ->json('data.id');

        Sanctum::actingAs($admin);
        $this->postJson("/api/inventory-requests/{$requestId}/approve", [
            'status' => 'approved',
        ])->assertOk()
            ->assertJsonPath('data.invoice.status', 'unpaid')
            ->assertJsonPath('data.invoice.paid_amount', '0.00')
            ->assertJsonPath('data.invoice.remaining_amount', '700.00');

        $this->assertEquals(3, (float) $stock->fresh()->quantity);
        $this->assertEquals(10000, (float) $account->fresh()->current_balance);
        $this->assertDatabaseMissing('payments', ['customer_id' => $customer->id]);
    }

    public function test_approval_rechecks_stock_and_permissions_without_partial_posting(): void
    {
        [$staff, $admin] = $this->users();
        [$warehouse, $supplier, $good, $account] = $this->inventorySetup();
        $stock = InventoryItem::query()->create([
            'good_id' => $good->id,
            'warehouse_id' => $warehouse->id,
            'name' => $good->name,
            'code' => $good->code,
            'category' => $good->category,
            'unit' => $good->unit,
            'quantity' => 5,
            'unit_cost' => 200,
            'unit_price' => 350,
            'reorder_level' => 2,
            'supplier_id' => $supplier->id,
        ]);
        $customer = Customer::query()->create([
            'service_area_id' => ServiceArea::query()->firstOrFail()->id,
            'name' => 'Stock Check Customer',
            'phone' => '0700000888',
            'status' => 'active',
        ]);

        Sanctum::actingAs($staff);
        $requestId = $this->postJson('/api/inventory-requests', [
            'type' => 'issue',
            'issue_type' => 'customer',
            'customer_id' => $customer->id,
            'accounting_account_id' => $account->id,
            'warehouse_id' => $warehouse->id,
            'request_date' => '2026-07-27',
            'items' => [[
                'inventory_item_id' => $stock->id,
                'quantity' => 4,
                'unit_price' => 350,
            ]],
        ])->assertCreated()->json('data.id');

        $this->postJson("/api/inventory-requests/{$requestId}/approve", [
            'status' => 'approved',
        ])->assertForbidden();

        $stock->update(['quantity' => 2]);
        Sanctum::actingAs($admin);
        $this->postJson("/api/inventory-requests/{$requestId}/approve", [
            'status' => 'approved',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('items');

        $this->assertEquals('pending', InventoryRequest::query()->findOrFail($requestId)->status);
        $this->assertEquals(2, (float) $stock->fresh()->quantity);
        $this->assertEquals(10000, (float) $account->fresh()->current_balance);
        $this->assertDatabaseMissing('inventory_transactions', ['reference_id' => $requestId]);
        $this->assertDatabaseMissing('invoices', ['customer_id' => $customer->id, 'invoice_type' => 'inventory']);
    }

    public function test_warehouse_explorer_returns_stock_metrics_products_and_movements(): void
    {
        [$staff] = $this->users();
        [$warehouse, $supplier, $good] = $this->inventorySetup();

        $stock = InventoryItem::query()->create([
            'good_id' => $good->id,
            'warehouse_id' => $warehouse->id,
            'name' => $good->name,
            'code' => $good->code,
            'category' => $good->category,
            'unit' => $good->unit,
            'quantity' => 4,
            'unit_cost' => 200,
            'unit_price' => 350,
            'reorder_level' => 5,
            'supplier_id' => $supplier->id,
        ]);

        InventoryTransaction::query()->create([
            'inventory_item_id' => $stock->id,
            'type' => 'purchase',
            'quantity' => 4,
            'unit_cost' => 200,
            'total_amount' => 800,
            'transaction_date' => '2026-07-27',
            'notes' => 'Initial warehouse stock',
            'created_by' => $staff->id,
        ]);

        Sanctum::actingAs($staff);

        $this->getJson('/api/warehouses')
            ->assertOk()
            ->assertJsonPath('summary.total_warehouses', 1)
            ->assertJsonPath('summary.products_count', 1)
            ->assertJsonPath('data.0.products_count', 1)
            ->assertJsonPath('data.0.low_stock_count', 1)
            ->assertJsonPath('data.0.total_quantity', fn ($value) => (float) $value === 4.0)
            ->assertJsonPath('data.0.stock_value', fn ($value) => (float) $value === 800.0)
            ->assertJsonPath('data.0.last_movement_at', '2026-07-27');

        $this->getJson("/api/warehouses/{$warehouse->id}?inventory_search=pipe&stock_status=low&movement_type=purchase")
            ->assertOk()
            ->assertJsonPath('data.warehouse.id', $warehouse->id)
            ->assertJsonPath('data.summary.products_count', 1)
            ->assertJsonPath('data.summary.total_quantity', 4)
            ->assertJsonPath('data.summary.stock_value', 800)
            ->assertJsonPath('data.inventory.total', 1)
            ->assertJsonPath('data.inventory.data.0.good.code', $good->code)
            ->assertJsonPath('data.movements.total', 1)
            ->assertJsonPath('data.movements.data.0.type', 'purchase')
            ->assertJsonPath('data.movements.data.0.inventory_item.good.name', $good->name)
            ->assertJsonPath('data.movements.data.0.creator.id', $staff->id);
    }

    private function users(): array
    {
        $adminRole = Role::findOrCreate('Admin', 'web');
        $collectorRole = Role::findOrCreate('Collector', 'web');
        $staff = User::factory()->create(['status' => 'active']);
        $admin = User::factory()->create(['status' => 'active']);
        $staff->assignRole($collectorRole);
        $admin->assignRole($adminRole);

        return [$staff, $admin];
    }

    private function inventorySetup(): array
    {
        ServiceArea::query()->create([
            'code' => 'AREA-INV',
            'name' => 'Inventory Area',
            'status' => 'active',
        ]);
        $warehouse = Warehouse::query()->create([
            'name' => 'Main Warehouse',
            'code' => 'WH-TEST',
            'status' => 'active',
        ]);
        $supplier = Supplier::query()->create([
            'name' => 'Inventory Supplier',
            'supplier_type' => 'technical',
            'status' => 'active',
        ]);
        $good = Good::query()->create([
            'name' => 'Test Pipe',
            'code' => 'PIPE-TEST',
            'category' => 'pipe',
            'unit' => 'piece',
            'default_cost' => 200,
            'default_price' => 350,
            'status' => 'active',
        ]);
        $account = AccountingAccount::query()->create([
            'name' => 'Inventory Cash',
            'code' => 'inventory_cash',
            'type' => 'cash',
            'opening_balance' => 10000,
            'current_balance' => 10000,
            'status' => 'active',
        ]);

        return [$warehouse, $supplier, $good, $account];
    }
}
