<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_area_mosques', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('service_area_id')->constrained()->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('name');
            $table->string('status')->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['service_area_id', 'name']);
            $table->index(['service_area_id', 'status']);
        });

        Schema::table('customers', function (Blueprint $table): void {
            $table->foreignId('service_area_mosque_id')
                ->nullable()
                ->after('service_area_id')
                ->constrained('service_area_mosques')
                ->cascadeOnUpdate()
                ->restrictOnDelete();
        });

        $now = now();
        DB::table('service_areas')
            ->whereNotNull('mosque_name')
            ->where('mosque_name', '<>', '')
            ->orderBy('id')
            ->get(['id', 'mosque_name'])
            ->each(function (object $area) use ($now): void {
                $mosqueId = DB::table('service_area_mosques')->insertGetId([
                    'service_area_id' => $area->id,
                    'name' => trim($area->mosque_name),
                    'status' => 'active',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                DB::table('customers')
                    ->where('service_area_id', $area->id)
                    ->whereNull('service_area_mosque_id')
                    ->update(['service_area_mosque_id' => $mosqueId]);
            });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('service_area_mosque_id');
        });

        Schema::dropIfExists('service_area_mosques');
    }
};
