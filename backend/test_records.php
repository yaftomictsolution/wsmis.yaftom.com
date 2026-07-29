<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "=== DATABASE RECORD COUNTS ===\n";
echo "Service Areas: " . App\Models\ServiceArea::count() . "\n";
echo "Suppliers: " . App\Models\Supplier::count() . "\n";
echo "Users: " . App\Models\User::count() . "\n";
echo "Customers: " . App\Models\Customer::count() . "\n";
echo "Departments: " . App\Models\Department::count() . "\n";
echo "Warehouses: " . App\Models\Warehouse::count() . "\n";
echo "Inventory Items: " . App\Models\InventoryItem::count() . "\n";
echo "Assets: " . App\Models\Asset::count() . "\n";

echo "\n=== FIRST RECORD IDs ===\n";
$sa = App\Models\ServiceArea::first();
echo "First Service Area ID: " . ($sa?->id ?? 'NONE') . "\n";
$sup = App\Models\Supplier::first();
echo "First Supplier ID: " . ($sup?->id ?? 'NONE') . "\n";
$u = App\Models\User::first();
echo "First User ID: " . ($u?->id ?? 'NONE') . "\n";
$c = App\Models\Customer::first();
echo "First Customer ID: " . ($c?->id ?? 'NONE') . "\n";
$d = App\Models\Department::first();
echo "First Department ID: " . ($d?->id ?? 'NONE') . "\n";
$w = App\Models\Warehouse::first();
echo "First Warehouse ID: " . ($w?->id ?? 'NONE') . "\n";

echo "\n=== TEST RECORD CREATION ===\n";

// Test 1: Create Warehouse (needed for inventory items)
echo "\n--- Test 1: Create Warehouse ---\n";
try {
    $warehouse = App\Models\Warehouse::create([
        'name' => 'Main Warehouse',
        'code' => 'WH-001',
        'address' => 'Kabul, Afghanistan',
        'service_area_id' => $sa?->id,
        'status' => 'active',
        'notes' => 'Primary storage facility',
    ]);
    echo "SUCCESS: Warehouse created with ID: {$warehouse->id}\n";
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}

// Test 2: Create Asset (Well)
echo "\n--- Test 2: Create Asset (Well) ---\n";
try {
    $asset = App\Models\Asset::create([
        'asset_code' => 'WELL-001',
        'name' => 'Main Water Well',
        'type' => 'well',
        'status' => 'active',
        'service_area_id' => $sa?->id,
        'latitude' => 34.5553,
        'longitude' => 69.2075,
        'address' => 'Kabul District 5',
        'purchase_cost' => 150000.00,
        'purchase_date' => '2025-01-15',
        'warranty_expiry' => '2027-01-15',
        'supplier_id' => $sup?->id,
        'attributes' => [
            'well_depth' => 120,
            'water_capacity' => 5000,
            'pump_type' => 'submersible',
            'motor_power' => 15,
            'pipe_diameter' => 6,
            'water_level' => 45,
            'is_drilled' => true,
        ],
        'created_by' => $u?->id,
        'notes' => 'Primary water source for district 5',
    ]);
    echo "SUCCESS: Asset created with ID: {$asset->id}\n";
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}

// Test 3: Create Asset Maintenance
echo "\n--- Test 3: Create Asset Maintenance ---\n";
try {
    $maintenance = App\Models\AssetMaintenance::create([
        'asset_id' => $asset->id ?? 1,
        'maintenance_type' => 'preventive',
        'title' => 'Quarterly Pump Inspection',
        'description' => 'Routine inspection of submersible pump and motor',
        'cost' => 5000.00,
        'performed_at' => '2026-07-20',
        'next_due_date' => '2026-10-20',
        'status' => 'completed',
        'performed_by' => 'Technician Ahmad',
        'created_by' => $u?->id,
        'notes' => 'All systems functioning normally',
    ]);
    echo "SUCCESS: Maintenance record created with ID: {$maintenance->id}\n";
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}

// Test 4: Create Inventory Item
echo "\n--- Test 4: Create Inventory Item ---\n";
try {
    $item = App\Models\InventoryItem::create([
        'warehouse_id' => $warehouse->id ?? 1,
        'name' => 'PVC Pipe 4 inch',
        'code' => 'PIPE-001',
        'category' => 'pipe',
        'unit' => 'meter',
        'quantity' => 500,
        'unit_cost' => 250.00,
        'unit_price' => 350.00,
        'reorder_level' => 50,
        'supplier_id' => $sup?->id,
        'notes' => 'Standard PVC pipe for water distribution',
    ]);
    echo "SUCCESS: Inventory item created with ID: {$item->id}\n";
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}

// Test 5: Create Inventory Transaction
echo "\n--- Test 5: Create Inventory Transaction ---\n";
try {
    $transaction = App\Models\InventoryTransaction::create([
        'inventory_item_id' => $item->id ?? 1,
        'type' => 'purchase',
        'quantity' => 500,
        'unit_cost' => 250.00,
        'unit_price' => 350.00,
        'total_amount' => 125000.00,
        'transaction_date' => '2026-07-20',
        'notes' => 'Initial stock purchase',
        'created_by' => $u?->id,
    ]);
    echo "SUCCESS: Transaction created with ID: {$transaction->id}\n";
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}

// Test 6: Create Inventory Issue (Internal)
echo "\n--- Test 6: Create Inventory Issue (Internal) ---\n";
try {
    $issue = App\Models\InventoryIssue::create([
        'issue_number' => 'ISS-00001',
        'issue_date' => '2026-07-23',
        'type' => 'internal',
        'department_id' => $d?->id,
        'requested_by' => $u?->id,
        'approved_by' => $u?->id,
        'status' => 'issued',
        'notes' => 'Pipes for new connection project',
        'created_by' => $u?->id,
    ]);
    echo "SUCCESS: Issue created with ID: {$issue->id}\n";

    // Create issue item
    $issueItem = App\Models\InventoryIssueItem::create([
        'inventory_issue_id' => $issue->id,
        'inventory_item_id' => $item->id ?? 1,
        'quantity' => 50,
        'unit_cost' => 250.00,
        'unit_price' => 350.00,
        'total_cost' => 125000.00,
        'total_price' => 175000.00,
    ]);
    echo "SUCCESS: Issue item created with ID: {$issueItem->id}\n";
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}

echo "\n=== FINAL COUNTS ===\n";
echo "Warehouses: " . App\Models\Warehouse::count() . "\n";
echo "Assets: " . App\Models\Asset::count() . "\n";
echo "Asset Maintenance: " . App\Models\AssetMaintenance::count() . "\n";
echo "Inventory Items: " . App\Models\InventoryItem::count() . "\n";
echo "Inventory Transactions: " . App\Models\InventoryTransaction::count() . "\n";
echo "Inventory Issues: " . App\Models\InventoryIssue::count() . "\n";
echo "Inventory Issue Items: " . App\Models\InventoryIssueItem::count() . "\n";

echo "\n=== TEST COMPLETE ===\n";
