<?php

namespace App\Services\Sync;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class SyncFileService
{
    public function descriptors(string $table, array $payload): array
    {
        $descriptors = [];
        foreach (config("sync.files.{$table}", []) as $column => $disk) {
            $path = $payload[$column] ?? null;
            if (! is_string($path) || $path === '' || ! Storage::disk($disk)->exists($path)) {
                continue;
            }

            $absolutePath = Storage::disk($disk)->path($path);
            $descriptors[] = [
                'table_name' => $table,
                'column_name' => $column,
                'disk' => $disk,
                'path' => $path,
                'sha256' => hash_file('sha256', $absolutePath),
                'size' => filesize($absolutePath),
            ];
        }

        return $descriptors;
    }

    public function isAllowed(array $descriptor): bool
    {
        $table = (string) ($descriptor['table_name'] ?? '');
        $column = (string) ($descriptor['column_name'] ?? '');
        $disk = (string) ($descriptor['disk'] ?? '');
        $path = (string) ($descriptor['path'] ?? '');
        $configuredDisk = config("sync.files.{$table}.{$column}");

        return $configuredDisk === $disk
            && $path !== ''
            && ! str_contains(str_replace('\\', '/', $path), '../')
            && ! str_starts_with($path, '/')
            && ! preg_match('/^[A-Za-z]:/', $path);
    }

    public function storeUploaded(array $descriptor, UploadedFile $file): void
    {
        if (! $this->isAllowed($descriptor)) {
            throw new RuntimeException('The synchronization file path is not allowed.');
        }

        $actualHash = hash_file('sha256', $file->getRealPath());
        if (! hash_equals((string) $descriptor['sha256'], $actualHash)) {
            throw new RuntimeException('The synchronized file checksum does not match.');
        }

        Storage::disk($descriptor['disk'])->put($descriptor['path'], $file->getContent());
    }

    public function hasExpectedFile(array $descriptor): bool
    {
        if (! $this->isAllowed($descriptor) || ! Storage::disk($descriptor['disk'])->exists($descriptor['path'])) {
            return false;
        }

        return hash_equals(
            (string) $descriptor['sha256'],
            hash_file('sha256', Storage::disk($descriptor['disk'])->path($descriptor['path'])),
        );
    }
}
