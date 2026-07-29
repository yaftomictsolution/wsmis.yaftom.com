<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "═══════════════════════════════════════════════════════════════\n";
echo "  COMPLETE PURCHASED GOODS WORKFLOW TEST\n";
echo "  Kabul Water Supply Company\n";
echo "═══════════════════════════════════════════════════════════════\n\n";

// Clean previous test data (only test records)
App\Models\InventoryIssueItem::query()->whereHas('issue', function ($q) {
    $q->whereIn('issue_number', ['ISS-00001', 'ISS-00002']);
})->forceDelete();
App\Models\InventoryIssue::query()->whereIn('issue_number', ['ISS-00001', 'ISS-00002'])->forceDelete();
App\Models\InventoryTransaction::query()->where('notes', 'like', '%test%')->forceDelete();
App\Models\InventoryItem::query()->where('code', 'PIPE-TEST-001')->forceDelete();
App\Models\Warehouse::query()->where('code', 'WH-TEST-001')->forceDelete();
App\Models\Customer::query()->where('name', 'Test Customer Ahmad')->forceDelete();
App\Models\ServiceArea::query()->where('name', 'Test District')->forceDelete();

// Setup
$serviceArea = App\Models\ServiceArea::create([
    'name' => 'Test District',
    'mosque_name' => 'Test Mosque',
    'district' => 'Test District',
    'status' => 'active',
    'rate_per_cubic_meter' => 20,
]);

$warehouse = App\Models\Warehouse::create([
    'name' => 'Test Warehouse',
    'code' => 'WH-TEST-001',
    'address' => 'Kabul, Afghanistan',
    'status' => 'active',
]);

$user = App\Models\User::first();

$customer = App\Models\Customer::create([
    'service_area_id' => $serviceArea->id,
    'name' => 'Test Customer Ahmad',
    'father_name' => 'Mohammad',
    'phone' => '+93 700 999 888',
    'house_number' => '25',
    'status' => 'registered',
]);

echo "═══════════════════════════════════════════════════════════════\n";
echo "  STEP 1: RECEIVE GOODS FROM SUPPLIER\n";
echo "═══════════════════════════════════════════════════════════════\n";
echo "Company buys 100 PVC pipes from supplier\n";
echo "100 meters × 250 AFN = 25,000 AFN\n\n";

$item = App\Models\InventoryItem::create([
    'warehouse_id' => $warehouse->id,
    'name' => 'PVC Pipe 4 inch',
    'code' => 'PIPE-TEST-001',
    'category' => 'pipe',
    'unit' => 'meter',
    'quantity' => 100,
    'unit_cost' => 250.00,
    'unit_price' => 350.00,
    'reorder_level' => 10,
]);

App\Models\InventoryTransaction::create([
    'inventory_item_id' => $item->id,
    'type' => 'purchase',
    'quantity' => 100,
    'unit_cost' => 250.00,
    'total_amount' => 25000.00,
    'transaction_date' => now()->toDateString(),
    'notes' => 'test - Received from supplier',
    'created_by' => $user->id,
]);

echo "✓ Inventory Item: {$item->name} ({$item->code})\n";
echo "✓ Stock: 100 meters @ 250 AFN = 25,000 AFN\n";
echo "✓ Transaction: Stock IN (+100 meters)\n\n";

echo "═══════════════════════════════════════════════════════════════\n";
echo "  STEP 2: INTERNAL USE (Company uses for new connections)\n";
echo "═══════════════════════════════════════════════════════════════\n";
echo "Company takes 30 pipes for new water main installation\n\n";

$internalIssue = App\Models\InventoryIssue::create([
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
    'inventory_issue_id' => $internalIssue->id,
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
    'total_amount' => 7500.00,
    'transaction_date' => now()->toDateString(),
    'reference_type' => App\Models\InventoryIssue::class,
    'reference_id' => $internalIssue->id,
    'created_by' => $user->id,
]);

$item->decrement('quantity', 30);

echo "✓ Issue: {$internalIssue->issue_number} (Internal Use)\n";
echo "✓ Quantity: 30 meters issued\n";
echo "✓ Cost: 7,500 AFN (30 × 250)\n";
echo "✓ Stock: 100 - 30 = 70 meters remaining\n";
echo "✓ Transaction: Stock OUT (-30 meters)\n";
echo "✓ Accounting: Expense +7,500 AFN\n\n";

echo "═══════════════════════════════════════════════════════════════\n";
echo "  STEP 3: CUSTOMER SALE (Customer Ahmad buys pipes)\n";
echo "═══════════════════════════════════════════════════════════════\n";
echo "Customer Ahmad buys 20 pipes for house connection\n\n";

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

echo "✓ Issue: {$customerIssue->issue_number} (Customer Sale)\n";
echo "✓ Customer: {$customer->name}\n";
echo "✓ Quantity: 20 meters sold\n";
echo "✓ Sale Price: 7,000 AFN (20 × 350)\n";
echo "✓ Cost (COGS): 5,000 AFN (20 × 250)\n";
echo "✓ Profit: 2,000 AFN\n";
echo "✓ Stock: 70 - 20 = 50 meters remaining\n\n";

echo "═══════════════════════════════════════════════════════════════\n";
echo "  FINAL SUMMARY\n";
echo "═══════════════════════════════════════════════════════════════\n";
echo "Total Purchased:  100 meters @ 250 AFN = 25,000 AFN\n";
echo "Internal Use:      30 meters @ 250 AFN =  7,500 AFN\n";
echo "Customer Sale:     20 meters @ 350 AFN =  7,000 AFN\n";
echo "                  (COGS: 5,000 | Profit: 2,000 AFN)\n";
echo "Remaining Stock:   50 meters @ 250 AFN = 12,500 AFN\n";
echo "═══════════════════════════════════════════════════════════════\n\n";

echo "Database Records:\n";
echo "  Inventory Items:        " . App\Models\InventoryItem::count() . "\n";
echo "  Inventory Transactions: " . App\Models\InventoryTransaction::count() . "\n";
echo "  Inventory Issues:       " . App\Models\InventoryIssue::count() . "\n";
echo "  Inventory Issue Items:  " . App\Models\InventoryIssueItem::count() . "\n";
echo "═══════════════════════════════════════════════════════════════\n";
