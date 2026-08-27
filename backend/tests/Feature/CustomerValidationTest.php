<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerContract;
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

    public function test_subscription_code_is_generated_by_the_system_and_cannot_be_overridden(): void
    {
        Sanctum::actingAs(User::factory()->create(['status' => 'active']));

        $response = $this->postJson('/api/customers', [
            'service_area_id' => $this->area()->id,
            'subscription_code' => 'MANUAL-CODE',
            'name' => 'System Code Customer',
            'father_name' => 'System Code Father',
            'phone' => '0780000010',
            'house_number' => 'H-10',
        ])->assertCreated();

        $customerId = $response->json('data.id');
        $generatedCode = $response->json('data.subscription_code');

        $this->assertMatchesRegularExpression('/^CUS-\d{6}(?:-\d+)?$/', $generatedCode);
        $this->assertNotSame('MANUAL-CODE', $generatedCode);

        $this->patchJson("/api/customers/{$customerId}", [
            'subscription_code' => 'REPLACEMENT-CODE',
            'notes' => 'Updated without changing the system code.',
        ])->assertOk()
            ->assertJsonPath('data.subscription_code', $generatedCode);

        $this->assertDatabaseHas('customers', [
            'id' => $customerId,
            'subscription_code' => $generatedCode,
        ]);
    }

    public function test_customer_index_returns_a_lightweight_row_summary(): void
    {
        Sanctum::actingAs(User::factory()->create(['status' => 'active']));
        $area = $this->area();
        $customer = Customer::query()->create([
            'service_area_id' => $area->id,
            'name' => 'Summary Customer',
            'father_name' => 'Summary Father',
            'phone' => '+93780000005',
            'house_number' => 'H-05',
            'status' => 'registered',
        ]);
        CustomerContract::query()->create([
            'customer_id' => $customer->id,
            'contract_number' => 'CTR-SUMMARY-0001',
            'connection_fee' => 300,
            'meter_fee' => 100,
            'net_amount' => 400,
            'remaining_amount' => 250,
            'status' => 'installation_pending',
        ]);

        $this->getJson('/api/customers')
            ->assertOk()
            ->assertJsonPath('data.0.service_area.name', 'Validation Area')
            ->assertJsonPath('data.0.latest_contract.contract_number', 'CTR-SUMMARY-0001')
            ->assertJsonPath('data.0.latest_contract.paid_amount', 150)
            ->assertJsonPath('data.0.latest_contract.payment_status', 'partially_paid')
            ->assertJsonMissingPath('data.0.meter_assignments')
            ->assertJsonMissingPath('data.0.latest_contract.deposits')
            ->assertJsonMissingPath('data.0.latest_contract.submitter');
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

    public function test_customer_photo_can_be_uploaded_viewed_replaced_and_removed(): void
    {
        Storage::fake('local');
        Sanctum::actingAs(User::factory()->create(['status' => 'active']));
        $customer = Customer::query()->create([
            'service_area_id' => $this->area()->id,
            'name' => 'Photo Customer',
            'father_name' => 'Photo Father',
            'phone' => '+93780000004',
            'house_number' => 'H-04',
            'status' => 'registered',
        ]);

        $this->post("/api/customers/{$customer->id}/photo", [
            'photo' => UploadedFile::fake()->create('customer-one.jpg', 120, 'image/jpeg'),
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.has_photo', true)
            ->assertJsonMissingPath('data.photo_path');

        $firstPath = $customer->fresh()->photo_path;
        Storage::disk('local')->assertExists($firstPath);

        $this->get("/api/customers/{$customer->id}/photo")
            ->assertOk()
            ->assertHeader('content-type', 'image/jpeg');

        $this->post("/api/customers/{$customer->id}/photo", [
            'photo' => UploadedFile::fake()->create('customer-two.png', 120, 'image/png'),
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.photo_original_name', 'customer-two.png');

        Storage::disk('local')->assertMissing($firstPath);
        Storage::disk('local')->assertExists($customer->fresh()->photo_path);

        $this->deleteJson("/api/customers/{$customer->id}/photo")
            ->assertOk()
            ->assertJsonPath('data.has_photo', false);

        $this->assertNull($customer->fresh()->photo_path);
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
