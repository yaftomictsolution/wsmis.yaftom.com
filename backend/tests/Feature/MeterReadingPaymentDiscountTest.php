<?php

namespace Tests\Feature;

use App\Models\AccountingAccount;
use App\Models\Authority;
use App\Models\BillingPeriod;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Meter;
use App\Models\MeterAssignment;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\ServiceArea;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class MeterReadingPaymentDiscountTest extends TestCase
{
    use RefreshDatabase;

    public function test_meter_location_is_exposed_and_partial_water_payments_support_authorized_discounts_without_duplicates(): void
    {
        $adminRole = Role::findOrCreate('Admin', 'web');
        $admin = User::factory()->create(['status' => 'active']);
        $admin->assignRole($adminRole);
        Sanctum::actingAs($admin);

        $area = ServiceArea::query()->create([
            'name' => 'Karte Parwan',
            'households_count' => 20,
            'rate_per_cubic_meter' => 10,
            'status' => 'active',
        ]);
        $mosque = $area->mosques()->create([
            'name' => 'Masjid Omar',
            'status' => 'active',
        ]);
        $customer = Customer::query()->create([
            'service_area_id' => $area->id,
            'service_area_mosque_id' => $mosque->id,
            'subscription_code' => 'CUS-WATER-001',
            'name' => 'Fatima',
            'last_name' => 'Noori',
            'father_name' => 'Karim',
            'phone' => '0799001001',
            'house_number' => 'H-10',
            'opening_balance' => 0,
            'current_balance' => 0,
            'connection_fee' => 0,
            'meter_fee' => 0,
            'agreement_discount_amount' => 0,
            'agreement_paid_amount' => 0,
            'agreement_remaining_amount' => 0,
            'agreement_status' => 'active',
            'status' => 'active',
        ]);
        $meter = Meter::query()->create([
            'meter_number' => 'WM-DISCOUNT-001',
            'status' => 'installed',
        ]);
        $assignment = MeterAssignment::query()->create([
            'customer_id' => $customer->id,
            'meter_id' => $meter->id,
            'installed_by' => $admin->id,
            'initial_reading' => 0,
            'installation_date' => '2026-08-01',
            'seal_number' => 'SEAL-DISCOUNT-001',
            'status' => 'active',
        ]);
        $period = BillingPeriod::query()->create([
            'name' => 'August 2026',
            'code' => '2026-08',
            'starts_on' => '2026-08-01',
            'ends_on' => '2026-08-31',
            'status' => 'open',
        ]);
        $cashMethod = PaymentMethod::query()->firstOrCreate(
            ['code' => 'cash'],
            ['name' => 'Cash', 'status' => 'active'],
        );
        $account = AccountingAccount::query()->create([
            'name' => 'Office Cash',
            'code' => 'office_cash',
            'type' => 'cash',
            'opening_balance' => 0,
            'current_balance' => 0,
            'status' => 'active',
        ]);
        $authority = Authority::query()->create([
            'authority_number' => 'AUT-00001',
            'name' => 'Tahir Ahmad',
            'status' => 'active',
        ]);

        $this->getJson('/api/meter-assignments')
            ->assertOk()
            ->assertJsonPath('data.0.customer.service_area.id', $area->id)
            ->assertJsonPath('data.0.customer.service_area_mosque.id', $mosque->id)
            ->assertJsonPath('data.0.customer.subscription_code', 'CUS-WATER-001');

        $this->postJson('/api/meter-readings', [
            'billing_period_id' => $period->id,
            'meter_assignment_id' => $assignment->id,
            'reading_date' => '2026-08-25',
            'current_reading' => 100,
            'due_date' => '2026-08-31',
        ])->assertCreated();

        $invoice = Invoice::query()->where('meter_reading_id', '!=', null)->firstOrFail();
        $firstRequestKey = (string) Str::uuid();
        $firstPayment = [
            'customer_id' => $customer->id,
            'payment_method_id' => $cashMethod->id,
            'accounting_account_id' => $account->id,
            'discount_authority_id' => $authority->id,
            'paid_at' => '2026-08-25',
            'idempotency_key' => $firstRequestKey,
            'items' => [[
                'type' => 'invoice',
                'id' => $invoice->id,
                'amount' => 400,
                'discount_amount' => 100,
            ]],
        ];

        $this->postJson('/api/payments', $firstPayment)
            ->assertCreated()
            ->assertJsonPath('data.amount', '400.00')
            ->assertJsonPath('data.discount_amount', '100.00')
            ->assertJsonPath('data.discount_authority.id', $authority->id);

        $invoice->refresh();
        $this->assertEquals(400, (float) $invoice->paid_amount);
        $this->assertEquals(100, (float) $invoice->payment_discount_amount);
        $this->assertEquals(500, (float) $invoice->remaining_amount);
        $this->assertSame('partially_paid', $invoice->status);
        $this->assertEquals(400, (float) $account->fresh()->current_balance);

        $this->postJson('/api/payments', $firstPayment)
            ->assertOk()
            ->assertJsonPath('data.idempotency_key', $firstRequestKey);
        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseCount('payment_allocations', 1);
        $this->assertEquals(400, (float) $account->fresh()->current_balance);

        $secondPaymentId = $this->postJson('/api/payments', [
            'customer_id' => $customer->id,
            'payment_method_id' => $cashMethod->id,
            'accounting_account_id' => $account->id,
            'paid_at' => '2026-08-25',
            'idempotency_key' => (string) Str::uuid(),
            'items' => [[
                'type' => 'invoice',
                'id' => $invoice->id,
                'amount' => 500,
                'discount_amount' => 0,
            ]],
        ])->assertCreated()->json('data.id');

        $invoice->refresh();
        $this->assertSame('paid', $invoice->status);
        $this->assertEquals(900, (float) $invoice->paid_amount);
        $this->assertEquals(100, (float) $invoice->payment_discount_amount);
        $this->assertEquals(0, (float) $invoice->remaining_amount);
        $this->assertDatabaseCount('invoices', 1);
        $this->assertDatabaseCount('payments', 2);
        $this->assertEquals(900, (float) $account->fresh()->current_balance);

        $firstPaymentId = Payment::query()->where('idempotency_key', $firstRequestKey)->value('id');
        $this->putJson("/api/payments/{$firstPaymentId}", ['status' => 'cancelled'])
            ->assertOk();

        $invoice->refresh();
        $this->assertSame('partially_paid', $invoice->status);
        $this->assertEquals(500, (float) $invoice->paid_amount);
        $this->assertEquals(0, (float) $invoice->payment_discount_amount);
        $this->assertEquals(500, (float) $invoice->remaining_amount);
        $this->assertEquals(500, (float) $account->fresh()->current_balance);
        $this->assertDatabaseHas('payments', ['id' => $secondPaymentId, 'status' => 'posted']);

        $this->deleteJson("/api/authorities/{$authority->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('authority');
    }

    public function test_water_discount_requires_an_active_authority_and_cannot_be_used_on_other_invoice_types(): void
    {
        $adminRole = Role::findOrCreate('Admin', 'web');
        $admin = User::factory()->create(['status' => 'active']);
        $admin->assignRole($adminRole);
        Sanctum::actingAs($admin);

        $area = ServiceArea::query()->create([
            'name' => 'Test Area',
            'households_count' => 1,
            'rate_per_cubic_meter' => 10,
            'status' => 'active',
        ]);
        $customer = Customer::query()->create([
            'service_area_id' => $area->id,
            'name' => 'Test Customer',
            'father_name' => 'Test Father',
            'phone' => '0799002002',
            'house_number' => 'H-20',
            'opening_balance' => 0,
            'current_balance' => 100,
            'connection_fee' => 0,
            'meter_fee' => 0,
            'agreement_discount_amount' => 0,
            'agreement_paid_amount' => 0,
            'agreement_remaining_amount' => 0,
            'agreement_status' => 'active',
            'status' => 'active',
        ]);
        $method = PaymentMethod::query()->firstOrCreate(
            ['code' => 'cash'],
            ['name' => 'Cash', 'status' => 'active'],
        );
        $account = AccountingAccount::query()->create([
            'name' => 'Cash',
            'code' => 'cash_test',
            'type' => 'cash',
            'opening_balance' => 0,
            'current_balance' => 0,
            'status' => 'active',
        ]);
        $invoice = Invoice::query()->create([
            'invoice_type' => 'service',
            'customer_id' => $customer->id,
            'source_type' => 'test_service',
            'source_id' => 1,
            'invoice_number' => 'INV-S-TEST-001',
            'issue_date' => '2026-08-25',
            'total_amount' => 100,
            'remaining_amount' => 100,
            'status' => 'unpaid',
        ]);

        $this->postJson('/api/payments', [
            'customer_id' => $customer->id,
            'payment_method_id' => $method->id,
            'accounting_account_id' => $account->id,
            'paid_at' => '2026-08-25',
            'items' => [[
                'type' => 'invoice',
                'id' => $invoice->id,
                'amount' => 90,
                'discount_amount' => 10,
            ]],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('items');

        $invoice->update(['invoice_type' => 'water']);
        $this->postJson('/api/payments', [
            'customer_id' => $customer->id,
            'payment_method_id' => $method->id,
            'accounting_account_id' => $account->id,
            'paid_at' => '2026-08-25',
            'items' => [[
                'type' => 'invoice',
                'id' => $invoice->id,
                'amount' => 90,
                'discount_amount' => 10,
            ]],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('discount_authority_id');

        $inactiveAuthority = Authority::query()->create([
            'authority_number' => 'AUT-INACTIVE',
            'name' => 'Inactive Authority',
            'status' => 'inactive',
        ]);
        $this->postJson('/api/payments', [
            'customer_id' => $customer->id,
            'payment_method_id' => $method->id,
            'accounting_account_id' => $account->id,
            'discount_authority_id' => $inactiveAuthority->id,
            'paid_at' => '2026-08-25',
            'items' => [[
                'type' => 'invoice',
                'id' => $invoice->id,
                'amount' => 90,
                'discount_amount' => 10,
            ]],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('discount_authority_id');
    }
}
