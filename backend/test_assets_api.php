<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

// Create token
$user = App\Models\User::first();
$token = $user->createToken('test-token')->plainTextToken;
echo "Token: $token\n\n";

// Use file_get_contents
$opts = [
    'http' => [
        'method' => 'GET',
        'header' => "Accept: application/json\r\nAuthorization: Bearer $token",
    ],
];
$context = stream_context_create($opts);
$response = file_get_contents('http://127.0.0.1:8000/api/assets', false, $context);

echo "Response:\n";
echo $response . "\n";
