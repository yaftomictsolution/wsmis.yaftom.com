<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            FoundationSeeder::class,
            BillingWorkflowDemoSeeder::class,
            PhaseSixDemoSeeder::class,
            AssetsInventoryDemoSeeder::class,
            FullSystemDemoSeeder::class,
            DemoDataAuditSeeder::class,
        ]);
    }
}
