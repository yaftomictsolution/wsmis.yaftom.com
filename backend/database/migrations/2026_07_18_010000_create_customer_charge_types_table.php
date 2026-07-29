<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_charge_types', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('code', 100)->unique();
            $table->text('description')->nullable();
            $table->string('status')->default('active');
            $table->boolean('is_system')->default(false);
            $table->timestamps();

            $table->index(['status', 'name']);
        });

        $now = now();
        $defaults = [
            ['name' => 'Connection Fee', 'code' => 'connection_fee', 'is_system' => true],
            ['name' => 'Meter Fee', 'code' => 'meter_fee', 'is_system' => true],
            ['name' => 'Replacement Fee', 'code' => 'replacement_fee', 'is_system' => false],
            ['name' => 'Penalty', 'code' => 'penalty', 'is_system' => true],
            ['name' => 'Service Fee', 'code' => 'service_fee', 'is_system' => false],
            ['name' => 'Reconnection Fee', 'code' => 'reconnection_fee', 'is_system' => true],
            ['name' => 'Booklet Fee', 'code' => 'booklet_fee', 'is_system' => false],
            ['name' => 'Name Change Fee', 'code' => 'name_change_fee', 'is_system' => false],
            ['name' => 'Other', 'code' => 'other', 'is_system' => false],
        ];

        foreach ($defaults as $type) {
            DB::table('customer_charge_types')->insert($type + [
                'description' => null,
                'status' => 'active',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $knownCodes = collect($defaults)->pluck('code');
        DB::table('customer_charges')
            ->whereNotNull('type')
            ->distinct()
            ->pluck('type')
            ->reject(fn ($code) => $knownCodes->contains($code))
            ->each(function (string $code) use ($now): void {
                DB::table('customer_charge_types')->insert([
                    'name' => Str::of($code)->replace('_', ' ')->title()->toString(),
                    'code' => $code,
                    'description' => 'Imported from existing customer charge history.',
                    'status' => 'active',
                    'is_system' => false,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            });

        Schema::table('customer_charges', function (Blueprint $table): void {
            $table->foreignId('customer_charge_type_id')
                ->nullable()
                ->after('customer_contract_id')
                ->constrained('customer_charge_types')
                ->nullOnDelete();
        });

        DB::table('customer_charge_types')
            ->pluck('id', 'code')
            ->each(function (int $id, string $code): void {
                DB::table('customer_charges')
                    ->where('type', $code)
                    ->update(['customer_charge_type_id' => $id]);
            });
    }

    public function down(): void
    {
        Schema::table('customer_charges', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('customer_charge_type_id');
        });

        Schema::dropIfExists('customer_charge_types');
    }
};
