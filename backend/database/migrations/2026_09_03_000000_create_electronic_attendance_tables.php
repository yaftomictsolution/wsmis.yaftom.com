<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_devices', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('code', 80)->unique();
            $table->string('vendor', 80)->default('ZKTeco');
            $table->string('model', 120)->nullable();
            $table->string('serial_number', 120)->nullable();
            $table->string('connection_mode', 20)->default('network');
            $table->string('ip_address', 45)->nullable();
            $table->unsignedSmallInteger('port')->default(4370);
            $table->unsignedSmallInteger('timeout_seconds')->default(8);
            $table->string('timezone', 80)->default('Asia/Kabul');
            $table->string('status', 20)->default('active');
            $table->string('connection_status', 20)->default('unknown');
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamp('last_sync_at')->nullable();
            $table->timestamp('last_punch_at')->nullable();
            $table->text('last_error')->nullable();
            $table->json('device_info')->nullable();
            $table->timestamps();

            $table->index(['status', 'connection_mode']);
        });

        Schema::create('attendance_device_mappings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('attendance_device_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->restrictOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('device_user_id', 120);
            $table->string('device_user_name')->nullable();
            $table->string('card_number', 120)->nullable();
            $table->string('mapping_source', 20)->default('manual');
            $table->string('status', 20)->default('active');
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->unique(['attendance_device_id', 'device_user_id'], 'attendance_device_user_unique');
            $table->unique(['attendance_device_id', 'employee_id'], 'attendance_device_employee_unique');
        });

        Schema::table('biometric_import_batches', function (Blueprint $table): void {
            $table->foreignId('attendance_device_id')->nullable()->constrained()->nullOnDelete();
            $table->string('source', 30)->default('legacy_csv');
            $table->unsignedInteger('skipped_rows')->default(0);
            $table->unsignedInteger('unmatched_rows')->default(0);
        });

        Schema::create('attendance_device_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('attendance_device_id')->constrained()->restrictOnDelete();
            $table->foreignId('attendance_device_mapping_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('biometric_import_batch_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('attendance_record_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event_uid', 64);
            $table->string('device_user_id', 120);
            $table->string('device_user_name')->nullable();
            $table->date('attendance_date');
            $table->timestamp('occurred_at');
            $table->string('verification_type', 30)->default('unknown');
            $table->string('punch_state', 30)->nullable();
            $table->string('source', 20)->default('network');
            $table->string('status', 20)->default('unmatched');
            $table->json('raw_payload')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->unique(['attendance_device_id', 'event_uid'], 'attendance_device_event_unique');
            $table->index(['employee_id', 'attendance_date', 'status'], 'attendance_event_employee_date_index');
            $table->index(['attendance_device_id', 'status', 'occurred_at'], 'attendance_event_device_status_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_device_events');

        Schema::table('biometric_import_batches', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('attendance_device_id');
            $table->dropColumn(['source', 'skipped_rows', 'unmatched_rows']);
        });

        Schema::dropIfExists('attendance_device_mappings');
        Schema::dropIfExists('attendance_devices');
    }
};
