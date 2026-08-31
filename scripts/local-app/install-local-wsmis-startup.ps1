param(
    [string]$ProjectRoot = "D:\WSMIS",
    [string]$TaskName = "WSMIS Local App"
)

$ErrorActionPreference = "Stop"

$StartScript = Join-Path $ProjectRoot "scripts\local-app\start-local-wsmis.ps1"
if (-not (Test-Path -LiteralPath $StartScript)) {
    throw "Start script not found: $StartScript"
}

$quotedStartScript = '"' + $StartScript + '"'
$quotedProjectRoot = '"' + $ProjectRoot + '"'

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File $quotedStartScript -ProjectRoot $quotedProjectRoot -NoBrowser"
$trigger = New-ScheduledTaskTrigger -AtLogOn

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Description "Starts the local WSMIS backend and frontend after Windows login." `
    -Force | Out-Null

$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "WSMIS Local.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File $quotedStartScript -ProjectRoot $quotedProjectRoot"
$shortcut.WorkingDirectory = $ProjectRoot
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
$shortcut.Save()

Write-Host "Installed startup task: $TaskName"
Write-Host "Created desktop shortcut: $shortcutPath"
