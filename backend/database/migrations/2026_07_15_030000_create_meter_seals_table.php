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
            $table->foreignId('submitted_by')
                ->nullable()
                ->after('submitted_at')
                ->constrained('users')
                ->nullOnDelete();
        });

        Schema::create('meter_seals', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('meter_assignment_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('sealed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('removed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('seal_number')->unique();
            $table->dateTime('sealed_at');
            $table->string('status')->default('intact');
            $table->dateTime('removed_at')->nullable();
            $table->text('removal_reason')->nullable();
            $table->string('photo_path')->nullable();
            $table->string('photo_original_name')->nullable();
            $table->string('photo_mime_type')->nullable();
            $table->unsignedBigInteger('photo_size')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['meter_assignment_id', 'status']);
        });

        $now = now();
        DB::table('meter_assignments')
            ->whereNotNull('seal_number')
            ->where('seal_number', '!=', '')
            ->orderBy('id')
            ->get()
            ->each(function (object $assignment) use ($now): void {
                DB::table('meter_seals')->insert([
                    'meter_assignment_id' => $assignment->id,
                    'sealed_by' => $assignment->installed_by,
                    'removed_by' => null,
                    'seal_number' => $assignment->seal_number,
                    'sealed_at' => $assignment->installation_date.' 00:00:00',
                    'status' => $assignment->status === 'active' ? 'intact' : $assignment->status,
                    'removed_at' => $assignment->removed_at,
                    'removal_reason' => $assignment->status === 'active' ? null : 'Imported from the existing meter assignment history.',
                    'photo_path' => null,
                    'photo_original_name' => null,
                    'photo_mime_type' => null,
                    'photo_size' => null,
                    'notes' => 'Imported from the legacy assignment seal number.',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('meter_seals');

        Schema::table('customer_contracts', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('submitted_by');
        });
    }
};
