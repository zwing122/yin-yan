param(
  [string]$OutputDir = "dist",
  [string]$PackageName = "yin-yan-installer"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::UTF8

$projectRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $projectRoot
$stageDir = Join-Path $repoRoot "$OutputDir\$PackageName"
$zipPath = Join-Path $repoRoot "$OutputDir\$PackageName.zip"

if (Test-Path $stageDir) {
  Remove-Item -LiteralPath $stageDir -Recurse -Force
}
if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Force -Path $stageDir | Out-Null

Copy-Item -LiteralPath (Join-Path $projectRoot "installer") -Destination $stageDir -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot "skills") -Destination $stageDir -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot "schemas") -Destination $stageDir -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot "web-review") -Destination $stageDir -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot "USAGE.md") -Destination $stageDir -Force
Copy-Item -LiteralPath (Join-Path $projectRoot "PRODUCT_FORM.md") -Destination $stageDir -Force
Copy-Item -LiteralPath (Join-Path $projectRoot "HEARTBEAT.md") -Destination $stageDir -Force

$dataDir = Join-Path $stageDir "skills\yin-yan\data"
if (Test-Path $dataDir) {
  Remove-Item -LiteralPath $dataDir -Recurse -Force
}

Compress-Archive -Path (Join-Path $stageDir "*") -DestinationPath $zipPath -Force

Write-Host "Package created: $zipPath"
