<?php

namespace App\Services;

use App\Models\LeavePolicy;
use Illuminate\Support\Collection;

class LeavePolicyDefaultsService
{
    public function ensure(): Collection
    {
        $policies = collect($this->attributes())->map(
            fn (array $attributes, string $code): LeavePolicy => LeavePolicy::query()->firstOrCreate(['code' => $code], $attributes),
        );

        LeavePolicy::query()->where('code', 'other')->update(['status' => 'inactive']);

        return $policies;
    }

    public function synchronize(array $settings): Collection
    {
        $policies = collect($this->attributes($settings))->map(
            fn (array $attributes, string $code): LeavePolicy => LeavePolicy::query()->updateOrCreate(['code' => $code], $attributes),
        );

        LeavePolicy::query()->where('code', 'other')->update(['status' => 'inactive']);

        return $policies;
    }

    private function attributes(?array $settings = null): array
    {
        return [
            'annual' => [
                'name' => 'Annual Leave',
                'days_per_year' => $settings['annual_leave_days'] ?? 20,
                'is_paid' => true,
                'tracks_balance' => true,
                'carry_forward_limit' => $settings['carry_forward_days'] ?? 5,
                'max_consecutive_days' => 15,
                'payout_on_termination' => true,
                'status' => 'active',
            ],
            'sick' => [
                'name' => 'Sick Leave',
                'days_per_year' => $settings['sick_leave_days'] ?? 10,
                'is_paid' => true,
                'tracks_balance' => true,
                'carry_forward_limit' => 0,
                'attachment_after_days' => 2,
                'payout_on_termination' => false,
                'status' => 'active',
            ],
            'emergency' => [
                'name' => 'Emergency Leave',
                'days_per_year' => $settings['emergency_leave_days'] ?? 5,
                'is_paid' => true,
                'tracks_balance' => true,
                'carry_forward_limit' => 0,
                'max_consecutive_days' => 3,
                'payout_on_termination' => false,
                'status' => 'active',
            ],
            'unpaid' => [
                'name' => 'Unpaid Leave',
                'days_per_year' => 0,
                'is_paid' => false,
                'tracks_balance' => false,
                'carry_forward_limit' => 0,
                'payout_on_termination' => false,
                'status' => 'active',
            ],
        ];
    }
}
