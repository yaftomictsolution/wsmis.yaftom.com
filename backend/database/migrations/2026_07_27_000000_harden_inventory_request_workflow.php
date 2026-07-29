<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('inventory_requests', 'issue_type')) {
            Schema::table('inventory_requests', function (Blueprint $table): void {
                $table->enum('issue_type', ['internal', 'customer'])->nullable()->after('type');
            });
        }

        DB::table('inventory_requests')
            ->where('type', 'issue')
            ->whereNull('issue_type')
            ->update([
                'issue_type' => DB::raw("CASE WHEN customer_id IS NOT NULL THEN 'customer' ELSE 'internal' END"),
            ]);

        $defaultWarehouseId = DB::table('warehouses')
            ->where('status', 'active')
            ->orderBy('id')
            ->value('id');

        if ($defaultWarehouseId) {
            DB::table('inventory_requests')
                ->whereNull('warehouse_id')
                ->update(['warehouse_id' => $defaultWarehouseId]);

            DB::table('inventory_items')
                ->whereNull('warehouse_id')
                ->update(['warehouse_id' => $defaultWarehouseId]);
        }

        Schema::table('inventory_requests', function (Blueprint $table): void {
            $table->decimal('total_items', 14, 2)->default(0)->change();
        });

        if (DB::table('inventory_items')->whereNull('warehouse_id')->doesntExist()) {
            Schema::table('inventory_items', function (Blueprint $table): void {
                $table->foreignId('warehouse_id')->nullable(false)->change();
            });
        }
    }

    public function down(): void
    {
        Schema::table('inventory_items', function (Blueprint $table): void {
            $table->foreignId('warehouse_id')->nullable()->change();
        });

        Schema::table('inventory_requests', function (Blueprint $table): void {
            $table->integer('total_items')->default(0)->change();
            $table->dropColumn('issue_type');
        });
    }
};
