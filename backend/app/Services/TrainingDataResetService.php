<?php

namespace App\Services;

use App\Models\SystemSetting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class TrainingDataResetService
{
    private const RESET_OPERATION_KEY = 'training_data_reset_operation';

    private const TABLE_BATCH_SIZE = 8;

    private const PRESERVED_TABLES = [
        'migrations',
        'users',
        'roles',
        'permissions',
        'model_has_roles',
        'model_has_permissions',
        'role_has_permissions',
        'personal_access_tokens',
        'password_reset_tokens',
        'sessions',
        'system_settings',
        'payment_methods',
        'financial_categories',
        'customer_charge_types',
        'cache',
        'cache_locks',
    ];

    public function reset(): array
    {
        if (! config('training.environment')) {
            throw new RuntimeException('Training data can only be reset in the training environment.');
        }

        $tables = array_values(array_diff($this->tables(), self::PRESERVED_TABLES));
        $this->truncateTables($tables);

        Cache::flush();
        $this->clearUploadedFiles();

        return [
            'cleared_tables' => count($tables),
            'preserved_tables' => self::PRESERVED_TABLES,
        ];
    }

    public function start(int $userId): array
    {
        if (! config('training.environment')) {
            throw new RuntimeException('Training data can only be reset in the training environment.');
        }

        $tables = array_values(array_diff($this->tables(), self::PRESERVED_TABLES));
        $state = [
            'id' => (string) Str::uuid(),
            'user_id' => $userId,
            'status' => 'running',
            'stage' => 'database',
            'message' => 'Preparing the training database reset...',
            'tables' => $tables,
            'next_table' => 0,
            'completed_steps' => 0,
            'total_steps' => count($tables) + 2,
            'started_at' => now()->toIso8601String(),
            'expires_at' => now()->addHour()->toIso8601String(),
        ];

        SystemSetting::query()->updateOrCreate(
            ['key' => self::RESET_OPERATION_KEY],
            ['value' => $state],
        );

        return $this->progress($state);
    }

    public function advance(string $operationId, int $userId): array
    {
        if (! config('training.environment')) {
            throw new RuntimeException('Training data can only be reset in the training environment.');
        }

        $setting = SystemSetting::query()->where('key', self::RESET_OPERATION_KEY)->first();
        $state = $setting?->value ?? [];

        if (! isset($state['id']) || ! hash_equals((string) $state['id'], $operationId)) {
            throw new RuntimeException('This training reset is no longer active. Start the reset again.');
        }

        if ((int) ($state['user_id'] ?? 0) !== $userId) {
            throw new RuntimeException('This training reset belongs to another administrator.');
        }

        if (($state['status'] ?? null) === 'completed') {
            return $this->progress($state);
        }

        if (now()->greaterThan($state['expires_at'] ?? now()->subSecond())) {
            throw new RuntimeException('This training reset expired. Start the reset again.');
        }

        if (($state['stage'] ?? null) === 'database') {
            $tables = array_values($state['tables'] ?? []);
            $nextTable = (int) ($state['next_table'] ?? 0);
            $batch = array_slice($tables, $nextTable, self::TABLE_BATCH_SIZE);

            if ($batch !== []) {
                $this->truncateTables($batch);
                $state['next_table'] = $nextTable + count($batch);
                $state['completed_steps'] = (int) $state['completed_steps'] + count($batch);
            }

            if ((int) $state['next_table'] >= count($tables)) {
                $state['stage'] = 'files';
                $state['message'] = 'Database cleared. Removing training attachments...';
            } else {
                $remainingTables = count($tables) - (int) $state['next_table'];
                $state['message'] = "Clearing training records... {$remainingTables} database tables remain.";
            }
        } elseif (($state['stage'] ?? null) === 'files') {
            $this->clearUploadedFiles();
            $state['completed_steps'] = (int) $state['completed_steps'] + 1;
            $state['stage'] = 'cache';
            $state['message'] = 'Attachments cleared. Refreshing application data...';
        } elseif (($state['stage'] ?? null) === 'cache') {
            Cache::flush();
            $state['completed_steps'] = (int) $state['total_steps'];
            $state['status'] = 'completed';
            $state['stage'] = 'complete';
            $state['message'] = 'Training data reset completed.';
            $state['completed_at'] = now()->toIso8601String();
        } else {
            throw new RuntimeException('The training reset state is invalid. Start the reset again.');
        }

        $setting->value = $state;
        $setting->save();

        return $this->progress($state);
    }

    private function progress(array $state): array
    {
        $tables = array_values($state['tables'] ?? []);
        $totalSteps = max(1, (int) ($state['total_steps'] ?? count($tables) + 2));
        $completedSteps = min($totalSteps, (int) ($state['completed_steps'] ?? 0));
        $completed = ($state['status'] ?? null) === 'completed';

        return [
            'operation_id' => (string) $state['id'],
            'status' => $completed ? 'completed' : 'running',
            'stage' => (string) ($state['stage'] ?? 'database'),
            'message' => (string) ($state['message'] ?? 'Resetting training data...'),
            'progress' => $completed ? 100 : min(99, (int) floor(($completedSteps / $totalSteps) * 100)),
            'completed_steps' => $completedSteps,
            'total_steps' => $totalSteps,
            'remaining_steps' => max(0, $totalSteps - $completedSteps),
            'cleared_tables' => min(count($tables), (int) ($state['next_table'] ?? 0)),
            'total_tables' => count($tables),
        ];
    }

    private function truncateTables(array $tables): void
    {
        $driver = DB::connection()->getDriverName();

        $this->disableForeignKeys($driver);
        try {
            foreach ($tables as $table) {
                DB::table($table)->truncate();
            }
        } finally {
            $this->enableForeignKeys($driver);
        }
    }

    private function tables(): array
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'sqlite') {
            return collect(DB::select("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"))
                ->pluck('name')
                ->all();
        }

        if ($driver === 'mysql') {
            return collect(DB::select('SHOW FULL TABLES WHERE Table_type = \'BASE TABLE\''))
                ->map(fn (object $row) => array_values((array) $row)[0])
                ->all();
        }

        throw new RuntimeException("Training reset does not support the {$driver} database driver.");
    }

    private function disableForeignKeys(string $driver): void
    {
        if ($driver === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
        } elseif ($driver === 'sqlite') {
            DB::statement('PRAGMA foreign_keys=OFF');
        }
    }

    private function enableForeignKeys(string $driver): void
    {
        if ($driver === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        } elseif ($driver === 'sqlite') {
            DB::statement('PRAGMA foreign_keys=ON');
        }
    }

    private function clearUploadedFiles(): void
    {
        foreach (['customer-documents', 'meter-seals'] as $directory) {
            Storage::disk('local')->deleteDirectory($directory);
        }

        foreach (['accounting-attachments', 'asset-purchases', 'employee-documents', 'employee-leave'] as $directory) {
            Storage::disk('public')->deleteDirectory($directory);
        }
    }
}
