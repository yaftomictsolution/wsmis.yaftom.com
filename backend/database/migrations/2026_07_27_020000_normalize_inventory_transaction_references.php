<?php

use App\Models\InventoryRequest;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('inventory_transactions')
            ->where('reference_type', 'inventory_request')
            ->update(['reference_type' => InventoryRequest::class]);
    }

    public function down(): void
    {
        DB::table('inventory_transactions')
            ->where('reference_type', InventoryRequest::class)
            ->update(['reference_type' => 'inventory_request']);
    }
};
