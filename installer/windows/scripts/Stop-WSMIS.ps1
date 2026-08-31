$ErrorActionPreference = 'SilentlyContinue'

foreach ($serviceName in @('WSMISFrontend', 'WSMISBackend', 'WSMISMySQL')) {
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($service -and $service.Status -ne 'Stopped') {
        Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
        $service.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30))
    }
}
