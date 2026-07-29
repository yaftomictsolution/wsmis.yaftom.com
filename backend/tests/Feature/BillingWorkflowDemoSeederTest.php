<?php

namespace Tests\Feature;

use App\Models\AccountingAccount;
use App\Models\Customer;
use Database\Seeders\BillingWorkflowDemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BillingWorkflowDemoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_records_cover_the_invoice_first_workflow_and_are_idempotent(): void
    {
        Storage::fake('local');

        $this->seed(BillingWorkflowDemoSeeder::class);

        $this->assertDatabaseCount('customers', 3);
        $this->assertDatabaseCount('customer_contracts', 3);
        $this->assertDatabaseCount('customer_deposits', 0);
        $this->assertDatabaseCount('meters', 4);
        $this->assertDatabaseCount('meter_assignments', 4);
        $this->assertDatabaseCount('meter_seals', 4);
        $this->assertDatabaseCount('meter_readings', 3);
        $this->assertDatabaseCount('invoices', 11);
        $this->assertDatabaseCount('invoice_items', 14);
        $this->assertDatabaseCount('customer_charges', 11);
        $this->assertDatabaseCount('payments', 4);
        $this->assertDatabaseCount('payment_allocations', 10);
        $this->assertDatabaseCount('customer_service_requests', 3);
        $this->assertDatabaseCount('customer_connection_events', 3);
        $this->assertDatabaseCount('customer_documents', 3);

        $partial = Customer::query()->where('subscription_code', 'TEST-SUB-0001')->firstOrFail();
        $paid = Customer::query()->where('subscription_code', 'TEST-SUB-0002')->firstOrFail();
        $outstanding = Customer::query()->where('subscription_code', 'TEST-SUB-0003')->firstOrFail();
        $this->assertSame('active', $partial->status);
        $this->assertSame('active', $paid->status);
        $this->assertSame('disconnected', $outstanding->status);
        $this->assertEquals(980, (float) $partial->current_balance);
        $this->assertEquals(0, (float) $paid->current_balance);
        $this->assertEquals(1725, (float) $outstanding->current_balance);
        $this->assertSame(1, $paid->meterAssignments()->where('status', 'replaced')->count());
        $this->assertSame(1, $paid->meterAssignments()->where('status', 'active')->count());
        $this->assertSame(1, $partial->invoices()->where('status', 'paid')->count());
        $this->assertSame(2, $partial->invoices()->where('status', 'partially_paid')->count());
        $this->assertSame(5, $paid->invoices()->where('status', 'paid')->count());

        $this->assertEquals(
            11950,
            (float) AccountingAccount::query()->where('code', 'test_cash_on_hand')->value('current_balance'),
        );
        $this->assertEquals(
            27270,
            (float) AccountingAccount::query()->where('code', 'test_bank_account')->value('current_balance'),
        );
        $this->assertSame(0, DB::table('payment_allocations')->whereNull('invoice_id')->count());
        $this->assertSame(1, DB::table('payments')->where('status', 'cancelled')->count());

        $counts = collect([
            'customers', 'customer_contracts', 'customer_deposits', 'meters',
            'meter_assignments', 'meter_readings', 'invoices', 'invoice_items',
            'customer_charges', 'payments', 'payment_allocations',
            'accounting_transactions', 'customer_documents',
        ])->mapWithKeys(fn (string $table) => [$table => DB::table($table)->count()]);

        $this->seed(BillingWorkflowDemoSeeder::class);

        $counts->each(fn (int $count, string $table) => $this->assertSame(
            $count,
            DB::table($table)->count(),
            "The {$table} table changed when the demo seeder was run twice.",
        ));
        $this->assertEquals(
            11950,
            (float) AccountingAccount::query()->where('code', 'test_cash_on_hand')->value('current_balance'),
        );
        $this->assertEquals(
            27270,
            (float) AccountingAccount::query()->where('code', 'test_bank_account')->value('current_balance'),
        );
    }
}
