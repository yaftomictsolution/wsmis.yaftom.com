<?php

namespace Tests\Feature;

use App\Models\AccountingAccount;
use App\Models\CustomerChargeType;
use App\Models\Employee;
use App\Models\Good;
use App\Models\Invoice;
use App\Models\Meter;
use App\Models\PaymentMethod;
use App\Models\Supplier;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class TrainingModeTest extends TestCase
{
    use RefreshDatabase;

    public function test_production_reports_real_clock_and_rejects_training_changes(): void
    {
        config()->set('training.environment', false);
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->getJson('/api/training-mode')
            ->assertOk()
            ->assertJsonPath('data.environment', 'production')
            ->assertJsonPath('data.enabled', false)
            ->assertJsonPath('data.can_manage', false);

        $this->putJson('/api/settings/training-mode', [
            'enabled' => true,
            'business_date' => '2026-07-01',
        ])->assertForbidden()
            ->assertJsonPath('message', 'Training controls are disabled in production.');
    }

    public function test_training_admin_can_change_the_business_date_and_requests_use_it(): void
    {
        config()->set('training.environment', true);
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->putJson('/api/settings/training-mode', [
            'enabled' => true,
            'business_date' => '2026-07-01',
        ])->assertOk()
            ->assertJsonPath('data.environment', 'training')
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.effective_date', '2026-07-01');

        $this->getJson('/api/training-mode')
            ->assertOk()
            ->assertHeader('X-WSMIS-Environment', 'training')
            ->assertHeader('X-WSMIS-Business-Date', '2026-07-01')
            ->assertJsonPath('data.effective_date', '2026-07-01');
    }

    public function test_training_reset_clears_business_records_but_preserves_access_and_catalogs(): void
    {
        config()->set('training.environment', true);
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        SystemSetting::query()->create([
            'key' => 'training_mode',
            'value' => ['enabled' => true, 'business_date' => '2026-07-31'],
        ]);
        AccountingAccount::query()->create([
            'name' => 'Training Cash',
            'code' => 'training_cash',
            'type' => 'cash',
            'opening_balance' => 3000,
            'current_balance' => 3000,
            'status' => 'active',
        ]);

        $this->postJson('/api/settings/training-mode/reset', [
            'confirmation' => 'RESET TRAINING DATA',
            'password' => 'training-password',
        ])->assertOk()
            ->assertJsonPath('data.training_mode.environment', 'training')
            ->assertJsonPath('data.training_mode.business_date', '2026-07-31');

        $this->assertDatabaseCount('accounting_accounts', 0);
        $this->assertDatabaseHas('users', ['id' => $admin->id]);
        $this->assertDatabaseHas('roles', ['name' => 'Admin']);
        $this->assertDatabaseHas('system_settings', ['key' => 'training_mode']);
    }

    public function test_training_reset_reports_real_progress_until_completion(): void
    {
        config()->set('training.environment', true);
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        AccountingAccount::query()->create([
            'name' => 'Progress Test Cash',
            'code' => 'progress_test_cash',
            'type' => 'cash',
            'opening_balance' => 1200,
            'current_balance' => 1200,
            'status' => 'active',
        ]);

        $progress = $this->postJson('/api/settings/training-mode/reset/start', [
            'confirmation' => 'RESET TRAINING DATA',
            'password' => 'training-password',
        ])->assertOk()
            ->assertJsonPath('data.status', 'running')
            ->assertJsonPath('data.progress', 0)
            ->json('data');

        $previousProgress = 0;
        for ($attempt = 0; $attempt < 100 && $progress['status'] !== 'completed'; $attempt++) {
            $progress = $this->postJson("/api/settings/training-mode/reset/{$progress['operation_id']}/advance")
                ->assertOk()
                ->json('data');

            $this->assertGreaterThanOrEqual($previousProgress, $progress['progress']);
            $previousProgress = $progress['progress'];
        }

        $this->assertSame('completed', $progress['status']);
        $this->assertSame(100, $progress['progress']);
        $this->assertSame(0, $progress['remaining_steps']);
        $this->assertSame($progress['total_tables'], $progress['cleared_tables']);
        $this->assertDatabaseCount('accounting_accounts', 0);
        $this->assertDatabaseHas('users', ['id' => $admin->id]);
        $this->assertDatabaseHas('roles', ['name' => 'Admin']);
    }

    public function test_complete_july_training_workflow_closes_with_dynamic_income_and_expense(): void
    {
        config()->set('training.environment', true);
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $this->putJson('/api/settings/training-mode', [
            'enabled' => true,
            'business_date' => '2026-07-01',
        ])->assertOk();

        $accountId = $this->postJson('/api/accounting/accounts', [
            'name' => 'Training Office Cash',
            'code' => 'training_office_cash',
            'type' => 'cash',
            'opening_balance' => 5000,
            'status' => 'active',
        ])->assertCreated()->json('data.id');
        $this->assertSame('2026-07-01', AccountingAccount::query()->findOrFail($accountId)->created_at->toDateString());

        $areaId = $this->postJson('/api/service-areas', [
            'name' => 'Training Area',
            'rate_per_cubic_meter' => 10,
            'status' => 'active',
        ])->assertCreated()->json('data.id');
        $customerId = $this->postJson('/api/customers', [
            'service_area_id' => $areaId,
            'name' => 'Training',
            'last_name' => 'Customer',
            'father_name' => 'Example Father',
            'phone' => '0701234567',
            'house_number' => 'TR-01',
        ])->assertCreated()->json('data.id');
        $contractId = $this->postJson("/api/customers/{$customerId}/contracts", [
            'subscription_date' => '2026-07-01',
            'meter_size' => 'Half inch',
            'connection_fee' => 200,
            'meter_fee' => 200,
            'discount_amount' => 0,
        ])->assertCreated()->json('data.id');
        $this->postJson("/api/customer-contracts/{$contractId}/confirm")
            ->assertOk()
            ->assertJsonPath('data.status', 'installation_pending');

        $warehouse = Warehouse::query()->create(['name' => 'Training Warehouse', 'code' => 'TR-WH', 'status' => 'active']);
        $supplier = Supplier::query()->create(['name' => 'Training Meter Supplier', 'supplier_type' => 'meter', 'status' => 'active']);
        $good = Good::query()->create([
            'name' => 'Training Half-inch Meter',
            'code' => 'TR-METER',
            'category' => 'meter',
            'unit' => 'piece',
            'default_cost' => 500,
            'default_price' => 700,
            'status' => 'active',
        ]);
        $purchasePaymentMethod = PaymentMethod::query()->firstOrCreate(
            ['code' => 'cash'],
            ['name' => 'Cash', 'status' => 'active'],
        );
        $purchaseId = $this->postJson('/api/inventory-requests', [
            'type' => 'purchase',
            'supplier_id' => $supplier->id,
            'accounting_account_id' => $accountId,
            'payment_method_id' => $purchasePaymentMethod->id,
            'amount_paid' => 500,
            'warehouse_id' => $warehouse->id,
            'request_date' => '2026-07-01',
            'items' => [[
                'good_id' => $good->id,
                'quantity' => 1,
                'unit_price' => 500,
                'meter_serials' => ['WM-TRAIN-0001'],
            ]],
        ])->assertCreated()->json('data.id');
        $this->postJson("/api/inventory-requests/{$purchaseId}/approve", ['status' => 'approved'])->assertOk();

        $meter = Meter::query()->where('meter_number', 'WM-TRAIN-0001')->firstOrFail();
        $assignmentId = $this->postJson('/api/meter-assignments', [
            'customer_id' => $customerId,
            'customer_contract_id' => $contractId,
            'source_warehouse_id' => $warehouse->id,
            'meter_id' => $meter->id,
            'meter_assigner_id' => $admin->employee->id,
            'initial_reading' => 0,
            'installation_date' => '2026-07-01',
            'sealed_at' => '2026-07-01',
            'seal_number' => 'SEAL-TRAIN-0001',
        ])->assertCreated()->json('data.id');

        $periodId = $this->postJson('/api/billing-periods', [
            'name' => 'July 2026 Training',
            'code' => '2026-07-TRAIN',
            'starts_on' => '2026-07-01',
            'ends_on' => '2026-07-31',
            'status' => 'open',
        ])->assertCreated()->json('data.id');

        $this->putJson('/api/settings/training-mode', [
            'enabled' => true,
            'business_date' => '2026-07-31',
        ])->assertOk();
        $this->postJson('/api/meter-readings', [
            'billing_period_id' => $periodId,
            'meter_assignment_id' => $assignmentId,
            'reading_date' => '2026-07-31',
            'current_reading' => 10,
            'due_date' => '2026-08-15',
            'status' => 'recorded',
        ])->assertCreated();

        $chargeType = CustomerChargeType::query()->create([
            'name' => 'Training Service',
            'code' => 'training_service',
            'status' => 'active',
            'is_system' => false,
        ]);
        $this->postJson("/api/customers/{$customerId}/charges", [
            'customer_charge_type_id' => $chargeType->id,
            'title' => 'Training service charge',
            'amount' => 100,
            'charge_date' => '2026-07-31',
        ])->assertCreated();

        $cash = PaymentMethod::query()->firstOrCreate(
            ['code' => 'cash'],
            ['name' => 'Cash', 'status' => 'active'],
        );
        $invoices = Invoice::query()->where('customer_id', $customerId)->where('status', 'unpaid')->get();
        $this->assertSame(3, $invoices->count());
        $this->postJson('/api/payments', [
            'customer_id' => $customerId,
            'payment_method_id' => $cash->id,
            'accounting_account_id' => $accountId,
            'paid_at' => '2026-07-31',
            'items' => $invoices->map(fn (Invoice $invoice) => [
                'type' => 'invoice',
                'id' => $invoice->id,
                'amount' => (float) $invoice->remaining_amount,
            ])->all(),
        ])->assertCreated()->assertJsonPath('data.amount', '600.00');
        $this->assertEquals(5100, (float) AccountingAccount::query()->findOrFail($accountId)->current_balance);

        $this->putJson('/api/settings/training-mode', [
            'enabled' => true,
            'business_date' => '2026-08-02',
        ])->assertOk();
        $reconciliationId = $this->postJson('/api/account-reconciliations', [
            'accounting_account_id' => $accountId,
            'period_start' => '2026-07-01',
            'period_end' => '2026-07-31',
            'statement_balance' => 5100,
            'items' => [],
        ])->assertCreated()
            ->assertJsonPath('data.book_balance', '5100.00')
            ->assertJsonPath('data.difference', '0.00')
            ->json('data.id');
        $this->postJson("/api/account-reconciliations/{$reconciliationId}/submit")->assertOk();
        $this->postJson("/api/account-reconciliations/{$reconciliationId}/approve")->assertOk();

        $closingId = $this->postJson('/api/financial-closings', [
            'period_start' => '2026-07-01',
            'period_end' => '2026-07-31',
            'notes' => 'Training workflow close.',
        ])->assertCreated()
            ->assertJsonPath('data.total_income', '600.00')
            ->assertJsonPath('data.total_expense', '500.00')
            ->assertJsonPath('data.net_income', '100.00')
            ->json('data.id');
        $this->postJson("/api/financial-closings/{$closingId}/submit")->assertOk();
        $this->postJson("/api/financial-closings/{$closingId}/review")->assertOk();
        $this->postJson("/api/financial-closings/{$closingId}/close")
            ->assertOk()
            ->assertJsonPath('data.status', 'closed');
    }

    private function admin(): User
    {
        $role = Role::findOrCreate('Admin', 'web');
        $meterAssignerRole = Role::findOrCreate('Meter Assigner', 'web');
        $user = User::factory()->create([
            'password' => Hash::make('training-password'),
            'status' => 'active',
        ]);
        $user->assignRole($role);
        $user->assignRole($meterAssignerRole);
        Employee::query()->create([
            'user_id' => $user->id,
            'employee_number' => 'EMP-TRAINING-ASSIGNER',
            'first_name' => $user->name,
            'email' => $user->email,
            'hire_date' => '2026-01-01',
            'employment_type' => 'permanent',
            'salary_type' => 'fixed',
            'base_salary' => 10000,
            'status' => 'active',
        ]);

        return $user;
    }
}
