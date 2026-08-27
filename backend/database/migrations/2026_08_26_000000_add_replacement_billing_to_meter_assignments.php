<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('meter_assignments', function (Blueprint $table): void {
            $table->foreignId('replacement_charge_id')
                ->nullable()
                ->unique()
                ->after('customer_contract_id')
                ->constrained('customer_charges')
                ->nullOnDelete();
        });

        $existing = DB::table('customer_charge_types')->where('code', 'replacement_fee')->first();
        if ($existing) {
            DB::table('customer_charge_types')->where('id', $existing->id)->update([
                'name' => 'Meter Replacement Fee',
                'description' => 'System charge generated when an installed customer meter is replaced.',
                'status' => 'active',
                'is_system' => true,
                'updated_at' => now(),
            ]);
        } else {
            DB::table('customer_charge_types')->insert([
                'name' => 'Meter Replacement Fee',
                'code' => 'replacement_fee',
                'description' => 'System charge generated when an installed customer meter is replaced.',
                'status' => 'active',
                'is_system' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('meter_assignments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('replacement_charge_id');
        });

        DB::table('customer_charge_types')
            ->where('code', 'replacement_fee')
            ->update(['is_system' => false, 'updated_at' => now()]);
    }
};
