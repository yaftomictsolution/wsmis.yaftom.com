<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "═══════════════════════════════════════════════════════════════\n";
echo "  CREATING TEST DATA FOR GOODS MODULE\n";
echo "═══════════════════════════════════════════════════════════════\n\n";

// Clear existing test data
App\Models\InventoryIssueItem::query()->forceDelete();
App\Models\InventoryIssue::query()->forceDelete();
App\Models\InventoryTransaction::query()->forceDelete();
App\Models\InventoryItem::query()->forceDelete();
App\Models\Good::query()->forceDelete();
App\Models\Warehouse::query()->forceDelete();
App\Models\Supplier::query()->forceDelete();

echo "✓ Cleared existing test data\n\n";

// Create Goods (Product Catalog)
echo "--- Creating Goods (Product Catalog) ---\n";

$goods = [
    ['name' => 'PVC Pipe 4 inch', 'code' => 'PIPE-001', 'category' => 'pipe', 'unit' => 'meter', 'default_cost' => 250, 'default_price' => 350],
    ['name' => 'PVC Pipe 6 inch', 'code' => 'PIPE-002', 'category' => 'pipe', 'unit' => 'meter', 'default_cost' => 400, 'default_price' => 550],
    ['name' => 'Water Meter 1 inch', 'code' => 'MTR-001', 'category' => 'meter', 'unit' => 'piece', 'default_cost' => 3500, 'default_price' => 5000],
    ['name' => 'Water Meter 2 inch', 'code' => 'MTR-002', 'category' => 'meter', 'unit' => 'piece', 'default_cost' => 5500, 'default_price' => 7500],
    ['name' => 'Chlorine Tablets', 'code' => 'CHM-001', 'category' => 'chemical', 'unit' => 'kg', 'default_cost' => 150, 'default_price' => 200],
    ['name' => 'Diesel Fuel', 'code' => 'DSL-001', 'category' => 'fuel', 'unit' => 'liter', 'default_cost' => 65, 'default_price' => 80],
    ['name' => 'Solar Panel 100W', 'code' => 'SOL-001', 'category' => 'solar', 'unit' => 'piece', 'default_cost' => 12000, 'default_price' => 18000],
    ['name' => 'Pump Motor 5KW', 'code' => 'PMP-001', 'category' => 'technical', 'unit' => 'piece', 'default_cost' => 25000, 'default_price' => 35000],
];

$createdGoods = [];
foreach ($goods as $good) {
    $created = App\Models\Good::create($good);
    $createdGoods[] = $created;
    echo "✓ {$created->name} ({$created->code}) - Cost: {$created->default_cost} AFN\n";
}

// Create Warehouse
echo "\n--- Creating Warehouses ---\n";
$warehouse = App\Models\Warehouse::create([
    'name' => 'Main Central Warehouse',
    'code' => 'WH-001',
    'address' => 'Kabul, Industrial Zone',
    'status' => 'active',
]);
echo "✓ {$warehouse->name} ({$warehouse->code})\n";

// Create Inventory Items (Stock)
echo "\n--- Creating Inventory Stock ---\n";
$inventoryItems = [
    ['good_id' => $createdGoods[0]->id, 'name' => 'PVC Pipe 4 inch', 'code' => 'PIPE-001', 'category' => 'pipe', 'unit' => 'meter', 'quantity' => 500, 'unit_cost' => 250, 'unit_price' => 350],
    ['good_id' => $createdGoods[1]->id, 'name' => 'PVC Pipe 6 inch', 'code' => 'PIPE-002', 'category' => 'pipe', 'unit' => 'meter', 'quantity' => 300, 'unit_cost' => 400, 'unit_price' => 550],
    ['good_id' => $createdGoods[2]->id, 'name' => 'Water Meter 1 inch', 'code' => 'MTR-001', 'category' => 'meter', 'unit' => 'piece', 'quantity' => 50, 'unit_cost' => 3500, 'unit_price' => 5000],
    ['good_id' => $createdGoods[4]->id, 'name' => 'Chlorine Tablets', 'code' => 'CHM-001', 'category' => 'chemical', 'unit' => 'kg', 'quantity' => 100, 'unit_cost' => 150, 'unit_price' => 200],
];

foreach ($inventoryItems as $item) {
    $invItem = App\Models\InventoryItem::create(array_merge($item, ['warehouse_id' => $warehouse->id]));
    echo "✓ Good ID {$invItem->good_id}: {$invItem->quantity} units @ {$invItem->unit_cost} AFN\n";
}

// Create Supplier
echo "\n--- Creating Supplier ---\n";
$supplier = App\Models\Supplier::create([
    'name' => 'Ahmadi Pipes Co.',
    'supplier_type' => 'pipe',
    'phone' => '+93 700 123 456',
    'address' => 'Kabul, Industrial Area',
    'status' => 'active',
]);
echo "✓ {$supplier->name}\n";

echo "\n═══════════════════════════════════════════════════════════════\n";
echo "  SUMMARY\n";
echo "═══════════════════════════════════════════════════════════════\n";
echo "Goods:           " . App\Models\Good::count() . "\n";
echo "Warehouses:      " . App\Models\Warehouse::count() . "\n";
echo "Inventory Items: " . App\Models\InventoryItem::count() . "\n";
echo "Suppliers:       " . App\Models\Supplier::count() . "\n";
echo "═══════════════════════════════════════════════════════════════\n";
