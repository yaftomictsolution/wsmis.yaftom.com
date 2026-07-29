<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $customerIds = DB::table('customer_contracts as pending_contracts')
            ->where('pending_contracts.status', 'installation_pending')
            ->whereNotExists(function ($query): void {
                $query->selectRaw('1')
                    ->from('customer_contracts as active_contracts')
                    ->whereColumn('active_contracts.customer_id', 'pending_contracts.customer_id')
                    ->where('active_contracts.status', 'active');
            })
            ->distinct()
            ->pluck('pending_contracts.customer_id');

        if ($customerIds->isNotEmpty()) {
            DB::table('customers')
                ->whereIn('id', $customerIds)
                ->update([
                    'status' => 'awaiting_installation',
                    'agreement_status' => 'installation_pending',
                ]);
        }
    }

    public function down(): void
    {
        // Customer operational status is intentionally not guessed during rollback.
    }
};
