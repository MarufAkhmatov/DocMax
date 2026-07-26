# DocMax — dev-stack watchdog. Ensures Docker infra (postgres, minio, redis,
# mailpit) is up, then keeps `pnpm dev` (web:3000, api:3001, worker) alive.
# Tracks the spawned process (not just the port — a mid-recompile watch
# process can drop the port briefly without having died) so it never piles
# up duplicate `pnpm dev` trees fighting over the same ports. Self-healing:
# if the process actually dies, it is restarted. Runs forever; relaunched at
# the next logon by the scheduled task created by install-autostart.ps1.
$ErrorActionPreference = "SilentlyContinue"
$proj = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $proj
$pidFile = "$proj\.devstack.pid"

function DaemonUp { docker info 2>$null | Out-Null; return $? }
function DevProcAlive {
  if (-not (Test-Path $pidFile)) { return $false }
  $procId = Get-Content $pidFile -ErrorAction SilentlyContinue
  if (-not $procId) { return $false }
  return [bool](Get-Process -Id $procId -ErrorAction SilentlyContinue)
}

# 1) Make sure the Docker daemon is running (start Docker Desktop if needed),
#    then bring up postgres/minio/redis/mailpit (idempotent).
if (-not (DaemonUp)) {
  $dd = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  if (Test-Path $dd) { Start-Process $dd }
  for ($i = 0; $i -lt 60; $i++) { if (DaemonUp) { break }; Start-Sleep -Seconds 3 }
}
if (DaemonUp) { docker compose up -d 2>$null | Out-Null }

# 2) Keep `pnpm dev` (turbo: web + api + worker) alive.
while ($true) {
  if (-not (DevProcAlive)) {
    if (DaemonUp) { docker compose up -d 2>$null | Out-Null }
    $p = Start-Process -FilePath "cmd.exe" -ArgumentList "/c pnpm dev" -WorkingDirectory $proj -WindowStyle Hidden -PassThru
    Set-Content -Path $pidFile -Value $p.Id
    Start-Sleep -Seconds 60   # cold start (install + prisma generate + tsc + vite/nest) needs real time
  }
  Start-Sleep -Seconds 10
}
