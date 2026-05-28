param(
  [string]$InstallDir = "$env:USERPROFILE\.yin-yan",
  [switch]$DeleteData,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::UTF8

$taskNames = @(
  "YinYanReminder",
  "YinYanDailySummary",
  "YinYanCashflowSummary",
  "YinYanWeeklySummary",
  "YinYanMonthlySummary"
)

foreach ($name in $taskNames) {
  $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  if ($task) {
    Unregister-ScheduledTask -TaskName $name -Confirm:$false
  }
}

if (-not $DeleteData) {
  Write-Host "Scheduled tasks removed. Local ledger and install dir kept: $InstallDir"
  Write-Host "To delete local data too, rerun with -DeleteData."
  exit 0
}

if (-not $Force) {
  $answer = Read-Host "This will delete the install directory and local ledger data. Type DELETE to continue"
  if ($answer -ne "DELETE") {
    Write-Host "Cancelled. Local data kept: $InstallDir"
    exit 0
  }
}

if (Test-Path $InstallDir) {
  Remove-Item -LiteralPath $InstallDir -Recurse -Force
}

Write-Host "Uninstall complete. Local data deleted: $InstallDir"
