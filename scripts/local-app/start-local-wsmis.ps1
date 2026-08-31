param(
    [string]$ProjectRoot = "D:\WSMIS",
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 3000,
    [int]$MysqlPort = 3306,
    [string]$XamppPath = "C:\xampp",
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

function Test-LocalPort {
    param([int]$Port)

    try {
        $client = [System.Net.Sockets.TcpClient]::new()
        $task = $client.ConnectAsync("127.0.0.1", $Port)
        $connected = $task.Wait(500)
        $client.Dispose()
        return $connected
    } catch {
        return $false
    }
}

function Wait-LocalPort {
    param(
        [int]$Port,
        [int]$Seconds = 20
    )

    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-LocalPort -Port $Port) {
            return $true
        }

        Start-Sleep -Milliseconds 500
    }

    return $false
}

function Start-MySqlIfNeeded {
    if (Test-LocalPort -Port $MysqlPort) {
        Write-Host "MySQL is already running on port $MysqlPort."
        return
    }

    $mysqlService = Get-Service -Name "mysql*" -ErrorAction SilentlyContinue |
        Where-Object { $_.Status -ne "Running" } |
        Select-Object -First 1

    if ($mysqlService) {
        try {
            Start-Service -Name $mysqlService.Name
        } catch {
            Write-Warning "Could not start MySQL service $($mysqlService.Name): $($_.Exception.Message)"
        }
    }

    if (-not (Test-LocalPort -Port $MysqlPort)) {
        $xamppMysql = Join-Path $XamppPath "mysql_start.bat"
        if (Test-Path -LiteralPath $xamppMysql) {
            Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "`"$xamppMysql`"") -WindowStyle Hidden
        }
    }

    if (-not (Wait-LocalPort -Port $MysqlPort -Seconds 25)) {
        Write-Warning "MySQL is not reachable on port $MysqlPort. Open XAMPP/MySQL manually if the app cannot connect."
    }
}

$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"

if (-not (Test-Path -LiteralPath $BackendDir)) {
    throw "Backend path not found: $BackendDir"
}

if (-not (Test-Path -LiteralPath $FrontendDir)) {
    throw "Frontend path not found: $FrontendDir"
}

Start-MySqlIfNeeded

if (-not (Test-LocalPort -Port $BackendPort)) {
    $backendOut = Join-Path $BackendDir "storage\logs\local-wsmis-backend.out.log"
    $backendErr = Join-Path $BackendDir "storage\logs\local-wsmis-backend.err.log"
    Start-Process -FilePath "php" `
        -ArgumentList @("artisan", "serve", "--host=127.0.0.1", "--port=$BackendPort") `
        -WorkingDirectory $BackendDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput $backendOut `
        -RedirectStandardError $backendErr
    Wait-LocalPort -Port $BackendPort -Seconds 20 | Out-Null
}

if (-not (Test-LocalPort -Port $FrontendPort)) {
    $frontendOut = Join-Path $FrontendDir "local-wsmis-frontend.out.log"
    $frontendErr = Join-Path $FrontendDir "local-wsmis-frontend.err.log"
    Start-Process -FilePath "npm.cmd" `
        -ArgumentList @("start", "--", "-p", "$FrontendPort") `
        -WorkingDirectory $FrontendDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput $frontendOut `
        -RedirectStandardError $frontendErr
    Wait-LocalPort -Port $FrontendPort -Seconds 25 | Out-Null
}

if (-not $NoBrowser) {
    Start-Process "http://127.0.0.1:$FrontendPort"
}

Write-Host "WSMIS local app is ready at http://127.0.0.1:$FrontendPort"
