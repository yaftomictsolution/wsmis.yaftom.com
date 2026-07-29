<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "=== Creating Default Warehouse ===\n";

$warehouse = App\Models\Warehouse::first();
if (!$warehouse) {
    $warehouse = App\Models\Warehouse::create([
        'name' => 'Main Warehouse',
        'code' => 'WH-001',
        'address' => 'Kabul, Afghanistan',
        'status' => 'active',
        'notes' => 'Default warehouse for inventory',
    ]);
    echo "✓ Warehouse created: {$warehouse->name} (ID: {$warehouse->id})\n";
} else {
    echo "✓ Warehouse already exists: {$warehouse->name} (ID: {$warehouse->id})\n";
}

echo "\n=== Total Warehouses: " . App\Models\Warehouse::count() . " ===\n";
