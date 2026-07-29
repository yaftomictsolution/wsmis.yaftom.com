<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('goods', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('code')->unique();
            $table->enum('category', ['pipe', 'meter', 'chemical', 'fuel', 'solar', 'technical', 'office', 'other']);
            $table->string('unit', 50)->default('piece');
            $table->decimal('default_cost', 16, 2)->default(0);
            $table->decimal('default_price', 16, 2)->default(0);
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->text('description')->nullable();
            $table->timestamps();

            $table->index('code');
            $table->index('category');
            $table->index('status');
        });

        // Add good_id to inventory_items table
        Schema::table('inventory_items', function (Blueprint $table): void {
            $table->foreignId('good_id')->nullable()->after('id')->constrained('goods')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('inventory_items', function (Blueprint $table): void {
            $table->dropForeign(['good_id']);
            $table->dropColumn('good_id');
        });

        Schema::dropIfExists('goods');
    }
};
