<?php

namespace Tests\Feature;

use App\Models\Authority;
use App\Models\Customer;
use App\Models\ServiceArea;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AuthorityContractDiscountTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole(Role::findOrCreate('Admin', 'web'));
        Sanctum::actingAs($user);
    }

    public function test_authorities_can_be_created_updated_listed_and_deleted_when_unused(): void
    {
        $created = $this->postJson('/api/authorities', [
            'name' => 'Haji Abdullah',
            'father_name' => 'Mohammad Karim',
            'title' => 'Company Director',
            'phone' => '0799000011',
            'email' => 'abdullah@example.com',
            'status' => 'active',
        ])->assertCreated()
            ->assertJsonPath('data.authority_number', 'AUT-00001')
            ->assertJsonPath('data.name', 'Haji Abdullah')
            ->assertJsonPath('data.contracts_count', 0)
            ->json('data');

        $this->getJson('/api/authorities/options')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Haji Abdullah');

        $this->putJson("/api/authorities/{$created['id']}", [
            'name' => 'Haji Abdullah Khan',
            'father_name' => 'Mohammad Karim',
            'title' => 'Managing Director',
            'phone' => '0799000011',
            'email' => 'abdullah@example.com',
            'status' => 'inactive',
        ])->assertOk()
            ->assertJsonPath('data.name', 'Haji Abdullah Khan')
            ->assertJsonPath('data.status', 'inactive');

        $this->getJson('/api/authorities/options')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->deleteJson("/api/authorities/{$created['id']}")
            ->assertOk()
            ->assertJsonPath('message', 'Authority deleted.');

        $this->assertDatabaseMissing('authorities', ['id' => $created['id']]);
    }

    public function test_contract_discount_requires_an_active_authority_and_preserves_its_name(): void
    {
        $authority = Authority::query()->create([
            'authority_number' => 'AUT-00001',
            'name' => 'Tahir Ahmad',
            'title' => 'Discount Authority',
            'status' => 'active',
        ]);
        $customer = $this->customer('Discount Customer', '0799000021');

        $payload = [
            'subscription_date' => now()->toDateString(),
            'meter_size' => 'Half inch',
            'connection_fee' => 300,
            'meter_fee' => 100,
            'discount_amount' => 100,
            'discount_approved_by' => 'Spoofed Name',
        ];

        $this->postJson("/api/customers/{$customer->id}/contracts", $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('discount_authority_id');

        $payload['discount_authority_id'] = $authority->id;

        $contract = $this->postJson("/api/customers/{$customer->id}/contracts", $payload)
            ->assertCreated()
            ->assertJsonPath('data.discount_authority_id', $authority->id)
            ->assertJsonPath('data.discount_approved_by', 'Tahir Ahmad')
            ->assertJsonPath('data.discount_authority.name', 'Tahir Ahmad')
            ->assertJsonPath('data.net_amount', '300.00')
            ->json('data');

        $this->assertDatabaseHas('customer_contracts', [
            'id' => $contract['id'],
            'discount_authority_id' => $authority->id,
            'discount_approved_by' => 'Tahir Ahmad',
            'discount_amount' => 100,
            'net_amount' => 300,
        ]);

        $this->deleteJson("/api/authorities/{$authority->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('authority');

        $this->assertDatabaseHas('authorities', ['id' => $authority->id]);
    }

    public function test_inactive_authority_cannot_be_selected_for_a_discount(): void
    {
        $authority = Authority::query()->create([
            'authority_number' => 'AUT-00001',
            'name' => 'Inactive Authority',
            'status' => 'inactive',
        ]);
        $customer = $this->customer('Second Customer', '0799000022');

        $this->postJson("/api/customers/{$customer->id}/contracts", [
            'subscription_date' => now()->toDateString(),
            'connection_fee' => 300,
            'meter_fee' => 100,
            'discount_amount' => 50,
            'discount_authority_id' => $authority->id,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('discount_authority_id');
    }

    private function customer(string $name, string $phone): Customer
    {
        $area = ServiceArea::query()->create([
            'name' => "{$name} Area",
            'rate_per_cubic_meter' => 65,
            'status' => 'active',
        ]);

        return Customer::query()->create([
            'service_area_id' => $area->id,
            'name' => $name,
            'father_name' => 'Test Father',
            'phone' => $phone,
            'house_number' => 'H-1',
            'status' => 'registered',
        ]);
    }
}
