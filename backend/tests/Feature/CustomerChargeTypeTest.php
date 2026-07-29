<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerChargeType;
use App\Models\CustomerContract;
use App\Models\Invoice;
use App\Models\ServiceArea;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CustomerChargeTypeTest extends TestCase
{
    use RefreshDatabase;

    public function test_charge_types_are_managed_dynamically_without_category_input(): void
    {
        $adminRole = Role::findOrCreate('Admin', 'web');
        $admin = User::factory()->create(['status' => 'active']);
        $admin->assignRole($adminRole);
        Sanctum::actingAs($admin);

        $this->getJson('/api/settings')
            ->assertOk()
            ->assertJsonCount(9, 'data.customer_charge_types');

        $systemType = CustomerChargeType::query()->where('code', 'connection_fee')->firstOrFail();
        $this->putJson("/api/customer-charge-types/{$systemType->id}", ['status' => 'inactive'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
        $this->deleteJson("/api/customer-charge-types/{$systemType->id}")
            ->assertUnprocessable();

        $typeId = $this->postJson('/api/customer-charge-types', [
            'name' => 'Inspection Visit',
            'description' => 'On-site customer inspection charge.',
        ])->assertCreated()
            ->assertJsonPath('data.code', 'inspection_visit')
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.is_system', false)
            ->json('data.id');

        $this->putJson("/api/customer-charge-types/{$typeId}", [
            'name' => 'Technical Inspection Visit',
            'status' => 'active',
        ])->assertOk()
            ->assertJsonPath('data.name', 'Technical Inspection Visit')
            ->assertJsonPath('data.code', 'inspection_visit');

        $area = ServiceArea::query()->create([
            'name' => 'Charge Type Area',
            'rate_per_cubic_meter' => 65,
            'status' => 'active',
        ]);
        $customer = Customer::query()->create([
            'service_area_id' => $area->id,
            'name' => 'Charge Type Customer',
            'status' => 'active',
            'agreement_status' => 'active',
            'current_balance' => 0,
        ]);
        CustomerContract::query()->create([
            'customer_id' => $customer->id,
            'created_by' => $admin->id,
            'contract_number' => 'CTR-CHARGE-TYPE-TEST',
            'status' => 'active',
        ]);

        $chargeId = $this->postJson("/api/customers/{$customer->id}/charges", [
            'customer_charge_type_id' => $typeId,
            'title' => 'Site inspection',
            'amount' => 350,
            'charge_date' => '2026-07-18',
            'notes' => 'Requested by customer.',
        ])->assertCreated()
            ->assertJsonPath('data.type', 'inspection_visit')
            ->assertJsonPath('data.charge_type.id', $typeId)
            ->assertJsonPath('data.charge_type.name', 'Technical Inspection Visit')
            ->json('data.id');

        $this->assertDatabaseHas('customer_charges', [
            'id' => $chargeId,
            'customer_charge_type_id' => $typeId,
            'type' => 'inspection_visit',
            'amount' => 350,
        ]);
        $this->assertDatabaseHas('financial_categories', [
            'code' => 'customer_charge_income',
            'type' => 'income',
        ]);
        $this->assertDatabaseHas('invoices', [
            'customer_id' => $customer->id,
            'invoice_type' => 'service',
            'source_type' => 'customer_charge',
            'source_id' => $chargeId,
            'total_amount' => 350,
            'remaining_amount' => 350,
            'status' => 'unpaid',
        ]);
        $this->assertEquals($chargeId, Invoice::query()->where('source_type', 'customer_charge')->firstOrFail()->items()->value('customer_charge_id'));
        $this->assertEquals(350, (float) $customer->fresh()->current_balance);

        $this->getJson("/api/customers/{$customer->id}/detail")
            ->assertOk()
            ->assertJsonPath('data.customer.charges.0.charge_type.name', 'Technical Inspection Visit');

        $this->deleteJson("/api/customer-charge-types/{$typeId}")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'A charge type used by customer history cannot be deleted. Set it inactive instead.');

        $unusedTypeId = $this->postJson('/api/customer-charge-types', [
            'name' => 'Temporary Charge Type',
        ])->assertCreated()->json('data.id');
        $this->deleteJson("/api/customer-charge-types/{$unusedTypeId}")
            ->assertOk();
        $this->assertDatabaseMissing('customer_charge_types', ['id' => $unusedTypeId]);
    }
}
