<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('inventory_requests', 'warehouse_id')) {
            return;
        }

        Schema::table('inventory_requests', function (Blueprint $table): void {
            $table->foreignId('warehouse_id')->nullable()->after('department_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('inventory_requests', 'warehouse_id')) {
            return;
        }

        Schema::table('inventory_requests', function (Blueprint $table): void {
            $table->dropForeign(['warehouse_id']);
            $table->dropColumn('warehouse_id');
        });
    }
};
