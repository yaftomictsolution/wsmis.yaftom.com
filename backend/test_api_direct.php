<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "=== Testing Assets API ===\n";

// Get assets directly from database
$assets = App\Models\Asset::with(['serviceArea', 'supplier', 'creator'])->get();
echo "Assets in database: " . $assets->count() . "\n";

if ($assets->count() > 0) {
    $asset = $assets->first();
    echo "First asset: {$asset->asset_code} - {$asset->name}\n";
    echo "Type: {$asset->type}\n";
    echo "Status: {$asset->status}\n";
    echo "Attributes: " . json_encode($asset->attributes) . "\n";
}

echo "\n=== Testing Inventory API ===\n";

$items = App\Models\InventoryItem::with(['warehouse', 'supplier'])->get();
echo "Inventory items in database: " . $items->count() . "\n";

if ($items->count() > 0) {
    $item = $items->first();
    echo "First item: {$item->code} - {$item->name}\n";
    echo "Category: {$item->category}\n";
    echo "Quantity: {$item->quantity} {$item->unit}\n";
}

echo "\n=== Testing Warehouse API ===\n";

$warehouses = App\Models\Warehouse::all();
echo "Warehouses in database: " . $warehouses->count() . "\n";

echo "\n=== Testing Asset Maintenance API ===\n";

$maintenance = App\Models\AssetMaintenance::with('asset')->get();
echo "Maintenance records in database: " . $maintenance->count() . "\n";
