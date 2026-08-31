param(
    [string]$ProjectRoot = "D:\WSMIS",
    [string]$OutputPath = "",
    [string]$DatabaseDumpPath = ""
)

$ErrorActionPreference = "Stop"

function Set-EnvValue {
    param(
        [string]$Content,
        [string]$Name,
        [string]$Value
    )

    $pattern = "(?m)^" + [regex]::Escape($Name) + "=.*$"
    $line = "$Name=$Value"

    if ([regex]::IsMatch($Content, $pattern)) {
        return [regex]::Replace($Content, $pattern, $line)
    }

    return $Content.TrimEnd() + [Environment]::NewLine + $line + [Environment]::NewLine
}

$project = [System.IO.Path]::GetFullPath($ProjectRoot)
if (-not (Test-Path -LiteralPath (Join-Path $project "backend\artisan"))) {
    throw "Laravel backend not found under $project"
}
if (-not (Test-Path -LiteralPath (Join-Path $project "frontend\package.json"))) {
    throw "Next.js frontend not found under $project"
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path (Split-Path $project -Parent) "WSMIS-PC-TRANSFER.zip"
}

$output = [System.IO.Path]::GetFullPath($OutputPath)
$outputParent = Split-Path $output -Parent
New-Item -ItemType Directory -Force -Path $outputParent | Out-Null

if ($DatabaseDumpPath) {
    $databaseDump = [System.IO.Path]::GetFullPath($DatabaseDumpPath)
    if (-not (Test-Path -LiteralPath $databaseDump -PathType Leaf)) {
        throw "Cloud database backup not found: $databaseDump"
    }
}

$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$stage = Join-Path $tempRoot ("wsmis-transfer-" + [guid]::NewGuid().ToString("N"))
$stageProject = Join-Path $stage "WSMIS"

try {
    New-Item -ItemType Directory -Force -Path $stageProject | Out-Null

    $excludedDirectories = @(
        (Join-Path $project ".git"),
        (Join-Path $project "tmp"),
        (Join-Path $project "frontend\node_modules"),
        (Join-Path $project "frontend\.next"),
        (Join-Path $project "frontend\test-results"),
        (Join-Path $project "frontend\playwright-report"),
        (Join-Path $project "backend\vendor"),
        (Join-Path $project "backend\bootstrap\cache"),
        (Join-Path $project "backend\storage\framework"),
        (Join-Path $project "backend\storage\logs")
    )

    $robocopyArguments = @(
        $project,
        $stageProject,
        "/E",
        "/R:2",
        "/W:1",
        "/NFL",
        "/NDL",
        "/NJH",
        "/NJS",
        "/NP",
        "/XD"
    ) + $excludedDirectories + @("/XF", "*.log", "*.tmp")

    & robocopy @robocopyArguments | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "Unable to copy the project into the transfer package. Robocopy exit code: $LASTEXITCODE"
    }

    $requiredRuntimeDirectories = @(
        "backend\bootstrap\cache",
        "backend\storage\framework\cache\data",
        "backend\storage\framework\sessions",
        "backend\storage\framework\views",
        "backend\storage\logs"
    )
    foreach ($directory in $requiredRuntimeDirectories) {
        New-Item -ItemType Directory -Force -Path (Join-Path $stageProject $directory) | Out-Null
    }

    $backendEnv = Join-Path $stageProject "backend\.env"
    if (-not (Test-Path -LiteralPath $backendEnv)) {
        Copy-Item -LiteralPath (Join-Path $stageProject "backend\.env.example") -Destination $backendEnv
    }

    $envContent = Get-Content -LiteralPath $backendEnv -Raw
    $envContent = Set-EnvValue -Content $envContent -Name "APP_URL" -Value "http://127.0.0.1:8000"
    $envContent = Set-EnvValue -Content $envContent -Name "FRONTEND_URL" -Value "http://127.0.0.1:3000"
    $envContent = Set-EnvValue -Content $envContent -Name "DB_TIMEZONE" -Value "+00:00"
    $envContent = Set-EnvValue -Content $envContent -Name "SYNC_ENABLED" -Value "true"
    $envContent = Set-EnvValue -Content $envContent -Name "SYNC_MODE" -Value "local"
    $envContent = Set-EnvValue -Content $envContent -Name "SYNC_REMOTE_URL" -Value "https://wsmis-api.yaftom.com/api"
    $envContent = Set-EnvValue -Content $envContent -Name "SYNC_DEVICE_UUID" -Value ""
    $envContent = Set-EnvValue -Content $envContent -Name "SYNC_DEVICE_SECRET" -Value ""
    Set-Content -LiteralPath $backendEnv -Value $envContent -Encoding UTF8 -NoNewline

    if ($DatabaseDumpPath) {
        Copy-Item -LiteralPath $databaseDump -Destination (Join-Path $stageProject "wsmis-cloud-bootstrap.sql")
    }

    $databaseInstruction = if ($DatabaseDumpPath) {
        "The fresh cloud database is included as wsmis-cloud-bootstrap.sql."
    } else {
        "Download a fresh full cloud SQL export and copy it beside this ZIP before setting up the new PC."
    }

    $readme = @"
WSMIS NEW COMPUTER PACKAGE
==========================

$databaseInstruction

1. Install XAMPP, Composer 2, and Node.js 22 LTS on the new PC.
2. Extract this ZIP so the project path is D:\WSMIS.
3. Start MySQL, create the WSMIS database, and import the fresh cloud SQL file.
4. Register a NEW device on the cloud with:
   php artisan sync:register-device "Office Computer 2"
5. Put that new UUID and secret in D:\WSMIS\backend\.env.
6. Never reuse the old computer's sync UUID or secret.
7. Run the installation commands in OFFLINE_SYNC_GUIDE.md.
8. Run php artisan sync:rebaseline-local --force before creating any local record.
9. Install the automatic startup shortcut with scripts\local-app\install-local-wsmis-startup.ps1.

Important: Do not run sync:initialize on this new local computer.
"@
    Set-Content -LiteralPath (Join-Path $stageProject "NEW_PC_SETUP.txt") -Value $readme -Encoding UTF8

    if (Test-Path -LiteralPath $output) {
        Remove-Item -LiteralPath $output -Force
    }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        $stageProject,
        $output,
        [System.IO.Compression.CompressionLevel]::Optimal,
        $false
    )

    $size = (Get-Item -LiteralPath $output).Length / 1MB
    Write-Host "Transfer ZIP created successfully."
    Write-Host "File: $output"
    Write-Host ("Size: {0:N1} MB" -f $size)
    if (-not $DatabaseDumpPath) {
        Write-Warning "The ZIP does not contain a database. Download a fresh cloud SQL export separately."
    }
    Write-Warning "The package contains the Laravel APP_KEY and other private environment settings. Keep the flash drive secure."
} finally {
    if (Test-Path -LiteralPath $stage) {
        $stageFull = [System.IO.Path]::GetFullPath($stage)
        $stageLeaf = Split-Path $stageFull -Leaf
        if ($stageFull.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
            $stageLeaf.StartsWith("wsmis-transfer-", [System.StringComparison]::OrdinalIgnoreCase)) {
            Remove-Item -LiteralPath $stageFull -Recurse -Force
        }
    }
}
