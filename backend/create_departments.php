<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "=== Creating Test Departments ===\n";

$departments = [
    ['code' => 'DISTRIBUTION', 'name' => 'Distribution Department', 'description' => 'Water distribution and customer connections'],
    ['code' => 'MAINTENANCE', 'name' => 'Maintenance Department', 'description' => 'Pipe and infrastructure maintenance'],
    ['code' => 'TREATMENT', 'name' => 'Water Treatment', 'description' => 'Water quality and treatment'],
    ['code' => 'ADMIN', 'name' => 'Administration', 'description' => 'Office and administration'],
];

foreach ($departments as $dept) {
    $existing = App\Models\Department::where('code', $dept['code'])->first();
    if (!$existing) {
        App\Models\Department::create($dept);
        echo "✓ Created: {$dept['name']} ({$dept['code']})\n";
    } else {
        echo "✓ Already exists: {$dept['name']} ({$dept['code']})\n";
    }
}

echo "\n=== Total Departments: " . App\Models\Department::count() . " ===\n";
