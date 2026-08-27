<?php

namespace Tests\Feature;

use App\Models\AccountingAccount;
use App\Models\BillingPeriod;
use App\Models\Customer;
use App\Models\Employee;
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
        [$manager, $admin] = $this->users();
        [$area] = $this->collectionSetup();
        $customer = $this->customer($area, 'Contract History Customer');
        Sanctum::actingAs($manager);

        $firstContract = $this->postJson("/api/customers/{$customer->id}/contracts", [
            'subscription_date' => '2026-07-10',
            'meter_size' => 'Half inch',
            'connection_fee' => 1000,
            'meter_fee' => 500,
        ])->assertCreated()->json('data');

        $this->submitAndApproveCancellation($manager, $admin, $firstContract['id'], [
            'reason' => 'Customer requested corrected contract terms.',
        ]);

        Sanctum::actingAs($manager);

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
            ->assertJsonPath('data.customer.contracts.1.updater.id', $admin->id);
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
            'meter_assigner_id' => $manager->employee->id,
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

    public function test_paid_contract_refund_uses_the_selected_account_and_cancels_atomically(): void
    {
        [$manager, $admin] = $this->users();
        [$area, $cashMethod, $cashAccount, $bankAccount] = $this->collectionSetup();
        $bankAccount->update(['opening_balance' => 1000, 'current_balance' => 1000]);
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
            ->assertJsonValidationErrors('refund_posted_payments');
        $this->assertDatabaseHas('payments', ['id' => $paymentId, 'status' => 'posted']);
        $this->assertDatabaseHas('customer_contracts', ['id' => $contractId, 'status' => 'installation_pending']);

        $this->postJson("/api/customer-contracts/{$contractId}/cancel", [
            'reason' => 'Customer withdrew before meter installation.',
            'refund_posted_payments' => true,
            'refunded_at' => '2026-07-20',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('refund_accounting_account_id');

        $this->submitAndApproveCancellation($manager, $admin, $contractId, [
            'reason' => 'Customer withdrew before meter installation.',
            'refund_posted_payments' => true,
            'refund_accounting_account_id' => $bankAccount->id,
            'refunded_at' => '2026-07-20',
            'refund_reference' => 'RETURNED-CASH-001',
        ]);

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
            'accounting_account_id' => $bankAccount->id,
            'status' => 'approved',
        ]);
        $this->assertEquals(400, (float) $cashAccount->fresh()->current_balance);
        $this->assertEquals(600, (float) $bankAccount->fresh()->current_balance);
        $this->assertEquals(0, (float) $customer->fresh()->current_balance);
        $this->assertEquals('registered', $customer->fresh()->status);
    }

    public function test_active_contract_can_be_refunded_cancelled_and_meter_history_closed(): void
    {
        [$manager, $admin] = $this->users();
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
            'meter_assigner_id' => $manager->employee->id,
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
        $cashMethod->update(['code' => 'cash-0003']);
        $this->getJson("/api/customers/{$customer->id}/detail")
            ->assertOk()
            ->assertJsonPath('data.customer.latest_contract.invoice.allocations.0.payment.status', 'posted')
            ->assertJsonPath('data.customer.latest_contract.invoice.allocations.0.payment.amount', '200.00');

        $this->submitAndApproveCancellation($manager, $admin, $contractId, [
            'reason' => 'Customer moved away after installation.',
            'refund_posted_payments' => true,
            'refunded_at' => '2026-07-20',
            'refund_reference' => 'ACTIVE-REFUND-001',
        ]);

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
            'removed_by' => $admin->id,
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
        [$manager, $admin] = $this->users();
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
            'meter_assigner_id' => $manager->employee->id,
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

        $this->submitAndApproveCancellation($manager, $admin, $contractId, [
            'reason' => 'Customer cancelled the contract after a mixed receipt was posted.',
            'refund_posted_payments' => true,
            'refunded_at' => '2026-07-21',
            'refund_reference' => 'MIXED-REFUND-001',
        ]);

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

    public function test_meter_replacement_generates_one_linked_invoice_and_accepts_partial_payment(): void
    {
        [$manager] = $this->users();
        [$area, $cashMethod, $cashAccount] = $this->collectionSetup();
        $customer = $this->customer($area, 'Replacement Billing Customer');
        Sanctum::actingAs($manager);

        $contractId = $this->postJson("/api/customers/{$customer->id}/contracts", [
            'subscription_date' => '2026-07-19',
            'connection_fee' => 100,
            'meter_fee' => 0,
        ])->assertCreated()->json('data.id');
        $this->postJson("/api/customer-contracts/{$contractId}/confirm")->assertOk();
        $contractInvoice = Invoice::query()->where('customer_contract_id', $contractId)->firstOrFail();
        $this->postJson('/api/payments', [
            'customer_id' => $customer->id,
            'payment_method_id' => $cashMethod->id,
            'accounting_account_id' => $cashAccount->id,
            'paid_at' => '2026-07-19',
            'items' => [['type' => 'invoice', 'id' => $contractInvoice->id, 'amount' => 100]],
        ])->assertCreated();

        $firstMeter = Meter::query()->create(['meter_number' => 'WM-REPLACE-OLD', 'status' => 'available']);
        $firstAssignmentId = $this->postJson('/api/meter-assignments', [
            'customer_id' => $customer->id,
            'customer_contract_id' => $contractId,
            'meter_id' => $firstMeter->id,
            'meter_assigner_id' => $manager->employee->id,
            'initial_reading' => 0,
            'installation_date' => '2026-07-19',
            'seal_number' => 'SEAL-REPLACE-OLD',
        ])->assertCreated()->json('data.id');

        $newMeter = Meter::query()->create(['meter_number' => 'WM-REPLACE-NEW', 'status' => 'available']);
        $this->postJson('/api/meter-assignments', [
            'customer_id' => $customer->id,
            'customer_contract_id' => $contractId,
            'meter_id' => $newMeter->id,
            'meter_assigner_id' => $manager->employee->id,
            'initial_reading' => 0,
            'installation_date' => '2026-07-20',
            'seal_number' => 'SEAL-REPLACE-NEW',
            'previous_meter_disposition' => 'repair',
            'replacement_fee' => 600,
            'notes' => 'Old meter stopped recording consumption.',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.meter.meter_number', 'WM-REPLACE-NEW');

        $previousAssignment = $customer->meterAssignments()->findOrFail($firstAssignmentId);
        $charge = $previousAssignment->replacementCharge()->firstOrFail();
        $invoice = Invoice::query()
            ->where('source_type', 'customer_charge')
            ->where('source_id', $charge->id)
            ->firstOrFail();

        $this->assertDatabaseHas('meter_assignments', [
            'id' => $firstAssignmentId,
            'status' => 'replaced',
            'replacement_charge_id' => $charge->id,
        ]);
        $this->assertDatabaseHas('customer_charges', [
            'id' => $charge->id,
            'customer_id' => $customer->id,
            'customer_contract_id' => $contractId,
            'type' => 'replacement_fee',
            'amount' => 600,
            'remaining_amount' => 600,
            'status' => 'posted',
        ]);
        $this->assertDatabaseHas('invoices', [
            'id' => $invoice->id,
            'invoice_type' => 'service',
            'total_amount' => 600,
            'paid_amount' => 0,
            'remaining_amount' => 600,
            'status' => 'unpaid',
        ]);
        $this->assertSame(1, Invoice::query()->where('source_type', 'customer_charge')->where('source_id', $charge->id)->count());
        $this->assertEquals(600, (float) $customer->fresh()->current_balance);

        $this->getJson("/api/customers/{$customer->id}/detail")
            ->assertOk()
            ->assertJsonPath('data.meter_replacement_history.0.id', $firstAssignmentId)
            ->assertJsonPath('data.meter_replacement_history.0.replacement_charge.invoice.id', $invoice->id);

        $this->postJson('/api/payments', [
            'customer_id' => $customer->id,
            'payment_method_id' => $cashMethod->id,
            'accounting_account_id' => $cashAccount->id,
            'paid_at' => '2026-07-21',
            'items' => [['type' => 'invoice', 'id' => $invoice->id, 'amount' => 250]],
        ])->assertCreated()->assertJsonPath('data.amount', '250.00');

        $this->assertDatabaseHas('invoices', [
            'id' => $invoice->id,
            'paid_amount' => 250,
            'remaining_amount' => 350,
            'status' => 'partially_paid',
        ]);
        $this->assertDatabaseHas('customer_charges', [
            'id' => $charge->id,
            'paid_amount' => 250,
            'remaining_amount' => 350,
        ]);
        $this->assertEquals(350, (float) $cashAccount->fresh()->current_balance);
        $this->assertEquals(350, (float) $customer->fresh()->current_balance);
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
            'meter_assigner_id' => $manager->employee->id,
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

    public function test_meter_assigner_employee_can_be_created_with_login_and_is_listed_for_assignments(): void
    {
        [$manager] = $this->users();
        Sanctum::actingAs($manager);

        $employeeId = $this->postJson('/api/employees', [
            'first_name' => 'Farid',
            'last_name' => 'Ahmadi',
            'email' => 'farid.assigner@example.test',
            'hire_date' => '2026-07-01',
            'employment_type' => 'permanent',
            'salary_type' => 'fixed',
            'base_salary' => 12000,
            'standard_daily_hours' => 8,
            'work_start_time' => '08:00',
            'work_end_time' => '16:00',
            'work_days' => [1, 2, 3, 4, 5, 6],
            'status' => 'active',
            'login_enabled' => true,
            'login_password' => 'password123',
            'login_password_confirmation' => 'password123',
            'login_role' => 'Meter Assigner',
            'login_status' => 'active',
        ])->assertCreated()
            ->assertJsonPath('data.user.roles.0.name', 'Meter Assigner')
            ->json('data.id');

        $this->getJson('/api/meter-assignments/assigners')
            ->assertOk()
            ->assertJsonFragment([
                'id' => $employeeId,
                'name' => 'Farid Ahmadi',
                'email' => 'farid.assigner@example.test',
            ]);
    }

    private function users(): array
    {
        $managerRole = Role::findOrCreate('Manager', 'web');
        $adminRole = Role::findOrCreate('Admin', 'web');
        $meterAssignerRole = Role::findOrCreate('Meter Assigner', 'web');
        $manager = User::factory()->create(['status' => 'active']);
        $admin = User::factory()->create(['status' => 'active']);
        $manager->assignRole($managerRole);
        $manager->assignRole($meterAssignerRole);
        $admin->assignRole($adminRole);
        Employee::query()->create([
            'user_id' => $manager->id,
            'employee_number' => 'EMP-METER-ASSIGNER',
            'first_name' => $manager->name,
            'email' => $manager->email,
            'hire_date' => '2026-01-01',
            'employment_type' => 'permanent',
            'salary_type' => 'fixed',
            'base_salary' => 10000,
            'status' => 'active',
        ]);

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

    private function submitAndApproveCancellation(
        User $requester,
        User $admin,
        int $contractId,
        array $payload,
    ): int {
        if (($payload['refund_posted_payments'] ?? false) && empty($payload['refund_accounting_account_id'])) {
            $payload['refund_accounting_account_id'] = AccountingAccount::query()
                ->where('status', 'active')
                ->orderByDesc('current_balance')
                ->value('id');
        }
        Sanctum::actingAs($requester);
        $requestId = $this->postJson("/api/customer-contracts/{$contractId}/cancel", $payload)
            ->assertStatus(202)
            ->assertJsonPath('data.status', 'pending')
            ->json('data.id');

        $this->assertDatabaseMissing('customer_contracts', [
            'id' => $contractId,
            'status' => 'cancelled',
        ]);

        Sanctum::actingAs($admin);
        $this->postJson("/api/contract-cancellation-requests/{$requestId}/resolve", [
            'status' => 'approved',
        ])->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.contract.status', 'cancelled');

        return (int) $requestId;
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
