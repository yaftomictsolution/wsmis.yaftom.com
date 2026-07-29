<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_service_requests', function (Blueprint $table): void {
            $table->timestamp('assigned_at')->nullable()->after('requested_at');
            $table->foreignId('closed_by')->nullable()->after('resolved_at')->constrained('users')->nullOnDelete();
            $table->timestamp('closed_at')->nullable()->after('closed_by');
        });
    }

    public function down(): void
    {
        Schema::table('customer_service_requests', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('closed_by');
            $table->dropColumn(['assigned_at', 'closed_at']);
        });
    }
};
