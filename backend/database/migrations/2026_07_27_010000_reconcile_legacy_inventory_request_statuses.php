<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $legacyApprovals = DB::table('inventory_requests')
            ->where('status', 'approved')
            ->whereNotExists(function ($query): void {
                $query->selectRaw('1')
                    ->from('inventory_transactions')
                    ->whereColumn('inventory_transactions.reference_id', 'inventory_requests.id')
                    ->whereIn('inventory_transactions.reference_type', [
                        'inventory_request',
                        \App\Models\InventoryRequest::class,
                    ]);
            })
            ->pluck('id');

        if ($legacyApprovals->isEmpty()) {
            return;
        }

        DB::table('inventory_requests')
            ->whereIn('id', $legacyApprovals)
            ->update([
                'status' => 'rejected',
                'approval_notes' => DB::raw(
                    "CONCAT_WS('\n', NULLIF(approval_notes, ''), 'Legacy approval voided: no stock or accounting posting was created.')"
                ),
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        // A voided legacy approval cannot be restored safely without inventing stock or cash movement.
    }
};
