<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "========================================\n";
echo "  PURCHASED GOODS WORKFLOW TEST\n";
echo "========================================\n";

// Clean previous test data
App\Models\InventoryIssueItem::query()->delete();
App\Models\InventoryIssue::query()->delete();
App\Models\InventoryTransaction::query()->delete();
App\Models\InventoryItem::query()->delete();
App\Models\Warehouse::query()->delete();
App\Models\Supplier::query()->delete();

$warehouse = App\Models\Warehouse::first();
if (!$warehouse) {
    $warehouse = App\Models\Warehouse::create([
        'name' => 'Main Warehouse',
        'code' => 'WH-001',
        'address' => 'Kabul, Afghanistan',
        'status' => 'active',
    ]);
}

$serviceArea = App\Models\ServiceArea::first();
if (!$serviceArea) {
    $serviceArea = App\Models\ServiceArea::create([
        'name' => 'District 5',
        'mosque_name' => 'Omar Bin Khattab',
        'district' => 'District 5',
        'street_block_village' => 'Street 10',
        'status' => 'active',
        'rate_per_cubic_meter' => 20,
    ]);
}

$supplier = App\Models\Supplier::first();
if (!$supplier) {
    $supplier = App\Models\Supplier::create([
        'name' => 'Ahmad Pipes Co.',
        'supplier_type' => 'pipe',
        'phone' => '+93 700 123 456',
        'address' => 'Kabul, Industrial Area',
        'status' => 'active',
    ]);
}

$user = App\Models\User::first();

echo "\n=== STEP 1: RECEIVE GOODS FROM SUPPLIER ===\n";
echo "Purchasing 100 pipes at 250 AFN each from {$supplier->name}\n";

$item = App\Models\InventoryItem::create([
    'warehouse_id' => $warehouse->id,
    'name' => 'PVC Pipe 4 inch',
    'code' => 'PIPE-001',
    'category' => 'pipe',
    'unit' => 'meter',
    'quantity' => 100,
    'unit_cost' => 250.00,
    'unit_price' => 350.00,
    'reorder_level' => 10,
    'supplier_id' => $supplier->id,
]);

App\Models\InventoryTransaction::create([
    'inventory_item_id' => $item->id,
    'type' => 'purchase',
    'quantity' => 100,
    'unit_cost' => 250.00,
    'unit_price' => 350.00,
    'total_amount' => 25000.00,
    'transaction_date' => now()->toDateString(),
    'notes' => "Received from supplier",
    'created_by' => $user->id,
]);

echo "✓ Inventory: {$item->name} - 100 meters @ 250 AFN = 25,000 AFN\n";
echo "✓ Stock IN transaction recorded\n";

echo "\n=== STEP 2: INTERNAL USE (Company uses pipes for new connections) ===\n";
echo "Company takes 30 pipes for new connection project\n";

$issue = App\Models\InventoryIssue::create([
    'issue_number' => 'ISS-00001',
    'issue_date' => now()->toDateString(),
    'type' => 'internal',
    'status' => 'issued',
    'notes' => 'Pipes for new connection project',
    'created_by' => $user->id,
    'requested_by' => $user->id,
    'total_cost' => 7500.00,
    'total_price' => 10500.00,
]);

App\Models\InventoryIssueItem::create([
    'inventory_issue_id' => $issue->id,
    'inventory_item_id' => $item->id,
    'quantity' => 30,
    'unit_cost' => 250.00,
    'unit_price' => 350.00,
    'total_cost' => 7500.00,
    'total_price' => 10500.00,
]);

App\Models\InventoryTransaction::create([
    'inventory_item_id' => $item->id,
    'type' => 'internal_use',
    'quantity' => -30,
    'unit_cost' => 250.00,
    'unit_price' => 350.00,
    'total_amount' => 10500.00,
    'transaction_date' => now()->toDateString(),
    'reference_type' => App\Models\InventoryIssue::class,
    'reference_id' => $issue->id,
    'created_by' => $user->id,
]);

$item->decrement('quantity', 30);

echo "✓ Issue {$issue->issue_number}: 30 meters issued for internal use\n";
echo "✓ Cost: 7,500 AFN (30 × 250)\n";
echo "✓ Remaining stock: 70 meters\n";

echo "\n=== STEP 3: CUSTOMER SALE (Customer Ahmad buys pipes) ===\n";
echo "Customer Ahmad buys 20 pipes for his house connection\n";

$customer = App\Models\Customer::first();
if (!$customer) {
    $customer = App\Models\Customer::create([
        'service_area_id' => $serviceArea->id,
        'name' => 'Ahmad',
        'father_name' => 'Mohammad',
        'phone' => '+93 700 999 888',
        'house_number' => '25',
        'status' => 'registered',
    ]);
}

$customerIssue = App\Models\InventoryIssue::create([
    'issue_number' => 'ISS-00002',
    'issue_date' => now()->toDateString(),
    'type' => 'customer',
    'customer_id' => $customer->id,
    'status' => 'issued',
    'notes' => 'Pipes for customer house connection',
    'created_by' => $user->id,
    'requested_by' => $user->id,
    'total_cost' => 5000.00,
    'total_price' => 7000.00,
]);

App\Models\InventoryIssueItem::create([
    'inventory_issue_id' => $customerIssue->id,
    'inventory_item_id' => $item->id,
    'quantity' => 20,
    'unit_cost' => 250.00,
    'unit_price' => 350.00,
    'total_cost' => 5000.00,
    'total_price' => 7000.00,
]);

App\Models\InventoryTransaction::create([
    'inventory_item_id' => $item->id,
    'type' => 'sale',
    'quantity' => -20,
    'unit_cost' => 250.00,
    'unit_price' => 350.00,
    'total_amount' => 7000.00,
    'transaction_date' => now()->toDateString(),
    'reference_type' => App\Models\InventoryIssue::class,
    'reference_id' => $customerIssue->id,
    'created_by' => $user->id,
]);

$item->decrement('quantity', 20);

echo "✓ Issue {$customerIssue->issue_number}: 20 meters sold to customer\n";
echo "✓ Sale Price: 7,000 AFN (20 × 350)\n";
echo "✓ Cost of Goods Sold: 5,000 AFN (20 × 250)\n";
echo "✓ Profit: 2,000 AFN\n";
echo "✓ Remaining stock: 50 meters\n";

echo "\n========================================\n";
echo "  SUMMARY\n";
echo "========================================\n";
echo "Total Purchased: 100 meters @ 250 AFN = 25,000 AFN\n";
echo "Internal Use:     30 meters @ 250 AFN =  7,500 AFN\n";
echo "Customer Sale:    20 meters @ 350 AFN =  7,000 AFN\n";
echo "                  (COGS: 5,000 AFN, Profit: 2,000 AFN)\n";
echo "Remaining Stock:  50 meters @ 250 AFN = 12,500 AFN\n";
echo "========================================\n";
echo "Inventory Items: " . App\Models\InventoryItem::count() . "\n";
echo "Inventory Transactions: " . App\Models\InventoryTransaction::count() . "\n";
echo "Inventory Issues: " . App\Models\InventoryIssue::count() . "\n";
echo "========================================\n";
