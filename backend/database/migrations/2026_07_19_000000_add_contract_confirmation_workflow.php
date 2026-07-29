<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_contracts', function (Blueprint $table): void {
            $table->foreignId('confirmed_by')
                ->nullable()
                ->after('submitted_by')
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('confirmed_at')->nullable()->after('confirmed_by');
        });

        DB::table('customer_contracts')
            ->whereIn('status', ['pending_approval', 'approved'])
            ->orderBy('id')
            ->get()
            ->each(function (object $contract): void {
                DB::table('customer_contracts')
                    ->where('id', $contract->id)
                    ->update([
                        'confirmed_by' => $contract->approved_by
                            ?? $contract->submitted_by
                            ?? $contract->updated_by
                            ?? $contract->created_by,
                        'confirmed_at' => $contract->approved_at
                            ?? $contract->submitted_at
                            ?? $contract->updated_at,
                        'status' => 'installation_pending',
                    ]);
            });

        DB::table('customers')
            ->whereIn('agreement_status', ['pending_approval', 'approved'])
            ->update(['agreement_status' => 'installation_pending']);
        DB::table('customers')
            ->where('status', 'awaiting_approval')
            ->update(['status' => 'awaiting_installation']);
    }

    public function down(): void
    {
        DB::table('customer_contracts')
            ->where('status', 'installation_pending')
            ->update(['status' => 'approved']);
        DB::table('customers')
            ->where('agreement_status', 'installation_pending')
            ->update(['agreement_status' => 'approved']);

        Schema::table('customer_contracts', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('confirmed_by');
            $table->dropColumn('confirmed_at');
        });
    }
};
