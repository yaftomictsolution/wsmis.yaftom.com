Set-StrictMode -Version 2.0

function Get-WSMISEnvValue {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Name
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    $line = Get-Content -LiteralPath $Path | Where-Object {
        $_ -match ('^' + [regex]::Escape($Name) + '=')
    } | Select-Object -Last 1
    if (-not $line) {
        return $null
    }

    $value = $line.Substring($Name.Length + 1).Trim()
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        return $value.Substring(1, $value.Length - 2)
    }

    return $value
}

function New-WSMISSecret {
    param([int]$Length = 40)

    $characters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
    $bytes = New-Object byte[] $Length
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $random.GetBytes($bytes)
    } finally {
        $random.Dispose()
    }

    $builder = New-Object System.Text.StringBuilder
    foreach ($byte in $bytes) {
        [void]$builder.Append($characters[$byte % $characters.Length])
    }

    return $builder.ToString()
}

function Invoke-WSMISNative {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter()][string[]]$Arguments = @(),
        [Parameter()][string]$FailureMessage = 'A required program failed.'
    )

    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FailureMessage Exit code: $LASTEXITCODE"
    }
}

function Wait-WSMISTcpPort {
    param(
        [Parameter(Mandatory = $true)][int]$Port,
        [int]$TimeoutSeconds = 90
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        $client = New-Object System.Net.Sockets.TcpClient
        try {
            $async = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
            if ($async.AsyncWaitHandle.WaitOne(750, $false) -and $client.Connected) {
                $client.EndConnect($async)
                return
            }
        } catch {
        } finally {
            $client.Dispose()
        }
        Start-Sleep -Milliseconds 700
    } while ((Get-Date) -lt $deadline)

    throw "The local service on port $Port did not start within $TimeoutSeconds seconds."
}

function Assert-WSMISPortAvailable {
    param([Parameter(Mandatory = $true)][int]$Port)

    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    try {
        $listener.Start()
    } catch {
        throw "Local port $Port is already in use. Close the program using it and run WSMIS Setup again."
    } finally {
        try { $listener.Stop() } catch {}
    }
}

function Wait-WSMISUrl {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSeconds = 120
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return
            }
        } catch {
        }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)

    throw "WSMIS did not become available at $Url within $TimeoutSeconds seconds."
}

function Write-WSMISProgress {
    param(
        [Parameter(Mandatory = $true)][string]$DataRoot,
        [Parameter(Mandatory = $true)][int]$Progress,
        [Parameter(Mandatory = $true)][string]$Message
    )

    $payload = @{
        progress = [Math]::Max(0, [Math]::Min(100, $Progress))
        message = $Message
        updated_at = (Get-Date).ToUniversalTime().ToString('o')
    } | ConvertTo-Json
    Set-Content -LiteralPath (Join-Path $DataRoot 'setup-progress.json') -Value $payload -Encoding UTF8
    Write-Output ("[{0,3}%] {1}" -f $Progress, $Message)
}

function Protect-WSMISSecretFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [switch]$IncludeCurrentUser
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }

    $grantArguments = @('*S-1-5-18:F', '*S-1-5-32-544:F')
    if ($IncludeCurrentUser) {
        $currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        $grantArguments += "*$($currentSid):F"
    }

    & icacls.exe $Path /inheritance:r /grant:r @grantArguments | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to protect the secret file at $Path"
    }
}
