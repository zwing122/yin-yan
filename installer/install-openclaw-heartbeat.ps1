param(
  [string]$InstallDir = "$env:USERPROFILE\.yin-yan",
  [string]$WorkspaceDir = "",
  [switch]$RunNow
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::UTF8

$heartbeatSource = Join-Path (Split-Path -Parent $PSScriptRoot) "HEARTBEAT.md"
if (-not $WorkspaceDir) {
  $WorkspaceDir = Join-Path $InstallDir "openclaw-workspace"
}
$heartbeatTarget = Join-Path $WorkspaceDir "HEARTBEAT.md"
$runner = Join-Path $InstallDir "run-heartbeat.ps1"

if (-not (Test-Path $heartbeatSource)) {
  throw "Missing HEARTBEAT.md template: $heartbeatSource"
}

New-Item -ItemType Directory -Force -Path $WorkspaceDir | Out-Null
Copy-Item -LiteralPath $heartbeatSource -Destination $heartbeatTarget -Force

Write-Host "OpenClaw heartbeat workspace prepared:"
Write-Host $WorkspaceDir
Write-Host ""
Write-Host "HEARTBEAT.md:"
Write-Host $heartbeatTarget
Write-Host ""
Write-Host "YinYan heartbeat command used by the heartbeat file:"
Write-Host "powershell -NoProfile -ExecutionPolicy Bypass -File `"$runner`" -Type reminder"
Write-Host ""
Write-Host "Next step:"
Write-Host "Configure OpenClaw heartbeat to watch/use this workspace. Fixed-time summaries should still use install-openclaw-cron.ps1."

if ($RunNow) {
  if (-not (Test-Path $runner)) {
    throw "YinYan heartbeat runner was not found: $runner. Run install.ps1 first."
  }
  Write-Host ""
  Write-Host "Dry run output:"
  powershell -NoProfile -ExecutionPolicy Bypass -File $runner -Type reminder
}
