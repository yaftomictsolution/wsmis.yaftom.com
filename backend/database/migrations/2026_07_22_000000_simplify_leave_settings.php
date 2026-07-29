<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('leave_policies')->where('code', 'other')->update([
            'status' => 'inactive',
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('leave_policies')->where('code', 'other')->update([
            'status' => 'active',
            'updated_at' => now(),
        ]);
    }
};
