<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->string('photo_path')->nullable()->after('documents');
            $table->string('photo_original_name')->nullable()->after('photo_path');
            $table->string('photo_mime_type', 100)->nullable()->after('photo_original_name');
            $table->unsignedBigInteger('photo_size')->nullable()->after('photo_mime_type');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->dropColumn([
                'photo_path',
                'photo_original_name',
                'photo_mime_type',
                'photo_size',
            ]);
        });
    }
};
