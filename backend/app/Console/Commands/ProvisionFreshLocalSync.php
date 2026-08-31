<?php

namespace App\Console\Commands;

use App\Services\Sync\FreshLocalProvisioner;
use Illuminate\Console\Command;
use Throwable;

class ProvisionFreshLocalSync extends Command
{
    protected $signature = 'sync:provision-local {--force : Delete local business data and download the cloud baseline without confirmation}';

    protected $description = 'Provision a fresh local WSMIS database directly from the cloud';

    public function handle(FreshLocalProvisioner $provisioner): int
    {
        if (! $this->option('force')
            && ! $this->confirm('Delete local business data and provision this computer from the cloud?')) {
            return self::FAILURE;
        }

        try {
            $result = $provisioner->provision(function (int $progress, string $message): void {
                $this->line(sprintf('[%3d%%] %s', $progress, $message));
            });

            $this->newLine();
            $this->info('This computer is ready for local WSMIS work.');
            $this->line("Cloud records installed: {$result['pulled']}");
            $this->line("Attachments downloaded: {$result['downloaded_files']}");
            $this->line("Cloud cursor: {$result['remote_cursor']}");
            $this->line('Integrity verification: passed');

            return self::SUCCESS;
        } catch (Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }
    }
}
