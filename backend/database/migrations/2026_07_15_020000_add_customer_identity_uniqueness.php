<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $rows = DB::table('customers')->orderBy('id')->get(['id', 'phone', 'secondary_phone', 'tazkira_number']);
        $phones = [];
        $tazkiras = [];
        $updates = [];

        foreach ($rows as $row) {
            $phone = $this->normalizePhone($row->phone);
            $secondaryPhone = $this->normalizePhone($row->secondary_phone);
            $tazkira = $this->normalizeTazkira($row->tazkira_number);

            if ($phone !== null && isset($phones[$phone])) {
                throw new RuntimeException("Customers {$phones[$phone]} and {$row->id} have the same normalized phone number. Resolve the duplicate before migrating.");
            }
            if ($tazkira !== null && isset($tazkiras[$tazkira])) {
                throw new RuntimeException("Customers {$tazkiras[$tazkira]} and {$row->id} have the same normalized Tazkira number. Resolve the duplicate before migrating.");
            }

            if ($phone !== null) {
                $phones[$phone] = $row->id;
            }
            if ($tazkira !== null) {
                $tazkiras[$tazkira] = $row->id;
            }

            $updates[$row->id] = [
                'phone' => $phone,
                'secondary_phone' => $secondaryPhone,
                'tazkira_number' => $tazkira,
            ];
        }

        DB::transaction(function () use ($updates): void {
            foreach ($updates as $id => $values) {
                DB::table('customers')->where('id', $id)->update($values);
            }
        });

        Schema::table('customers', function (Blueprint $table): void {
            $table->unique('phone', 'customers_phone_unique');
            $table->unique('tazkira_number', 'customers_tazkira_number_unique');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->dropUnique('customers_phone_unique');
            $table->dropUnique('customers_tazkira_number_unique');
        });
    }

    private function normalizePhone(mixed $value): ?string
    {
        $raw = trim((string) $value);
        if ($raw === '') {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $raw);
        if (str_starts_with($digits, '0093')) {
            return '+'.substr($digits, 2);
        }
        if (str_starts_with($digits, '93') && strlen($digits) === 11) {
            return '+'.$digits;
        }
        if (str_starts_with($digits, '0') && strlen($digits) === 10) {
            return '+93'.substr($digits, 1);
        }
        if (strlen($digits) === 9) {
            return '+93'.$digits;
        }

        return str_starts_with($raw, '+') ? '+'.$digits : $digits;
    }

    private function normalizeTazkira(mixed $value): ?string
    {
        $normalized = strtoupper(preg_replace('/\s+/u', '', trim((string) $value)));

        return $normalized === '' ? null : $normalized;
    }
};
