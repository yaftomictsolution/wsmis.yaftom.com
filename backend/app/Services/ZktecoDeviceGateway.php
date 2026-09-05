<?php

namespace App\Services;

use App\Models\AttendanceDevice;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\Process;
use Throwable;

class ZktecoDeviceGateway
{
    public function test(AttendanceDevice $device): array
    {
        if ($device->connection_mode === 'simulator') {
            $details = [
                'connectionType' => 'simulator',
                'deviceName' => $device->model ?: 'WSMIS Test Device',
                'serialNumber' => $device->serial_number,
                'deviceTime' => now()->toIso8601String(),
                'userCount' => $device->mappings()->count(),
                'logCount' => $device->events()->count(),
            ];
            $this->markOnline($device, $details, false);

            return $details;
        }

        if ($device->connection_mode === 'usb') {
            $details = [
                'connectionType' => 'usb',
                'deviceName' => $device->model ?: 'USB Attendance Import',
                'message' => 'USB mode is ready. Export attendance from the device and upload the file here.',
            ];
            $this->markOnline($device, $details, false);

            return $details;
        }

        $response = $this->runBridge($device, 'test');
        $details = (array) ($response['details'] ?? []);
        $this->markOnline($device, $details, false);

        return $details;
    }

    public function pull(AttendanceDevice $device): array
    {
        abort_unless($device->connection_mode === 'network', 422, 'Only a network device can download punches directly.');
        $response = $this->runBridge($device, 'pull');
        $details = (array) ($response['details'] ?? []);
        $users = collect($response['users'] ?? [])
            ->filter(fn ($user): bool => is_array($user))
            ->values();
        $usersById = $users->mapWithKeys(function (array $user): array {
            $keys = array_filter([
                isset($user['userId']) ? (string) $user['userId'] : null,
                isset($user['uid']) ? (string) $user['uid'] : null,
            ]);

            return collect($keys)->mapWithKeys(fn (string $key): array => [$key => $user])->all();
        });
        $punches = collect($response['punches'] ?? [])
            ->filter(fn ($punch): bool => is_array($punch))
            ->map(function (array $punch) use ($usersById): array {
                $deviceUserId = (string) ($punch['deviceUserId'] ?? '');
                $user = $usersById->get($deviceUserId, []);

                return $punch + [
                    'device_user_name' => $user['name'] ?? null,
                    'card_number' => $user['cardNumber'] ?? null,
                ];
            })
            ->values()
            ->all();

        $this->markOnline($device, $details + ['downloadedUserCount' => $users->count()], true);

        return ['details' => $details, 'users' => $users->all(), 'punches' => $punches];
    }

    private function runBridge(AttendanceDevice $device, string $operation): array
    {
        if (! config('attendance-devices.network_enabled')) {
            throw ValidationException::withMessages([
                'device' => ['Direct device access is available only on the office computer. Use USB import on the cloud website.'],
            ]);
        }
        if ($device->status !== 'active') {
            throw ValidationException::withMessages(['device' => ['Activate the attendance device before connecting.']]);
        }
        if (! $this->isPrivateIpv4((string) $device->ip_address)) {
            throw ValidationException::withMessages([
                'ip_address' => ['Use the device private LAN address, such as 192.168.1.201. Public addresses are blocked.'],
            ]);
        }

        $node = $this->nodeBinary();
        $script = (string) config('attendance-devices.bridge_script');
        if (! is_file($script)) {
            throw ValidationException::withMessages(['device' => ['The local ZKTeco connector is not installed.']]);
        }

        $process = new Process([$node, $script], base_path());
        $process->setTimeout(max(15, (int) $device->timeout_seconds + 45));
        $process->setInput(json_encode([
            'operation' => $operation,
            'ip' => $device->ip_address,
            'port' => (int) $device->port,
            'timeoutMs' => (int) $device->timeout_seconds * 1000,
        ], JSON_THROW_ON_ERROR));

        try {
            $process->run();
            $response = $this->readResponse($process->getOutput());
            if (! $process->isSuccessful() || ! ($response['ok'] ?? false)) {
                $message = $this->friendlyError((string) ($response['error'] ?? $process->getErrorOutput()));
                $this->markOffline($device, $message);
                throw ValidationException::withMessages(['device' => [$message]]);
            }

            return $response;
        } catch (ValidationException $exception) {
            throw $exception;
        } catch (Throwable $exception) {
            $message = $this->friendlyError($exception->getMessage());
            $this->markOffline($device, $message);
            throw ValidationException::withMessages(['device' => [$message]]);
        }
    }

    private function readResponse(string $output): array
    {
        $line = collect(preg_split('/\R/', trim($output)) ?: [])
            ->last(fn (string $value): bool => str_starts_with($value, 'WSMIS_RESULT:'));
        if (! $line) {
            return ['ok' => false, 'error' => 'The local connector returned an unreadable response.'];
        }

        $decoded = json_decode(substr($line, strlen('WSMIS_RESULT:')), true);

        return is_array($decoded) ? $decoded : ['ok' => false, 'error' => 'The local connector returned invalid data.'];
    }

    private function markOnline(AttendanceDevice $device, array $details, bool $synced): void
    {
        $serial = trim((string) ($details['serialNumber'] ?? ''));
        $device->forceFill([
            'serial_number' => $serial !== '' ? $serial : $device->serial_number,
            'connection_status' => 'online',
            'last_seen_at' => now(),
            'last_sync_at' => $synced ? now() : $device->last_sync_at,
            'last_error' => null,
            'device_info' => $details,
        ])->save();
    }

    private function markOffline(AttendanceDevice $device, string $message): void
    {
        $device->forceFill([
            'connection_status' => 'offline',
            'last_error' => mb_substr($message, 0, 1000),
        ])->save();
    }

    private function friendlyError(string $message): string
    {
        $message = trim(preg_replace('/\s+/', ' ', $message) ?? '');
        if (preg_match('/ECONNREFUSED|ETIMEDOUT|timeout|EHOSTUNREACH|ENETUNREACH/i', $message)) {
            return 'The attendance device could not be reached. Check its power, LAN cable, IP address, port 4370, and firewall.';
        }

        return mb_substr($message ?: 'Unable to communicate with the attendance device.', 0, 500);
    }

    private function isPrivateIpv4(string $ip): bool
    {
        if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            return false;
        }

        $number = ip2long($ip);
        if ($number === false) {
            return false;
        }
        $unsigned = (int) sprintf('%u', $number);
        $ranges = [
            ['10.0.0.0', '10.255.255.255'],
            ['172.16.0.0', '172.31.255.255'],
            ['192.168.0.0', '192.168.255.255'],
            ['169.254.0.0', '169.254.255.255'],
        ];

        return collect($ranges)->contains(function (array $range) use ($unsigned): bool {
            return $unsigned >= (int) sprintf('%u', ip2long($range[0]))
                && $unsigned <= (int) sprintf('%u', ip2long($range[1]));
        });
    }

    private function nodeBinary(): string
    {
        $configured = (string) config('attendance-devices.node_binary', 'node');
        if ($configured !== 'node' || PHP_OS_FAMILY !== 'Windows') {
            return $configured;
        }

        $programFiles = getenv('ProgramFiles') ?: 'C:\\Program Files';
        $bundled = rtrim($programFiles, '\\/').DIRECTORY_SEPARATOR.'WSMIS'.DIRECTORY_SEPARATOR.'runtime'.DIRECTORY_SEPARATOR.'node'.DIRECTORY_SEPARATOR.'node.exe';

        return is_file($bundled) ? $bundled : $configured;
    }
}
