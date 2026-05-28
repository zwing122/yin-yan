param(
  [string]$SkillName = "yin-yan",
  [string]$InstallDir = "$env:USERPROFILE\.yin-yan",
  [string]$Channel = "",
  [string]$To = "",
  [switch]$InstallSkillHubSkill,
  [switch]$ConfigureOpenClawCron,
  [switch]$ConfigureOpenClawHeartbeat,
  [switch]$NoWindowsSchedule,
  [switch]$RunVerify
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::UTF8

$packageRoot = Split-Path -Parent $PSScriptRoot
$installScript = Join-Path $PSScriptRoot "install.ps1"
$cronScript = Join-Path $PSScriptRoot "install-openclaw-cron.ps1"
$heartbeatScript = Join-Path $PSScriptRoot "install-openclaw-heartbeat.ps1"
$verifyScript = Join-Path $PSScriptRoot "verify.ps1"

function Step($Message) {
  Write-Host ""
  Write-Host "==> $Message"
}

function HasCommand($Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

Write-Host "YinYan setup wizard"
Write-Host "Package root: $packageRoot"
Write-Host "Install dir : $InstallDir"

Step "Check SkillHub CLI"
if (HasCommand "skillhub") {
  Write-Host "SkillHub CLI: found"
} else {
  Write-Host "SkillHub CLI: not found"
  Write-Host "Install SkillHub CLI-only first if you want marketplace install:"
  Write-Host "https://skillhub.cn/install/skillhub.md"
}

if ($InstallSkillHubSkill) {
  Step "Install SkillHub skill: $SkillName"
  if (-not (HasCommand "skillhub")) {
    throw "skillhub command was not found. Install SkillHub CLI first."
  }
  skillhub install $SkillName
  if ($LASTEXITCODE -ne 0) {
    throw "skillhub install failed: $SkillName"
  }
} else {
  Write-Host "Skip SkillHub skill install. Use -InstallSkillHubSkill to run: skillhub install $SkillName"
}

Step "Install YinYan local package"
$installArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $installScript, "-InstallDir", $InstallDir)
if ($NoWindowsSchedule) {
  $installArgs += "-NoSchedule"
}
powershell @installArgs
if ($LASTEXITCODE -ne 0) {
  throw "install.ps1 failed"
}

Step "Prepare OpenClaw heartbeat workspace"
powershell -NoProfile -ExecutionPolicy Bypass -File $heartbeatScript -InstallDir $InstallDir
if ($LASTEXITCODE -ne 0) {
  throw "install-openclaw-heartbeat.ps1 failed"
}

if ($ConfigureOpenClawHeartbeat) {
  Write-Host "Configure OpenClaw heartbeat to use this workspace:"
  Write-Host (Join-Path $InstallDir "openclaw-workspace")
} else {
  Write-Host "Heartbeat workspace prepared."
}

Step "OpenClaw cron"
if ($ConfigureOpenClawCron) {
  if (-not $Channel -or -not $To) {
    throw "-ConfigureOpenClawCron requires -Channel and -To."
  }
  powershell -NoProfile -ExecutionPolicy Bypass -File $cronScript -InstallDir $InstallDir -Channel $Channel -To $To -Run
  if ($LASTEXITCODE -ne 0) {
    throw "install-openclaw-cron.ps1 failed"
  }
} else {
  Write-Host "Cron not created automatically."
  Write-Host "Print OpenClaw cron commands:"
  Write-Host "powershell -NoProfile -ExecutionPolicy Bypass -File `"$cronScript`" -InstallDir `"$InstallDir`""
  Write-Host "Create OpenClaw cron after confirming channel/to:"
  Write-Host "powershell -NoProfile -ExecutionPolicy Bypass -File `"$cronScript`" -InstallDir `"$InstallDir`" -Channel qq -To `"group:123456`" -Run"
}

if ($RunVerify) {
  Step "Run package verify"
  powershell -NoProfile -ExecutionPolicy Bypass -File $verifyScript -PackageRoot $packageRoot
  if ($LASTEXITCODE -ne 0) {
    throw "verify.ps1 failed"
  }
}

Step "Done"
Write-Host "Try a record:"
Write-Host "powershell -NoProfile -ExecutionPolicy Bypass -File `"$InstallDir\run.ps1`" `"today lunch 38`""
Write-Host ""
Write-Host "Use OpenClaw cron for fixed-time summaries. Use OpenClaw heartbeat workspace for lightweight checks."
