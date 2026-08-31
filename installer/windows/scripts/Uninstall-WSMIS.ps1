$ErrorActionPreference = 'Continue'
$ProgramRoot = Split-Path -Parent $PSScriptRoot
$DataRoot = Join-Path $env:ProgramData 'WSMIS'
$LogRoot = Join-Path $DataRoot 'logs'
New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null

try {
    & (Join-Path $PSScriptRoot 'Backup-WSMIS.ps1') -Destination (Join-Path $DataRoot 'backups') | Out-Null
} catch {
}

& (Join-Path $PSScriptRoot 'Stop-WSMIS.ps1')

foreach ($runner in @('WSMISFrontend.exe', 'WSMISBackend.exe')) {
    $path = Join-Path $ProgramRoot "services\$runner"
    if (Test-Path -LiteralPath $path) {
        & $path uninstall | Out-Null
    }
}

$mysqld = Join-Path $ProgramRoot 'runtime\mysql\bin\mysqld.exe'
if (Test-Path -LiteralPath $mysqld) {
    & $mysqld --remove WSMISMySQL | Out-Null
} else {
    & sc.exe delete WSMISMySQL | Out-Null
}

@"
WSMIS was uninstalled on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss').
The database, uploaded files, configuration, and backups remain in:
$DataRoot
"@ | Set-Content -LiteralPath (Join-Path $DataRoot 'UNINSTALLED.txt') -Encoding UTF8
