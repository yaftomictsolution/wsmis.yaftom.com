<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "=== Creating Test Supplier ===\n";

try {
    $supplier = App\Models\Supplier::create([
        'name' => 'Ahmad Pipes Co.',
        'supplier_type' => 'pipe',
        'phone' => '+93 700 123 456',
        'address' => 'Kabul, Industrial Area',
        'status' => 'active',
        'notes' => 'Main PVC pipe supplier',
    ]);
    echo "SUCCESS: Supplier created with ID: {$supplier->id}\n";
    echo "Name: {$supplier->name}\n";
    echo "Type: {$supplier->supplier_type}\n";
    echo "Phone: {$supplier->phone}\n";
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}

echo "\n=== Total Suppliers: " . App\Models\Supplier::count() . " ===\n";
