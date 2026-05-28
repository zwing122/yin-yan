param(
  [string]$InstallDir = "$env:USERPROFILE\.yin-yan",
  [string]$LegacyInstallDir = "$env:USERPROFILE\.finance-heartbeat",
  [string]$ReminderTime = "21:00",
  [string]$DailySummaryTime = "21:05",
  [string]$CashflowSummaryTime = "21:08",
  [string]$WeeklySummaryTime = "21:10",
  [string]$WeeklyDay = "Sunday",
  [string]$MonthlySummaryTime = "21:15",
  [ValidateRange(1,31)]
  [int]$MonthlySummaryDay = 28,
  [switch]$NoSchedule
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::UTF8

$packageRoot = Split-Path -Parent $PSScriptRoot
$skillSource = Join-Path $packageRoot "skills\yin-yan"
$skillTarget = Join-Path $InstallDir "skills\yin-yan"
$legacySkillTarget = Join-Path $LegacyInstallDir "skills\finance-heartbeat"
$webSource = Join-Path $packageRoot "web-review"
$webTarget = Join-Path $InstallDir "web-review"
$logDir = Join-Path $InstallDir "logs"
$dataBackupDir = Join-Path $env:TEMP ("yin-yan-data-" + [guid]::NewGuid().ToString("N"))
$node = Get-Command node -ErrorAction SilentlyContinue

if (-not $node) {
  throw "Node.js was not found. Install Node.js 18+ and run install.ps1 again."
}

if (-not (Test-Path $skillSource)) {
  throw "Skill package was not found: $skillSource"
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $skillTarget) | Out-Null
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

if (-not (Test-Path $skillTarget) -and (Test-Path $legacySkillTarget)) {
  $legacyData = Join-Path $legacySkillTarget "data"
  if (Test-Path $legacyData) {
    New-Item -ItemType Directory -Force -Path $dataBackupDir | Out-Null
    Copy-Item -LiteralPath $legacyData -Destination $dataBackupDir -Recurse -Force
    Write-Host "Migrated legacy ledger data from: $legacyData"
  }
}

if (Test-Path $skillTarget) {
  $existingData = Join-Path $skillTarget "data"
  if (Test-Path $existingData) {
    New-Item -ItemType Directory -Force -Path $dataBackupDir | Out-Null
    Move-Item -LiteralPath $existingData -Destination $dataBackupDir -Force
  }
  Remove-Item -LiteralPath $skillTarget -Recurse -Force
}

Copy-Item -LiteralPath $skillSource -Destination (Split-Path -Parent $skillTarget) -Recurse -Force
$preservedData = Join-Path $dataBackupDir "data"
if (Test-Path $preservedData) {
  $targetData = Join-Path $skillTarget "data"
  if (Test-Path $targetData) {
    Remove-Item -LiteralPath $targetData -Recurse -Force
  }
  Move-Item -LiteralPath $preservedData -Destination $targetData -Force
}
if (Test-Path $dataBackupDir) {
  Remove-Item -LiteralPath $dataBackupDir -Recurse -Force
}
if (Test-Path $webSource) {
  if (Test-Path $webTarget) {
    Remove-Item -LiteralPath $webTarget -Recurse -Force
  }
  Copy-Item -LiteralPath $webSource -Destination $InstallDir -Recurse -Force
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "run.ps1") -Destination (Join-Path $InstallDir "run.ps1") -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "run-heartbeat.ps1") -Destination (Join-Path $InstallDir "run-heartbeat.ps1") -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "verify.ps1") -Destination (Join-Path $InstallDir "verify.ps1") -Force

$ledgerCli = Join-Path $skillTarget "scripts\ledger-cli.mjs"
$ledgerPath = Join-Path $skillTarget "data\ledger.json"

& $node.Source $ledgerCli init | Out-Host

if (-not $NoSchedule) {
  $baseArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$InstallDir\run-heartbeat.ps1`""
  $tasks = @(
    @{
      Name = "YinYanReminder"
      Type = "reminder"
      Trigger = New-ScheduledTaskTrigger -Daily -At $ReminderTime
      Description = "银砚 reminder"
    },
    @{
      Name = "YinYanDailySummary"
      Type = "daily-summary"
      Trigger = New-ScheduledTaskTrigger -Daily -At $DailySummaryTime
      Description = "银砚 daily summary"
    },
    @{
      Name = "YinYanCashflowSummary"
      Type = "cashflow-summary"
      Trigger = New-ScheduledTaskTrigger -Daily -At $CashflowSummaryTime
      Description = "银砚 cashflow summary"
    },
    @{
      Name = "YinYanWeeklySummary"
      Type = "weekly-summary"
      Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $WeeklyDay -At $WeeklySummaryTime
      Description = "银砚 weekly summary"
    },
    @{
      Name = "YinYanMonthlySummary"
      Type = "monthly-summary -MonthlyDay $MonthlySummaryDay -CheckMonthlyDay"
      Trigger = New-ScheduledTaskTrigger -Daily -At $MonthlySummaryTime
      Description = "银砚 monthly summary"
    }
  )

  foreach ($task in $tasks) {
    $action = New-ScheduledTaskAction `
      -Execute "powershell.exe" `
      -Argument "$baseArgs -Type $($task.Type)"
    Register-ScheduledTask `
      -TaskName $task.Name `
      -Action $action `
      -Trigger $task.Trigger `
      -Description $task.Description `
      -Force | Out-Null
  }
}

Write-Host ""
Write-Host "Install complete."
Write-Host "Install dir: $InstallDir"
Write-Host "Ledger path: $ledgerPath"
Write-Host "Manual runner: $InstallDir\run.ps1"
Write-Host "Heartbeat runner: $InstallDir\run-heartbeat.ps1"
Write-Host "Verify runner: $InstallDir\verify.ps1"
Write-Host "Local review page: $InstallDir\web-review\index.html"

if ($NoSchedule) {
  Write-Host "Scheduled tasks were skipped."
} else {
  Write-Host "Scheduled tasks created."
}
