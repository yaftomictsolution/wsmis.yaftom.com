param(
    [Parameter(Mandatory = $true)][string]$ConfigPath
)

$ErrorActionPreference = 'Stop'
$ProgramRoot = Split-Path -Parent $PSScriptRoot
$DataRoot = Join-Path $env:ProgramData 'WSMIS'
$BackendRoot = Join-Path $DataRoot 'backend'
$LogRoot = Join-Path $DataRoot 'logs'
$MySqlRoot = Join-Path $DataRoot 'mysql'
$MySqlData = Join-Path $MySqlRoot 'data'
$InstallStatePath = Join-Path $DataRoot 'install-state.json'
$EnvPath = Join-Path $BackendRoot '.env'
. (Join-Path $PSScriptRoot 'WSMIS.Common.ps1')

New-Item -ItemType Directory -Force -Path $DataRoot, $BackendRoot, $LogRoot, $MySqlRoot, $MySqlData, (Join-Path $DataRoot 'backups') | Out-Null
$transcriptPath = Join-Path $LogRoot ("setup-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
Start-Transcript -Path $transcriptPath -Force | Out-Null

function Set-WSMISPhpTlsConfig {
    $phpIni = Join-Path $ProgramRoot 'runtime\php\php.ini'
    $caBundle = Join-Path $ProgramRoot 'runtime\php\extras\ssl\cacert.pem'

    if (-not (Test-Path -LiteralPath $phpIni)) {
        throw "The packaged PHP configuration was not found at $phpIni"
    }
    if (-not (Test-Path -LiteralPath $caBundle)) {
        throw "The packaged TLS certificate bundle was not found at $caBundle"
    }

    $escapedBundle = $caBundle.Replace('\', '/')
    $content = Get-Content -LiteralPath $phpIni -Raw
    $content = [regex]::Replace($content, '(?m)^curl\.cainfo\s*=.*$', "curl.cainfo=`"$escapedBundle`"")
    $content = [regex]::Replace($content, '(?m)^openssl\.cafile\s*=.*$', "openssl.cafile=`"$escapedBundle`"")

    if ($content -notmatch '(?m)^curl\.cainfo\s*=') {
        $content += "`r`ncurl.cainfo=`"$escapedBundle`""
    }
    if ($content -notmatch '(?m)^openssl\.cafile\s*=') {
        $content += "`r`nopenssl.cafile=`"$escapedBundle`""
    }

    Set-Content -LiteralPath $phpIni -Value $content -Encoding ASCII
}

function Install-WSMISWrappedService {
    param([Parameter(Mandatory = $true)][string]$RunnerPath)

    $serviceName = [System.IO.Path]::GetFileNameWithoutExtension($RunnerPath)
    $existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($existing) {
        if ($existing.Status -ne 'Stopped') {
            Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
            $existing.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30))
        }
        & $RunnerPath uninstall | Out-Null
        $deadline = (Get-Date).AddSeconds(30)
        while ((Get-Service -Name $serviceName -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
            Start-Sleep -Milliseconds 500
        }
    }

    Invoke-WSMISNative -Executable $RunnerPath -Arguments @('install') -FailureMessage "Unable to install $serviceName."
    Invoke-WSMISNative -Executable $RunnerPath -Arguments @('start') -FailureMessage "Unable to start $serviceName."
}

try {
    if (-not (Test-Path -LiteralPath $ConfigPath)) {
        throw 'The installer configuration file is missing.'
    }
    $setup = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
    $freshInstall = -not (Test-Path -LiteralPath $InstallStatePath)

    if ($freshInstall) {
        if (-not $setup.cloud_api -or -not $setup.device_uuid -or -not $setup.device_secret) {
            throw 'Cloud API, Device ID, and Device Secret are required for a new local installation.'
        }
        $parsedDeviceId = [guid]::Empty
        if (-not [guid]::TryParse([string]$setup.device_uuid, [ref]$parsedDeviceId)) {
            throw 'The Device ID is not a valid identifier.'
        }
    }

    Assert-WSMISPortAvailable -Port 3307
    Assert-WSMISPortAvailable -Port 8000
    Assert-WSMISPortAvailable -Port 3000
    Set-WSMISPhpTlsConfig

    Write-WSMISProgress -DataRoot $DataRoot -Progress 5 -Message 'Preparing the private MySQL database'
    $mysqlBase = (Join-Path $ProgramRoot 'runtime\mysql').Replace('\', '/')
    $mysqlDataPath = $MySqlData.Replace('\', '/')
    $mysqlLogPath = (Join-Path $LogRoot 'mysql-error.log').Replace('\', '/')
    $myIni = Join-Path $MySqlRoot 'my.ini'
    @"
[client]
port=3307
host=127.0.0.1
protocol=TCP
default-character-set=utf8mb4

[mysqld]
basedir=$mysqlBase
datadir=$mysqlDataPath
port=3307
bind-address=127.0.0.1
mysqlx=0
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
default-time-zone=+00:00
max_allowed_packet=64M
secure-file-priv=""
log-error=$mysqlLogPath
pid-file=wsmis-mysql.pid
skip-log-bin
"@ | Set-Content -LiteralPath $myIni -Encoding ASCII

    $mysqld = Join-Path $ProgramRoot 'runtime\mysql\bin\mysqld.exe'
    $mysql = Join-Path $ProgramRoot 'runtime\mysql\bin\mysql.exe'
    if (-not (Test-Path -LiteralPath (Join-Path $MySqlData 'auto.cnf'))) {
        if ((Get-ChildItem -LiteralPath $MySqlData -Force -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0) {
            throw "The MySQL data directory is incomplete. Restore a backup or remove $MySqlData before retrying."
        }
        Invoke-WSMISNative -Executable $mysqld -Arguments @("--defaults-file=$myIni", '--initialize-insecure', '--console') -FailureMessage 'Unable to initialize MySQL.'
    }

    if (-not (Get-Service -Name 'WSMISMySQL' -ErrorAction SilentlyContinue)) {
        Invoke-WSMISNative -Executable $mysqld -Arguments @('--install', 'WSMISMySQL', "--defaults-file=$myIni") -FailureMessage 'Unable to install the WSMIS MySQL service.'
    }
    Invoke-WSMISNative -Executable "$env:SystemRoot\System32\sc.exe" -Arguments @('config', 'WSMISMySQL', 'start=', 'delayed-auto') -FailureMessage 'Unable to configure automatic MySQL startup.'
    Invoke-WSMISNative -Executable "$env:SystemRoot\System32\sc.exe" -Arguments @('failure', 'WSMISMySQL', 'reset=', '86400', 'actions=', 'restart/5000/restart/15000/restart/30000') -FailureMessage 'Unable to configure MySQL recovery.'
    Start-Service -Name 'WSMISMySQL'
    Wait-WSMISTcpPort -Port 3307 -TimeoutSeconds 90

    $adminDefaults = Join-Path $MySqlRoot 'admin.cnf'
    if (-not (Test-Path -LiteralPath $EnvPath)) {
        if (Test-Path -LiteralPath $adminDefaults) {
            throw 'The database exists but its application environment is missing. Restore the ProgramData WSMIS backup before reinstalling.'
        }

        $databaseName = 'wsmis_local'
        $databaseUser = 'wsmis_app'
        $databasePassword = New-WSMISSecret -Length 48
        $rootPassword = New-WSMISSecret -Length 56
        $initialSql = @"
CREATE DATABASE IF NOT EXISTS ``$databaseName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$databaseUser'@'127.0.0.1' IDENTIFIED BY '$databasePassword';
ALTER USER '$databaseUser'@'127.0.0.1' IDENTIFIED BY '$databasePassword';
GRANT ALL PRIVILEGES ON ``$databaseName``.* TO '$databaseUser'@'127.0.0.1';
ALTER USER 'root'@'localhost' IDENTIFIED BY '$rootPassword';
FLUSH PRIVILEGES;
"@
        $initialSql | & $mysql --protocol=TCP --host=127.0.0.1 --port=3307 --user=root
        if ($LASTEXITCODE -ne 0) {
            throw 'Unable to create the private WSMIS database account.'
        }

        @"
[client]
user=root
password=$rootPassword
host=127.0.0.1
port=3307
protocol=TCP
"@ | Set-Content -LiteralPath $adminDefaults -Encoding ASCII
        Protect-WSMISSecretFile -Path $adminDefaults

        $keyBytes = New-Object byte[] 32
        $keyGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try { $keyGenerator.GetBytes($keyBytes) } finally { $keyGenerator.Dispose() }
        $appKey = 'base64:' + [Convert]::ToBase64String($keyBytes)
        $cloudApi = ([string]$setup.cloud_api).TrimEnd('/')
        @"
APP_NAME="WSMIS"
APP_ENV=production
APP_KEY=$appKey
APP_DEBUG=false
APP_URL=http://127.0.0.1:8000
FRONTEND_URL=http://127.0.0.1:3000
APP_LOCALE=en
APP_FALLBACK_LOCALE=en

LOG_CHANNEL=daily
LOG_LEVEL=warning

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3307
DB_DATABASE=$databaseName
DB_USERNAME=$databaseUser
DB_PASSWORD=$databasePassword
DB_TIMEZONE=+00:00

SESSION_DRIVER=file
SESSION_LIFETIME=240
CACHE_STORE=file
QUEUE_CONNECTION=sync
FILESYSTEM_DISK=local

SYNC_ENABLED=true
SYNC_MODE=local
SYNC_REMOTE_URL=$cloudApi
SYNC_DEVICE_UUID=$($setup.device_uuid)
SYNC_DEVICE_SECRET=$($setup.device_secret)
SYNC_BATCH_SIZE=100
SYNC_REQUEST_TIMEOUT=120
SYNC_LEASE_HOURS=72
"@ | Set-Content -LiteralPath $EnvPath -Encoding ASCII
        Protect-WSMISSecretFile -Path $EnvPath
    }

    if (-not $freshInstall) {
        Write-WSMISProgress -DataRoot $DataRoot -Progress 22 -Message 'Creating an upgrade safety backup'
        & (Join-Path $PSScriptRoot 'Backup-WSMIS.ps1') -Destination (Join-Path $DataRoot 'backups') | Out-Null
    }

    Write-WSMISProgress -DataRoot $DataRoot -Progress 30 -Message 'Updating the WSMIS database structure'
    $php = Join-Path $ProgramRoot 'runtime\php\php.exe'
    Push-Location $BackendRoot
    try {
        Invoke-WSMISNative -Executable $php -Arguments @('artisan', 'config:clear', '--no-interaction') -FailureMessage 'Unable to clear the Laravel configuration.'
        Invoke-WSMISNative -Executable $php -Arguments @('artisan', 'migrate', '--force', '--no-interaction') -FailureMessage 'Unable to update the WSMIS database.'
        Invoke-WSMISNative -Executable $php -Arguments @('artisan', 'storage:link', '--force', '--no-interaction') -FailureMessage 'Unable to prepare uploaded-file access.'

        if ($freshInstall) {
            Write-WSMISProgress -DataRoot $DataRoot -Progress 42 -Message 'Downloading and verifying the cloud database'
            Invoke-WSMISNative -Executable $php -Arguments @('artisan', 'sync:provision-local', '--force', '--no-interaction') -FailureMessage 'Unable to provision this computer from the cloud.'
        }

        Write-WSMISProgress -DataRoot $DataRoot -Progress 70 -Message 'Optimizing the local application'
        Invoke-WSMISNative -Executable $php -Arguments @('artisan', 'optimize:clear', '--no-interaction') -FailureMessage 'Unable to clear old application caches.'
        Invoke-WSMISNative -Executable $php -Arguments @('artisan', 'optimize', '--no-interaction') -FailureMessage 'Unable to optimize WSMIS.'
    } finally {
        Pop-Location
    }

    Write-WSMISProgress -DataRoot $DataRoot -Progress 82 -Message 'Installing automatic Windows services'
    Install-WSMISWrappedService -RunnerPath (Join-Path $ProgramRoot 'services\WSMISBackend.exe')
    Wait-WSMISUrl -Url 'http://127.0.0.1:8000/up' -TimeoutSeconds 120
    Install-WSMISWrappedService -RunnerPath (Join-Path $ProgramRoot 'services\WSMISFrontend.exe')
    Wait-WSMISUrl -Url 'http://127.0.0.1:3000/login' -TimeoutSeconds 120

    @{
        version = [string]$setup.version
        installed_at = (Get-Date).ToUniversalTime().ToString('o')
        program_root = $ProgramRoot
        data_root = $DataRoot
        frontend_url = 'http://127.0.0.1:3000'
        backend_url = 'http://127.0.0.1:8000'
        database_service = 'WSMISMySQL'
        backend_service = 'WSMISBackend'
        frontend_service = 'WSMISFrontend'
    } | ConvertTo-Json | Set-Content -LiteralPath $InstallStatePath -Encoding UTF8

    Write-WSMISProgress -DataRoot $DataRoot -Progress 100 -Message 'WSMIS is installed and ready'
    Stop-Transcript | Out-Null
    exit 0
} catch {
    $message = $_.Exception.Message
    try {
        Set-Content -LiteralPath (Join-Path $DataRoot 'setup-error.txt') -Value $message -Encoding UTF8
        Write-WSMISProgress -DataRoot $DataRoot -Progress 100 -Message "Setup failed: $message"
    } catch {
    }
    Write-Error $message
    try { Stop-Transcript | Out-Null } catch {}
    exit 1
}
