<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('sync_runs')) {
            return;
        }

        $driver = DB::getDriverName();
        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE sync_runs MODIFY status VARCHAR(40) NOT NULL DEFAULT 'running'");
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('sync_runs')) {
            return;
        }

        $driver = DB::getDriverName();
        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE sync_runs MODIFY status VARCHAR(20) NOT NULL DEFAULT 'running'");
        }
    }
};
