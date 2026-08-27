<?php

return [
    'environment' => (bool) env('TRAINING_ENVIRONMENT', false),
    'business_timezone' => env('BUSINESS_TIMEZONE', 'Asia/Kabul'),
    'training_url' => env('TRAINING_FRONTEND_URL'),
    'production_url' => env('PRODUCTION_FRONTEND_URL'),
    'reset_confirmation' => 'RESET TRAINING DATA',
];
