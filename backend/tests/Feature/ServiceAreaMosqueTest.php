<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\ServiceArea;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ServiceAreaMosqueTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->create(['status' => 'active']));
    }

    public function test_service_area_can_be_created_with_multiple_mosques(): void
    {
        $this->postJson('/api/service-areas', [
            'name' => 'Karte Parwan',
            'rate_per_cubic_meter' => 65,
            'status' => 'active',
            'mosques' => [
                ['name' => 'Omar Mosque', 'status' => 'active'],
                ['name' => 'Bilal Mosque', 'status' => 'active'],
            ],
        ])->assertCreated()
            ->assertJsonCount(2, 'data.mosques')
            ->assertJsonPath('data.mosques_count', 2);

        $this->assertDatabaseHas('service_area_mosques', ['name' => 'Omar Mosque']);
        $this->assertDatabaseHas('service_area_mosques', ['name' => 'Bilal Mosque']);
        $this->assertDatabaseHas('service_areas', ['name' => 'Karte Parwan', 'mosque_name' => 'Omar Mosque']);
    }

    public function test_legacy_mosque_name_is_preserved_as_a_mosque_record(): void
    {
        $this->postJson('/api/service-areas', [
            'name' => 'Legacy Area',
            'mosque_name' => 'Central Mosque',
            'rate_per_cubic_meter' => 60,
            'status' => 'active',
        ])->assertCreated()
            ->assertJsonPath('data.mosques.0.name', 'Central Mosque');

        $this->assertDatabaseHas('service_area_mosques', [
            'name' => 'Central Mosque',
            'status' => 'active',
        ]);
    }

    public function test_customer_mosque_must_belong_to_the_selected_service_area(): void
    {
        $firstArea = ServiceArea::query()->create(['name' => 'First Area', 'status' => 'active']);
        $secondArea = ServiceArea::query()->create(['name' => 'Second Area', 'status' => 'active']);
        $firstMosque = $firstArea->mosques()->create(['name' => 'First Mosque', 'status' => 'active']);
        $secondMosque = $secondArea->mosques()->create(['name' => 'Second Mosque', 'status' => 'active']);

        $payload = [
            'service_area_id' => $firstArea->id,
            'service_area_mosque_id' => $secondMosque->id,
            'name' => 'Ahmad',
            'father_name' => 'Karim',
            'phone' => '0780000021',
            'house_number' => 'H-21',
        ];

        $this->postJson('/api/customers', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('service_area_mosque_id');

        $payload['service_area_mosque_id'] = $firstMosque->id;

        $this->postJson('/api/customers', $payload)
            ->assertCreated()
            ->assertJsonPath('data.service_area_mosque.name', 'First Mosque');
    }

    public function test_mosque_assigned_to_a_customer_cannot_be_removed_from_the_area(): void
    {
        $area = ServiceArea::query()->create(['name' => 'Protected Area', 'status' => 'active']);
        $assignedMosque = $area->mosques()->create(['name' => 'Assigned Mosque', 'status' => 'active']);
        $otherMosque = $area->mosques()->create(['name' => 'Other Mosque', 'status' => 'active']);

        Customer::query()->create([
            'service_area_id' => $area->id,
            'service_area_mosque_id' => $assignedMosque->id,
            'name' => 'Fatima',
            'father_name' => 'Rahim',
            'phone' => '+93780000022',
            'house_number' => 'H-22',
            'status' => 'registered',
        ]);

        $this->putJson("/api/service-areas/{$area->id}", [
            'mosques' => [
                ['id' => $otherMosque->id, 'name' => $otherMosque->name, 'status' => 'active'],
            ],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('mosques');

        $this->assertDatabaseHas('service_area_mosques', ['id' => $assignedMosque->id]);
        $this->assertDatabaseHas('service_area_mosques', ['id' => $otherMosque->id]);
    }

    public function test_unassigned_mosques_can_be_removed_from_the_area(): void
    {
        $area = ServiceArea::query()->create([
            'name' => 'Editable Area',
            'mosque_name' => 'Old Mosque',
            'status' => 'active',
        ]);
        $mosque = $area->mosques()->create(['name' => 'Old Mosque', 'status' => 'active']);

        $this->putJson("/api/service-areas/{$area->id}", ['mosques' => []])
            ->assertOk()
            ->assertJsonCount(0, 'data.mosques')
            ->assertJsonPath('data.mosque_name', null);

        $this->assertDatabaseMissing('service_area_mosques', ['id' => $mosque->id]);
    }

    public function test_service_area_with_registered_customers_cannot_be_deleted(): void
    {
        $area = ServiceArea::query()->create(['name' => 'Customer Area', 'status' => 'active']);

        Customer::query()->create([
            'service_area_id' => $area->id,
            'name' => 'Ahmad',
            'father_name' => 'Karim',
            'phone' => '+93780000023',
            'house_number' => 'H-23',
            'status' => 'registered',
        ]);

        $this->deleteJson("/api/service-areas/{$area->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('service_area')
            ->assertJsonPath(
                'errors.service_area.0',
                'Customer Area cannot be deleted because it has 1 registered customer. Mark the service area inactive instead to preserve customer history.'
            );

        $this->assertDatabaseHas('service_areas', ['id' => $area->id, 'status' => 'active']);
        $this->assertDatabaseHas('customers', ['service_area_id' => $area->id]);
    }

    public function test_empty_service_area_can_be_deleted(): void
    {
        $area = ServiceArea::query()->create(['name' => 'Empty Area', 'status' => 'active']);
        $mosque = $area->mosques()->create(['name' => 'Temporary Mosque', 'status' => 'active']);

        $this->deleteJson("/api/service-areas/{$area->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Service area deleted.');

        $this->assertDatabaseMissing('service_areas', ['id' => $area->id]);
        $this->assertDatabaseMissing('service_area_mosques', ['id' => $mosque->id]);
    }
}
