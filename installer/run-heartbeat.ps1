param(
  [ValidateSet("reminder", "daily-summary", "weekly-summary", "monthly-summary", "cashflow-summary")]
  [string]$Type = "reminder",
  [ValidateRange(1,31)]
  [int]$MonthlyDay = 28,
  [switch]$CheckMonthlyDay
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::UTF8

$installDir = $PSScriptRoot
$runScript = Join-Path $installDir "skills\yin-yan\scripts\run-command.mjs"
$logDir = Join-Path $installDir "logs"
$logFile = Join-Path $logDir "$Type.log"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

if ($Type -eq "monthly-summary" -and $CheckMonthlyDay -and (Get-Date).Day -ne $MonthlyDay) {
  @(
    "[$timestamp] $Type skipped; current day is not $MonthlyDay.",
    ""
  ) | Add-Content -LiteralPath $logFile -Encoding UTF8
  exit 0
}

$output = node $runScript --heartbeat $Type 2>&1

@(
  "[$timestamp] $Type",
  $output,
  ""
) | Add-Content -LiteralPath $logFile -Encoding UTF8

$output
