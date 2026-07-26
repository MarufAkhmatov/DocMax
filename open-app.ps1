# DocMax — desktop launcher. Ensures the dev stack (Docker infra + pnpm dev)
# is running, then opens the app in the default browser. Used by the
# "DocMax" desktop icon.
$ErrorActionPreference = "SilentlyContinue"
$proj = Split-Path -Parent $MyInvocation.MyCommand.Path

function Port3000Up { Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue }

if (-not (Port3000Up)) {
  # try the background scheduled task first, else launch the watchdog directly
  Start-ScheduledTask -TaskName "DocMax" -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  if (-not (Port3000Up)) {
    Start-Process powershell.exe -ArgumentList "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$proj\serve-dev.ps1`"" -WindowStyle Hidden
  }
  # cold start = Docker Desktop boot + infra healthchecks + turbo/vite/nest — can take a while
  for ($i = 0; $i -lt 150; $i++) { if (Port3000Up) { break }; Start-Sleep -Seconds 1 }
}

Start-Process "http://localhost:3000"
