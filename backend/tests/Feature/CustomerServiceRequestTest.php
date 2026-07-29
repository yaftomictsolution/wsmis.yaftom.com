<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerContract;
use App\Models\ServiceArea;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CustomerServiceRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_legacy_approved_customer_can_create_an_assigned_request(): void
    {
        $creator = User::factory()->create(['name' => 'Office User', 'status' => 'active']);
        $technician = User::factory()->create(['name' => 'Field Technician', 'status' => 'active']);
        $technician->assignRole(Role::findOrCreate('Technician', 'web'));
        $customer = $this->customer('approved');

        Sanctum::actingAs($creator);

        $response = $this->postJson("/api/customers/{$customer->id}/service-requests", [
            'assigned_to' => $technician->id,
            'type' => 'low_pressure',
            'priority' => 'high',
            'description' => 'Water pressure drops every evening.',
            'requested_at' => '2026-07-20',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.status', 'assigned')
            ->assertJsonPath('data.assignee.id', $technician->id);

        $requestId = $response->json('data.id');
        $this->assertDatabaseHas('customer_service_requests', [
            'id' => $requestId,
            'customer_id' => $customer->id,
            'assigned_to' => $technician->id,
            'created_by' => $creator->id,
            'status' => 'assigned',
        ]);

        $notification = $technician->notifications()->firstOrFail();
        $this->assertSame('service_request_assigned', $notification->data['event']);
        $this->assertSame("/dashboard/customers/{$customer->id}?tab=requests", $notification->data['href']);
        $this->assertSame($requestId, $notification->data['service_request_id']);
        $this->assertCount(0, $creator->notifications()->get());
    }

    public function test_request_assignment_rejects_a_user_who_is_not_an_active_technician(): void
    {
        $creator = User::factory()->create(['status' => 'active']);
        $nonTechnician = User::factory()->create(['status' => 'active']);
        $customer = $this->customer('active');
        CustomerContract::query()->create([
            'customer_id' => $customer->id,
            'created_by' => $creator->id,
            'contract_number' => 'CTR-SERVICE-REQUEST-ACTIVE',
            'status' => 'active',
        ]);

        Sanctum::actingAs($creator);

        $this->postJson("/api/customers/{$customer->id}/service-requests", [
            'assigned_to' => $nonTechnician->id,
            'type' => 'leak',
            'priority' => 'urgent',
            'description' => 'A service pipe is leaking.',
            'requested_at' => '2026-07-20',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('assigned_to')
            ->assertJsonPath('errors.assigned_to.0', 'Select an active technician.');

        $this->assertDatabaseCount('customer_service_requests', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_cancelled_latest_contract_still_blocks_customer_operations(): void
    {
        $creator = User::factory()->create(['status' => 'active']);
        $customer = $this->customer('active');
        CustomerContract::query()->create([
            'customer_id' => $customer->id,
            'created_by' => $creator->id,
            'contract_number' => 'CTR-SERVICE-REQUEST-CANCELLED',
            'status' => 'cancelled',
        ]);

        Sanctum::actingAs($creator);

        $this->postJson("/api/customers/{$customer->id}/service-requests", [
            'type' => 'complaint',
            'priority' => 'normal',
            'description' => 'This request must remain blocked.',
            'requested_at' => '2026-07-20',
        ])->assertUnprocessable()
            ->assertJsonPath('message', 'Customer contract must be confirmed before this workflow can continue.');

        $this->assertDatabaseCount('customer_service_requests', 0);
    }

    private function customer(string $agreementStatus): Customer
    {
        $area = ServiceArea::query()->create([
            'name' => 'Service Request Area',
            'rate_per_cubic_meter' => 65,
            'status' => 'active',
        ]);

        return Customer::query()->create([
            'service_area_id' => $area->id,
            'name' => 'Test Customer',
            'status' => 'active',
            'agreement_status' => $agreementStatus,
        ]);
    }
}
