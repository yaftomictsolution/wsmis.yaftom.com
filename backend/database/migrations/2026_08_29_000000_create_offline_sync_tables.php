<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sync_node_states', function (Blueprint $table): void {
            $table->id();
            $table->uuid('node_uuid')->unique();
            $table->uuid('installation_uuid');
            $table->string('mode', 20)->default('standalone');
            $table->timestamp('initialized_at')->nullable();
            $table->unsignedBigInteger('remote_cursor')->default(0);
            $table->timestamp('last_sync_at')->nullable();
            $table->timestamp('last_verified_at')->nullable();
            $table->text('last_error')->nullable();
            $table->string('writer_mode', 20)->default('cloud');
            $table->uuid('writer_device_uuid')->nullable();
            $table->timestamp('lease_expires_at')->nullable();
            $table->timestamps();
        });

        Schema::create('sync_devices', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name');
            $table->string('token_hash');
            $table->string('status', 20)->default('active');
            $table->timestamp('last_seen_at')->nullable();
            $table->string('last_ip', 64)->nullable();
            $table->timestamps();
        });

        Schema::create('sync_entities', function (Blueprint $table): void {
            $table->id();
            $table->uuid('entity_uuid')->unique();
            $table->string('table_name', 100)->index();
            $table->unsignedBigInteger('record_id')->nullable();
            $table->unsignedBigInteger('version')->default(0);
            $table->string('checksum', 64)->nullable();
            $table->json('snapshot')->nullable();
            $table->uuid('origin_node_uuid')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();

            $table->unique(['table_name', 'record_id']);
            $table->index(['table_name', 'deleted_at']);
        });

        Schema::create('sync_changes', function (Blueprint $table): void {
            $table->id();
            $table->uuid('change_uuid')->unique();
            $table->uuid('entity_uuid')->index();
            $table->string('table_name', 100)->index();
            $table->string('operation', 20);
            $table->unsignedBigInteger('base_version')->default(0);
            $table->unsignedBigInteger('version');
            $table->json('payload')->nullable();
            $table->json('relationships')->nullable();
            $table->json('files')->nullable();
            $table->string('checksum', 64)->nullable();
            $table->uuid('source_node_uuid')->index();
            $table->timestamp('pushed_at')->nullable();
            $table->timestamps();

            $table->index(['source_node_uuid', 'pushed_at']);
        });

        Schema::create('sync_conflicts', function (Blueprint $table): void {
            $table->id();
            $table->uuid('conflict_uuid')->unique();
            $table->uuid('entity_uuid')->index();
            $table->string('table_name', 100);
            $table->uuid('local_change_uuid')->nullable();
            $table->json('local_snapshot')->nullable();
            $table->json('remote_snapshot')->nullable();
            $table->unsignedBigInteger('local_version')->default(0);
            $table->unsignedBigInteger('remote_version')->default(0);
            $table->text('reason');
            $table->string('status', 20)->default('open');
            $table->string('resolution', 20)->nullable();
            $table->timestamp('detected_at');
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['status', 'detected_at']);
        });

        Schema::create('sync_deferred_relations', function (Blueprint $table): void {
            $table->id();
            $table->uuid('entity_uuid');
            $table->string('table_name', 100);
            $table->string('column_name', 100);
            $table->uuid('target_entity_uuid');
            $table->string('target_table', 100);
            $table->timestamps();

            $table->unique(['entity_uuid', 'column_name']);
        });

        Schema::create('sync_runs', function (Blueprint $table): void {
            $table->id();
            $table->uuid('run_uuid')->unique();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 40)->default('running');
            $table->string('stage', 40)->default('prepare');
            $table->unsignedTinyInteger('progress')->default(0);
            $table->json('counts')->nullable();
            $table->json('warnings')->nullable();
            $table->text('error')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_runs');
        Schema::dropIfExists('sync_deferred_relations');
        Schema::dropIfExists('sync_conflicts');
        Schema::dropIfExists('sync_changes');
        Schema::dropIfExists('sync_entities');
        Schema::dropIfExists('sync_devices');
        Schema::dropIfExists('sync_node_states');
    }
};
