<?php

return [
    'network_enabled' => env('ATTENDANCE_DEVICE_NETWORK_ENABLED', env('SYNC_MODE', 'standalone') !== 'cloud'),
    'node_binary' => env('ATTENDANCE_DEVICE_NODE_BINARY', 'node'),
    'bridge_script' => env('ATTENDANCE_DEVICE_BRIDGE_SCRIPT', base_path('device-bridge/zkteco-cli.cjs')),
    'default_timezone' => env('BUSINESS_TIMEZONE', 'Asia/Kabul'),
    'maximum_import_rows' => max(100, (int) env('ATTENDANCE_DEVICE_MAX_IMPORT_ROWS', 100000)),
];
