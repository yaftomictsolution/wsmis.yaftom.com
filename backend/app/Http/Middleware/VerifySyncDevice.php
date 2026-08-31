<?php

namespace App\Http\Middleware;

use App\Models\SyncDevice;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

class VerifySyncDevice
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(config('sync.enabled') && config('sync.mode') === 'cloud', 404);
        abort_unless(
            (int) $request->header('X-WSMIS-Sync-Protocol') === (int) config('sync.protocol_version'),
            426,
            'Synchronization protocol version mismatch.',
        );

        $uuid = (string) $request->header('X-WSMIS-Device');
        $token = (string) $request->header('X-WSMIS-Device-Token');
        $device = SyncDevice::query()->where('uuid', $uuid)->where('status', 'active')->first();

        abort_unless($device && $token !== '' && Hash::check($token, $device->token_hash), 401, 'Invalid synchronization device credentials.');

        $device->forceFill([
            'last_seen_at' => now(),
            'last_ip' => $request->ip(),
        ])->save();
        $request->attributes->set('sync_device', $device);

        return $next($request);
    }
}
