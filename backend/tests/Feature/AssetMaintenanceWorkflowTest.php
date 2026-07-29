<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\ServiceArea;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AssetMaintenanceWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_asset_maintenance_responses_and_statuses_stay_consistent(): void
    {
        $user = User::factory()->create(['status' => 'active']);
        Sanctum::actingAs($user);
        $area = ServiceArea::query()->create([
            'code' => 'AREA-ASSET',
            'name' => 'Asset Area',
            'status' => 'active',
        ]);
        $supplier = Supplier::query()->create([
            'name' => 'Asset Supplier',
            'status' => 'active',
        ]);

        $assetId = $this->postJson('/api/assets', [
            'asset_code' => 'GEN-001',
            'name' => 'Main Generator',
            'type' => 'generator',
            'status' => 'active',
            'service_area_id' => $area->id,
            'supplier_id' => $supplier->id,
            'purchase_cost' => 250000,
        ])->assertCreated()
            ->assertJsonPath('data.asset_code', 'GEN-001')
            ->json('data.id');

        $maintenanceId = $this->postJson('/api/assets-maintenance', [
            'asset_id' => $assetId,
            'maintenance_type' => 'preventive',
            'title' => 'Oil and filter service',
            'performed_at' => '2026-07-27',
            'next_due_date' => '2026-08-27',
            'status' => 'in_progress',
        ])->assertCreated()
            ->assertJsonPath('data.asset.id', $assetId)
            ->assertJsonPath('data.status', 'in_progress')
            ->json('data.id');

        $this->assertEquals('maintenance', Asset::query()->findOrFail($assetId)->status);

        $this->putJson("/api/assets-maintenance/{$maintenanceId}", [
            'title' => 'Generator oil and filter service',
        ])->assertOk()
            ->assertJsonPath('data.title', 'Generator oil and filter service');

        $this->putJson("/api/assets-maintenance/{$maintenanceId}", [
            'status' => 'completed',
        ])->assertOk()
            ->assertJsonPath('data.status', 'completed');

        $this->assertEquals('active', Asset::query()->findOrFail($assetId)->status);
        $this->deleteJson("/api/assets/{$assetId}")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'An asset with maintenance history cannot be deleted. Mark it retired instead.');
    }

    public function test_next_maintenance_date_cannot_precede_the_service_date(): void
    {
        $user = User::factory()->create(['status' => 'active']);
        Sanctum::actingAs($user);
        $asset = Asset::query()->create([
            'asset_code' => 'WELL-001',
            'name' => 'Main Well',
            'type' => 'well',
            'status' => 'active',
            'created_by' => $user->id,
        ]);

        $this->postJson('/api/assets-maintenance', [
            'asset_id' => $asset->id,
            'maintenance_type' => 'corrective',
            'title' => 'Pump repair',
            'performed_at' => '2026-07-27',
            'next_due_date' => '2026-07-20',
            'status' => 'scheduled',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('next_due_date');
    }
}
