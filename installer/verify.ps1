param(
  [string]$PackageRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::UTF8

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  throw "Node.js was not found. Install Node.js 18+ before running verify.ps1."
}

$runScript = Join-Path $PackageRoot "skills\yin-yan\scripts\run-command.mjs"
$webReview = Join-Path $PackageRoot "web-review\index.html"
$openClawCronInstaller = Join-Path $PackageRoot "installer\install-openclaw-cron.ps1"
$openClawHeartbeatInstaller = Join-Path $PackageRoot "installer\install-openclaw-heartbeat.ps1"
$setupWizard = Join-Path $PackageRoot "installer\setup-wizard.ps1"
$heartbeatTemplate = Join-Path $PackageRoot "HEARTBEAT.md"
if (-not (Test-Path $runScript)) {
  throw "Missing packaged run-command.mjs: $runScript"
}
if (-not (Test-Path $webReview)) {
  throw "Missing packaged web-review page: $webReview"
}
if (-not (Test-Path $openClawCronInstaller)) {
  throw "Missing packaged OpenClaw cron installer: $openClawCronInstaller"
}
if (-not (Test-Path $openClawHeartbeatInstaller)) {
  throw "Missing packaged OpenClaw heartbeat installer: $openClawHeartbeatInstaller"
}
if (-not (Test-Path $setupWizard)) {
  throw "Missing packaged setup wizard: $setupWizard"
}
if (-not (Test-Path $heartbeatTemplate)) {
  throw "Missing packaged HEARTBEAT.md: $heartbeatTemplate"
}

$testRoot = Join-Path $env:TEMP ("yin-yan-verify-" + [guid]::NewGuid().ToString("N"))
$ledger = Join-Path $testRoot "ledger.json"
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

function Decode-Utf8Base64([string]$Value) {
  return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Value))
}

try {
  $lunchText = Decode-Utf8Base64 "5LuK5aSp5Y2I6aWtIDM477yM5b6u5L+h5LuY55qE"
  $incomeText = Decode-Utf8Base64 "5LuK5aSp5pS25Yiw5bel6LWEIDEyMDAw77yM6ZO26KGM5Y2h"
  $badDateText = Decode-Utf8Base64 "MuaciDMx5pel5Y2I6aWtIDEw"
  $clearText = Decode-Utf8Base64 "5riF56m66LSm5pys"
  $balanceText = Decode-Utf8Base64 "5b6u5L+h5L2Z6aKdIDIwMO+8jOmTtuihjOWNoSAzMjAw"
  $takeoutTodayText = Decode-Utf8Base64 "5LuK5aSp5aSW5Y2WIDM5"
  $takeoutYesterdayText = Decode-Utf8Base64 "5pio5aSp5aSW5Y2WIDQ1"
  $lunchBeforeText = Decode-Utf8Base64 "5YmN5aSp5Y2I6aWtIDM4"
  $earphoneText = Decode-Utf8Base64 "5Lmw5LqG6ZmN5Zmq6ICz5py6MTI5OQ=="
  $earphoneStartText = Decode-Utf8Base64 "6L+Z5Liq6ICz5py65byA5aeL6L+96Liq77yM6aKE6K6h55So5LiA5bm0"
  $earphoneMentionText = Decode-Utf8Base64 "6ICz5py65LuK5aSp55So5LqG"
  $weChatAccount = Decode-Utf8Base64 "5b6u5L+h"
  $bankCardAccount = Decode-Utf8Base64 "6ZO26KGM5Y2h"
  $diningPattern = Decode-Utf8Base64 "6aSQ6aWu6auY6aKR"
  $earphoneItem = Decode-Utf8Base64 "6ZmN5Zmq6ICz5py6"

  $first = & $node.Source $runScript --ledger $ledger --text $lunchText
  if ($LASTEXITCODE -ne 0) { throw "record command failed" }
  if (-not (Test-Path $ledger)) { throw "record command did not create ledger" }

  $duplicate = & $node.Source $runScript --ledger $ledger --text $lunchText
  if ($LASTEXITCODE -ne 0) { throw "duplicate command failed" }

  $ledgerJson = Get-Content -Raw -Encoding UTF8 $ledger | ConvertFrom-Json
  if ($ledgerJson.events.Count -ne 1) { throw "duplicate verification expected 1 event, got $($ledgerJson.events.Count)" }

  $income = & $node.Source $runScript --ledger $ledger --text $incomeText
  if ($LASTEXITCODE -ne 0) { throw "income command failed" }
  $ledgerJson = Get-Content -Raw -Encoding UTF8 $ledger | ConvertFrom-Json
  $incomeEvent = $ledgerJson.events | Where-Object { $_.type -eq "income" } | Select-Object -First 1
  if (-not $incomeEvent -or -not $incomeEvent.occurred_at) { throw "income event did not get occurred_at" }

  $invalidDate = & $node.Source $runScript --ledger $ledger --text $badDateText
  if ($LASTEXITCODE -ne 0) { throw "invalid-date command failed" }
  $ledgerJson = Get-Content -Raw -Encoding UTF8 $ledger | ConvertFrom-Json
  $invalidDateEvent = $ledgerJson.events | Where-Object { $_.source.raw_text -eq $badDateText } | Select-Object -First 1
  if (-not $invalidDateEvent -or $invalidDateEvent.occurred_at) { throw "invalid date wrote a bogus occurred_at" }

  $balance = & $node.Source $runScript --ledger $ledger --text $balanceText
  if ($LASTEXITCODE -ne 0) { throw "multi-balance command failed" }
  $ledgerJson = Get-Content -Raw -Encoding UTF8 $ledger | ConvertFrom-Json
  $latestBalances = @($ledgerJson.profile.latest_balances)
  if (-not ($latestBalances | Where-Object { $_.account -eq $weChatAccount -and $_.amount -eq 200 })) {
    throw "multi-balance verification missing WeChat 200"
  }
  if (-not ($latestBalances | Where-Object { $_.account -eq $bankCardAccount -and $_.amount -eq 3200 })) {
    throw "multi-balance verification missing bank card 3200"
  }

  & $node.Source $runScript --ledger $ledger --text $takeoutTodayText | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "takeout today command failed" }
  & $node.Source $runScript --ledger $ledger --text $takeoutYesterdayText | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "takeout yesterday command failed" }
  & $node.Source $runScript --ledger $ledger --text $lunchBeforeText | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "lunch before command failed" }
  $ledgerJson = Get-Content -Raw -Encoding UTF8 $ledger | ConvertFrom-Json
  $smallExpensePending = @($ledgerJson.events | Where-Object {
    ($_.source.raw_text -eq $takeoutTodayText -or $_.source.raw_text -eq $takeoutYesterdayText -or $_.source.raw_text -eq $lunchBeforeText) -and
    $_.status -eq "needs_review"
  })
  if ($smallExpensePending.Count -ne 0) { throw "small clear expenses should not enter strong review" }
  $patterns = @($ledgerJson.profile.behavior_patterns)
  if (-not ($patterns | Where-Object { $_.label -eq $diningPattern })) {
    throw "dining behavior pattern was not generated"
  }

  & $node.Source $runScript --ledger $ledger --text $earphoneText | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "asset candidate command failed" }
  & $node.Source $runScript --ledger $ledger --text $earphoneStartText | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "asset start command failed" }
  & $node.Source $runScript --ledger $ledger --text $earphoneMentionText | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "asset mention command failed" }
  $ledgerJson = Get-Content -Raw -Encoding UTF8 $ledger | ConvertFrom-Json
  $assetEvent = $ledgerJson.events | Where-Object { $_.asset_tracking.item_name -eq $earphoneItem } | Select-Object -First 1
  if (-not $assetEvent -or $assetEvent.asset_tracking.status -ne "tracking") {
    throw "asset tracking verification missing tracking status"
  }
  if ($assetEvent.asset_tracking.mention_count -ne 1) {
    throw "asset tracking verification expected one mention"
  }
  if ($assetEvent.asset_tracking.PSObject.Properties.Name -contains "usage_count") {
    throw "asset tracking should not write usage_count"
  }

  $beforeClearCount = $ledgerJson.events.Count
  $clear = & $node.Source $runScript --ledger $ledger --text $clearText
  if ($LASTEXITCODE -ne 0) { throw "clear warning command failed" }
  $ledgerJson = Get-Content -Raw -Encoding UTF8 $ledger | ConvertFrom-Json
  if ($ledgerJson.events.Count -ne $beforeClearCount) { throw "clear warning changed ledger without confirmation" }

  $daily = & $node.Source $runScript --ledger $ledger --heartbeat daily-summary
  if ($LASTEXITCODE -ne 0) { throw "daily heartbeat failed" }
  if (-not $daily -or $daily.Count -eq 0) { throw "daily heartbeat did not render summary" }

  Write-Host "Verify passed. Temp ledger only: $ledger"
} finally {
  if (Test-Path $testRoot) {
    Remove-Item -LiteralPath $testRoot -Recurse -Force
  }
}
