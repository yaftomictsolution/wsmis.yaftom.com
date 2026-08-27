<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_requests', function (Blueprint $table): void {
            $table->string('document_number')->nullable()->unique()->after('invoice_id');
            $table->timestamp('document_generated_at')->nullable()->after('document_number');
        });

        DB::table('inventory_requests')
            ->where('type', 'purchase')
            ->where('status', 'approved')
            ->orderBy('id')
            ->chunkById(100, function ($requests): void {
                foreach ($requests as $request) {
                    $suffix = str_starts_with($request->request_number, 'PO-')
                        ? substr($request->request_number, 3)
                        : str_pad((string) $request->id, 8, '0', STR_PAD_LEFT);

                    DB::table('inventory_requests')->where('id', $request->id)->update([
                        'document_number' => 'PB-'.$suffix,
                        'document_generated_at' => $request->approved_at ?? $request->updated_at ?? now(),
                    ]);
                }
            });

        DB::table('inventory_requests')
            ->where('type', 'issue')
            ->where(function ($query): void {
                $query->where('issue_type', 'customer')->orWhereNotNull('customer_id');
            })
            ->where('status', 'approved')
            ->whereNotNull('invoice_id')
            ->orderBy('id')
            ->chunkById(100, function ($requests): void {
                foreach ($requests as $request) {
                    $invoiceNumber = DB::table('invoices')
                        ->where('id', $request->invoice_id)
                        ->value('invoice_number');

                    if (! $invoiceNumber) {
                        continue;
                    }

                    DB::table('inventory_requests')->where('id', $request->id)->update([
                        'document_number' => $invoiceNumber,
                        'document_generated_at' => $request->approved_at ?? $request->updated_at ?? now(),
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('inventory_requests', function (Blueprint $table): void {
            $table->dropUnique(['document_number']);
            $table->dropColumn(['document_number', 'document_generated_at']);
        });
    }
};
