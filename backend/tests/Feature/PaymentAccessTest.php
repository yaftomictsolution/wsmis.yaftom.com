<?php

namespace Tests\Feature;

use App\Models\AccountingAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PaymentAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_collectors_can_load_receiving_accounts_without_full_accounting_access(): void
    {
        $viewPermission = Permission::findOrCreate('payments.view', 'web');
        $createPermission = Permission::findOrCreate('payments.create', 'web');
        $collectorRole = Role::findOrCreate('Collector', 'web');
        $collectorRole->givePermissionTo([$viewPermission, $createPermission]);
        $collector = User::factory()->create(['status' => 'active']);
        $collector->assignRole($collectorRole);

        $account = AccountingAccount::query()->create([
            'name' => 'Collection Desk',
            'code' => 'collection_desk',
            'type' => 'cash',
            'opening_balance' => 1000,
            'current_balance' => 1000,
            'status' => 'active',
        ]);

        Sanctum::actingAs($collector);

        $this->getJson('/api/payments/receiving-accounts')
            ->assertOk()
            ->assertJsonFragment([
                'id' => $account->id,
                'name' => 'Collection Desk',
                'code' => 'collection_desk',
                'type' => 'cash',
                'current_balance' => '1000.00',
                'status' => 'active',
            ]);

        $this->getJson('/api/accounting/accounts')->assertForbidden();
    }

    public function test_technicians_cannot_access_or_post_customer_payments(): void
    {
        $technicianRole = Role::findOrCreate('Technician', 'web');
        $technician = User::factory()->create(['status' => 'active']);
        $technician->assignRole($technicianRole);
        Sanctum::actingAs($technician);

        $this->getJson('/api/payments')->assertForbidden();
        $this->getJson('/api/payments/receiving-accounts')->assertForbidden();
        $this->postJson('/api/payments', [])->assertForbidden();
    }
}
