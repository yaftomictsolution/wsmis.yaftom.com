<?php

namespace Tests\Feature;

use App\Models\ServiceArea;
use App\Models\SyncChange;
use App\Models\SyncConflict;
use App\Models\SyncDevice;
use App\Models\SyncEntity;
use App\Models\User;
use App\Services\Sync\OfflineSyncManager;
use App\Services\Sync\SyncApplyService;
use App\Services\Sync\SyncCatalog;
use App\Services\Sync\SyncChangeDetector;
use App\Services\Sync\SyncFileService;
use App\Services\Sync\SyncIntegrityService;
use App\Services\Sync\SyncNodeManager;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class OfflineSynchronizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('sync.enabled', true);
        config()->set('sync.mode', 'local');
        config()->set('sync.tables', ['service_areas']);
    }

    public function test_scanner_captures_query_builder_create_update_and_delete_without_duplicate_changes(): void
    {
        $area = $this->area('Area A');
        $detector = app(SyncChangeDetector::class);

        $first = $detector->detect();
        $this->assertSame(1, $first['created']);
        $this->assertDatabaseCount('sync_changes', 1);
        $create = SyncChange::query()->firstOrFail();
        $this->assertSame('create', $create->operation);

        $detector->detect();
        $this->assertDatabaseCount('sync_changes', 1);

        $create->update(['pushed_at' => now()]);
        DB::table('service_areas')->where('id', $area->id)->update(['name' => 'Area A Updated']);
        $detector->detect();
        $this->assertDatabaseCount('sync_changes', 2);
        $update = SyncChange::query()->latest('id')->firstOrFail();
        $this->assertSame('update', $update->operation);
        $this->assertSame('Area A Updated', $update->payload['name']);

        $update->update(['pushed_at' => now()]);
        DB::table('service_areas')->where('id', $area->id)->delete();
        $detector->detect();
        $delete = SyncChange::query()->latest('id')->firstOrFail();
        $this->assertSame('delete', $delete->operation);
        $this->assertNull(SyncEntity::query()->firstOrFail()->record_id);
    }

    public function test_create_then_delete_before_first_sync_leaves_no_remote_change(): void
    {
        $area = $this->area('Temporary Area');
        $detector = app(SyncChangeDetector::class);
        $detector->detect();

        DB::table('service_areas')->where('id', $area->id)->delete();
        $detector->detect();

        $this->assertDatabaseCount('sync_changes', 0);
        $this->assertDatabaseCount('sync_entities', 0);
    }

    public function test_relationships_are_transferred_by_stable_uuid_instead_of_numeric_id(): void
    {
        config()->set('sync.tables', ['service_areas', 'customers']);
        $area = $this->area('Relationship Area');
        $customerId = DB::table('customers')->insertGetId([
            'service_area_id' => $area->id,
            'name' => 'Ahmad',
            'opening_balance' => 0,
            'current_balance' => 0,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        app(SyncChangeDetector::class)->detect();

        $customerMap = SyncEntity::query()->where('table_name', 'customers')->where('record_id', $customerId)->firstOrFail();
        $areaMap = SyncEntity::query()->where('table_name', 'service_areas')->where('record_id', $area->id)->firstOrFail();
        $change = SyncChange::query()->where('entity_uuid', $customerMap->entity_uuid)->firstOrFail();
        $this->assertArrayNotHasKey('service_area_id', $change->payload);
        $this->assertSame($areaMap->entity_uuid, $change->relationships['service_area_id']['entity_uuid']);
    }

    public function test_remote_changes_are_idempotent_and_stale_changes_are_quarantined_without_overwrite(): void
    {
        config()->set('sync.mode', 'cloud');
        $source = (string) Str::uuid();
        $entityUuid = (string) Str::uuid();
        $applier = app(SyncApplyService::class);
        $create = $this->change($entityUuid, $source, 'create', 0, 1, ['name' => 'Cloud Area']);

        $this->assertSame('accepted', $applier->apply($create, true, false)['status']);
        $this->assertSame('accepted', $applier->apply($create, true, false)['status']);
        $this->assertDatabaseCount('service_areas', 1);

        $update = $this->change($entityUuid, $source, 'update', 1, 2, ['name' => 'Cloud Area Updated']);
        $this->assertSame('accepted', $applier->apply($update, true, false)['status']);
        $this->assertSame('Cloud Area Updated', ServiceArea::query()->firstOrFail()->name);

        $stale = $this->change($entityUuid, $source, 'update', 1, 2, ['name' => 'Stale Overwrite']);
        $result = $applier->apply($stale, true, false);
        $this->assertSame('conflict', $result['status']);
        $this->assertSame('Cloud Area Updated', ServiceArea::query()->firstOrFail()->name);
        $this->assertDatabaseCount('sync_conflicts', 1);
    }

    public function test_remote_relationships_are_remapped_to_the_local_record_ids(): void
    {
        config()->set('sync.mode', 'cloud');
        config()->set('sync.tables', ['service_areas', 'customers']);
        $source = (string) Str::uuid();
        $areaUuid = (string) Str::uuid();
        $customerUuid = (string) Str::uuid();
        $applier = app(SyncApplyService::class);

        $applier->apply($this->change($areaUuid, $source, 'create', 0, 1, ['name' => 'Remote Area']), true, false);
        $customer = $this->change($customerUuid, $source, 'create', 0, 1, [
            'name' => 'Remote Customer',
            'opening_balance' => 0,
            'current_balance' => 0,
            'status' => 'active',
        ]);
        $customer['table_name'] = 'customers';
        $customer['relationships'] = [
            'service_area_id' => ['table_name' => 'service_areas', 'entity_uuid' => $areaUuid],
        ];
        $customer['checksum'] = hash('sha256', 'customer-relationship');

        $result = $applier->apply($customer, true, false);
        $this->assertSame('accepted', $result['status']);
        $this->assertSame(
            ServiceArea::query()->firstOrFail()->id,
            (int) DB::table('customers')->value('service_area_id'),
        );
    }

    public function test_indirect_reference_ids_are_remapped_to_destination_records(): void
    {
        config()->set('sync.mode', 'cloud');
        config()->set('sync.tables', ['service_areas', 'accounting_transactions']);
        config()->set('sync.indirect_references.accounting_transactions.types.test_area', 'service_areas');
        $this->area('Existing Local Area');
        $source = (string) Str::uuid();
        $areaUuid = (string) Str::uuid();
        $transactionUuid = (string) Str::uuid();
        $applier = app(SyncApplyService::class);

        $this->assertSame(
            'accepted',
            $applier->apply($this->change($areaUuid, $source, 'create', 0, 1, ['name' => 'Remote Source Area']), true, false)['status'],
        );
        $remoteAreaId = (int) SyncEntity::query()->where('entity_uuid', $areaUuid)->value('record_id');
        $this->assertGreaterThan(1, $remoteAreaId);

        $payload = [
            'transaction_number' => 'SYNC-INDIRECT-0001',
            'type' => 'income',
            'title' => 'Indirect reference test',
            'amount' => 100,
            'transaction_date' => now()->toDateString(),
            'source_type' => 'test_area',
            'status' => 'approved',
            '__sync_indirect_source_id' => [
                'table_name' => 'service_areas',
                'entity_uuid' => $areaUuid,
            ],
        ];
        $change = $this->change($transactionUuid, $source, 'create', 0, 1, $payload);
        $change['table_name'] = 'accounting_transactions';
        $change['checksum'] = app(SyncCatalog::class)->checksum($payload, []);

        $this->assertSame('accepted', $applier->apply($change, true, false)['status']);
        $this->assertSame($remoteAreaId, (int) DB::table('accounting_transactions')->value('source_id'));
    }

    public function test_delete_sync_removes_the_row_but_preserves_a_tombstone_for_future_devices(): void
    {
        config()->set('sync.mode', 'cloud');
        $source = (string) Str::uuid();
        $entityUuid = (string) Str::uuid();
        $applier = app(SyncApplyService::class);
        $applier->apply($this->change($entityUuid, $source, 'create', 0, 1, ['name' => 'Delete Me']), true, false);

        $delete = $this->change($entityUuid, $source, 'delete', 1, 2, null);
        $this->assertSame('accepted', $applier->apply($delete, true, false)['status']);
        $this->assertDatabaseCount('service_areas', 0);
        $entity = SyncEntity::query()->where('entity_uuid', $entityUuid)->firstOrFail();
        $this->assertNotNull($entity->deleted_at);
        $this->assertNull($entity->record_id);
    }

    public function test_file_sync_validates_hash_and_rejects_unsafe_paths(): void
    {
        Storage::fake('local');
        config()->set('sync.files', ['customers' => ['photo_path' => 'local']]);
        Storage::disk('local')->put('customers/1/photo.jpg', 'photo-content');
        $service = app(SyncFileService::class);
        $descriptor = $service->descriptors('customers', ['photo_path' => 'customers/1/photo.jpg'])[0];

        $this->assertTrue($service->hasExpectedFile($descriptor));
        $this->assertFalse($service->isAllowed(array_merge($descriptor, ['path' => '../secret.txt'])));

        Storage::disk('local')->delete($descriptor['path']);
        $upload = UploadedFile::fake()->createWithContent('photo.jpg', 'photo-content');
        $service->storeUploaded($descriptor, $upload);
        $this->assertTrue($service->hasExpectedFile($descriptor));
    }

    public function test_cloud_protocol_requires_registered_device_credentials(): void
    {
        config()->set('sync.mode', 'cloud');
        $uuid = (string) Str::uuid();
        SyncDevice::query()->create([
            'uuid' => $uuid,
            'name' => 'Office PC',
            'token_hash' => Hash::make('correct-secret'),
            'status' => 'active',
        ]);
        $headers = [
            'X-WSMIS-Device' => $uuid,
            'X-WSMIS-Device-Token' => 'correct-secret',
            'X-WSMIS-Sync-Protocol' => '1',
        ];

        $this->withHeaders($headers)->getJson('/api/sync/remote/handshake')->assertOk();
        $this->withHeaders(array_merge($headers, ['X-WSMIS-Device-Token' => 'wrong']))->getJson('/api/sync/remote/handshake')->assertUnauthorized();
    }

    public function test_admin_can_create_and_revoke_one_time_local_computer_credentials(): void
    {
        config()->set('sync.mode', 'cloud');
        $admin = User::factory()->create(['status' => 'active']);
        $admin->assignRole(Role::findOrCreate('Admin'));
        Sanctum::actingAs($admin);

        $created = $this->postJson('/api/sync/devices', ['name' => 'Front Office Computer'])
            ->assertCreated()
            ->assertJsonPath('data.device.name', 'Front Office Computer')
            ->assertJsonPath('data.device.status', 'active');
        $uuid = $created->json('data.device.uuid');
        $secret = $created->json('data.secret');

        $this->assertTrue(Str::isUuid($uuid));
        $this->assertIsString($secret);
        $this->assertGreaterThanOrEqual(48, strlen($secret));
        $this->assertTrue(Hash::check($secret, SyncDevice::query()->where('uuid', $uuid)->value('token_hash')));
        $this->getJson('/api/sync/devices')
            ->assertOk()
            ->assertJsonMissing(['secret' => $secret]);

        $this->deleteJson('/api/sync/devices/'.SyncDevice::query()->where('uuid', $uuid)->value('id'))
            ->assertOk()
            ->assertJsonPath('data.status', 'revoked');
    }

    public function test_admin_can_fix_a_stale_cloud_queue_without_changing_business_data(): void
    {
        config()->set('sync.mode', 'cloud');
        $admin = User::factory()->create(['status' => 'active']);
        $admin->assignRole(Role::findOrCreate('Admin'));
        Sanctum::actingAs($admin);

        $area = $this->area('Cloud Queue Safety Area');
        $state = app(SyncNodeManager::class)->state();
        $change = SyncChange::query()->create([
            'change_uuid' => (string) Str::uuid(),
            'entity_uuid' => (string) Str::uuid(),
            'table_name' => 'users',
            'operation' => 'update',
            'base_version' => 1,
            'version' => 2,
            'payload' => ['name' => 'Legacy queue metadata'],
            'relationships' => [],
            'files' => [],
            'checksum' => hash('sha256', 'legacy-queue-metadata'),
            'source_node_uuid' => $state->node_uuid,
        ]);

        $this->postJson('/api/sync/cloud-queue/repair')
            ->assertOk()
            ->assertJsonPath('data.acknowledged_changes', 1)
            ->assertJsonPath('data.message', 'Sync status fixed. The cloud queue is now clean.');

        $this->assertNotNull($change->fresh()->pushed_at);
        $this->assertSame('Cloud Queue Safety Area', ServiceArea::query()->findOrFail($area->id)->name);
        $this->getJson('/api/sync/status')
            ->assertOk()
            ->assertJsonPath('data.pending_changes', 0)
            ->assertJsonPath('data.can_repair_cloud_queue', false);
    }

    public function test_cloud_push_is_idempotent_and_is_visible_to_a_different_registered_device(): void
    {
        config()->set('sync.mode', 'cloud');
        $deviceA = $this->registeredDevice('Office A', 'secret-a');
        $deviceB = $this->registeredDevice('Office B', 'secret-b');
        $timestamp = now()->format('Y-m-d H:i:s');
        $payload = [
            'name' => 'Shared Area',
            'mosque_name' => null,
            'district' => null,
            'street_block_village' => null,
            'representative_name' => null,
            'representative_phone' => null,
            'households_count' => 0,
            'rate_per_cubic_meter' => 0,
            'status' => 'active',
            'inactive_reason' => null,
            'notes' => null,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ];
        $change = $this->change((string) Str::uuid(), $deviceA->uuid, 'create', 0, 1, $payload);
        $change['checksum'] = app(SyncCatalog::class)->checksum($payload, []);

        $firstPush = $this->withHeaders($this->deviceHeaders($deviceA->uuid, 'secret-a'))
            ->postJson('/api/sync/remote/push', ['changes' => [$change]])
            ->assertOk();
        $firstPush->assertJsonPath('data.results.0.status', 'accepted');

        $this->withHeaders($this->deviceHeaders($deviceA->uuid, 'secret-a'))
            ->postJson('/api/sync/remote/push', ['changes' => [$change]])
            ->assertOk()
            ->assertJsonPath('data.results.0.reason', 'already_applied');
        $this->assertDatabaseCount('service_areas', 1);

        $this->withHeaders($this->deviceHeaders($deviceA->uuid, 'secret-a'))
            ->getJson('/api/sync/remote/pull?cursor=0&limit=100')
            ->assertOk()
            ->assertJsonCount(0, 'data.changes');

        $this->withHeaders($this->deviceHeaders($deviceA->uuid, 'secret-a'))
            ->getJson('/api/sync/remote/pull?cursor=0&limit=100&include_own=1')
            ->assertOk()
            ->assertJsonPath('data.changes.0.entity_uuid', $change['entity_uuid']);

        $pullForB = $this->withHeaders($this->deviceHeaders($deviceB->uuid, 'secret-b'))
            ->getJson('/api/sync/remote/pull?cursor=0&limit=100')
            ->assertOk();
        $pullForB->assertJsonPath('data.changes.0.entity_uuid', $change['entity_uuid']);
    }

    public function test_offline_writer_lease_makes_cloud_mutations_read_only(): void
    {
        config()->set('sync.mode', 'cloud');
        Role::findOrCreate('Admin');
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole('Admin');
        Sanctum::actingAs($user);
        $state = app(SyncNodeManager::class)->state();
        $state->update([
            'writer_mode' => 'local',
            'writer_device_uuid' => (string) Str::uuid(),
            'lease_expires_at' => now()->addHour(),
        ]);

        $this->getJson('/api/settings')->assertOk();
        $this->putJson('/api/settings/system-profile', [])->assertStatus(423)
            ->assertJsonPath('code', 'LOCAL_WRITER_ACTIVE');
    }

    public function test_integrity_manifest_changes_when_a_record_is_modified(): void
    {
        $area = $this->area('Manifest Area');
        app(SyncChangeDetector::class)->detect();
        $before = app(SyncIntegrityService::class)->manifest();

        DB::table('service_areas')->where('id', $area->id)->update(['name' => 'Manifest Area Updated']);
        app(SyncChangeDetector::class)->detect();
        $after = app(SyncIntegrityService::class)->manifest();

        $this->assertNotSame($before['root_hash'], $after['root_hash']);
    }

    public function test_initialization_reclaims_a_matching_deterministic_tombstone_without_duplicate_uuid(): void
    {
        config()->set('sync.mode', 'cloud');
        $state = app(SyncNodeManager::class)->state();
        $area = $this->area('Reused Baseline Area');
        $entityUuid = app(SyncNodeManager::class)->deterministicEntityUuid('service_areas', $area->id);

        SyncEntity::query()->create([
            'entity_uuid' => $entityUuid,
            'table_name' => 'service_areas',
            'record_id' => null,
            'version' => 1,
            'origin_node_uuid' => $state->node_uuid,
            'deleted_at' => now(),
        ]);

        app(SyncChangeDetector::class)->detect();

        $this->assertDatabaseCount('sync_entities', 1);
        $this->assertSame(
            $area->id,
            SyncEntity::query()->where('entity_uuid', $entityUuid)->firstOrFail()->record_id,
        );
    }

    public function test_cloud_baseline_reset_preserves_business_records_and_registered_devices(): void
    {
        config()->set('sync.mode', 'cloud');
        $this->area('Cloud Baseline Area');
        $device = $this->registeredDevice('Preserved Office', 'preserved-secret');
        app(SyncChangeDetector::class)->detect();
        $oldInstallation = app(SyncNodeManager::class)->state()->installation_uuid;
        SyncConflict::query()->create([
            'conflict_uuid' => (string) Str::uuid(),
            'entity_uuid' => SyncEntity::query()->firstOrFail()->entity_uuid,
            'table_name' => 'service_areas',
            'reason' => 'Broken copied history',
            'status' => 'open',
            'detected_at' => now(),
        ]);

        $this->artisan('sync:reset-cloud-baseline --force')->assertSuccessful();

        $this->assertDatabaseCount('service_areas', 1);
        $this->assertDatabaseHas('sync_devices', ['uuid' => $device->uuid]);
        $this->assertDatabaseCount('sync_conflicts', 0);
        $this->assertDatabaseCount('sync_entities', 1);
        $this->assertDatabaseCount('sync_changes', 1);
        $this->assertNotSame($oldInstallation, app(SyncNodeManager::class)->state()->installation_uuid);
    }

    public function test_exact_cloud_copy_can_be_provisioned_locally_without_replaying_or_conflicts(): void
    {
        config()->set('sync.mode', 'cloud');
        $this->area('Shared Baseline Area');
        app(SyncChangeDetector::class)->detect();
        $cloudState = app(SyncNodeManager::class)->state();
        $manifest = app(SyncIntegrityService::class)->manifest();
        $latestCursor = (int) SyncChange::query()->max('id');
        $deviceUuid = (string) Str::uuid();

        $this->configureLocalClient($deviceUuid);
        Http::fake(function ($request) use ($cloudState, $manifest, $latestCursor) {
            if (str_ends_with($request->url(), '/sync/remote/handshake')) {
                return Http::response(['data' => [
                    'protocol_version' => 1,
                    'node_uuid' => $cloudState->node_uuid,
                    'installation_uuid' => $cloudState->installation_uuid,
                    'latest_cursor' => $latestCursor,
                    'writer_mode' => 'cloud',
                ]]);
            }
            if (str_ends_with($request->url(), '/sync/remote/manifest')) {
                return Http::response(['data' => $manifest]);
            }

            return Http::response(['message' => 'Unexpected test URL'], 500);
        });

        $this->artisan('sync:rebaseline-local --force')->assertSuccessful();

        $state = app(SyncNodeManager::class)->state();
        $this->assertSame($deviceUuid, $state->node_uuid);
        $this->assertSame($latestCursor, $state->remote_cursor);
        $this->assertNotNull($state->last_sync_at);
        $this->assertDatabaseCount('sync_entities', 1);
        $this->assertDatabaseCount('sync_changes', 0);
        $this->assertDatabaseCount('sync_conflicts', 0);
    }

    public function test_rebaseline_rejects_an_already_provisioned_local_computer(): void
    {
        $this->configureLocalClient((string) Str::uuid());
        $this->area('Established Local Area');
        app(SyncChangeDetector::class)->detect();
        $entity = SyncEntity::query()->firstOrFail();

        $this->artisan('sync:rebaseline-local --force')
            ->expectsOutputToContain('This computer is already provisioned for local synchronization.')
            ->assertFailed();

        $this->assertDatabaseHas('sync_entities', [
            'id' => $entity->id,
            'entity_uuid' => $entity->entity_uuid,
            'record_id' => $entity->record_id,
        ]);
        $this->assertDatabaseCount('service_areas', 1);
        Http::assertNothingSent();
    }

    public function test_fresh_local_provisioning_replaces_seeded_rows_with_verified_cloud_data(): void
    {
        $deviceUuid = (string) Str::uuid();
        $cloudNodeUuid = (string) Str::uuid();
        $installationUuid = (string) Str::uuid();
        $entityUuid = (string) Str::uuid();
        $change = $this->change($entityUuid, $deviceUuid, 'create', 0, 1, [
            'name' => 'Downloaded Cloud Area',
        ]);
        $change['sequence'] = 1;
        $line = implode(':', [$entityUuid, 1, $change['checksum'], 'active']);
        $tableHash = hash('sha256', $line);
        $manifest = [
            'tables' => [
                'service_areas' => [
                    'active' => 1,
                    'deleted' => 0,
                    'hash' => $tableHash,
                ],
            ],
            'root_hash' => hash('sha256', 'service_areas:'.$tableHash),
        ];

        $this->configureLocalClient($deviceUuid);
        $this->area('Seeded Local Row That Must Be Removed');

        Http::fake(function ($request) use ($cloudNodeUuid, $installationUuid, $change, $manifest) {
            if (str_ends_with($request->url(), '/sync/remote/handshake')) {
                return Http::response(['data' => [
                    'protocol_version' => 1,
                    'node_uuid' => $cloudNodeUuid,
                    'installation_uuid' => $installationUuid,
                    'latest_cursor' => 1,
                    'writer_mode' => 'cloud',
                ]]);
            }
            if (str_contains($request->url(), '/sync/remote/pull')) {
                $this->assertStringContainsString('include_own=1', $request->url());

                return Http::response(['data' => [
                    'changes' => [$change],
                    'next_cursor' => 1,
                    'has_more' => false,
                ]]);
            }
            if (str_ends_with($request->url(), '/sync/remote/manifest')) {
                return Http::response(['data' => $manifest]);
            }

            return Http::response(['message' => 'Unexpected test URL'], 500);
        });

        $this->artisan('sync:provision-local --force')
            ->expectsOutputToContain('This computer is ready for local WSMIS work.')
            ->assertSuccessful();

        $this->assertDatabaseCount('service_areas', 1);
        $this->assertSame('Downloaded Cloud Area', ServiceArea::query()->sole()->name);
        $this->assertDatabaseCount('sync_changes', 0);
        $this->assertDatabaseCount('sync_conflicts', 0);
        $state = app(SyncNodeManager::class)->state();
        $this->assertSame($deviceUuid, $state->node_uuid);
        $this->assertSame($installationUuid, $state->installation_uuid);
        $this->assertSame(1, $state->remote_cursor);
        $this->assertNotNull($state->initialized_at);
        $this->assertNotNull($state->last_verified_at);
    }

    public function test_fresh_local_provisioning_catches_up_with_cloud_changes_created_during_download(): void
    {
        $deviceUuid = (string) Str::uuid();
        $cloudNodeUuid = (string) Str::uuid();
        $installationUuid = (string) Str::uuid();
        $firstEntityUuid = (string) Str::uuid();
        $secondEntityUuid = (string) Str::uuid();
        $first = $this->change($firstEntityUuid, $deviceUuid, 'create', 0, 1, ['name' => 'Initial Cloud Area']);
        $second = $this->change($secondEntityUuid, $cloudNodeUuid, 'create', 0, 1, ['name' => 'Area Added During Setup']);
        $first['sequence'] = 1;
        $second['sequence'] = 2;

        $lines = collect([$first, $second])
            ->sortBy('entity_uuid')
            ->map(fn (array $change): string => implode(':', [
                $change['entity_uuid'],
                1,
                $change['checksum'],
                'active',
            ]));
        $tableHash = hash('sha256', $lines->implode('|'));
        $manifest = [
            'tables' => [
                'service_areas' => [
                    'active' => 2,
                    'deleted' => 0,
                    'hash' => $tableHash,
                ],
            ],
            'root_hash' => hash('sha256', 'service_areas:'.$tableHash),
        ];
        $pulls = 0;

        $this->configureLocalClient($deviceUuid);
        Http::fake(function ($request) use (
            $cloudNodeUuid,
            $installationUuid,
            $first,
            $second,
            $manifest,
            &$pulls,
        ) {
            if (str_ends_with($request->url(), '/sync/remote/handshake')) {
                return Http::response(['data' => [
                    'protocol_version' => 1,
                    'node_uuid' => $cloudNodeUuid,
                    'installation_uuid' => $installationUuid,
                    'latest_cursor' => 1,
                    'writer_mode' => 'cloud',
                ]]);
            }
            if (str_contains($request->url(), '/sync/remote/pull')) {
                $pulls++;

                return Http::response(['data' => $pulls === 1
                    ? ['changes' => [$first], 'next_cursor' => 1, 'has_more' => false]
                    : ['changes' => [$second], 'next_cursor' => 2, 'has_more' => false]]);
            }
            if (str_ends_with($request->url(), '/sync/remote/manifest')) {
                return Http::response(['data' => $manifest]);
            }

            return Http::response(['message' => 'Unexpected test URL'], 500);
        });

        $this->artisan('sync:provision-local --force')->assertSuccessful();

        $this->assertSame(2, $pulls);
        $this->assertSame(
            ['Area Added During Setup', 'Initial Cloud Area'],
            ServiceArea::query()->orderBy('name')->pluck('name')->all(),
        );
        $this->assertSame(2, app(SyncNodeManager::class)->state()->remote_cursor);
    }

    public function test_fresh_local_provisioning_rebases_equivalent_ignored_metadata(): void
    {
        config()->set('sync.ignored_columns.service_areas', ['updated_at']);
        $deviceUuid = (string) Str::uuid();
        $cloudNodeUuid = (string) Str::uuid();
        $installationUuid = (string) Str::uuid();
        $entityUuid = (string) Str::uuid();
        $area = $this->area('Metadata Rebase Area');
        $payload = (array) DB::table('service_areas')->where('id', $area->id)->first();
        unset($payload['id']);
        $historicalChecksum = app(SyncCatalog::class)->checksum($payload, []);
        $canonicalPayload = $payload;
        unset($canonicalPayload['updated_at']);
        $canonicalChecksum = app(SyncCatalog::class)->checksum($canonicalPayload, []);
        $change = $this->change($entityUuid, $deviceUuid, 'create', 0, 1, $payload);
        $change['checksum'] = $historicalChecksum;
        $change['sequence'] = 1;
        $line = implode(':', [$entityUuid, 1, $canonicalChecksum, 'active']);
        $tableHash = hash('sha256', $line);
        $manifest = [
            'tables' => [
                'service_areas' => [
                    'active' => 1,
                    'deleted' => 0,
                    'hash' => $tableHash,
                ],
            ],
            'root_hash' => hash('sha256', 'service_areas:'.$tableHash),
        ];

        $this->configureLocalClient($deviceUuid);
        Http::fake(function ($request) use ($cloudNodeUuid, $installationUuid, $change, $manifest) {
            if (str_ends_with($request->url(), '/sync/remote/handshake')) {
                return Http::response(['data' => [
                    'protocol_version' => 1,
                    'node_uuid' => $cloudNodeUuid,
                    'installation_uuid' => $installationUuid,
                    'latest_cursor' => 1,
                    'writer_mode' => 'cloud',
                ]]);
            }
            if (str_contains($request->url(), '/sync/remote/pull')) {
                return Http::response(['data' => [
                    'changes' => [$change],
                    'next_cursor' => 1,
                    'has_more' => false,
                ]]);
            }
            if (str_ends_with($request->url(), '/sync/remote/manifest')) {
                return Http::response(['data' => $manifest]);
            }

            return Http::response(['message' => 'Unexpected test URL'], 500);
        });

        $this->artisan('sync:provision-local --force')->assertSuccessful();

        $this->assertSame($canonicalChecksum, SyncEntity::query()->sole()->checksum);
        $this->assertDatabaseCount('sync_changes', 0);
    }

    public function test_online_record_created_while_local_computer_was_off_is_downloaded_on_next_sync(): void
    {
        $deviceUuid = (string) Str::uuid();
        $cloudNodeUuid = (string) Str::uuid();
        $installationUuid = (string) Str::uuid();
        $entityUuid = (string) Str::uuid();
        $remoteChange = $this->change($entityUuid, $cloudNodeUuid, 'create', 0, 1, ['name' => 'Created Online']);
        $remoteChange['sequence'] = 1;
        $this->configureLocalClient($deviceUuid);

        Http::fake(function ($request) use ($installationUuid, $cloudNodeUuid, $remoteChange) {
            $path = $request->url();
            if (str_ends_with($path, '/sync/remote/handshake')) {
                return Http::response(['data' => [
                    'protocol_version' => 1,
                    'node_uuid' => $cloudNodeUuid,
                    'installation_uuid' => $installationUuid,
                ]]);
            }
            if (str_contains($path, '/sync/remote/push')) {
                return Http::response(['data' => ['results' => []]]);
            }
            if (str_contains($path, '/sync/remote/pull')) {
                return Http::response(['data' => [
                    'changes' => [$remoteChange],
                    'next_cursor' => 1,
                    'has_more' => false,
                ]]);
            }
            if (str_contains($path, '/sync/remote/manifest')) {
                return Http::response(['data' => app(SyncIntegrityService::class)->manifest()]);
            }

            return Http::response(['message' => 'Unexpected test URL'], 500);
        });

        $run = app(OfflineSyncManager::class)->start(User::factory()->create(['status' => 'active'])->id);
        do {
            $run = app(OfflineSyncManager::class)->advance($run);
        } while ($run->status === 'running');

        $this->assertSame('completed', $run->status);
        $this->assertSame('Created Online', ServiceArea::query()->sole()->name);
        $this->assertSame(1, app(SyncNodeManager::class)->state()->remote_cursor);
    }

    public function test_network_failure_keeps_local_change_pending_for_safe_retry(): void
    {
        $deviceUuid = (string) Str::uuid();
        $installationUuid = (string) Str::uuid();
        $this->configureLocalClient($deviceUuid);
        $this->area('Offline Safe Area');

        Http::fake(function ($request) use ($installationUuid) {
            if (str_ends_with($request->url(), '/sync/remote/handshake')) {
                return Http::response(['data' => [
                    'protocol_version' => 1,
                    'node_uuid' => (string) Str::uuid(),
                    'installation_uuid' => $installationUuid,
                ]]);
            }

            return Http::response(['message' => 'Cloud temporarily unavailable'], 503);
        });

        $run = app(OfflineSyncManager::class)->start(User::factory()->create(['status' => 'active'])->id);
        do {
            $run = app(OfflineSyncManager::class)->advance($run);
        } while ($run->status === 'running');

        $this->assertSame('failed', $run->status);
        $this->assertSame(1, SyncChange::query()->whereNull('pushed_at')->count());
        $this->assertSame('Offline Safe Area', ServiceArea::query()->sole()->name);
    }

    public function test_same_content_with_newer_remote_version_advances_local_version_without_duplicate_row(): void
    {
        config()->set('sync.mode', 'cloud');
        $source = (string) Str::uuid();
        $entityUuid = (string) Str::uuid();
        $applier = app(SyncApplyService::class);
        $create = $this->change($entityUuid, $source, 'create', 0, 1, ['name' => 'Same Content']);
        $applier->apply($create, false, false);

        $newer = $this->change($entityUuid, $source, 'update', 3, 4, ['name' => 'Same Content']);
        $newer['checksum'] = $create['checksum'];
        $result = $applier->apply($newer, false, false);

        $this->assertSame('accepted', $result['status']);
        $this->assertSame(4, SyncEntity::query()->where('entity_uuid', $entityUuid)->value('version'));
        $this->assertDatabaseCount('service_areas', 1);
    }

    public function test_login_activity_does_not_create_a_user_sync_change(): void
    {
        config()->set('sync.tables', ['permissions', 'roles', 'users']);
        $user = User::factory()->create([
            'email' => 'sync-login@example.test',
            'password' => 'password123',
            'status' => 'active',
        ]);
        $detector = app(SyncChangeDetector::class);
        $detector->detect();
        SyncChange::query()->update(['pushed_at' => now()]);
        $updatedAt = DB::table('users')->where('id', $user->id)->value('updated_at');

        $this->travel(5)->minutes();
        $this->postJson('/api/auth/login', [
            'email' => 'sync-login@example.test',
            'password' => 'password123',
        ])->assertOk();

        $this->assertSame($updatedAt, DB::table('users')->where('id', $user->id)->value('updated_at'));
        $this->assertNotNull(DB::table('users')->where('id', $user->id)->value('last_login_at'));
        $result = $detector->detect();
        $this->assertSame(0, $result['created'] + $result['updated'] + $result['deleted']);
        $this->assertSame(0, SyncChange::query()->whereNull('pushed_at')->count());
    }

    public function test_newly_ignored_user_timestamp_rebases_metadata_without_creating_a_change(): void
    {
        config()->set('sync.tables', ['permissions', 'roles', 'users']);
        config()->set('sync.ignored_columns.users', ['remember_token', 'last_login_at']);
        $user = User::factory()->create(['status' => 'active']);
        $detector = app(SyncChangeDetector::class);
        $detector->detect();
        SyncChange::query()->update(['pushed_at' => now()]);
        $entity = SyncEntity::query()->where('table_name', 'users')->firstOrFail();
        $version = (int) $entity->version;

        DB::table('users')->where('id', $user->id)->update(['updated_at' => now()->addHour()]);
        config()->set('sync.ignored_columns.users', ['remember_token', 'last_login_at', 'updated_at']);
        $result = $detector->detect();

        $this->assertSame(0, $result['created'] + $result['updated'] + $result['deleted']);
        $this->assertSame($version, (int) $entity->fresh()->version);
        $this->assertArrayNotHasKey('updated_at', $entity->fresh()->snapshot['payload']);
        $this->assertSame(0, SyncChange::query()->whereNull('pushed_at')->count());
    }

    public function test_timestamp_only_user_conflict_is_resolved_automatically(): void
    {
        config()->set('sync.tables', ['permissions', 'roles', 'users']);
        $user = User::factory()->create(['status' => 'active']);
        app(SyncChangeDetector::class)->detect();
        SyncChange::query()->update(['pushed_at' => now()]);
        $entity = SyncEntity::query()->where('table_name', 'users')->firstOrFail();
        $remote = [
            'operation' => 'update',
            'payload' => $entity->snapshot['payload'] + ['updated_at' => now()->addHour()->toDateTimeString()],
            'relationships' => $entity->snapshot['relationships'] ?? [],
            'files' => [],
        ];
        SyncConflict::query()->create([
            'conflict_uuid' => (string) Str::uuid(),
            'entity_uuid' => $entity->entity_uuid,
            'table_name' => 'users',
            'local_snapshot' => $entity->snapshot,
            'remote_snapshot' => $remote,
            'local_version' => $entity->version,
            'remote_version' => $entity->version + 1,
            'reason' => 'The incoming change is based on an older record version.',
            'status' => 'open',
            'detected_at' => now(),
        ]);

        $this->assertSame(1, app(SyncApplyService::class)->resolveEquivalentConflicts());
        $this->assertDatabaseHas('sync_conflicts', [
            'entity_uuid' => $entity->entity_uuid,
            'status' => 'resolved',
            'resolution' => 'same_content',
        ]);
        $this->assertSame((int) $entity->version + 1, (int) $entity->fresh()->version);
        $this->assertSame($user->id, (int) $entity->fresh()->record_id);
    }

    public function test_full_system_catalog_can_be_scanned_twice_without_missing_tables_or_duplicate_outbox_rows(): void
    {
        $syncConfig = require config_path('sync.php');
        config()->set('sync.tables', $syncConfig['tables']);
        config()->set('sync.files', $syncConfig['files']);
        Storage::fake('local');
        Storage::fake('public');
        $this->seed(DatabaseSeeder::class);
        $detector = app(SyncChangeDetector::class);

        $first = $detector->detect();
        $firstChangeCount = SyncChange::query()->count();
        $second = $detector->detect();

        $this->assertGreaterThan(50, $first['created']);
        $this->assertSame($firstChangeCount, SyncChange::query()->count());
        $this->assertSame(0, $second['created'] + $second['updated'] + $second['deleted']);

        $serializedLine = DB::table('inventory_request_items')->whereNotNull('meter_ids')->first();
        $this->assertNotNull($serializedLine, 'The demo catalog should include a serialized meter issue.');
        $lineEntity = SyncEntity::query()
            ->where('table_name', 'inventory_request_items')
            ->where('record_id', $serializedLine->id)
            ->firstOrFail();
        $lineChange = SyncChange::query()->where('entity_uuid', $lineEntity->entity_uuid)->firstOrFail();
        $this->assertArrayNotHasKey('meter_ids', $lineChange->payload);
        $this->assertNotEmpty($lineChange->payload['__sync_meter_entities']);

        $meterEntityUuid = $lineChange->payload['__sync_meter_entities'][0];
        $meterEntity = SyncEntity::query()
            ->where('table_name', 'meters')
            ->where('entity_uuid', $meterEntityUuid)
            ->firstOrFail();
        $destinationMeterId = (int) DB::table('meters')
            ->where('id', '!=', $meterEntity->record_id)
            ->value('id');
        $this->assertGreaterThan(0, $destinationMeterId);

        SyncEntity::query()
            ->where('table_name', 'meters')
            ->where('record_id', $destinationMeterId)
            ->update(['record_id' => null]);
        $meterEntity->update(['record_id' => $destinationMeterId]);
        app(SyncCatalog::class)->applyVirtualFields(
            'inventory_request_items',
            (int) $serializedLine->id,
            $lineChange->payload,
        );

        $restoredMeterIds = json_decode(
            (string) DB::table('inventory_request_items')->where('id', $serializedLine->id)->value('meter_ids'),
            true,
            flags: JSON_THROW_ON_ERROR,
        );
        $this->assertSame([$destinationMeterId], $restoredMeterIds);

        foreach ([
            ['invoices', 'source_id'],
            ['accounting_transactions', 'source_id'],
            ['inventory_transactions', 'reference_id'],
        ] as [$table, $idColumn]) {
            $row = DB::table($table)->whereNotNull($idColumn)->first();
            $this->assertNotNull($row, "The demo catalog should exercise {$table}.{$idColumn}.");
            $entity = SyncEntity::query()
                ->where('table_name', $table)
                ->where('record_id', $row->id)
                ->firstOrFail();
            $change = SyncChange::query()->where('entity_uuid', $entity->entity_uuid)->firstOrFail();
            $virtualColumn = '__sync_indirect_'.$idColumn;
            $this->assertArrayNotHasKey($idColumn, $change->payload);
            $this->assertNotNull($change->payload[$virtualColumn]);
            $this->assertDatabaseHas('sync_entities', [
                'entity_uuid' => $change->payload[$virtualColumn]['entity_uuid'],
                'table_name' => $change->payload[$virtualColumn]['table_name'],
            ]);
        }
    }

    public function test_every_application_table_is_synchronized_or_explicitly_excluded(): void
    {
        $syncConfig = require config_path('sync.php');
        $known = collect($syncConfig['tables'])
            ->merge($syncConfig['excluded_tables'])
            ->unique();
        $unexpected = collect(Schema::getTables())
            ->pluck('name')
            ->reject(fn (string $table): bool => $table === 'sqlite_sequence' || $known->contains($table))
            ->sort()
            ->values()
            ->all();

        $this->assertSame([], $unexpected, 'New database tables must be added to sync.tables or sync.excluded_tables.');
    }

    public function test_keep_local_conflict_resolution_rebases_change_without_losing_local_edit(): void
    {
        $area = $this->area('Original');
        $detector = app(SyncChangeDetector::class);
        $detector->detect();
        SyncChange::query()->update(['pushed_at' => now()]);
        $area->update(['name' => 'Offline Edit']);
        $detector->detect();
        $entity = SyncEntity::query()->where('table_name', 'service_areas')->firstOrFail();
        $incoming = $this->change($entity->entity_uuid, (string) Str::uuid(), 'update', 1, 2, ['name' => 'Online Edit']);

        $this->assertSame('conflict', app(SyncApplyService::class)->apply($incoming, false, true)['status']);
        $user = User::factory()->create(['status' => 'active']);
        $conflict = SyncConflict::query()->firstOrFail();
        app(SyncApplyService::class)->resolveConflict($conflict, 'keep_local', $user->id);

        $pending = SyncChange::query()->whereNull('pushed_at')->sole();
        $this->assertSame(2, (int) $pending->base_version);
        $this->assertSame(3, (int) $pending->version);
        $this->assertSame('Offline Edit', ServiceArea::query()->sole()->name);
    }

    public function test_use_online_conflict_resolution_replaces_only_the_conflicted_record(): void
    {
        $area = $this->area('Original');
        $detector = app(SyncChangeDetector::class);
        $detector->detect();
        SyncChange::query()->update(['pushed_at' => now()]);
        $area->update(['name' => 'Offline Edit']);
        $detector->detect();
        $entity = SyncEntity::query()->where('table_name', 'service_areas')->firstOrFail();
        $incoming = $this->change($entity->entity_uuid, (string) Str::uuid(), 'update', 1, 2, ['name' => 'Online Edit']);

        app(SyncApplyService::class)->apply($incoming, false, true);
        $user = User::factory()->create(['status' => 'active']);
        app(SyncApplyService::class)->resolveConflict(SyncConflict::query()->firstOrFail(), 'use_remote', $user->id);

        $this->assertSame('Online Edit', ServiceArea::query()->sole()->name);
        $this->assertDatabaseCount('sync_changes', 1);
        $this->assertSame('resolved', SyncConflict::query()->sole()->status);
    }

    public function test_use_online_for_a_record_absent_from_cloud_deletes_local_copy_and_pending_change(): void
    {
        $area = $this->area('Local Only Area');
        app(SyncChangeDetector::class)->detect();
        $entity = SyncEntity::query()->where('table_name', 'service_areas')->firstOrFail();
        $conflict = SyncConflict::query()->create([
            'conflict_uuid' => (string) Str::uuid(),
            'entity_uuid' => $entity->entity_uuid,
            'table_name' => 'service_areas',
            'local_change_uuid' => SyncChange::query()->sole()->change_uuid,
            'local_snapshot' => $entity->snapshot,
            'remote_snapshot' => null,
            'local_version' => $entity->version,
            'remote_version' => 0,
            'reason' => 'The cloud record is absent.',
            'status' => 'open',
            'detected_at' => now(),
        ]);

        app(SyncApplyService::class)->resolveConflict(
            $conflict,
            'use_remote',
            User::factory()->create(['status' => 'active'])->id,
        );

        $this->assertDatabaseMissing('service_areas', ['id' => $area->id]);
        $this->assertDatabaseCount('sync_changes', 0);
        $this->assertNotNull($entity->fresh()->deleted_at);
    }

    public function test_unique_key_collision_is_quarantined_and_existing_record_is_preserved(): void
    {
        config()->set('sync.mode', 'cloud');
        config()->set('sync.tables', ['payment_methods']);
        $source = (string) Str::uuid();
        $applier = app(SyncApplyService::class);
        $first = $this->change((string) Str::uuid(), $source, 'create', 0, 1, [
            'name' => 'Sync Test Method', 'code' => 'offline_sync_unique', 'status' => 'active',
        ]);
        $first['table_name'] = 'payment_methods';
        $second = $this->change((string) Str::uuid(), $source, 'create', 0, 1, [
            'name' => 'Duplicate Sync Method', 'code' => 'offline_sync_unique', 'status' => 'active',
        ]);
        $second['table_name'] = 'payment_methods';

        $this->assertSame('accepted', $applier->apply($first, true, false)['status']);
        $this->assertSame('conflict', $applier->apply($second, true, false)['status']);
        $this->assertSame('Sync Test Method', DB::table('payment_methods')->where('code', 'offline_sync_unique')->value('name'));
        $this->assertSame(1, DB::table('payment_methods')->where('code', 'offline_sync_unique')->count());
    }

    public function test_parent_delete_that_would_orphan_customer_is_rejected_without_partial_loss(): void
    {
        config()->set('sync.mode', 'cloud');
        config()->set('sync.tables', ['service_areas', 'customers']);
        $area = $this->area('Protected Area');
        DB::table('customers')->insert([
            'service_area_id' => $area->id,
            'name' => 'Protected Customer',
            'opening_balance' => 0,
            'current_balance' => 0,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        app(SyncChangeDetector::class)->detect();
        $areaEntity = SyncEntity::query()->where('table_name', 'service_areas')->firstOrFail();
        $delete = $this->change(
            $areaEntity->entity_uuid,
            (string) Str::uuid(),
            'delete',
            (int) $areaEntity->version,
            (int) $areaEntity->version + 1,
            null,
        );

        $result = app(SyncApplyService::class)->apply($delete, true, false);
        $this->assertSame('conflict', $result['status']);
        $this->assertDatabaseCount('service_areas', 1);
        $this->assertDatabaseCount('customers', 1);
    }

    public function test_employee_login_role_assignments_are_included_in_user_sync_snapshot(): void
    {
        config()->set('sync.tables', ['permissions', 'roles', 'users']);
        $role = Role::findOrCreate('Meter Reader');
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        app(SyncChangeDetector::class)->detect();
        $entity = SyncEntity::query()->where('table_name', 'users')->where('record_id', $user->id)->firstOrFail();
        $change = SyncChange::query()->where('entity_uuid', $entity->entity_uuid)->firstOrFail();

        $this->assertContains('Meter Reader', $change->payload['__sync_roles']);
    }

    public function test_cloud_database_copy_adopts_registered_local_device_identity_without_changing_installation(): void
    {
        config()->set('sync.mode', 'cloud');
        $cloudState = app(SyncNodeManager::class)->state();
        $installationUuid = $cloudState->installation_uuid;
        $localDeviceUuid = (string) Str::uuid();

        config()->set('sync.mode', 'local');
        config()->set('sync.device_uuid', $localDeviceUuid);
        $localState = app(SyncNodeManager::class)->state();

        $this->assertSame($localDeviceUuid, $localState->node_uuid);
        $this->assertSame($installationUuid, $localState->installation_uuid);
        $this->assertSame('local', $localState->mode);
        $this->assertSame('cloud', $localState->writer_mode);
    }

    private function area(string $name): ServiceArea
    {
        return ServiceArea::query()->create([
            'name' => $name,
            'households_count' => 0,
            'rate_per_cubic_meter' => 10,
            'status' => 'active',
        ]);
    }

    private function change(
        string $entityUuid,
        string $source,
        string $operation,
        int $baseVersion,
        int $version,
        ?array $payload,
    ): array {
        return [
            'change_uuid' => (string) Str::uuid(),
            'entity_uuid' => $entityUuid,
            'table_name' => 'service_areas',
            'operation' => $operation,
            'base_version' => $baseVersion,
            'version' => $version,
            'payload' => $payload,
            'relationships' => [],
            'files' => [],
            'checksum' => $payload === null ? null : hash('sha256', json_encode($payload)),
            'source_node_uuid' => $source,
        ];
    }

    private function configureLocalClient(string $deviceUuid): void
    {
        config()->set('sync.enabled', true);
        config()->set('sync.mode', 'local');
        config()->set('sync.remote_url', 'https://cloud.test/api');
        config()->set('sync.device_uuid', $deviceUuid);
        config()->set('sync.device_secret', 'test-device-secret');
        config()->set('sync.batch_size', 100);
    }

    private function registeredDevice(string $name, string $secret): SyncDevice
    {
        return SyncDevice::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => $name,
            'token_hash' => Hash::make($secret),
            'status' => 'active',
        ]);
    }

    private function deviceHeaders(string $uuid, string $secret): array
    {
        return [
            'X-WSMIS-Device' => $uuid,
            'X-WSMIS-Device-Token' => $secret,
            'X-WSMIS-Sync-Protocol' => '1',
        ];
    }
}
