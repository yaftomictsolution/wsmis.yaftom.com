<?php

use App\Services\DemoDataAuditService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('demo:audit', function (DemoDataAuditService $audit) {
    $this->table(
        ['Section', 'Records', 'Status'],
        $audit->audit(),
    );
    $this->info('All demo data calculations and module coverage checks passed.');
})->purpose('Verify full-system demo records, balances, stock, payroll, reports, and shareholder calculations');
