<?php

namespace Tests\Feature;

use App\Models\AccountingAccount;
use App\Models\InventoryItem;
use App\Models\InventoryTransaction;
use App\Models\Meter;
use Database\Seeders\AssetsInventoryDemoSeeder;
use Database\Seeders\BillingWorkflowDemoSeeder;
use Database\Seeders\FoundationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AssetsInventoryDemoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_inventory_records_are_balanced_and_idempotent(): void
    {
        $this->seed(FoundationSeeder::class);
        $this->seed(BillingWorkflowDemoSeeder::class);
        $cashBefore = (float) AccountingAccount::query()->where('code', 'cash_on_hand')->value('current_balance');
        $bankBefore = (float) AccountingAccount::query()->where('code', 'bank_account')->value('current_balance');
        $transactionCountBefore = InventoryTransaction::query()->count();

        $this->seed(AssetsInventoryDemoSeeder::class);

        $this->assertDatabaseCount('warehouses', 3);
        $this->assertDatabaseCount('goods', 3);
        $this->assertDatabaseCount('suppliers', 2);
        $this->assertDatabaseCount('inventory_requests', 4);
        $this->assertDatabaseCount('inventory_transactions', $transactionCountBefore + 4);
        $this->assertDatabaseCount('assets', 2);
        $this->assertDatabaseCount('asset_maintenance', 2);
        $this->assertSame(4, DB::table('inventory_requests')->where('status', 'approved')->count());
        $this->assertEquals(
            18,
            (float) InventoryItem::query()->where('code', 'PIPE-HALF-DEMO')->value('quantity'),
        );
        $this->assertEquals(
            2,
            (float) InventoryItem::query()->where('code', 'METER-HALF-DEMO')->value('quantity'),
        );
        $meterStockId = InventoryItem::query()->where('code', 'METER-HALF-DEMO')->value('id');
        $this->assertSame(3, Meter::query()->where('inventory_item_id', $meterStockId)->count());
        $this->assertSame(2, Meter::query()->where('inventory_item_id', $meterStockId)->where('status', 'available')->count());
        $this->assertSame(1, Meter::query()->where('inventory_item_id', $meterStockId)->where('status', 'sold')->count());
        $this->assertEquals(
            $cashBefore - 400,
            (float) AccountingAccount::query()->where('code', 'cash_on_hand')->value('current_balance'),
        );
        $this->assertEquals(
            $bankBefore - 1200,
            (float) AccountingAccount::query()->where('code', 'bank_account')->value('current_balance'),
        );
        $this->assertDatabaseHas('invoices', [
            'invoice_type' => 'inventory',
            'total_amount' => 600,
            'paid_amount' => 600,
            'remaining_amount' => 0,
            'status' => 'paid',
        ]);

        $counts = collect([
            'warehouses',
            'goods',
            'suppliers',
            'inventory_items',
            'inventory_requests',
            'inventory_transactions',
            'meters',
            'meter_movements',
            'assets',
            'asset_maintenance',
            'invoices',
            'payments',
            'accounting_transactions',
        ])->mapWithKeys(fn (string $table) => [$table => DB::table($table)->count()]);
        $cashAfter = (float) AccountingAccount::query()->where('code', 'cash_on_hand')->value('current_balance');
        $bankAfter = (float) AccountingAccount::query()->where('code', 'bank_account')->value('current_balance');

        $this->seed(AssetsInventoryDemoSeeder::class);

        $counts->each(fn (int $count, string $table) => $this->assertSame(
            $count,
            DB::table($table)->count(),
            "The {$table} table changed when the inventory demo seeder ran twice.",
        ));
        $this->assertEquals($cashAfter, (float) AccountingAccount::query()->where('code', 'cash_on_hand')->value('current_balance'));
        $this->assertEquals($bankAfter, (float) AccountingAccount::query()->where('code', 'bank_account')->value('current_balance'));
    }
}
