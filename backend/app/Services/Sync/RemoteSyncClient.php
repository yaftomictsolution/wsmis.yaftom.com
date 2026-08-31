<?php

namespace App\Services\Sync;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class RemoteSyncClient
{
    public function configured(): bool
    {
        return config('sync.enabled')
            && config('sync.mode') === 'local'
            && filled(config('sync.remote_url'))
            && filled(config('sync.device_uuid'))
            && filled(config('sync.device_secret'));
    }

    public function handshake(): array
    {
        return $this->json($this->request()->get($this->url('/sync/remote/handshake')));
    }

    public function push(array $changes): array
    {
        return $this->json($this->request()->post($this->url('/sync/remote/push'), [
            'changes' => $changes,
        ]));
    }

    public function pull(int $cursor, int $limit): array
    {
        return $this->json($this->request()->get($this->url('/sync/remote/pull'), [
            'cursor' => $cursor,
            'limit' => $limit,
        ]));
    }

    public function manifest(): array
    {
        return $this->json($this->request()->get($this->url('/sync/remote/manifest')));
    }

    public function acquireLease(bool $force = false): array
    {
        return $this->json($this->request()->post($this->url('/sync/remote/lease/acquire'), [
            'force' => $force,
        ]));
    }

    public function releaseLease(): array
    {
        return $this->json($this->request()->post($this->url('/sync/remote/lease/release')));
    }

    public function uploadFile(array $descriptor): bool
    {
        if (! Storage::disk($descriptor['disk'])->exists($descriptor['path'])) {
            return false;
        }

        $path = Storage::disk($descriptor['disk'])->path($descriptor['path']);
        $handle = fopen($path, 'r');
        if ($handle === false) {
            throw new RuntimeException("Unable to open synchronized file {$descriptor['path']}.");
        }

        try {
            $response = $this->request()
                ->attach('file', $handle, basename($path))
                ->post($this->url('/sync/remote/file'), ['descriptor' => json_encode($descriptor)]);
        } finally {
            fclose($handle);
        }

        $this->json($response);

        return true;
    }

    public function downloadFile(array $descriptor): bool
    {
        $response = $this->request()->get($this->url('/sync/remote/file'), [
            'table_name' => $descriptor['table_name'],
            'column_name' => $descriptor['column_name'],
            'disk' => $descriptor['disk'],
            'path' => $descriptor['path'],
            'sha256' => $descriptor['sha256'],
        ]);

        if (! $response->successful()) {
            throw new RuntimeException($response->json('message') ?? 'Unable to download a synchronized file.');
        }

        if (! hash_equals((string) $descriptor['sha256'], hash('sha256', $response->body()))) {
            throw new RuntimeException('Downloaded synchronization file failed checksum validation.');
        }

        Storage::disk($descriptor['disk'])->put($descriptor['path'], $response->body());

        return true;
    }

    private function request(): PendingRequest
    {
        if (! $this->configured()) {
            throw new RuntimeException('Local synchronization is not configured.');
        }

        return Http::acceptJson()
            ->timeout((int) config('sync.request_timeout', 45))
            ->retry(2, 300, throw: false)
            ->withHeaders([
                'X-WSMIS-Device' => config('sync.device_uuid'),
                'X-WSMIS-Device-Token' => config('sync.device_secret'),
                'X-WSMIS-Sync-Protocol' => (string) config('sync.protocol_version', 1),
            ]);
    }

    private function url(string $path): string
    {
        return rtrim((string) config('sync.remote_url'), '/').$path;
    }

    private function json(Response $response): array
    {
        if (! $response->successful()) {
            $message = $response->json('message');
            if (! is_string($message) || $message === '' || $message === 'Server Error') {
                $message = "Cloud synchronization failed ({$response->status()}).";
            }

            throw new RuntimeException($message);
        }

        return $response->json('data') ?? $response->json();
    }
}
