<?php

namespace Database\Seeders;

use App\Models\AccountingAccount;
use App\Models\Asset;
use App\Models\AssetMaintenance;
use App\Models\Customer;
use App\Models\Department;
use App\Models\Good;
use App\Models\InventoryItem;
use App\Models\InventoryRequest;
use App\Models\Meter;
use App\Models\PaymentMethod;
use App\Models\ServiceArea;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\InventoryRequestWorkflowService;
use Illuminate\Database\Seeder;
use RuntimeException;

class AssetsInventoryDemoSeeder extends Seeder
{
    public function run(): void
    {
        $workflow = app(InventoryRequestWorkflowService::class);
        $admin = User::query()->where('email', 'admin@waternet.local')->firstOrFail();
        $customer = Customer::query()->where('status', 'active')->firstOrFail();
        $department = Department::query()->where('status', 'active')->first()
            ?? Department::query()->create([
                'code' => 'operations',
                'name' => 'Operations',
                'description' => 'Water network field operations.',
                'status' => 'active',
            ]);
        $area = ServiceArea::query()->where('status', 'active')->first();

        $cash = $this->account('cash_on_hand', 'Inventory Cash', 'cash', 5000);
        $bank = $this->account('bank_account', 'Inventory Bank', 'bank', 15000);
        $cashMethod = PaymentMethod::query()->updateOrCreate(
            ['code' => 'cash'],
            ['name' => 'Cash', 'status' => 'active'],
        );
        $mainWarehouse = $this->warehouse('WH-MAIN', 'Main Warehouse', $area?->id);
        $fieldWarehouse = $this->warehouse('WH-FIELD', 'Field Warehouse', $area?->id);
        $pipeSupplier = $this->supplier('Kabul Pipe Supplies', 'pipe');
        $meterSupplier = $this->supplier('Afghan Meter Company', 'meter');
        $pipe = $this->good('PIPE-HALF-DEMO', 'PVC Pipe - Half Inch', 'pipe', 'meter', 50, 80);
        $meter = $this->good('METER-HALF-DEMO', 'Water Meter - Half Inch', 'meter', 'piece', 400, 600);

        $this->approveRequest($workflow, $admin, 'DEMO-INVENTORY:PURCHASE-PIPE', [
            'type' => 'purchase',
            'supplier_id' => $pipeSupplier->id,
            'accounting_account_id' => $cash->id,
            'warehouse_id' => $mainWarehouse->id,
            'request_date' => now()->toDateString(),
            'items' => [[
                'good_id' => $pipe->id,
                'quantity' => 20,
                'unit_price' => 50,
            ]],
        ]);
        $this->approveRequest($workflow, $admin, 'DEMO-INVENTORY:PURCHASE-METER', [
            'type' => 'purchase',
            'supplier_id' => $meterSupplier->id,
            'accounting_account_id' => $bank->id,
            'warehouse_id' => $fieldWarehouse->id,
            'request_date' => now()->toDateString(),
            'items' => [[
                'good_id' => $meter->id,
                'quantity' => 3,
                'unit_price' => 400,
                'meter_serials' => [
                    'DEMO-STOCK-MTR-0001',
                    'DEMO-STOCK-MTR-0002',
                    'DEMO-STOCK-MTR-0003',
                ],
            ]],
        ]);

        $pipeStock = InventoryItem::query()
            ->where('good_id', $pipe->id)
            ->where('warehouse_id', $mainWarehouse->id)
            ->firstOrFail();
        $meterStock = InventoryItem::query()
            ->where('good_id', $meter->id)
            ->where('warehouse_id', $fieldWarehouse->id)
            ->firstOrFail();
        $soldMeter = Meter::query()
            ->where('inventory_item_id', $meterStock->id)
            ->where('status', 'available')
            ->orderBy('id')
            ->firstOrFail();

        $this->approveRequest($workflow, $admin, 'DEMO-INVENTORY:INTERNAL-ISSUE', [
            'type' => 'issue',
            'issue_type' => 'internal',
            'department_id' => $department->id,
            'warehouse_id' => $mainWarehouse->id,
            'request_date' => now()->toDateString(),
            'items' => [[
                'inventory_item_id' => $pipeStock->id,
                'quantity' => 2,
                'unit_price' => 50,
            ]],
        ]);
        $this->approveRequest($workflow, $admin, 'DEMO-INVENTORY:CUSTOMER-ISSUE', [
            'type' => 'issue',
            'issue_type' => 'customer',
            'customer_id' => $customer->id,
            'accounting_account_id' => $cash->id,
            'payment_method_id' => $cashMethod->id,
            'amount_paid' => 600,
            'warehouse_id' => $fieldWarehouse->id,
            'request_date' => now()->toDateString(),
            'items' => [[
                'inventory_item_id' => $meterStock->id,
                'quantity' => 1,
                'unit_price' => 600,
                'meter_ids' => [$soldMeter->id],
            ]],
        ]);

        $well = Asset::query()->updateOrCreate(
            ['asset_code' => 'ASSET-WELL-DEMO'],
            [
                'name' => 'Main Production Well',
                'type' => 'well',
                'status' => 'active',
                'service_area_id' => $area?->id,
                'purchase_cost' => 350000,
                'purchase_date' => '2025-01-15',
                'created_by' => $admin->id,
                'notes' => 'Inventory and assets workflow demonstration record.',
            ],
        );
        $generator = Asset::query()->updateOrCreate(
            ['asset_code' => 'ASSET-GEN-DEMO'],
            [
                'name' => 'Backup Generator',
                'type' => 'generator',
                'status' => 'maintenance',
                'service_area_id' => $area?->id,
                'supplier_id' => $meterSupplier->id,
                'purchase_cost' => 180000,
                'purchase_date' => '2025-03-10',
                'created_by' => $admin->id,
                'notes' => 'Inventory and assets workflow demonstration record.',
            ],
        );

        AssetMaintenance::query()->updateOrCreate(
            ['asset_id' => $well->id, 'title' => 'Quarterly pump inspection'],
            [
                'maintenance_type' => 'preventive',
                'description' => 'Inspect pump, water pressure, wiring, and safety controls.',
                'cost' => 2500,
                'performed_at' => now()->toDateString(),
                'next_due_date' => now()->addMonths(3)->toDateString(),
                'status' => 'completed',
                'performed_by' => 'Ahmad Karimi',
                'created_by' => $admin->id,
            ],
        );
        AssetMaintenance::query()->updateOrCreate(
            ['asset_id' => $generator->id, 'title' => 'Generator oil and filter service'],
            [
                'maintenance_type' => 'corrective',
                'description' => 'Replace oil and filters before returning the generator to service.',
                'cost' => 1800,
                'performed_at' => now()->toDateString(),
                'next_due_date' => now()->addMonth()->toDateString(),
                'status' => 'in_progress',
                'performed_by' => 'Ahmad Karimi',
                'created_by' => $admin->id,
            ],
        );
    }

    private function approveRequest(
        InventoryRequestWorkflowService $workflow,
        User $admin,
        string $marker,
        array $data,
    ): void {
        $request = InventoryRequest::query()->where('notes', $marker)->first();
        if (! $request) {
            $request = $workflow->submit($data + ['notes' => $marker], $admin);
        }

        if ($request->status === 'pending') {
            $workflow->resolve($request, [
                'status' => 'approved',
                'approval_notes' => 'Approved demonstration workflow.',
            ], $admin);
        }

        if ($request->status === 'rejected') {
            throw new RuntimeException("Demo request {$request->request_number} was previously rejected.");
        }
    }

    private function account(string $code, string $name, string $type, float $balance): AccountingAccount
    {
        return AccountingAccount::query()->firstOrCreate(
            ['code' => $code],
            [
                'name' => $name,
                'type' => $type,
                'opening_balance' => $balance,
                'current_balance' => $balance,
                'status' => 'active',
            ],
        );
    }

    private function warehouse(string $code, string $name, ?int $areaId): Warehouse
    {
        return Warehouse::query()->updateOrCreate(
            ['code' => $code],
            ['name' => $name, 'service_area_id' => $areaId, 'status' => 'active'],
        );
    }

    private function supplier(string $name, string $type): Supplier
    {
        return Supplier::query()->updateOrCreate(
            ['name' => $name],
            ['supplier_type' => $type, 'status' => 'active'],
        );
    }

    private function good(
        string $code,
        string $name,
        string $category,
        string $unit,
        float $cost,
        float $price,
    ): Good {
        return Good::query()->updateOrCreate(
            ['code' => $code],
            [
                'name' => $name,
                'category' => $category,
                'unit' => $unit,
                'default_cost' => $cost,
                'default_price' => $price,
                'status' => 'active',
            ],
        );
    }
}
