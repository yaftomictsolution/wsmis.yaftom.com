<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\ServiceArea;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerValidationTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_creation_requires_a_complete_minimum_identity(): void
    {
        Sanctum::actingAs(User::factory()->create(['status' => 'active']));

        $this->postJson('/api/customers', ['name' => 'Ahmad'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['service_area_id', 'father_name', 'phone', 'house_number']);
    }

    public function test_duplicate_phone_tazkira_and_house_identity_are_rejected(): void
    {
        Sanctum::actingAs(User::factory()->create(['status' => 'active']));
        $area = $this->area();

        $this->postJson('/api/customers', [
            'service_area_id' => $area->id,
            'name' => 'Ahmad',
            'last_name' => 'Karim',
            'father_name' => 'Mahmood',
            'phone' => '0781234567',
            'tazkira_number' => 'ABC 123',
            'house_number' => 'H-10',
        ])->assertCreated()
            ->assertJsonPath('data.name', 'Ahmad')
            ->assertJsonPath('data.last_name', 'Karim');

        $this->postJson('/api/customers', [
            'service_area_id' => $area->id,
            'name' => 'Another Customer',
            'last_name' => 'One',
            'father_name' => 'Another Father',
            'phone' => '+93781234567',
            'tazkira_number' => 'OTHER-001',
            'house_number' => 'H-11',
        ])->assertUnprocessable()->assertJsonValidationErrors('phone');

        $this->postJson('/api/customers', [
            'service_area_id' => $area->id,
            'name' => 'Another Customer',
            'last_name' => 'Two',
            'father_name' => 'Another Father',
            'phone' => '0791111111',
            'tazkira_number' => 'abc123',
            'house_number' => 'H-11',
        ])->assertUnprocessable()->assertJsonValidationErrors('tazkira_number');

        $this->postJson('/api/customers', [
            'service_area_id' => $area->id,
            'name' => 'Ahmad',
            'last_name' => 'Karim',
            'father_name' => 'Mahmood',
            'phone' => '0792222222',
            'tazkira_number' => 'OTHER-002',
            'house_number' => 'H-10',
        ])->assertUnprocessable()->assertJsonValidationErrors('name');

        $this->assertDatabaseCount('customers', 1);
        $this->assertDatabaseHas('customers', [
            'phone' => '+93781234567',
            'tazkira_number' => 'ABC123',
            'last_name' => 'Karim',
        ]);
    }

    public function test_creating_a_customer_keeps_all_existing_customers_in_the_index(): void
    {
        Sanctum::actingAs(User::factory()->create(['status' => 'active']));
        $area = $this->area();

        foreach ([
            ['First Customer', 'First Father', '0780000001', 'H-01'],
            ['Second Customer', 'Second Father', '0780000002', 'H-02'],
        ] as [$name, $fatherName, $phone, $houseNumber]) {
            $this->postJson('/api/customers', [
                'service_area_id' => $area->id,
                'name' => $name,
                'father_name' => $fatherName,
                'phone' => $phone,
                'house_number' => $houseNumber,
            ])->assertCreated();
        }

        $this->getJson('/api/customers')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Second Customer')
            ->assertJsonPath('data.1.name', 'First Customer');
    }

    public function test_multiple_customer_documents_can_be_uploaded_together(): void
    {
        Storage::fake('local');
        Sanctum::actingAs(User::factory()->create(['status' => 'active']));
        $customer = Customer::query()->create([
            'service_area_id' => $this->area()->id,
            'name' => 'Document Customer',
            'father_name' => 'Document Father',
            'phone' => '+93780000003',
            'house_number' => 'H-03',
            'status' => 'registered',
        ]);

        $this->post("/api/customers/{$customer->id}/documents", [
            'documents' => [
                UploadedFile::fake()->create('tazkira.jpg', 100, 'image/jpeg'),
                UploadedFile::fake()->create('application.pdf', 100, 'application/pdf'),
            ],
            'document_type' => 'Registration',
            'notes' => 'Created with the customer profile.',
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonCount(2, 'data');

        $this->assertDatabaseCount('customer_documents', 2);
        $customer->documentFiles->each(fn ($document) => Storage::disk('local')->assertExists($document->path));
    }

    private function area(): ServiceArea
    {
        return ServiceArea::query()->create([
            'name' => 'Validation Area',
            'rate_per_cubic_meter' => 65,
            'status' => 'active',
        ]);
    }
}
