param(
  [string]$Text,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$TextParts
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::UTF8

$installDir = $PSScriptRoot
$runScript = Join-Path $installDir "skills\yin-yan\scripts\run-command.mjs"
$inputText = if ($Text) { $Text } else { ($TextParts -join " ") }
$text = $inputText.Trim()

if (-not $text) {
  Write-Host "用法："
  Write-Host "powershell -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" `"今天午饭 38，微信付的`""
  exit 1
}

node $runScript --text $text
