<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        Schema::create('authorities', function (Blueprint $table): void {
            $table->id();
            $table->string('authority_number')->unique();
            $table->string('name');
            $table->string('father_name')->nullable();
            $table->string('title')->nullable();
            $table->string('phone')->nullable()->unique();
            $table->string('email')->nullable()->unique();
            $table->string('status')->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['status', 'name']);
        });

        Schema::table('customer_contracts', function (Blueprint $table): void {
            $table->foreignId('discount_authority_id')
                ->nullable()
                ->after('discount_approved_by')
                ->constrained('authorities')
                ->restrictOnDelete();
        });

        $now = now();
        foreach (['view', 'create', 'update', 'delete'] as $action) {
            DB::table('permissions')->insertOrIgnore([
                'name' => "authorities.{$action}",
                'guard_name' => 'web',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $permissionIds = DB::table('permissions')
            ->whereIn('name', ['authorities.view', 'authorities.create', 'authorities.update', 'authorities.delete'])
            ->pluck('id');
        $roleIds = DB::table('roles')
            ->where('guard_name', 'web')
            ->whereIn('name', ['Admin', 'Super Admin', 'Manager'])
            ->pluck('id');

        foreach ($roleIds as $roleId) {
            foreach ($permissionIds as $permissionId) {
                DB::table('role_has_permissions')->insertOrIgnore([
                    'permission_id' => $permissionId,
                    'role_id' => $roleId,
                ]);
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        Schema::table('customer_contracts', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('discount_authority_id');
        });

        Schema::dropIfExists('authorities');

        $permissionIds = DB::table('permissions')
            ->whereIn('name', ['authorities.view', 'authorities.create', 'authorities.update', 'authorities.delete'])
            ->pluck('id');
        DB::table('role_has_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('model_has_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
