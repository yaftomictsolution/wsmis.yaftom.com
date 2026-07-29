<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $meters = DB::table('meters')
            ->where('source_type', 'inventory_opening')
            ->whereNull('purchase_request_item_id')
            ->get();

        foreach ($meters as $meter) {
            $purchaseLine = DB::table('inventory_request_items')
                ->join('inventory_requests', 'inventory_requests.id', '=', 'inventory_request_items.inventory_request_id')
                ->where('inventory_request_items.inventory_item_id', $meter->inventory_item_id)
                ->where('inventory_requests.type', 'purchase')
                ->where('inventory_requests.status', 'approved')
                ->orderByDesc('inventory_requests.request_date')
                ->orderByDesc('inventory_requests.id')
                ->select([
                    'inventory_request_items.id',
                    'inventory_request_items.unit_price',
                    'inventory_requests.id as request_id',
                    'inventory_requests.request_number',
                    'inventory_requests.supplier_id',
                    'inventory_requests.warehouse_id',
                    'inventory_requests.request_date',
                ])
                ->first();

            if (! $purchaseLine) {
                continue;
            }

            DB::table('meters')->where('id', $meter->id)->update([
                'purchase_request_item_id' => $purchaseLine->id,
                'supplier_id' => $purchaseLine->supplier_id,
                'source_warehouse_id' => $purchaseLine->warehouse_id,
                'source_type' => 'purchase',
                'purchase_cost' => $purchaseLine->unit_price,
                'purchased_at' => $purchaseLine->request_date,
                'received_at' => $purchaseLine->request_date,
                'updated_at' => now(),
            ]);

            DB::table('meter_movements')
                ->where('meter_id', $meter->id)
                ->where('type', 'inventory_opening')
                ->update([
                    'type' => 'purchase_receipt',
                    'notes' => "Reconciled with historical purchase {$purchaseLine->request_number}; physical serial still requires verification.",
                    'updated_at' => now(),
                ]);
        }
    }

    public function down(): void
    {
        // Provenance is intentionally retained; removing it would make serialized history less accurate.
    }
};
