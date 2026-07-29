<?php

namespace Database\Seeders;

use App\Services\DemoDataAuditService;
use Illuminate\Database\Seeder;

class DemoDataAuditSeeder extends Seeder
{
    public function run(): void
    {
        $results = app(DemoDataAuditService::class)->audit();
        $this->command?->info('Full-system demo data audit passed.');
        $this->command?->table(['Section', 'Records', 'Status'], $results);
    }
}
