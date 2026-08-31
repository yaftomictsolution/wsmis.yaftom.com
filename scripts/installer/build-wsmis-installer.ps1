param(
    [string]$Version = '1.0.0',
    [string]$ProjectRoot = '',
    [string]$PhpRuntimePath = 'C:\xampp\php',
    [string]$NodeExecutable = 'C:\Program Files\nodejs\node.exe',
    [string]$MySqlVersion = '8.4.11',
    [switch]$SkipFrontendBuild,
    [switch]$SkipCompilerInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

if (-not $ProjectRoot) {
    $ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
}
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$InstallerRoot = Join-Path $ProjectRoot 'installer'
$WindowsRoot = Join-Path $InstallerRoot 'windows'
$CacheRoot = Join-Path $InstallerRoot '.cache'
$StageRoot = Join-Path $InstallerRoot 'stage'
$ProgramStage = Join-Path $StageRoot 'program'
$BackendStage = Join-Path $StageRoot 'backend'
$DistRoot = Join-Path $InstallerRoot 'dist'
$FrontendRoot = Join-Path $ProjectRoot 'frontend'
$BackendRoot = Join-Path $ProjectRoot 'backend'

function Assert-PathExists {
    param([string]$Path, [string]$Description)
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Description was not found at $Path"
    }
}

function Reset-BuildDirectory {
    param([string]$Path)
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $allowedRoot = [System.IO.Path]::GetFullPath($InstallerRoot).TrimEnd('\') + '\'
    if (-not $fullPath.StartsWith($allowedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to reset a directory outside $InstallerRoot"
    }
    if (Test-Path -LiteralPath $fullPath) {
        Remove-Item -LiteralPath $fullPath -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $fullPath | Out-Null
}

function Copy-Tree {
    param(
        [string]$Source,
        [string]$Destination,
        [string[]]$ExcludeDirectories = @(),
        [string[]]$ExcludeFiles = @()
    )
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    $arguments = @($Source, $Destination, '/E', '/R:2', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS', '/NP')
    if ($ExcludeDirectories.Count -gt 0) {
        $arguments += '/XD'
        $arguments += $ExcludeDirectories
    }
    if ($ExcludeFiles.Count -gt 0) {
        $arguments += '/XF'
        $arguments += $ExcludeFiles
    }
    & robocopy.exe @arguments | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "Unable to copy $Source to $Destination. Robocopy exit code: $LASTEXITCODE"
    }
}

function Get-CachedFile {
    param([string]$Url, [string]$Path, [long]$ExpectedSize = 0)
    if ((Test-Path -LiteralPath $Path) -and ($ExpectedSize -le 0 -or (Get-Item -LiteralPath $Path).Length -eq $ExpectedSize)) {
        Write-Output "Using cached $(Split-Path -Leaf $Path)"
        return
    }
    $partialPath = "$Path.part"
    if (Test-Path -LiteralPath $Path) {
        if (Test-Path -LiteralPath $partialPath) {
            Remove-Item -LiteralPath $partialPath -Force
        }
        Move-Item -LiteralPath $Path -Destination $partialPath -Force
    }
    if ((Test-Path -LiteralPath $partialPath) -and $ExpectedSize -gt 0 -and (Get-Item -LiteralPath $partialPath).Length -gt $ExpectedSize) {
        Remove-Item -LiteralPath $partialPath -Force
    }
    Write-Output "Downloading $Url"
    & curl.exe --location --fail --retry 5 --retry-delay 2 --continue-at - --output $partialPath $Url
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to download $Url"
    }
    if ($ExpectedSize -gt 0 -and (Get-Item -LiteralPath $partialPath).Length -ne $ExpectedSize) {
        throw "The downloaded file has an unexpected size: $partialPath"
    }
    Move-Item -LiteralPath $partialPath -Destination $Path -Force
}

function Find-InnoCompiler {
    $candidates = @(
        (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'),
        (Join-Path $env:ProgramFiles 'Inno Setup 6\ISCC.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe')
    )
    return $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
}

Assert-PathExists -Path $FrontendRoot -Description 'Frontend project'
Assert-PathExists -Path $BackendRoot -Description 'Backend project'
Assert-PathExists -Path $PhpRuntimePath -Description 'PHP runtime'
Assert-PathExists -Path $NodeExecutable -Description 'Node.js runtime'
Assert-PathExists -Path $WindowsRoot -Description 'Windows installer source'
New-Item -ItemType Directory -Force -Path $CacheRoot, $DistRoot | Out-Null
Reset-BuildDirectory -Path $StageRoot
New-Item -ItemType Directory -Force -Path $ProgramStage, $BackendStage | Out-Null

Write-Output 'Building the production frontend...'
if (-not $SkipFrontendBuild) {
    Push-Location $FrontendRoot
    try {
        $previousApiUrl = $env:NEXT_PUBLIC_API_URL
        $env:NEXT_PUBLIC_API_URL = 'http://127.0.0.1:8000/api'
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) {
            throw 'The production frontend build failed.'
        }
    } finally {
        $env:NEXT_PUBLIC_API_URL = $previousApiUrl
        Pop-Location
    }
}
$standaloneRoot = Join-Path $FrontendRoot '.next\standalone'
Assert-PathExists -Path (Join-Path $standaloneRoot 'server.js') -Description 'Next.js standalone server'
Copy-Tree -Source $standaloneRoot -Destination (Join-Path $ProgramStage 'frontend')
Copy-Tree -Source (Join-Path $FrontendRoot 'public') -Destination (Join-Path $ProgramStage 'frontend\public')
Copy-Tree -Source (Join-Path $FrontendRoot '.next\static') -Destination (Join-Path $ProgramStage 'frontend\.next\static')

Write-Output 'Packaging Node.js and PHP...'
$nodeStage = Join-Path $ProgramStage 'runtime\node'
New-Item -ItemType Directory -Force -Path $nodeStage | Out-Null
Copy-Item -LiteralPath $NodeExecutable -Destination (Join-Path $nodeStage 'node.exe') -Force

$phpStage = Join-Path $ProgramStage 'runtime\php'
Copy-Tree -Source $PhpRuntimePath -Destination $phpStage -ExcludeDirectories @(
    'cfg', 'CompatInfo', 'data', 'dev', 'docs', 'man', 'pear', 'scripts', 'tests', 'tmp', 'windowsXamppPhp', 'www'
) -ExcludeFiles @('php.ini')
Copy-Item -LiteralPath (Join-Path $WindowsRoot 'config\php.ini') -Destination (Join-Path $phpStage 'php.ini') -Force
$caBundle = 'C:\xampp\apache\bin\curl-ca-bundle.crt'
Assert-PathExists -Path $caBundle -Description 'TLS certificate bundle'
New-Item -ItemType Directory -Force -Path (Join-Path $phpStage 'extras\ssl') | Out-Null
Copy-Item -LiteralPath $caBundle -Destination (Join-Path $phpStage 'extras\ssl\cacert.pem') -Force

Write-Output "Packaging MySQL $MySqlVersion LTS..."
$mysqlZip = Join-Path $CacheRoot "mysql-$MySqlVersion-winx64.zip"
$mysqlUrl = "https://cdn.mysql.com/Downloads/MySQL-8.4/mysql-$MySqlVersion-winx64.zip"
Get-CachedFile -Url $mysqlUrl -Path $mysqlZip -ExpectedSize 281191914
$mysqlExtract = Join-Path $CacheRoot "mysql-$MySqlVersion-extracted"
$mysqlMarker = Join-Path $mysqlExtract '.complete'
if (-not (Test-Path -LiteralPath $mysqlMarker)) {
    Reset-BuildDirectory -Path $mysqlExtract
    Expand-Archive -LiteralPath $mysqlZip -DestinationPath $mysqlExtract -Force
    Set-Content -LiteralPath $mysqlMarker -Value $MySqlVersion -Encoding ASCII
}
$mysqlSource = Get-ChildItem -LiteralPath $mysqlExtract -Directory | Where-Object Name -Like 'mysql-*-winx64' | Select-Object -First 1
if (-not $mysqlSource) {
    throw 'The downloaded MySQL package has an unexpected directory structure.'
}
Assert-PathExists -Path (Join-Path $mysqlSource.FullName 'bin\mysqld.exe') -Description 'MySQL server executable'
Copy-Tree -Source $mysqlSource.FullName -Destination (Join-Path $ProgramStage 'runtime\mysql') -ExcludeDirectories @(
    'docs', 'include', 'mecab'
) -ExcludeFiles @('*.pdb', '*.lib', '*-debug.dll')

Write-Output 'Packaging the Laravel backend...'
Copy-Tree -Source $BackendRoot -Destination $BackendStage -ExcludeDirectories @(
    '.git', 'vendor', 'tests', 'storage'
) -ExcludeFiles @(
    '.env', '.env.*', '.phpunit.result.cache', 'phpunit.xml', '*.sql', '*.log',
    'check_*.php', 'create_*.php', 'get_token.php', 'test_*.php'
)
foreach ($directory in @(
    'bootstrap\cache',
    'storage\app\private',
    'storage\app\public',
    'storage\framework\cache\data',
    'storage\framework\sessions',
    'storage\framework\testing',
    'storage\framework\views',
    'storage\logs'
)) {
    New-Item -ItemType Directory -Force -Path (Join-Path $BackendStage $directory) | Out-Null
}
$composer = (Get-Command composer.bat -ErrorAction SilentlyContinue).Source
if (-not $composer) {
    throw 'Composer was not found. Install Composer once on the build computer.'
}
Push-Location $BackendStage
try {
    $previousPath = $env:Path
    $env:Path = "$PhpRuntimePath;$previousPath"
    $env:COMPOSER_ALLOW_SUPERUSER = '1'
    & $composer install --no-dev --prefer-dist --no-interaction --no-progress --optimize-autoloader
    if ($LASTEXITCODE -ne 0) {
        throw 'Composer could not build the production Laravel dependencies.'
    }
} finally {
    $env:Path = $previousPath
    Pop-Location
}

Write-Output 'Packaging managed Windows services...'
$serviceStage = Join-Path $ProgramStage 'services'
New-Item -ItemType Directory -Force -Path $serviceStage | Out-Null
$winSw = Join-Path $CacheRoot 'WinSW-x64.exe'
Get-CachedFile -Url 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe' -Path $winSw -ExpectedSize 18243033
Copy-Item -LiteralPath $winSw -Destination (Join-Path $serviceStage 'WSMISBackend.exe') -Force
Copy-Item -LiteralPath $winSw -Destination (Join-Path $serviceStage 'WSMISFrontend.exe') -Force
Copy-Item -LiteralPath (Join-Path $WindowsRoot 'services\WSMISBackend.xml') -Destination $serviceStage -Force
Copy-Item -LiteralPath (Join-Path $WindowsRoot 'services\WSMISFrontend.xml') -Destination $serviceStage -Force
Copy-Tree -Source (Join-Path $WindowsRoot 'scripts') -Destination (Join-Path $ProgramStage 'scripts')

Write-Output 'Packaging the Microsoft Visual C++ runtime...'
$prerequisiteStage = Join-Path $ProgramStage 'prerequisites'
New-Item -ItemType Directory -Force -Path $prerequisiteStage | Out-Null
$vcRedist = Join-Path $CacheRoot 'vc_redist.x64.exe'
Get-CachedFile -Url 'https://aka.ms/vs/17/release/vc_redist.x64.exe' -Path $vcRedist
$vcSignature = Get-AuthenticodeSignature -LiteralPath $vcRedist
if ($vcSignature.Status -ne 'Valid' -or $vcSignature.SignerCertificate.Subject -notmatch 'Microsoft Corporation') {
    throw 'The downloaded Microsoft Visual C++ runtime does not have a valid Microsoft signature.'
}
Copy-Item -LiteralPath $vcRedist -Destination (Join-Path $prerequisiteStage 'vc_redist.x64.exe') -Force

Write-Output 'Checking installer compiler...'
$inno = Find-InnoCompiler
if (-not $inno) {
    if ($SkipCompilerInstall) {
        throw 'Inno Setup 6 is not installed and -SkipCompilerInstall was specified.'
    }
    & winget.exe install --id JRSoftware.InnoSetup --exact --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to install the Inno Setup compiler.'
    }
    $inno = Find-InnoCompiler
}
if (-not $inno) {
    throw 'The Inno Setup compiler was installed but ISCC.exe could not be found.'
}

Write-Output 'Compiling the single-file WSMIS Setup package...'
& $inno "/DAppVersion=$Version" (Join-Path $WindowsRoot 'WSMIS-Setup.iss')
if ($LASTEXITCODE -ne 0) {
    throw 'Inno Setup could not compile the WSMIS installer.'
}

$installer = Join-Path $DistRoot "WSMIS-Setup-$Version.exe"
Assert-PathExists -Path $installer -Description 'Compiled WSMIS installer'
$hash = Get-FileHash -LiteralPath $installer -Algorithm SHA256
Set-Content -LiteralPath "$installer.sha256" -Value "$($hash.Hash.ToLowerInvariant())  $([System.IO.Path]::GetFileName($installer))" -Encoding ASCII

Write-Output ''
Write-Output 'WSMIS installer completed successfully.'
Write-Output "Installer: $installer"
Write-Output "SHA256:    $($hash.Hash.ToLowerInvariant())"
