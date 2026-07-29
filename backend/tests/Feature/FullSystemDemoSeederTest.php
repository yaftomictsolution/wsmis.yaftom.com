<?php

namespace Tests\Feature;

use App\Models\AccountingTransaction;
use App\Models\Customer;
use App\Models\InventoryItem;
use App\Models\Shareholder;
use App\Models\User;
use App\Services\DemoDataAuditService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FullSystemDemoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_full_system_seed_is_reconciled_and_reports_are_dynamic(): void
    {
        Storage::fake('local');
        Storage::fake('public');

        $this->seed(DatabaseSeeder::class);

        $audit = app(DemoDataAuditService::class)->audit();
        $this->assertNotEmpty($audit);
        $this->assertNotContains('FAIL', collect($audit)->pluck('status')->all());
        $this->assertEquals(100, (float) Shareholder::query()->where('status', 'active')->sum('ownership_percentage'));

        $admin = User::query()->where('email', 'admin@waternet.local')->firstOrFail();
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/reports/operational?type=all&from=2026-04-01&to=2026-07-31')
            ->assertOk();
        $response->assertJsonPath('data.summary.total_customers', Customer::query()->count());
        $response->assertJsonPath('data.summary.inventory_items', InventoryItem::query()->count());
        $this->assertEquals(
            round((float) AccountingTransaction::query()
                ->where('status', 'approved')
                ->where('type', 'income')
                ->whereBetween('transaction_date', ['2026-04-01', '2026-07-31'])
                ->sum('amount'), 2),
            (float) $response->json('data.summary.revenue'),
        );
    }
}
