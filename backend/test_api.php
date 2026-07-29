<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "=== API ENDPOINT TESTS ===\n";

$token = null;
// Get first user token
$user = App\Models\User::first();
if ($user) {
    $token = $user->createTestToken();
    echo "Using token for user: {$user->name}\n";
}

$baseUrl = 'http://127.0.0.1:8000/api';
$headers = [
    'Accept: application/json',
    'Content-Type: application/json',
];
if ($token) {
    $headers[] = "Authorization: Bearer {$token}";
}

function testEndpoint(string $method, string $url, array $headers, ?array $body = null): array {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($body) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        }
    } elseif ($method === 'PUT') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
        if ($body) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        }
    } elseif ($method === 'DELETE') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return ['code' => $httpCode, 'response' => json_decode($response, true)];
}

// Test 1: GET /api/assets
echo "\n--- Test 1: GET /api/assets ---\n";
$result = testEndpoint('GET', "{$baseUrl}/assets", $headers);
echo "Status: {$result['code']}\n";
echo "Data count: " . (isset($result['response']['data']) ? count($result['response']['data']) : 'N/A') . "\n";

// Test 2: GET /api/assets/stats
echo "\n--- Test 2: GET /api/assets/stats ---\n";
$result = testEndpoint('GET', "{$baseUrl}/assets/stats", $headers);
echo "Status: {$result['code']}\n";
echo "Response: " . json_encode($result['response]) . "\n";

// Test 3: GET /api/warehouses
echo "\n--- Test 3: GET /api/warehouses ---\n";
$result = testEndpoint('GET', "{$baseUrl}/warehouses", $headers);
echo "Status: {$result['code']}\n";
echo "Data count: " . (isset($result['response']['data']) ? count($result['response']['data']) : 'N/A') . "\n";

// Test 4: GET /api/inventory-items
echo "\n--- Test 4: GET /api/inventory-items ---\n";
$result = testEndpoint('GET', "{$baseUrl}/inventory-items", $headers);
echo "Status: {$result['code']}\n";
echo "Data count: " . (isset($result['response']['data']) ? count($result['response']['data']) : 'N/A') . "\n";

// Test 5: GET /api/inventory/stats
echo "\n--- Test 5: GET /api/inventory/stats ---\n";
$result = testEndpoint('GET', "{$baseUrl}/inventory/stats", $headers);
echo "Status: {$result['code']}\n";
echo "Response: " . json_encode($result['response]) . "\n";

// Test 6: GET /api/assets-maintenance
echo "\n--- Test 6: GET /api/assets-maintenance ---\n";
$result = testEndpoint('GET', "{$baseUrl}/assets-maintenance", $headers);
echo "Status: {$result['code']}\n";
echo "Data count: " . (isset($result['response']['data']) ? count($result['response']['data']) : 'N/A') . "\n";

// Test 7: GET /api/inventory-issues
echo "\n--- Test 7: GET /api/inventory-issues ---\n";
$result = testEndpoint('GET', "{$baseUrl}/inventory-issues", $headers);
echo "Status: {$result['code']}\n";
echo "Data count: " . (isset($result['response']['data']) ? count($result['response']['data']) : 'N/A') . "\n";

echo "\n=== API TEST COMPLETE ===\n";
