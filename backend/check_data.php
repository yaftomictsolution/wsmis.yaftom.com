<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "Customers: " . App\Models\Customer::count() . "\n";
echo "Users: " . App\Models\User::count() . "\n";
echo "Employees: " . App\Models\Employee::count() . "\n";
echo "Assets: " . App\Models\Asset::count() . "\n";
echo "Inventory Items: " . App\Models\InventoryItem::count() . "\n";
echo "Goods: " . App\Models\Good::count() . "\n";
echo "Accounting Accounts: " . App\Models\AccountingAccount::count() . "\n";
echo "Payroll Runs: " . App\Models\PayrollRun::count() . "\n";
echo "Leave Requests: " . App\Models\LeaveRequest::count() . "\n";
