<?php

namespace Tests\Feature;

use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SystemCalendarSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_save_hijri_shamsi_calendar_preferences(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->putJson('/api/settings/system-profile', [
            'company_name' => 'WSMIS',
            'system_name' => 'Water Supply Management System',
            'currency' => 'AFN',
            'language' => 'fa',
            'calendar_system' => 'shamsi',
            'show_gregorian_secondary' => true,
            'phone' => '0700000000',
            'address' => 'Kabul',
        ])->assertOk()
            ->assertJsonPath('data.system_profile.calendar_system', 'shamsi')
            ->assertJsonPath('data.system_profile.show_gregorian_secondary', true);

        $profile = SystemSetting::query()->where('key', 'system_profile')->firstOrFail()->value;
        $this->assertSame('shamsi', $profile['calendar_system']);
        $this->assertTrue($profile['show_gregorian_secondary']);
    }

    public function test_legacy_profile_updates_preserve_the_saved_calendar_preferences(): void
    {
        Sanctum::actingAs(User::factory()->create());
        SystemSetting::query()->create([
            'key' => 'system_profile',
            'value' => [
                'company_name' => 'Old Name',
                'system_name' => 'WSMIS',
                'currency' => 'AFN',
                'language' => 'en',
                'calendar_system' => 'gregorian',
                'show_gregorian_secondary' => true,
            ],
        ]);

        $this->putJson('/api/settings/system-profile', [
            'company_name' => 'New Name',
            'system_name' => 'WSMIS',
            'currency' => 'AFN',
            'language' => 'en',
        ])->assertOk()
            ->assertJsonPath('data.system_profile.calendar_system', 'gregorian')
            ->assertJsonPath('data.system_profile.show_gregorian_secondary', true);
    }

    public function test_calendar_system_rejects_unsupported_values(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->putJson('/api/settings/system-profile', [
            'company_name' => 'WSMIS',
            'system_name' => 'Water Supply Management System',
            'currency' => 'AFN',
            'language' => 'fa',
            'calendar_system' => 'lunar_hijri',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('calendar_system');
    }
}
