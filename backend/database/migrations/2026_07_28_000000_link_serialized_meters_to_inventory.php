<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_request_items', function (Blueprint $table): void {
            $table->json('meter_serials')->nullable()->after('total_price');
            $table->json('meter_ids')->nullable()->after('meter_serials');
        });

        Schema::table('meters', function (Blueprint $table): void {
            $table->foreignId('good_id')->nullable()->after('id')->constrained('goods')->nullOnDelete();
            $table->foreignId('inventory_item_id')->nullable()->after('good_id')->constrained('inventory_items')->nullOnDelete();
            $table->foreignId('purchase_request_item_id')->nullable()->after('inventory_item_id')->constrained('inventory_request_items')->nullOnDelete();
            $table->foreignId('supplier_id')->nullable()->after('purchase_request_item_id')->constrained('suppliers')->nullOnDelete();
            $table->foreignId('source_warehouse_id')->nullable()->after('supplier_id')->constrained('warehouses')->nullOnDelete();
            $table->foreignId('current_warehouse_id')->nullable()->after('source_warehouse_id')->constrained('warehouses')->nullOnDelete();
            $table->string('source_type')->default('opening_stock')->after('current_warehouse_id');
            $table->decimal('purchase_cost', 16, 2)->default(0)->after('source_type');
            $table->date('received_at')->nullable()->after('purchased_at');
            $table->timestamp('retired_at')->nullable()->after('received_at');

            $table->index(['current_warehouse_id', 'status'], 'meters_current_warehouse_status_index');
            $table->index(['inventory_item_id', 'status'], 'meters_inventory_item_status_index');
        });

        Schema::table('meter_assignments', function (Blueprint $table): void {
            $table->foreignId('source_warehouse_id')->nullable()->after('meter_id')->constrained('warehouses')->nullOnDelete();
            $table->foreignId('return_warehouse_id')->nullable()->after('source_warehouse_id')->constrained('warehouses')->nullOnDelete();
            $table->string('removal_disposition')->nullable()->after('removed_at');
        });

        Schema::create('meter_movements', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('meter_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->string('type', 50);
            $table->foreignId('from_warehouse_id')->nullable()->constrained('warehouses')->nullOnDelete();
            $table->foreignId('to_warehouse_id')->nullable()->constrained('warehouses')->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('meter_assignment_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('inventory_transaction_id')->nullable()->constrained()->nullOnDelete();
            $table->dateTime('movement_date');
            $table->string('condition')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['meter_id', 'movement_date']);
            $table->index(['to_warehouse_id', 'type']);
            $table->index(['customer_id', 'type']);
        });

        $this->backfillExistingMeters();
        $this->backfillExistingSerializedStock();
    }

    public function down(): void
    {
        Schema::dropIfExists('meter_movements');

        Schema::table('meter_assignments', function (Blueprint $table): void {
            $table->dropForeign(['source_warehouse_id']);
            $table->dropForeign(['return_warehouse_id']);
            $table->dropColumn(['source_warehouse_id', 'return_warehouse_id', 'removal_disposition']);
        });

        Schema::table('meters', function (Blueprint $table): void {
            $table->dropIndex('meters_current_warehouse_status_index');
            $table->dropIndex('meters_inventory_item_status_index');
            $table->dropForeign(['good_id']);
            $table->dropForeign(['inventory_item_id']);
            $table->dropForeign(['purchase_request_item_id']);
            $table->dropForeign(['supplier_id']);
            $table->dropForeign(['source_warehouse_id']);
            $table->dropForeign(['current_warehouse_id']);
            $table->dropColumn([
                'good_id',
                'inventory_item_id',
                'purchase_request_item_id',
                'supplier_id',
                'source_warehouse_id',
                'current_warehouse_id',
                'source_type',
                'purchase_cost',
                'received_at',
                'retired_at',
            ]);
        });

        Schema::table('inventory_request_items', function (Blueprint $table): void {
            $table->dropColumn(['meter_serials', 'meter_ids']);
        });
    }

    private function backfillExistingMeters(): void
    {
        if (! DB::table('meters')->exists()) {
            return;
        }

        $now = now();
        $warehouseId = DB::table('warehouses')
            ->where('code', 'WH-MAIN')
            ->value('id')
            ?? DB::table('warehouses')->where('status', 'active')->orderBy('id')->value('id');

        if (! $warehouseId) {
            $warehouseId = DB::table('warehouses')->insertGetId([
                'name' => 'Legacy Meter Store',
                'code' => 'WH-METER-LEGACY',
                'status' => 'active',
                'notes' => 'Created automatically to preserve meters registered before serialized inventory tracking.',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $goodId = DB::table('goods')->where('code', 'METER-LEGACY')->value('id');
        if (! $goodId) {
            $goodId = DB::table('goods')->insertGetId([
                'name' => 'Legacy Water Meter',
                'code' => 'METER-LEGACY',
                'category' => 'meter',
                'unit' => 'piece',
                'default_cost' => 0,
                'default_price' => 0,
                'status' => 'active',
                'description' => 'Opening-stock product used for meters registered before purchase tracking.',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $stockCode = 'METER-LEGACY-'.$warehouseId;
        $inventoryItemId = DB::table('inventory_items')->where('code', $stockCode)->value('id');
        if (! $inventoryItemId) {
            $inventoryItemId = DB::table('inventory_items')->insertGetId([
                'good_id' => $goodId,
                'warehouse_id' => $warehouseId,
                'name' => 'Legacy Water Meter',
                'code' => $stockCode,
                'category' => 'meter',
                'unit' => 'piece',
                'quantity' => 0,
                'unit_cost' => 0,
                'unit_price' => 0,
                'reorder_level' => 1,
                'notes' => 'Serialized opening stock migrated from the original meter register.',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $meters = DB::table('meters')->whereNull('good_id')->orderBy('id')->get();
        $availableCount = 0;

        foreach ($meters as $meter) {
            $isAvailable = $meter->status === 'available';
            if ($isAvailable) {
                $availableCount++;
            }

            DB::table('meters')->where('id', $meter->id)->update([
                'good_id' => $goodId,
                'inventory_item_id' => $inventoryItemId,
                'source_warehouse_id' => $warehouseId,
                'current_warehouse_id' => $isAvailable ? $warehouseId : null,
                'source_type' => 'opening_stock',
                'purchase_cost' => 0,
                'received_at' => $meter->purchased_at
                    ?: ($meter->created_at ? substr((string) $meter->created_at, 0, 10) : $now->toDateString()),
                'updated_at' => $now,
            ]);

            DB::table('meter_movements')->insert([
                'meter_id' => $meter->id,
                'type' => 'opening_stock',
                'to_warehouse_id' => $warehouseId,
                'movement_date' => $meter->created_at ?: $now,
                'condition' => $meter->status,
                'notes' => 'Imported from the original meter register.',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        if ($availableCount > 0) {
            DB::table('inventory_items')->where('id', $inventoryItemId)->update([
                'quantity' => DB::raw('quantity + '.(int) $availableCount),
                'updated_at' => $now,
            ]);

            DB::table('inventory_transactions')->insert([
                'inventory_item_id' => $inventoryItemId,
                'type' => 'adjustment',
                'quantity' => $availableCount,
                'unit_cost' => 0,
                'unit_price' => 0,
                'total_amount' => 0,
                'transaction_date' => $now->toDateString(),
                'reference_type' => 'App\\Models\\InventoryItem',
                'reference_id' => $inventoryItemId,
                'notes' => 'Opening balance for existing available meter serials.',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    private function backfillExistingSerializedStock(): void
    {
        $now = now();
        $items = DB::table('inventory_items')
            ->join('warehouses', 'warehouses.id', '=', 'inventory_items.warehouse_id')
            ->where('inventory_items.category', 'meter')
            ->select('inventory_items.*', 'warehouses.code as warehouse_code')
            ->get();

        foreach ($items as $item) {
            if (str_starts_with((string) $item->code, 'METER-LEGACY-')) {
                continue;
            }

            $existingCount = DB::table('meters')
                ->where('inventory_item_id', $item->id)
                ->where('status', 'available')
                ->count();
            $required = max(0, (int) floor((float) $item->quantity + 0.0001) - $existingCount);

            for ($index = 1; $index <= $required; $index++) {
                $serial = 'STOCK-'.$item->warehouse_code.'-'.$item->id.'-'.str_pad((string) ($existingCount + $index), 4, '0', STR_PAD_LEFT);
                $meterId = DB::table('meters')->insertGetId([
                    'good_id' => $item->good_id,
                    'inventory_item_id' => $item->id,
                    'supplier_id' => $item->supplier_id,
                    'source_warehouse_id' => $item->warehouse_id,
                    'current_warehouse_id' => $item->warehouse_id,
                    'source_type' => 'inventory_opening',
                    'purchase_cost' => $item->unit_cost,
                    'meter_number' => $serial,
                    'type' => $item->name,
                    'status' => 'available',
                    'condition_notes' => 'Opening-stock placeholder. Replace this number with the physical meter serial before assignment.',
                    'purchased_at' => $now->toDateString(),
                    'received_at' => $now->toDateString(),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                DB::table('meter_movements')->insert([
                    'meter_id' => $meterId,
                    'type' => 'inventory_opening',
                    'to_warehouse_id' => $item->warehouse_id,
                    'movement_date' => $now,
                    'condition' => 'available',
                    'notes' => 'Generated to reconcile existing aggregate meter stock with serialized units.',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }
};
