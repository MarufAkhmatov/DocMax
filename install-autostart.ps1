# DocMax — install resilient auto-start (run once).
# 1) Registers a Scheduled Task that launches the watchdog at every logon and
#    restarts it if it ever dies (self-healing, survives reboots).
# 2) Creates a Desktop icon "DocMax" + a Startup-folder shortcut.
# Run in PowerShell:  powershell -ExecutionPolicy Bypass -File .\install-autostart.ps1
$ErrorActionPreference = "Stop"
$proj = Split-Path -Parent $MyInvocation.MyCommand.Path
$watch = "$proj\serve-dev.ps1"
$open  = "$proj\open-app.ps1"

# ---- 1) Scheduled Task: run watchdog at logon, keep it alive ----
try {
  $action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$watch`""
  $trigger = New-ScheduledTaskTrigger -AtLogOn
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Seconds 0)
  Register-ScheduledTask -TaskName "DocMax" -Action $action -Trigger $trigger `
    -Settings $settings -Description "DocMax dev stack (web:3000, api:3001, worker)" -Force | Out-Null
  Start-ScheduledTask -TaskName "DocMax" -ErrorAction SilentlyContinue
  Write-Host "Scheduled Task 'DocMax' registered + started." -ForegroundColor Green
} catch {
  Write-Host "Scheduled Task registration failed ($($_.Exception.Message)). Falling back to Startup shortcut only." -ForegroundColor Yellow
}

# ---- 2) Shortcuts (Desktop launcher + Startup watchdog) ----
$ws = New-Object -ComObject WScript.Shell
$ico = "$env:SystemRoot\System32\SHELL32.dll,13"

# Desktop "DocMax" — opens the app (ensures dev stack up first)
$desktop = [Environment]::GetFolderPath("Desktop")
$lnk = $ws.CreateShortcut("$desktop\DocMax.lnk")
$lnk.TargetPath = "powershell.exe"
$lnk.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$open`""
$lnk.WorkingDirectory = $proj
$lnk.IconLocation = $ico
$lnk.Description = "Open DocMax"
$lnk.Save()
Write-Host "Desktop icon 'DocMax' created." -ForegroundColor Green

# Startup-folder watchdog (belt-and-suspenders alongside the task)
$startup = [Environment]::GetFolderPath("Startup")
$slnk = $ws.CreateShortcut("$startup\DocMax (server).lnk")
$slnk.TargetPath = "powershell.exe"
$slnk.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$watch`""
$slnk.WorkingDirectory = $proj
$slnk.IconLocation = $ico
$slnk.WindowStyle = 7
$slnk.Description = "DocMax background dev stack"
$slnk.Save()
Write-Host "Startup shortcut created." -ForegroundColor Green

Write-Host "`nDone. App will be at http://localhost:3000 (API: http://localhost:3001/api/v1)." -ForegroundColor Cyan
