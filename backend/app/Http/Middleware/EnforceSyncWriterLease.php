<?php

namespace App\Http\Middleware;

use App\Models\SyncNodeState;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

class EnforceSyncWriterLease
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('sync.enabled')
            || config('sync.mode') !== 'cloud'
            || in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)
            || $request->is('api/sync/*')
            || $request->is('api/auth/login')
            || $request->is('api/auth/logout')
            || ! Schema::hasTable('sync_node_states')) {
            return $next($request);
        }

        $state = SyncNodeState::query()->first();
        if (! $state || $state->writer_mode !== 'local') {
            return $next($request);
        }

        if ($state->lease_expires_at?->isPast()) {
            $state->forceFill([
                'writer_mode' => 'cloud',
                'writer_device_uuid' => null,
                'lease_expires_at' => null,
            ])->save();

            return $next($request);
        }

        return response()->json([
            'message' => 'The office computer is currently working offline. Online editing is read-only until it synchronizes and releases control.',
            'code' => 'LOCAL_WRITER_ACTIVE',
            'lease_expires_at' => optional($state->lease_expires_at)->toISOString(),
        ], 423);
    }
}
