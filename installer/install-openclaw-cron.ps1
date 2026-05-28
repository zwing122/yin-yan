param(
  [string]$InstallDir = "$env:USERPROFILE\.yin-yan",
  [string]$TimeZone = "Asia/Shanghai",
  [string]$Channel = "",
  [string]$To = "",
  [switch]$Run
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::UTF8

$jobs = @(
  @{
    Name = "YinYanReminder"
    Cron = "0 21 * * *"
    Type = "reminder"
    Label = "reminder"
  },
  @{
    Name = "YinYanDailySummary"
    Cron = "5 21 * * *"
    Type = "daily-summary"
    Label = "daily summary"
  },
  @{
    Name = "YinYanCashflowSummary"
    Cron = "8 21 * * *"
    Type = "cashflow-summary"
    Label = "cashflow summary"
  },
  @{
    Name = "YinYanWeeklySummary"
    Cron = "10 21 * * 0"
    Type = "weekly-summary"
    Label = "weekly summary"
  },
  @{
    Name = "YinYanMonthlySummary"
    Cron = "15 21 28 * *"
    Type = "monthly-summary"
    Label = "monthly summary"
  }
)

function New-YinYanCronArgs($Job) {
  $runner = Join-Path $InstallDir "run-heartbeat.ps1"
  $command = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$runner`" -Type $($Job.Type)"
  $message = @"
You are running the YinYan proactive finance heartbeat task: $($Job.Label).
Execute this local command:
$command

Send only the final script output to the current OpenClaw chat channel. Do not forward reasoning, tool-call traces, queue messages, or progress noise.
"@

  $cronArgs = @(
    "cron", "add",
    "--name", $Job.Name,
    "--cron", $Job.Cron,
    "--tz", $TimeZone,
    "--session", "isolated",
    "--message", $message
  )

  if ($Channel -and $To) {
    $cronArgs += @("--announce", "--channel", $Channel, "--to", $To)
  }

  return $cronArgs
}

function Format-CommandLine($Values) {
  $escaped = $Values | ForEach-Object {
    if ($_ -match '\s|["]') {
      '"' + ($_ -replace '"', '\"') + '"'
    } else {
      $_
    }
  }
  return "openclaw " + ($escaped -join " ")
}

if ($Run) {
  $openclaw = Get-Command openclaw -ErrorAction SilentlyContinue
  if (-not $openclaw) {
    throw "openclaw command was not found. Install and sign in to OpenClaw, or run this script without -Run to print commands."
  }
  if (-not (Test-Path (Join-Path $InstallDir "run-heartbeat.ps1"))) {
    throw "YinYan heartbeat runner was not found: $InstallDir\run-heartbeat.ps1. Run install.ps1 first."
  }
  if (-not $Channel -or -not $To) {
    throw "Channel and To are required when -Run is used. Run without -Run first if you are not sure."
  }

  foreach ($job in $jobs) {
    $jobArgs = New-YinYanCronArgs $job
    & $openclaw.Source @jobArgs
    if ($LASTEXITCODE -ne 0) {
      throw "OpenClaw cron creation failed: $($job.Name)"
    }
  }
  Write-Host "OpenClaw cron jobs created. Run: openclaw cron list"
  exit 0
}

Write-Host "OpenClaw cron command templates:"
Write-Host "Confirm OpenClaw channel/to first, then run this script with -Channel, -To, and -Run."
Write-Host ""
Write-Host "Example:"
Write-Host "powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\install-openclaw-cron.ps1 -Channel qq -To `"group:123456`" -Run"
Write-Host ""

foreach ($job in $jobs) {
  $jobArgs = New-YinYanCronArgs $job
  Write-Host "# $($job.Label)"
  Write-Host (Format-CommandLine $jobArgs)
  Write-Host ""
}
