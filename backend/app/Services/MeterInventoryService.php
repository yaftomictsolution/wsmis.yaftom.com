<?php

namespace App\Services;

use App\Models\Good;
use App\Models\InventoryItem;
use App\Models\InventoryRequest;
use App\Models\InventoryRequestItem;
use App\Models\InventoryTransaction;
use App\Models\Meter;
use App\Models\MeterAssignment;
use App\Models\MeterMovement;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MeterInventoryService
{
    public function registerOpeningStock(array $data, User $actor): Meter
    {
        return DB::transaction(function () use ($data, $actor): Meter {
            $good = Good::query()->whereKey($data['good_id'])->lockForUpdate()->firstOrFail();
            $warehouse = Warehouse::query()->whereKey($data['warehouse_id'])->lockForUpdate()->firstOrFail();
            $this->assertMeterGoodAndWarehouse($good, $warehouse);

            $item = $this->stockItemFor($good, $warehouse, null, (float) $data['purchase_cost']);
            $oldQuantity = (float) $item->quantity;
            $newQuantity = $oldQuantity + 1;
            $weightedCost = (($oldQuantity * (float) $item->unit_cost) + (float) $data['purchase_cost']) / $newQuantity;
            $item->update([
                'quantity' => $newQuantity,
                'unit_cost' => round($weightedCost, 2),
            ]);

            $meter = Meter::query()->create([
                'good_id' => $good->id,
                'inventory_item_id' => $item->id,
                'source_warehouse_id' => $warehouse->id,
                'current_warehouse_id' => $warehouse->id,
                'source_type' => 'opening_stock',
                'purchase_cost' => round((float) $data['purchase_cost'], 2),
                'meter_number' => trim($data['meter_number']),
                'type' => $data['type'] ?? $good->name,
                'status' => 'available',
                'condition_notes' => $data['condition_notes'] ?? null,
                'purchased_at' => $data['purchased_at'] ?? $data['received_at'],
                'received_at' => $data['received_at'],
            ]);

            $transaction = InventoryTransaction::query()->create([
                'inventory_item_id' => $item->id,
                'type' => 'adjustment',
                'quantity' => 1,
                'unit_cost' => $meter->purchase_cost,
                'unit_price' => $item->unit_price,
                'total_amount' => $meter->purchase_cost,
                'transaction_date' => $data['received_at'],
                'reference_type' => Meter::class,
                'reference_id' => $meter->id,
                'notes' => 'Opening meter stock: '.$meter->meter_number,
                'created_by' => $actor->id,
            ]);

            $this->movement($meter, [
                'type' => 'opening_stock',
                'to_warehouse_id' => $warehouse->id,
                'inventory_transaction_id' => $transaction->id,
                'movement_date' => $data['received_at'],
                'condition' => 'available',
                'notes' => $data['condition_notes'] ?? 'Opening meter stock registered by an administrator.',
                'created_by' => $actor->id,
            ]);

            return $meter->fresh()->load($this->meterRelations());
        });
    }

    public function receivePurchasedMeters(
        InventoryRequest $request,
        InventoryRequestItem $line,
        InventoryItem $stockItem,
        InventoryTransaction $transaction,
        User $actor,
    ): void {
        $serials = collect($line->meter_serials ?? [])
            ->map(fn ($serial) => trim((string) $serial))
            ->filter()
            ->values();

        $quantity = (float) $line->quantity;
        if (abs($quantity - round($quantity)) > 0.0001 || $serials->count() !== (int) round($quantity)) {
            throw ValidationException::withMessages([
                'items' => ["{$line->description} requires one unique meter serial for every purchased piece."],
            ]);
        }

        $duplicate = $serials->duplicates()->first();
        if ($duplicate) {
            throw ValidationException::withMessages([
                'items' => ["Meter serial {$duplicate} appears more than once."],
            ]);
        }

        $existing = Meter::query()->whereIn('meter_number', $serials)->lockForUpdate()->value('meter_number');
        if ($existing) {
            throw ValidationException::withMessages([
                'items' => ["Meter serial {$existing} is already registered."],
            ]);
        }

        foreach ($serials as $serial) {
            $meter = Meter::query()->create([
                'good_id' => $line->good_id,
                'inventory_item_id' => $stockItem->id,
                'purchase_request_item_id' => $line->id,
                'supplier_id' => $request->supplier_id,
                'source_warehouse_id' => $request->warehouse_id,
                'current_warehouse_id' => $request->warehouse_id,
                'source_type' => 'purchase',
                'purchase_cost' => $line->unit_price,
                'meter_number' => $serial,
                'type' => $line->description,
                'status' => 'available',
                'condition_notes' => 'Received in purchase '.$request->request_number.'.',
                'purchased_at' => $request->request_date,
                'received_at' => $request->request_date,
            ]);

            $this->movement($meter, [
                'type' => 'purchase_receipt',
                'to_warehouse_id' => $request->warehouse_id,
                'inventory_transaction_id' => $transaction->id,
                'movement_date' => $request->request_date,
                'condition' => 'available',
                'notes' => "Received from {$request->supplier?->name} through {$request->request_number}.",
                'created_by' => $actor->id,
            ]);
        }
    }

    public function ensureLegacyProvenance(Meter $meter, User $actor): Meter
    {
        if ($meter->good_id && $meter->inventory_item_id && $meter->source_warehouse_id) {
            return $meter;
        }

        $warehouse = $this->defaultWarehouse();
        $good = $this->legacyGood();
        $item = $this->stockItemFor($good, $warehouse, null, 0);

        if ($meter->status === 'available') {
            $item->increment('quantity', 1);
            $transaction = InventoryTransaction::query()->create([
                'inventory_item_id' => $item->id,
                'type' => 'adjustment',
                'quantity' => 1,
                'unit_cost' => 0,
                'unit_price' => $item->unit_price,
                'total_amount' => 0,
                'transaction_date' => now()->toDateString(),
                'reference_type' => Meter::class,
                'reference_id' => $meter->id,
                'notes' => 'Legacy meter adopted into opening stock.',
                'created_by' => $actor->id,
            ]);
        } else {
            $transaction = null;
        }

        $meter->update([
            'good_id' => $good->id,
            'inventory_item_id' => $item->id,
            'source_warehouse_id' => $warehouse->id,
            'current_warehouse_id' => $meter->status === 'available' ? $warehouse->id : null,
            'source_type' => 'opening_stock',
            'purchase_cost' => 0,
            'received_at' => $meter->purchased_at ?? now()->toDateString(),
        ]);

        if (! $meter->movements()->exists()) {
            $this->movement($meter, [
                'type' => 'opening_stock',
                'to_warehouse_id' => $warehouse->id,
                'inventory_transaction_id' => $transaction?->id,
                'movement_date' => $meter->created_at ?? now(),
                'condition' => $meter->status,
                'notes' => 'Legacy meter adopted into serialized inventory.',
                'created_by' => $actor->id,
            ]);
        }

        return $meter->refresh();
    }

    public function issueForAssignment(
        Meter $meter,
        MeterAssignment $assignment,
        User $actor,
        mixed $movementDate,
    ): void {
        $meter = $this->ensureLegacyProvenance($meter, $actor);
        $meter = Meter::query()->whereKey($meter->id)->lockForUpdate()->firstOrFail();

        if ($meter->status !== 'available' || ! $meter->current_warehouse_id || ! $meter->inventory_item_id) {
            throw ValidationException::withMessages([
                'meter_id' => ['Only an available serialized meter held in a warehouse can be assigned.'],
            ]);
        }
        if ($assignment->source_warehouse_id && (int) $assignment->source_warehouse_id !== (int) $meter->current_warehouse_id) {
            throw ValidationException::withMessages([
                'source_warehouse_id' => ['The selected meter is no longer available in this warehouse.'],
            ]);
        }

        $item = InventoryItem::query()->whereKey($meter->inventory_item_id)->lockForUpdate()->firstOrFail();
        if ((float) $item->quantity + 0.0001 < 1) {
            throw ValidationException::withMessages([
                'meter_id' => ['Warehouse stock is out of balance for this meter. Reconcile the meter register before assignment.'],
            ]);
        }

        $fromWarehouseId = $meter->current_warehouse_id;
        $item->update(['quantity' => round((float) $item->quantity - 1, 2)]);
        $transaction = InventoryTransaction::query()->create([
            'inventory_item_id' => $item->id,
            'type' => 'internal_use',
            'quantity' => -1,
            'unit_cost' => $meter->purchase_cost,
            'unit_price' => $item->unit_price,
            'total_amount' => $meter->purchase_cost,
            'transaction_date' => $this->dateOnly($movementDate),
            'reference_type' => MeterAssignment::class,
            'reference_id' => $assignment->id,
            'notes' => "Meter {$meter->meter_number} installed for customer.",
            'created_by' => $actor->id,
        ]);

        $meter->update([
            'status' => 'installed',
            'current_warehouse_id' => null,
        ]);
        $this->movement($meter, [
            'type' => 'customer_installation',
            'from_warehouse_id' => $fromWarehouseId,
            'customer_id' => $assignment->customer_id,
            'meter_assignment_id' => $assignment->id,
            'inventory_transaction_id' => $transaction->id,
            'movement_date' => $movementDate,
            'condition' => 'installed',
            'notes' => "Installed under assignment #{$assignment->id}.",
            'created_by' => $actor->id,
        ]);
    }

    public function releaseFromAssignment(
        MeterAssignment $assignment,
        User $actor,
        string $disposition,
        ?int $warehouseId,
        string $reason,
        mixed $movementDate,
    ): void {
        $meter = Meter::query()->whereKey($assignment->meter_id)->lockForUpdate()->firstOrFail();
        $meter = $this->ensureLegacyProvenance($meter, $actor);

        if ($disposition === 'return_to_stock') {
            $warehouse = Warehouse::query()
                ->whereKey($warehouseId ?: $meter->source_warehouse_id)
                ->lockForUpdate()
                ->first();
            if (! $warehouse || $warehouse->status !== 'active') {
                throw ValidationException::withMessages([
                    'return_warehouse_id' => ['Select an active warehouse for the returned meter.'],
                ]);
            }

            $good = Good::query()->whereKey($meter->good_id)->firstOrFail();
            $item = $this->stockItemFor($good, $warehouse, $meter->supplier_id, (float) $meter->purchase_cost);
            $item = InventoryItem::query()->whereKey($item->id)->lockForUpdate()->firstOrFail();
            $item->update(['quantity' => round((float) $item->quantity + 1, 2)]);
            $transaction = InventoryTransaction::query()->create([
                'inventory_item_id' => $item->id,
                'type' => 'return',
                'quantity' => 1,
                'unit_cost' => $meter->purchase_cost,
                'unit_price' => $item->unit_price,
                'total_amount' => $meter->purchase_cost,
                'transaction_date' => $this->dateOnly($movementDate),
                'reference_type' => MeterAssignment::class,
                'reference_id' => $assignment->id,
                'notes' => "Meter {$meter->meter_number} returned to stock.",
                'created_by' => $actor->id,
            ]);

            $meter->update([
                'inventory_item_id' => $item->id,
                'current_warehouse_id' => $warehouse->id,
                'status' => 'available',
            ]);
            $assignment->update([
                'return_warehouse_id' => $warehouse->id,
                'removal_disposition' => $disposition,
            ]);
            $this->movement($meter, [
                'type' => 'warehouse_return',
                'to_warehouse_id' => $warehouse->id,
                'customer_id' => $assignment->customer_id,
                'meter_assignment_id' => $assignment->id,
                'inventory_transaction_id' => $transaction->id,
                'movement_date' => $movementDate,
                'condition' => 'available',
                'notes' => $reason,
                'created_by' => $actor->id,
            ]);

            return;
        }

        $status = $disposition === 'scrap' ? 'inactive' : 'broken';
        $meter->update([
            'status' => $status,
            'current_warehouse_id' => null,
            'retired_at' => $disposition === 'scrap' ? $movementDate : null,
        ]);
        $assignment->update([
            'return_warehouse_id' => null,
            'removal_disposition' => $disposition,
        ]);
        $this->movement($meter, [
            'type' => $disposition === 'scrap' ? 'scrapped' : 'sent_to_repair',
            'customer_id' => $assignment->customer_id,
            'meter_assignment_id' => $assignment->id,
            'movement_date' => $movementDate,
            'condition' => $status,
            'notes' => $reason,
            'created_by' => $actor->id,
        ]);
    }

    public function issueRequestMeters(
        InventoryRequest $request,
        InventoryRequestItem $line,
        InventoryTransaction $transaction,
        User $actor,
    ): void {
        $ids = collect($line->meter_ids ?? [])->map(fn ($id) => (int) $id)->filter()->values();
        if ($ids->count() !== (int) round((float) $line->quantity)) {
            throw ValidationException::withMessages([
                'items' => ["Select the exact meter serials issued for {$line->description}."],
            ]);
        }

        $meters = Meter::query()->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get();
        if ($meters->count() !== $ids->count()) {
            throw ValidationException::withMessages(['items' => ['One or more selected meter serials no longer exist.']]);
        }

        foreach ($meters as $meter) {
            if (
                $meter->status !== 'available'
                || (int) $meter->inventory_item_id !== (int) $line->inventory_item_id
                || (int) $meter->current_warehouse_id !== (int) $request->warehouse_id
            ) {
                throw ValidationException::withMessages([
                    'items' => ["Meter {$meter->meter_number} is no longer available in the selected warehouse."],
                ]);
            }

            $fromWarehouseId = $meter->current_warehouse_id;
            $meter->update([
                'status' => $request->issue_type === 'customer' ? 'sold' : 'issued',
                'current_warehouse_id' => null,
            ]);
            $this->movement($meter, [
                'type' => $request->issue_type === 'customer' ? 'customer_sale' : 'internal_issue',
                'from_warehouse_id' => $fromWarehouseId,
                'customer_id' => $request->customer_id,
                'inventory_transaction_id' => $transaction->id,
                'movement_date' => $request->request_date,
                'condition' => $meter->status,
                'notes' => "Issued through {$request->request_number}.",
                'created_by' => $actor->id,
            ]);
        }
    }

    public function retire(Meter $meter, User $actor, string $reason): Meter
    {
        return DB::transaction(function () use ($meter, $actor, $reason): Meter {
            $meter = Meter::query()->whereKey($meter->id)->lockForUpdate()->firstOrFail();
            if ($meter->status === 'installed' || $meter->assignments()->where('status', 'active')->exists()) {
                throw ValidationException::withMessages([
                    'meter' => ['Remove the active customer assignment before retiring this meter.'],
                ]);
            }

            $meter = $this->ensureLegacyProvenance($meter, $actor);
            $fromWarehouseId = $meter->current_warehouse_id;
            $transaction = null;
            if ($meter->status === 'available' && $meter->inventory_item_id && $fromWarehouseId) {
                $item = InventoryItem::query()->whereKey($meter->inventory_item_id)->lockForUpdate()->firstOrFail();
                if ((float) $item->quantity + 0.0001 < 1) {
                    throw ValidationException::withMessages([
                        'meter' => ['Warehouse stock is out of balance for this meter.'],
                    ]);
                }
                $item->update(['quantity' => round((float) $item->quantity - 1, 2)]);
                $transaction = InventoryTransaction::query()->create([
                    'inventory_item_id' => $item->id,
                    'type' => 'adjustment',
                    'quantity' => -1,
                    'unit_cost' => $meter->purchase_cost,
                    'unit_price' => $item->unit_price,
                    'total_amount' => $meter->purchase_cost,
                    'transaction_date' => now()->toDateString(),
                    'reference_type' => Meter::class,
                    'reference_id' => $meter->id,
                    'notes' => 'Meter retired from warehouse stock.',
                    'created_by' => $actor->id,
                ]);
            }

            $meter->update([
                'status' => 'inactive',
                'current_warehouse_id' => null,
                'retired_at' => now(),
                'condition_notes' => trim(($meter->condition_notes ? $meter->condition_notes."\n" : '').$reason),
            ]);
            $this->movement($meter, [
                'type' => 'retired',
                'from_warehouse_id' => $fromWarehouseId,
                'inventory_transaction_id' => $transaction?->id,
                'movement_date' => now(),
                'condition' => 'inactive',
                'notes' => $reason,
                'created_by' => $actor->id,
            ]);

            return $meter->fresh()->load($this->meterRelations());
        });
    }

    public function returnFromRepair(
        Meter $meter,
        Warehouse $warehouse,
        User $actor,
        string $notes,
        mixed $returnedAt,
    ): Meter {
        return DB::transaction(function () use ($meter, $warehouse, $actor, $notes, $returnedAt): Meter {
            $meter = Meter::query()->whereKey($meter->id)->lockForUpdate()->firstOrFail();
            $warehouse = Warehouse::query()->whereKey($warehouse->id)->lockForUpdate()->firstOrFail();
            if ($meter->status !== 'broken' || $meter->current_warehouse_id) {
                throw ValidationException::withMessages([
                    'meter' => ['Only a meter currently recorded as under repair can be returned to stock.'],
                ]);
            }
            if ($warehouse->status !== 'active') {
                throw ValidationException::withMessages([
                    'warehouse_id' => ['Select an active warehouse.'],
                ]);
            }

            $meter = $this->ensureLegacyProvenance($meter, $actor);
            $good = Good::query()->whereKey($meter->good_id)->firstOrFail();
            $item = $this->stockItemFor($good, $warehouse, $meter->supplier_id, (float) $meter->purchase_cost);
            $item = InventoryItem::query()->whereKey($item->id)->lockForUpdate()->firstOrFail();
            $item->update(['quantity' => round((float) $item->quantity + 1, 2)]);
            $transaction = InventoryTransaction::query()->create([
                'inventory_item_id' => $item->id,
                'type' => 'return',
                'quantity' => 1,
                'unit_cost' => $meter->purchase_cost,
                'unit_price' => $item->unit_price,
                'total_amount' => $meter->purchase_cost,
                'transaction_date' => $this->dateOnly($returnedAt),
                'reference_type' => Meter::class,
                'reference_id' => $meter->id,
                'notes' => "Meter {$meter->meter_number} returned after repair.",
                'created_by' => $actor->id,
            ]);

            $meter->update([
                'inventory_item_id' => $item->id,
                'current_warehouse_id' => $warehouse->id,
                'status' => 'available',
                'retired_at' => null,
                'condition_notes' => trim(($meter->condition_notes ? $meter->condition_notes."\n" : '').$notes),
            ]);
            $this->movement($meter, [
                'type' => 'repair_return',
                'to_warehouse_id' => $warehouse->id,
                'inventory_transaction_id' => $transaction->id,
                'movement_date' => $returnedAt,
                'condition' => 'available',
                'notes' => $notes,
                'created_by' => $actor->id,
            ]);

            return $meter->fresh()->load($this->meterRelations());
        });
    }

    private function stockItemFor(
        Good $good,
        Warehouse $warehouse,
        ?int $supplierId,
        float $unitCost,
    ): InventoryItem {
        $item = InventoryItem::query()
            ->where('good_id', $good->id)
            ->where('warehouse_id', $warehouse->id)
            ->lockForUpdate()
            ->first();
        if ($item) {
            return $item;
        }

        return InventoryItem::query()->create([
            'good_id' => $good->id,
            'warehouse_id' => $warehouse->id,
            'name' => $good->name,
            'code' => $this->uniqueStockCode($good->code, $warehouse->code),
            'category' => 'meter',
            'unit' => 'piece',
            'quantity' => 0,
            'unit_cost' => round($unitCost, 2),
            'unit_price' => $good->default_price,
            'reorder_level' => 1,
            'supplier_id' => $supplierId,
            'notes' => 'Serialized meter inventory.',
        ]);
    }

    private function defaultWarehouse(): Warehouse
    {
        return Warehouse::query()->where('code', 'WH-MAIN')->where('status', 'active')->first()
            ?? Warehouse::query()->where('status', 'active')->orderBy('id')->first()
            ?? Warehouse::query()->create([
                'name' => 'Legacy Meter Store',
                'code' => 'WH-METER-LEGACY',
                'status' => 'active',
                'notes' => 'Created automatically for opening meter stock.',
            ]);
    }

    private function legacyGood(): Good
    {
        return Good::query()->firstOrCreate(
            ['code' => 'METER-LEGACY'],
            [
                'name' => 'Legacy Water Meter',
                'category' => 'meter',
                'unit' => 'piece',
                'default_cost' => 0,
                'default_price' => 0,
                'status' => 'active',
                'description' => 'Opening-stock product for meters without a historical purchase.',
            ],
        );
    }

    private function assertMeterGoodAndWarehouse(Good $good, Warehouse $warehouse): void
    {
        if ($good->category !== 'meter' || $good->status !== 'active') {
            throw ValidationException::withMessages([
                'good_id' => ['Select an active product from the Meter category.'],
            ]);
        }
        if ($warehouse->status !== 'active') {
            throw ValidationException::withMessages([
                'warehouse_id' => ['Select an active warehouse.'],
            ]);
        }
    }

    private function movement(Meter $meter, array $data): MeterMovement
    {
        return $meter->movements()->create($data);
    }

    private function uniqueStockCode(string $goodCode, string $warehouseCode): string
    {
        $base = $goodCode;
        if (! InventoryItem::query()->where('code', $base)->exists()) {
            return $base;
        }

        $base = $goodCode.'-'.$warehouseCode;
        $code = $base;
        $suffix = 2;
        while (InventoryItem::query()->where('code', $code)->exists()) {
            $code = $base.'-'.$suffix;
            $suffix++;
        }

        return $code;
    }

    private function dateOnly(mixed $value): string
    {
        return substr((string) $value, 0, 10);
    }

    private function meterRelations(): array
    {
        return [
            'good:id,name,code,category',
            'inventoryItem:id,good_id,warehouse_id,name,code,quantity,unit_cost',
            'supplier:id,name',
            'sourceWarehouse:id,name,code',
            'currentWarehouse:id,name,code',
            'purchaseItem.request:id,request_number,supplier_id,warehouse_id,request_date',
            'activeAssignment.customer:id,name,house_number',
            'movements.fromWarehouse:id,name,code',
            'movements.toWarehouse:id,name,code',
            'movements.customer:id,name',
            'movements.creator:id,name',
        ];
    }
}
