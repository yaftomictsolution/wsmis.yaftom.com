<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->string('subscription_code')->nullable()->unique()->after('service_area_id');
            $table->date('subscription_date')->nullable()->after('subscription_code');
            $table->string('grandfather_name')->nullable()->after('father_name');
            $table->string('tazkira_number')->nullable()->after('secondary_phone');
            $table->string('nearest_house_number')->nullable()->after('house_number');
            $table->string('street_number')->nullable()->after('nearest_house_number');
            $table->string('original_residence')->nullable()->after('street_number');
            $table->string('current_residence')->nullable()->after('original_residence');
            $table->string('meter_size')->nullable()->after('current_residence');
            $table->decimal('connection_fee', 14, 2)->default(0)->after('meter_size');
            $table->decimal('meter_fee', 14, 2)->default(0)->after('connection_fee');
            $table->decimal('agreement_discount_amount', 14, 2)->default(0)->after('meter_fee');
            $table->decimal('agreement_paid_amount', 14, 2)->default(0)->after('agreement_discount_amount');
            $table->decimal('agreement_remaining_amount', 14, 2)->default(0)->after('agreement_paid_amount');
            $table->string('discount_approved_by')->nullable()->after('agreement_remaining_amount');
            $table->string('agreement_status')->default('draft')->after('discount_approved_by');
            $table->timestamp('agreement_printed_at')->nullable()->after('agreement_status');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->dropUnique(['subscription_code']);
            $table->dropColumn([
                'subscription_code',
                'subscription_date',
                'grandfather_name',
                'tazkira_number',
                'nearest_house_number',
                'street_number',
                'original_residence',
                'current_residence',
                'meter_size',
                'connection_fee',
                'meter_fee',
                'agreement_discount_amount',
                'agreement_paid_amount',
                'agreement_remaining_amount',
                'discount_approved_by',
                'agreement_status',
                'agreement_printed_at',
            ]);
        });
    }
};
