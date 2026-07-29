<?php

namespace Tests\Feature;

use App\Models\AccountingAccount;
use App\Models\BillingPeriod;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Meter;
use App\Models\MeterSeal;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\PaymentMethod;
use App\Models\ServiceArea;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CustomerContractAccountingTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_registration_is_separate_from_contract_and_finance(): void
    {
        [$manager] = $this->users();
        [$area] = $this->collectionSetup();
        Sanctum::actingAs($manager);

        $this->postJson('/api/customers', [
            'service_area_id' => $area->id,
            'name' => 'Ahmad',
            'last_name' => 'Karim',
            'father_name' => 'Karim',
            'phone' => '0799000001',
            'house_number' => 'H-10',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'registered')
            ->assertJsonPath('data.current_balance', '0.00');

        $this->assertDatabaseCount('customer_contracts', 0);
        $this->assertDatabaseCount('customer_deposits', 0);
        $this->assertDatabaseCount('accounting_transactions', 0);
    }

    public function test_cancelled_contract_remains_in_history_after_a_new_contract_is_created(): void
    {
        [$manager] = $this->users();
        [$area] = $this->collectionSetup();
        $customer = $this->customer($area, 'Contract History Customer');
        Sanctum::actingAs($manager);

        $firstContract = $this->postJson("/api/customers/{$customer->id}/contracts", [
            'subscription_date' => '2026-07-10',
            'meter_size' => 'Half inch',
            'connection_fee' => 1000,
            'meter_fee' => 500,
        ])->assertCreated()->json('data');

        $this->postJson("/api/customer-contracts/{$firstContract['id']}/cancel", [
            'reason' => 'Customer requested corrected contract terms.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.rejection_reason', 'Customer requested corrected contract terms.');

        $secondContract = $this->postJson("/api/customers/{$customer->id}/contracts", [
            'subscription_date' => '2026-07-18',
            'meter_size' => 'Half inch',
            'connection_fee' => 1200,
            'meter_fee' => 600,
        ])->assertCreated()->json('data');

        $this->getJson("/api/customers/{$customer->id}/detail")
            ->assertOk()
            ->assertJsonCount(2, 'data.customer.contracts')
            ->assertJsonPath('data.customer.contracts.0.id', $secondContract['id'])
            ->assertJsonPath('data.customer.contracts.0.status', 'draft')
            ->assertJsonPath('data.customer.contracts.1.id', $firstContract['id'])
            ->assertJsonPath('data.customer.contracts.1.status', 'cancelled')
            ->assertJsonPath('data.customer.contracts.1.updater.id', $manager->id);
    }

    public function test_contract_confirmation_creates_invoice_and_notifies_only_admins_without_approval(): void
    {
        [$manager, $admin] = $this->users();
        [$area, $cashMethod, $cashAccount] = $this->collectionSetup();
        $customer = $this->customer($area, 'Notification Customer');
        Sanctum::actingAs($manager);

        $contract = $this->postJson("/api/customers/{$customer->id}/contracts", [
            'subscription_date' => '2026-07-19',
            'meter_size' => 'Half inch',
            'connection_fee' => 1000,
            'meter_fee' => 500,
            'required_initial_payment' => 1000,
        ])->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.required_initial_payment', '0.00')
            ->json('data');

        $this->postJson("/api/customer-contracts/{$contract['id']}/confirm")
            ->assertOk()
            ->assertJsonPath('data.status', 'installation_pending')
            ->assertJsonPath('data.confirmer.id', $manager->id)
            ->assertJsonPath('data.invoice.invoice_type', 'contract')
            ->assertJsonPath('data.invoice.total_amount', '1500.00');

        $this->assertDatabaseHas('customers', [
            'id' => $customer->id,
            'status' => 'awaiting_installation',
            'agreement_status' => 'installation_pending',
        ]);
        $this->assertDatabaseCount('customer_deposits', 0);
        $this->assertDatabaseCount('customer_charges', 2);
        $this->assertDatabaseCount('invoices', 1);
        $this->assertCount(0, $manager->notifications()->get());
        $this->assertCount(1, $admin->notifications()->get());

        Sanctum::actingAs($admin);
        $notificationId = $admin->notifications()->firstOrFail()->id;
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonPath('data.0.id', $notificationId)
            ->assertJsonPath('data.0.data.event', 'customer_contract_confirmed')
            ->assertJsonPath('data.0.data.customer_id', $customer->id)
            ->assertJsonPath('data.0.data.href', "/dashboard/customers/{$customer->id}?tab=contract");
        $this->postJson("/api/notifications/{$notificationId}/read")
            ->assertOk()
            ->assertJsonPath('data.id', $notificationId);
        $this->assertNotNull($admin->notifications()->whereKey($notificationId)->value('read_at'));

        Sanctum::actingAs($manager);
        $this->postJson("/api/customer-contracts/{$contract['id']}/approve")->assertNotFound();
        $this->postJson("/api/customer-contracts/{$contract['id']}/reject", ['rejection_reason' => 'Not used'])->assertNotFound();
        $this->postJson("/api/customer-contracts/{$contract['id']}/deposits", [])->assertNotFound();
    }

    public function test_contract_confirmation_links_an_existing_active_legacy_meter_and_activates_service(): void
    {
        [$manager] = $this->users();
        [$area] = $this->collectionSetup();
        $customer = $this->customer($area, 'Legacy Meter Customer');
        $meter = Meter::query()->create(['meter_number' => 'WM-LEGACY-001', 'status' => 'installed']);
        $assignment = $customer->meterAssignments()->create([
            'meter_id' => $meter->id,
            'installed_by' => $manager->id,
            'installation_date' => '2026-05-21',
            'initial_reading' => 0,
            'seal_number' => 'SEAL-LEGACY-001',
            'status' => 'active',
        ]);
        Sanctum::actingAs($manager);

        $contractId = $this->postJson("/api/customers/{$customer->id}/contracts", [
            'subscription_date' => '2026-07-19',
            'connection_fee' => 100,
            'meter_fee' => 100,
        ])->assertCreated()->json('data.id');

        $this->postJson("/api/customer-contracts/{$contractId}/confirm")
            ->assertOk()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.meter_assignments.0.id', $assignment->id);

        $this->assertDatabaseHas('meter_assignments', [
            'id' => $assignment->id,
            'customer_contract_id' => $contractId,
            'status' => 'active',
        ]);
        $this->assertDatabaseHas('customer_contracts', ['id' => $contractId, 'status' => 'active']);
        $this->assertDatabaseHas('customers', ['id' => $customer->id, 'status' => 'active', 'agreement_status' => 'active']);
    }

    public function test_contract_invoice_supports_partial_payments_before_and_after_meter_installation(): void
    {
        [$manager] = $this->users();
        [$area, $cashMethod, $cashAccount] = $this->collectionSetup();
        $customer = $this->customer($area, 'Partial Payment Customer');
        Sanctum::actingAs($manager);

        $contractId = $this->postJson("/api/customers/{$customer->id}/contracts", [
            'subscription_date' => '2026-07-19',
            'connection_fee' => 200,
            'meter_fee' => 200,
        ])->assertCreated()->json('data.id');
        $this->postJson("/api/customer-contracts/{$contractId}/confirm")
            ->assertOk()
            ->assertJsonPath('data.status', 'installation_pending');

        $invoice = Invoice::query()->where('customer_contract_id', $contractId)->firstOrFail();
        $firstPaymentId = $this->postJson('/api/payments', [
            'customer_id' => $customer->id,
            'payment_method_id' => $cashMethod->id,
            'accounting_account_id' => $cashAccount->id,
            'paid_at' => '2026-07-19',
            'items' => [['type' => 'invoice', 'id' => $invoice->id, 'amount' => 200]],
        ])->assertCreated()
            ->assertJsonPath('data.amount', '200.00')
            ->json('data.id');

        $this->getJson("/api/customer-contracts/{$contractId}")
            ->assertOk()
            ->assertJsonPath('data.paid_amount', 200)
            ->assertJsonPath('data.remaining_amount', '200.00')
            ->assertJsonPath('data.payment_status', 'partially_paid');
        $this->assertDatabaseHas('customer_contracts', [
            'id' => $contractId,
            'status' => 'installation_pending',
        ]);
        $this->assertEquals(200, (float) $cashAccount->fresh()->current_balance);
        $this->assertEquals(200, (float) $customer->fresh()->current_balance);

        $meter = Meter::query()->create(['meter_number' => 'WM-PARTIAL-001', 'status' => 'available']);
        $this->postJson('/api/meter-assignments', [
            'customer_id' => $customer->id,
            'customer_contract_id' => $contractId,
            'meter_id' => $meter->id,
            'initial_reading' => 0,
            'installation_date' => '2026-07-19',
            'seal_number' => 'SEAL-PARTIAL-001',
        ])->assertCreated()
            ->assertJsonPath('data.contract.status', 'active');

        $this->postJson('/api/payments', [
            'customer_id' => $customer->id,
            'payment_method_id' => $cashMethod->id,
            'accounting_account_id' => $cashAccount->id,
            'paid_at' => '2026-07-20',
            'items' => [['type' => 'invoice', 'id' => $invoice->id, 'amount' => 200]],
        ])->assertCreated();

        $this->getJson("/api/customer-contracts/{$contractId}")
            ->assertOk()
            ->assertJsonPath('data.paid_amount', 400)
            ->assertJsonPath('data.remaining_amount', '0.00')
            ->assertJsonPath('data.payment_status', 'paid');
        $this->assertEquals(400, (float) $cashAccount->fresh()->current_balance);
        $this->assertEquals(0, (float) $customer->fresh()->current_balance);

        $this->putJson("/api/payments/{$firstPaymentId}", ['status' => 'cancelled'])
            ->assertOk();
        $this->assertEquals(200, (float) $customer->fresh()->current_balance);
    }

    public function test_paid_contract_can_be_refunded_and_cancelled_atomically(): void
    {
        [$manager] = $this->users();
        [$area, $cashMethod, $cashAccount] = $this->collectionSetup();
        $customer = $this->customer($area, 'Refunded Contract Customer');
        Sanctum::actingAs($manager);

        $contractId = $this->postJson("/api/customers/{$customer->id}/contracts", [
            'subscription_date' => '2026-07-19',
            'connection_fee' => 200,
            'meter_fee' => 200,
        ])->assertCreated()->json('data.id');
        $this->postJson("/api/customer-contracts/{$contractId}/confirm")->assertOk();

        $invoice = Invoice::query()->where('customer_contract_id', $contractId)->firstOrFail();
        $paymentId = $this->postJson('/api/payments', [
            'customer_id' => $customer->id,
            'payment_method_id' => $cashMethod->id,
            'accounting_account_id' => $cashAccount->id,
            'paid_at' => '2026-07-19',
            'items' => [['type' => 'invoice', 'id' => $invoice->id, 'amount' => 400]],
        ])->assertCreated()->json('data.id');
        $this->assertEquals(400, (float) $cashAccount->fresh()->current_balance);

        $this->postJson("/api/customer-contracts/{$contractId}/cancel", [
            'reason' => 'Customer withdrew before meter installation.',
        ])->assertUnprocessable()
            ->assertJsonPath('message', 'This contract has posted payments. Confirm the customer refund in the cancellation form before cancelling the contract.');
        $this->assertDatabaseHas('payments', ['id' => $paymentId, 'status' => 'posted']);
        $this->assertDatabaseHas('customer_contracts', ['id' => $contractId, 'status' => 'installation_pending']);

        $this->postJson("/api/customer-contracts/{$contractId}/cancel", [
            'reason' => 'Customer withdrew before meter installation.',
            'refund_posted_payments' => true,
            'refunded_at' => '2026-07-20',
            'refund_reference' => 'RETURNED-CASH-001',
        ])->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.invoice.status', 'cancelled')
            ->assertJsonPath('data.invoice.allocations.0.payment.status', 'refunded')
            ->assertJsonPath('data.invoice.allocations.0.payment.refunded_amount', '400.00');

        $payment = Payment::query()->findOrFail($paymentId);
        $allocation = PaymentAllocation::query()->where('payment_id', $paymentId)->where('invoice_id', $invoice->id)->firstOrFail();
        $this->assertStringStartsWith('PRF-', (string) $payment->refund_receipt_number);
        $this->assertEquals('RETURNED-CASH-001', $payment->refund_reference);
        $this->assertEquals(400, (float) $allocation->fresh()->refunded_amount);
        $this->assertDatabaseHas('accounting_transactions', [
            'source_type' => 'customer_payment_allocation_refund',
            'source_id' => $allocation->id,
            'type' => 'customer_refund',
            'amount' => 400,
            'status' => 'approved',
        ]);
        $this->assertEquals(0, (float) $cashAccount->fresh()->current_balance);
        $this->assertEquals(0, (float) $customer->fresh()->current_balance);
        $this->assertEquals('registered', $customer->fresh()->status);
    }

    public function test_active_contract_can_be_refunded_cancelled_and_meter_history_closed(): void
    {
        [$manager] = $this->users();
        [$area, $cashMethod, $cashAccount] = $this->collectionSetup();
        $customer = $this->customer($area, 'Active Cancel Customer');
        Sanctum::actingAs($manager);

        $contractId = $this->postJson("/api/customers/{$customer->id}/contracts", [
            'subscription_date' => '2026-07-19',
            'connection_fee' => 150,
            'meter_fee' => 50,
        ])->assertCreated()->json('data.id');
        $this->postJson("/api/customer-contracts/{$contractId}/confirm")->assertOk();

        $meter = Meter::query()->create(['meter_number' => 'WM-CANCEL-ACTIVE-001', 'status' => 'available']);
        $assignmentId = $this->postJson('/api/meter-assignments', [
            'customer_id' => $customer->id,
            'customer_contract_id' => $contractId,
            'meter_id' => $meter->id,
            'initial_reading' => 0,
            'installation_date' => '2026-07-19',
            'seal_number' => 'SEAL-CANCEL-ACTIVE-001',
        ])->assertCreated()
            ->assertJsonPath('data.contract.status', 'active')
            ->json('data.id');

        $invoice = Invoice::query()->where('customer_contract_id', $contractId)->firstOrFail();
        $paymentId = $this->postJson('/api/payments', [
            'customer_id' => $customer->id,
            'payment_method_id' => $cashMethod->id,
            'accounting_account_id' => $cashAccount->id,
            'paid_at' => '2026-07-19',
            'items' => [['type' => 'invoice', 'id' => $invoice->id, 'amount' => 200]],
        ])->assertCreated()->json('data.id');
        $this->assertEquals(200, (float) $cashAccount->fresh()->current_balance);
        $this->getJson("/api/customers/{$customer->id}/detail")
            ->assertOk()
            ->assertJsonPath('data.customer.latest_contract.invoice.allocations.0.payment.status', 'posted')
            ->assertJsonPath('data.customer.latest_contract.invoice.allocations.0.payment.amount', '200.00');

        $this->postJson("/api/customer-contracts/{$contractId}/cancel", [
            'reason' => 'Customer moved away after installation.',
            'refund_posted_payments' => true,
            'refunded_at' => '2026-07-20',
            'refund_reference' => 'ACTIVE-REFUND-001',
        ])->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.invoice.status', 'cancelled');

        $this->assertDatabaseHas('payments', [
            'id' => $paymentId,
            'status' => 'refunded',
            'refund_reference' => 'ACTIVE-REFUND-001',
        ]);
        $this->assertDatabaseHas('meter_assignments', [
            'id' => $assignmentId,
            'customer_contract_id' => $contractId,
            'status' => 'removed',
        ]);
        $this->assertDatabaseHas('meter_seals', [
            'meter_assignment_id' => $assignmentId,
            'seal_number' => 'SEAL-CANCEL-ACTIVE-001',
            'status' => 'removed',
            'removed_by' => $manager->id,
        ]);
        $this->assertDatabaseHas('meters', ['id' => $meter->id, 'status' => 'available']);
        $this->assertDatabaseHas('customers', [
            'id' => $customer->id,
            'status' => 'registered',
            'agreement_status' => 'cancelled',
        ]);
        $this->assertEquals(0, (float) $cashAccount->fresh()->current_balance);
        $this->assertEquals(0, (float) $customer->fresh()->current_balance);
    }

    public function test_contract_cancellation_partially_refunds_mixed_receipt_without_reversing_other_invoices(): void
    {
        [$manager] = $this->users();
        [$area, $cashMethod, $cashAccount] = $this->collectionSetup();
        $customer = $this->customer($area, 'Mixed Receipt Customer');
        Sanctum::actingAs($manager);

        $contractId = $this->postJson("/api/customers/{$customer->id}/contracts", [
            'subscription_date' => '2026-07-19',
            'connection_fee' => 150,
            'meter_fee' => 50,
        ])->assertCreated()->json('data.id');
        $this->postJson("/api/customer-contracts/{$contractId}/confirm")->assertOk();

        $meter = Meter::query()->create(['meter_number' => 'WM-MIXED-001', 'status' => 'available']);
        $assignmentId = $this->postJson('/api/meter-assignments', [
            'customer_id' => $customer->id,
            'customer_contract_id' => $contractId,
            'meter_id' => $meter->id,
            'initial_reading' => 0,
            'installation_date' => '2026-07-19',
            'seal_number' => 'SEAL-MIXED-001',
        ])->assertCreated()->json('data.id');

        $period = BillingPeriod::query()->create([
            'name' => 'Mixed July 2026',
            'code' => '2026-07-MIXED',
            'starts_on' => '2026-07-01',
            'ends_on' => '2026-07-31',
            'status' => 'open',
        ]);
        $readingId = $this->postJson('/api/meter-readings', [
            'billing_period_id' => $period->id,
            'meter_assignment_id' => $assignmentId,
            'reading_date' => '2026-07-20',
            'current_reading' => 5,
            'due_date' => '2026-07-31',
            'status' => 'recorded',
        ])->assertCreated()->json('data.id');

        $contractInvoice = Invoice::query()->where('customer_contract_id', $contractId)->firstOrFail();
        $waterInvoice = Invoice::query()->where('meter_reading_id', $readingId)->firstOrFail();
        $paymentId = $this->postJson('/api/payments', [
            'customer_id' => $customer->id,
            'payment_method_id' => $cashMethod->id,
            'accounting_account_id' => $cashAccount->id,
            'paid_at' => '2026-07-20',
            'items' => [
                ['type' => 'invoice', 'id' => $waterInvoice->id, 'amount' => (float) $waterInvoice->remaining_amount],
                ['type' => 'invoice', 'id' => $contractInvoice->id, 'amount' => (float) $contractInvoice->remaining_amount],
            ],
        ])->assertCreated()->json('data.id');

        $contractAllocation = PaymentAllocation::query()
            ->where('payment_id', $paymentId)
            ->where('invoice_id', $contractInvoice->id)
            ->firstOrFail();
        $waterAllocation = PaymentAllocation::query()
            ->where('payment_id', $paymentId)
            ->where('invoice_id', $waterInvoice->id)
            ->firstOrFail();

        $this->postJson("/api/customer-contracts/{$contractId}/cancel", [
            'reason' => 'Customer cancelled the contract after a mixed receipt was posted.',
            'refund_posted_payments' => true,
            'refunded_at' => '2026-07-21',
            'refund_reference' => 'MIXED-REFUND-001',
        ])->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.invoice.status', 'cancelled');

        $this->assertDatabaseHas('payments', [
            'id' => $paymentId,
            'status' => 'posted',
            'refunded_amount' => 200,
            'refund_reference' => 'MIXED-REFUND-001',
        ]);
        $this->assertDatabaseHas('payment_allocations', [
            'id' => $contractAllocation->id,
            'amount' => 200,
            'refunded_amount' => 200,
            'refund_reference' => 'MIXED-REFUND-001',
        ]);
        $this->assertDatabaseHas('payment_allocations', [
            'id' => $waterAllocation->id,
            'amount' => 325,
            'refunded_amount' => 0,
        ]);
        $this->assertDatabaseHas('accounting_transactions', [
            'source_type' => 'customer_payment_allocation_refund',
            'source_id' => $contractAllocation->id,
            'type' => 'customer_refund',
            'amount' => 200,
            'status' => 'approved',
        ]);
        $this->assertDatabaseHas('invoices', [
            'id' => $waterInvoice->id,
            'status' => 'paid',
            'paid_amount' => 325,
            'remaining_amount' => 0,
        ]);
        $this->assertDatabaseHas('meters', ['id' => $meter->id, 'status' => 'available']);
        $this->assertEquals(325, (float) $cashAccount->fresh()->current_balance);
        $this->assertEquals(0, (float) $customer->fresh()->current_balance);
    }

    public function test_meter_installation_and_resealing_keep_a_complete_seal_history(): void
    {
        Storage::fake('local');
        [$manager, $admin] = $this->users();
        [$area] = $this->collectionSetup();
        $customer = $this->customer($area, 'Seal History');
        Sanctum::actingAs($manager);

        $contractId = $this->postJson("/api/customers/{$customer->id}/contracts", [
            'subscription_date' => '2026-07-19',
            'connection_fee' => 1000,
            'meter_fee' => 500,
        ])->assertCreated()->json('data.id');
        $this->postJson("/api/customer-contracts/{$contractId}/confirm")->assertOk();

        $meter = Meter::query()->create(['meter_number' => 'WM-SEAL-001', 'status' => 'available']);
        $assignmentPayload = [
            'customer_id' => $customer->id,
            'customer_contract_id' => $contractId,
            'meter_id' => $meter->id,
            'initial_reading' => 0,
            'installation_date' => '2026-07-19',
            'sealed_at' => '2026-07-19',
        ];

        $this->postJson('/api/meter-assignments', $assignmentPayload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('seal_number');

        $assignmentId = $this->post('/api/meter-assignments', $assignmentPayload + [
            'installed_by' => $admin->id,
            'sealed_by' => $admin->id,
            'seal_number' => 'SEAL-AUDIT-001',
            'seal_photo' => $this->fakeSealImage('first-seal.png'),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.installer.id', $manager->id)
            ->assertJsonPath('data.seals.0.sealer.id', $manager->id)
            ->assertJsonPath('data.seals.0.status', 'intact')
            ->json('data.id');

        $firstSeal = MeterSeal::query()->where('seal_number', 'SEAL-AUDIT-001')->firstOrFail();
        Storage::disk('local')->assertExists($firstSeal->photo_path);

        $this->post("/api/meter-assignments/{$assignmentId}/seals", [
            'seal_number' => 'SEAL-AUDIT-002',
            'sealed_at' => '2026-07-20',
            'sealed_by' => $admin->id,
            'previous_seal_status' => 'broken',
            'removal_reason' => 'Seal wire was damaged during inspection.',
            'seal_photo' => $this->fakeSealImage('replacement-seal.png'),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonCount(2, 'data.seals')
            ->assertJsonPath('data.seals.0.sealer.id', $manager->id)
            ->assertJsonPath('data.seals.1.status', 'broken');

        $this->assertDatabaseHas('meter_seals', [
            'id' => $firstSeal->id,
            'status' => 'broken',
            'removal_reason' => 'Seal wire was damaged during inspection.',
        ]);
        $this->assertDatabaseHas('meter_assignments', ['id' => $assignmentId, 'installed_by' => $manager->id]);

        $period = BillingPeriod::query()->create([
            'name' => 'July 2026',
            'code' => '2026-07-TEST',
            'starts_on' => '2026-07-01',
            'ends_on' => '2026-07-31',
            'status' => 'open',
        ]);
        $readingId = $this->postJson('/api/meter-readings', [
            'billing_period_id' => $period->id,
            'meter_assignment_id' => $assignmentId,
            'read_by' => $admin->id,
            'reading_date' => '2026-07-20',
            'current_reading' => 10,
            'due_date' => '2026-07-31',
            'status' => 'recorded',
        ])->assertCreated()
            ->assertJsonPath('data.reader.id', $manager->id)
            ->json('data.id');

        $this->assertDatabaseHas('meter_readings', ['id' => $readingId, 'read_by' => $manager->id]);
    }

    private function users(): array
    {
        $managerRole = Role::findOrCreate('Manager', 'web');
        $adminRole = Role::findOrCreate('Admin', 'web');
        $manager = User::factory()->create(['status' => 'active']);
        $admin = User::factory()->create(['status' => 'active']);
        $manager->assignRole($managerRole);
        $admin->assignRole($adminRole);

        return [$manager, $admin];
    }

    private function collectionSetup(): array
    {
        $area = ServiceArea::query()->create(['name' => 'Test Area', 'rate_per_cubic_meter' => 65, 'status' => 'active']);
        $method = PaymentMethod::query()->firstOrCreate(['code' => 'cash'], ['name' => 'Cash', 'status' => 'active']);
        $cash = AccountingAccount::query()->firstOrCreate(['code' => 'cash_test'], ['name' => 'Cash on Hand', 'type' => 'cash', 'opening_balance' => 0, 'current_balance' => 0, 'status' => 'active']);
        $bank = AccountingAccount::query()->firstOrCreate(['code' => 'bank_test'], ['name' => 'Bank', 'type' => 'bank', 'opening_balance' => 0, 'current_balance' => 0, 'status' => 'active']);

        return [$area, $method, $cash, $bank];
    }

    private function customer(ServiceArea $area, string $name = 'Ahmad Karim'): Customer
    {
        return Customer::query()->create([
            'service_area_id' => $area->id,
            'name' => $name,
            'status' => 'registered',
            'agreement_status' => 'draft',
        ]);
    }

    private function fakeSealImage(string $name): UploadedFile
    {
        return UploadedFile::fake()->createWithContent(
            $name,
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z8dQAAAAASUVORK5CYII='),
        );
    }
}
