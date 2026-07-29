<?php

namespace Tests\Feature;

use App\Models\AccountingAccount;
use App\Models\Customer;
use App\Models\Good;
use App\Models\InventoryItem;
use App\Models\Meter;
use App\Models\ServiceArea;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\FoundationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SerializedMeterInventoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_meter_purchase_assignment_and_return_preserve_stock_and_provenance(): void
    {
        $this->seed(FoundationSeeder::class);
        $admin = User::query()->where('email', 'admin@waternet.local')->firstOrFail();
        $area = ServiceArea::query()->where('status', 'active')->firstOrFail();
        $warehouse = Warehouse::query()->create([
            'name' => 'Serialized Meter Warehouse',
            'code' => 'WH-SERIAL',
            'status' => 'active',
        ]);
        $supplier = Supplier::query()->create([
            'name' => 'Serialized Meter Supplier',
            'supplier_type' => 'meter',
            'status' => 'active',
        ]);
        $good = Good::query()->create([
            'name' => 'Half-inch Serialized Meter',
            'code' => 'METER-SERIAL',
            'category' => 'meter',
            'unit' => 'piece',
            'default_cost' => 750,
            'default_price' => 1000,
            'status' => 'active',
        ]);
        $account = AccountingAccount::query()->create([
            'name' => 'Meter Purchase Bank',
            'code' => 'meter_purchase_bank',
            'type' => 'bank',
            'opening_balance' => 10000,
            'current_balance' => 10000,
            'status' => 'active',
        ]);

        Sanctum::actingAs($admin);
        $purchaseId = $this->postJson('/api/inventory-requests', [
            'type' => 'purchase',
            'supplier_id' => $supplier->id,
            'accounting_account_id' => $account->id,
            'warehouse_id' => $warehouse->id,
            'request_date' => '2026-07-28',
            'items' => [[
                'good_id' => $good->id,
                'quantity' => 2,
                'unit_price' => 750,
                'meter_serials' => ['WM-SERIAL-0001', 'WM-SERIAL-0002'],
            ]],
        ])->assertCreated()
            ->assertJsonPath('data.items.0.meter_serials.0', 'WM-SERIAL-0001')
            ->json('data.id');

        $this->postJson("/api/inventory-requests/{$purchaseId}/approve", [
            'status' => 'approved',
        ])->assertOk();

        $stock = InventoryItem::query()
            ->where('good_id', $good->id)
            ->where('warehouse_id', $warehouse->id)
            ->firstOrFail();
        $meter = Meter::query()->where('meter_number', 'WM-SERIAL-0001')->firstOrFail();
        $this->assertEquals(2, (float) $stock->quantity);
        $this->assertSame(2, $stock->meters()->where('status', 'available')->count());
        $this->assertSame($purchaseId, $meter->purchaseItem?->inventory_request_id);
        $this->assertSame($supplier->id, $meter->supplier_id);
        $this->assertSame($warehouse->id, $meter->source_warehouse_id);
        $this->assertSame($warehouse->id, $meter->current_warehouse_id);
        $this->assertEquals(8500, (float) $account->fresh()->current_balance);

        $customer = Customer::query()->create([
            'service_area_id' => $area->id,
            'name' => 'Serialized Meter Customer',
            'phone' => '0707000001',
            'status' => 'registered',
        ]);
        $contractId = $this->postJson("/api/customers/{$customer->id}/contracts", [
            'subscription_date' => '2026-07-28',
            'meter_size' => 'Half inch',
            'connection_fee' => 500,
            'meter_fee' => 1000,
        ])->assertCreated()->json('data.id');
        $this->postJson("/api/customer-contracts/{$contractId}/confirm")->assertOk();

        $assignmentId = $this->postJson('/api/meter-assignments', [
            'customer_id' => $customer->id,
            'customer_contract_id' => $contractId,
            'source_warehouse_id' => $warehouse->id,
            'meter_id' => $meter->id,
            'initial_reading' => 0,
            'installation_date' => '2026-07-28',
            'seal_number' => 'SEAL-SERIAL-0001',
        ])->assertCreated()
            ->assertJsonPath('data.source_warehouse.id', $warehouse->id)
            ->json('data.id');

        $this->assertEquals(1, (float) $stock->fresh()->quantity);
        $this->assertDatabaseHas('meters', [
            'id' => $meter->id,
            'status' => 'installed',
            'current_warehouse_id' => null,
        ]);
        $this->assertDatabaseHas('meter_movements', [
            'meter_id' => $meter->id,
            'type' => 'customer_installation',
            'customer_id' => $customer->id,
            'from_warehouse_id' => $warehouse->id,
        ]);

        $this->deleteJson("/api/meter-assignments/{$assignmentId}", [
            'disposition' => 'return_to_stock',
            'return_warehouse_id' => $warehouse->id,
            'reason' => 'Customer requested removal during serialized stock test.',
        ])->assertOk();

        $this->assertEquals(2, (float) $stock->fresh()->quantity);
        $this->assertDatabaseHas('meters', [
            'id' => $meter->id,
            'status' => 'available',
            'current_warehouse_id' => $warehouse->id,
        ]);
        $this->assertDatabaseHas('meter_assignments', [
            'id' => $assignmentId,
            'status' => 'removed',
            'removal_disposition' => 'return_to_stock',
            'return_warehouse_id' => $warehouse->id,
        ]);
        $this->assertDatabaseHas('meter_movements', [
            'meter_id' => $meter->id,
            'type' => 'warehouse_return',
            'to_warehouse_id' => $warehouse->id,
        ]);
    }

    public function test_meter_purchase_rejects_missing_and_duplicate_serials(): void
    {
        $this->seed(FoundationSeeder::class);
        $admin = User::query()->where('email', 'admin@waternet.local')->firstOrFail();
        $warehouse = Warehouse::query()->create(['name' => 'Meter Validation Warehouse', 'code' => 'WH-METER-VALID', 'status' => 'active']);
        $supplier = Supplier::query()->create(['name' => 'Meter Validation Supplier', 'supplier_type' => 'meter', 'status' => 'active']);
        $good = Good::query()->create([
            'name' => 'Validation Meter',
            'code' => 'METER-VALID',
            'category' => 'meter',
            'unit' => 'piece',
            'default_cost' => 500,
            'default_price' => 700,
            'status' => 'active',
        ]);
        $account = AccountingAccount::query()->create([
            'name' => 'Meter Validation Cash',
            'code' => 'meter_validation_cash',
            'type' => 'cash',
            'opening_balance' => 5000,
            'current_balance' => 5000,
            'status' => 'active',
        ]);

        Sanctum::actingAs($admin);
        $base = [
            'type' => 'purchase',
            'supplier_id' => $supplier->id,
            'accounting_account_id' => $account->id,
            'warehouse_id' => $warehouse->id,
            'request_date' => '2026-07-28',
        ];

        $this->postJson('/api/inventory-requests', $base + [
            'items' => [[
                'good_id' => $good->id,
                'quantity' => 2,
                'unit_price' => 500,
                'meter_serials' => ['WM-ONLY-ONE'],
            ]],
        ])->assertUnprocessable()->assertJsonValidationErrors('items.0.meter_serials');

        $this->postJson('/api/inventory-requests', $base + [
            'items' => [[
                'good_id' => $good->id,
                'quantity' => 2,
                'unit_price' => 500,
                'meter_serials' => ['WM-DUPLICATE', 'WM-DUPLICATE'],
            ]],
        ])->assertUnprocessable();

        $this->assertDatabaseCount('inventory_requests', 0);
        $this->assertDatabaseCount('meters', 0);
        $this->assertEquals(5000, (float) $account->fresh()->current_balance);
    }
}
