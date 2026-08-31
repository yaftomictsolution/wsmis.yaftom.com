<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SyncDevice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SyncDeviceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        return response()->json(['data' => SyncDevice::query()
            ->latest('id')
            ->get()
            ->map(fn (SyncDevice $device): array => $this->payload($device))]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
        ]);
        $secret = Str::random(64);
        $device = SyncDevice::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => $data['name'],
            'token_hash' => Hash::make($secret),
            'status' => 'active',
        ]);

        return response()->json(['data' => [
            'device' => $this->payload($device),
            'secret' => $secret,
            'api_url' => rtrim($request->root(), '/').'/api',
        ]], 201);
    }

    public function rotate(Request $request, SyncDevice $syncDevice): JsonResponse
    {
        $this->authorizeAdmin($request);
        $secret = Str::random(64);
        $syncDevice->forceFill([
            'token_hash' => Hash::make($secret),
            'status' => 'active',
        ])->save();

        return response()->json(['data' => [
            'device' => $this->payload($syncDevice->fresh()),
            'secret' => $secret,
            'api_url' => rtrim($request->root(), '/').'/api',
        ]]);
    }

    public function destroy(Request $request, SyncDevice $syncDevice): JsonResponse
    {
        $this->authorizeAdmin($request);
        $syncDevice->forceFill(['status' => 'revoked'])->save();

        return response()->json(['data' => $this->payload($syncDevice->fresh())]);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless(config('sync.enabled') && config('sync.mode') === 'cloud', 409, 'Local computers are managed from the online WSMIS installation.');
        abort_unless($request->user()?->hasAnyRole(['Admin', 'Super Admin']), 403, 'Only administrators can manage local computers.');
    }

    private function payload(SyncDevice $device): array
    {
        return [
            'id' => $device->id,
            'uuid' => $device->uuid,
            'name' => $device->name,
            'status' => $device->status,
            'last_seen_at' => optional($device->last_seen_at)->toISOString(),
            'last_ip' => $device->last_ip,
            'created_at' => optional($device->created_at)->toISOString(),
        ];
    }
}
