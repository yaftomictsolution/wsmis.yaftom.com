<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = App\Models\User::first();
$token = $user->createToken('test-token')->plainTextToken;
echo "Token: $token\n";
echo "User: {$user->email}\n";
