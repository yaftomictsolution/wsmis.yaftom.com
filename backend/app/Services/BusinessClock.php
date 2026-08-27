<?php

namespace App\Services;

use App\Models\SystemSetting;
use App\Models\User;
use Carbon\Carbon;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Database\QueryException;

class BusinessClock
{
    public const SETTING_KEY = 'training_mode';

    public function isTrainingEnvironment(): bool
    {
        return (bool) config('training.environment', false);
    }

    public function realDate(): string
    {
        return (new DateTimeImmutable('now', new DateTimeZone($this->businessTimezone())))
            ->format('Y-m-d');
    }

    public function settings(): array
    {
        if (! $this->isTrainingEnvironment()) {
            return ['enabled' => false, 'business_date' => null];
        }

        try {
            $value = SystemSetting::query()->where('key', self::SETTING_KEY)->first()?->value;
        } catch (QueryException) {
            $value = null;
        }

        return [
            'enabled' => (bool) ($value['enabled'] ?? false),
            'business_date' => $this->validDate($value['business_date'] ?? null),
        ];
    }

    public function effectiveDate(): string
    {
        $settings = $this->settings();

        return $settings['enabled'] && $settings['business_date']
            ? $settings['business_date']
            : $this->realDate();
    }

    public function simulatedNow(): ?Carbon
    {
        $settings = $this->settings();
        if (! $settings['enabled'] || ! $settings['business_date']) {
            return null;
        }

        $realNow = new DateTimeImmutable('now', new DateTimeZone((string) config('app.timezone', 'UTC')));

        return Carbon::createFromFormat(
            'Y-m-d H:i:s',
            $settings['business_date'].' '.$realNow->format('H:i:s'),
            (string) config('app.timezone', 'UTC'),
        );
    }

    public function status(?User $user = null): array
    {
        $settings = $this->settings();
        $trainingEnvironment = $this->isTrainingEnvironment();

        return [
            'environment' => $trainingEnvironment ? 'training' : 'production',
            'enabled' => $trainingEnvironment && $settings['enabled'],
            'business_date' => $trainingEnvironment ? $settings['business_date'] : null,
            'effective_date' => $this->effectiveDate(),
            'real_date' => $this->realDate(),
            'can_manage' => $trainingEnvironment
                && (bool) $user?->hasAnyRole(['Admin', 'Super Admin']),
            'training_url' => config('training.training_url'),
            'production_url' => config('training.production_url'),
            'reset_confirmation' => config('training.reset_confirmation'),
        ];
    }

    public function update(bool $enabled, string $businessDate): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => self::SETTING_KEY],
            ['value' => [
                'enabled' => $enabled,
                'business_date' => $businessDate,
            ]],
        );
    }

    private function businessTimezone(): string
    {
        return (string) config('training.business_timezone', 'Asia/Kabul');
    }

    private function validDate(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);

        return $date && $date->format('Y-m-d') === $value ? $value : null;
    }
}
