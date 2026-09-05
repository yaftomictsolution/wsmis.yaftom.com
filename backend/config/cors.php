<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [
        env('FRONTEND_URL', 'http://localhost:3000'),
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://localhost:3003',
        'http://127.0.0.1:3003',
    ],
    // Explicit local patterns keep browser CORS reliable when the frontend is
    // opened as localhost rather than 127.0.0.1 during local development.
    'allowed_origins_patterns' => [
        '#^http://localhost:300(?:0|1|3)$#',
        '#^http://127\.0\.0\.1:300(?:0|1|3)$#',
    ],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
