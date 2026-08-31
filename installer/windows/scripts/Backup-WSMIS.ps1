param(
    [string]$Destination
)

$ErrorActionPreference = 'Stop'
$ProgramRoot = Split-Path -Parent $PSScriptRoot
$DataRoot = Join-Path $env:ProgramData 'WSMIS'
. (Join-Path $PSScriptRoot 'WSMIS.Common.ps1')

$envPath = Join-Path $DataRoot 'backend\.env'
if (-not (Test-Path -LiteralPath $envPath)) {
    throw 'The WSMIS database configuration does not exist.'
}

if (-not $Destination) {
    $Destination = Join-Path $DataRoot 'backups'
}
New-Item -ItemType Directory -Force -Path $Destination | Out-Null

$database = Get-WSMISEnvValue -Path $envPath -Name 'DB_DATABASE'
$username = Get-WSMISEnvValue -Path $envPath -Name 'DB_USERNAME'
$password = Get-WSMISEnvValue -Path $envPath -Name 'DB_PASSWORD'
$port = Get-WSMISEnvValue -Path $envPath -Name 'DB_PORT'
if (-not $port) { $port = '3307' }
if (-not $database -or -not $username) {
    throw 'The WSMIS database configuration is incomplete.'
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$zipPath = Join-Path $Destination "WSMIS-$timestamp.zip"
$defaultsFile = Join-Path $env:TEMP "wsmis-mysql-$([guid]::NewGuid().ToString('N')).cnf"
$workRoot = Join-Path $env:TEMP "wsmis-backup-$([guid]::NewGuid().ToString('N'))"
$bundleRoot = Join-Path $workRoot 'WSMIS'
$sqlPath = Join-Path $bundleRoot 'database.sql'

try {
    New-Item -ItemType Directory -Force -Path $bundleRoot | Out-Null
    @"
[client]
user=$username
password=$password
host=127.0.0.1
port=$port
protocol=TCP
"@ | Set-Content -LiteralPath $defaultsFile -Encoding ASCII
    Protect-WSMISSecretFile -Path $defaultsFile -IncludeCurrentUser

    $dump = Join-Path $ProgramRoot 'runtime\mysql\bin\mysqldump.exe'
    Invoke-WSMISNative -Executable $dump -Arguments @(
        "--defaults-extra-file=$defaultsFile",
        '--single-transaction',
        '--routines',
        '--events',
        '--triggers',
        '--no-tablespaces',
        '--set-gtid-purged=OFF',
        "--result-file=$sqlPath",
        $database
    ) -FailureMessage 'Unable to create the WSMIS database backup.'

    $configurationRoot = Join-Path $bundleRoot 'configuration'
    New-Item -ItemType Directory -Force -Path $configurationRoot | Out-Null
    Copy-Item -LiteralPath $envPath -Destination (Join-Path $configurationRoot 'backend.env') -Force
    $installState = Join-Path $DataRoot 'install-state.json'
    if (Test-Path -LiteralPath $installState) {
        Copy-Item -LiteralPath $installState -Destination $configurationRoot -Force
    }

    $storageApp = Join-Path $DataRoot 'backend\storage\app'
    if (Test-Path -LiteralPath $storageApp) {
        Copy-Item -LiteralPath $storageApp -Destination (Join-Path $bundleRoot 'uploaded-files') -Recurse -Force
    }

    @"
WSMIS safety backup created on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss').

Contents:
- database.sql: complete MySQL application database
- configuration/backend.env: local application and database settings
- configuration/install-state.json: installed application information
- uploaded-files: customer documents, photos, receipts, and other local uploads

Keep this archive private because it contains business data and local credentials.
"@ | Set-Content -LiteralPath (Join-Path $bundleRoot 'RESTORE-INFORMATION.txt') -Encoding UTF8

    Compress-Archive -Path (Join-Path $bundleRoot '*') -DestinationPath $zipPath -CompressionLevel Optimal -Force
    Protect-WSMISSecretFile -Path $zipPath -IncludeCurrentUser
    Write-Output $zipPath
} finally {
    Remove-Item -LiteralPath $defaultsFile -Force -ErrorAction SilentlyContinue
    $resolvedWorkRoot = [System.IO.Path]::GetFullPath($workRoot)
    $resolvedTempRoot = [System.IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\'
    if ($resolvedWorkRoot.StartsWith($resolvedTempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedWorkRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
