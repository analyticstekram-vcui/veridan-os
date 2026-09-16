$ErrorActionPreference = 'Stop'
$stateDirectory = Join-Path $env:LOCALAPPDATA 'Veridan\Companion'
$secretPath = Join-Path $stateDirectory 'token.clixml'

if (-not (Test-Path $secretPath)) { throw 'Companion token not found. Run install.ps1 first.' }
$secureToken = Import-Clixml -Path $secretPath
$credential = New-Object System.Management.Automation.PSCredential('veridan', $secureToken)
$token = $credential.GetNetworkCredential().Password
$baseUrl = 'http://127.0.0.1:4701'

function New-VeridanHeaders {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Path
  )

  $timestamp = [DateTimeOffset]::UtcNow.ToString('o')
  $nonce = [Guid]::NewGuid().ToString()
  $canonical = "$($Method.ToUpperInvariant())`n$Path`n$timestamp`n$nonce"
  $key = [Text.Encoding]::UTF8.GetBytes($token)
  $data = [Text.Encoding]::UTF8.GetBytes($canonical)
  $hmac = New-Object System.Security.Cryptography.HMACSHA256
  try {
    $hmac.Key = $key
    $signature = [Convert]::ToBase64String($hmac.ComputeHash($data)).TrimEnd('=').Replace('+', '-').Replace('/', '_')
  } finally {
    $hmac.Dispose()
  }

  return @{
    Authorization = "Bearer $token"
    'X-Veridan-Timestamp' = $timestamp
    'X-Veridan-Nonce' = $nonce
    'X-Veridan-Signature' = $signature
  }
}

$health = Invoke-RestMethod "$baseUrl/health"
$capabilities = Invoke-RestMethod "$baseUrl/capabilities" -Headers (New-VeridanHeaders -Method GET -Path '/capabilities')
$activeWindow = Invoke-RestMethod "$baseUrl/v1/active-window" -Headers (New-VeridanHeaders -Method GET -Path '/v1/active-window')
$see = Invoke-RestMethod "$baseUrl/v1/see" -Method Post -Headers (New-VeridanHeaders -Method POST -Path '/v1/see')
$watchStart = Invoke-RestMethod "$baseUrl/v1/watch/start" -Method Post -Headers (New-VeridanHeaders -Method POST -Path '/v1/watch/start')
Start-Sleep -Milliseconds 500
$watchStop = Invoke-RestMethod "$baseUrl/v1/watch/stop" -Method Post -Headers (New-VeridanHeaders -Method POST -Path '/v1/watch/stop')
$lastError = Invoke-RestMethod "$baseUrl/last-error" -Headers (New-VeridanHeaders -Method GET -Path '/last-error')

$checks = @(
  @{ name = 'health'; passed = $health.status -eq 'ok' },
  @{ name = 'heartbeat'; passed = [bool]$health.heartbeat },
  @{ name = 'capabilities_nonexecuting'; passed = $capabilities.execution -eq $false },
  @{ name = 'active_window'; passed = $activeWindow.capability -eq 'active_window' },
  @{ name = 'see_ephemeral'; passed = $see.retention -eq 'ephemeral' -and $see.payload.ephemeral -eq $true },
  @{ name = 'watch_visible'; passed = $watchStart.watch.visibleIndicator -eq $true },
  @{ name = 'watch_stopped'; passed = $watchStop.watch.active -eq $false },
  @{ name = 'last_error_clear'; passed = $null -eq $lastError.lastError }
)

$checks | ForEach-Object {
  $mark = if ($_.passed) { '[PASS]' } else { '[FAIL]' }
  Write-Host "$mark $($_.name)"
}

if ($checks.Where({ -not $_.passed }).Count -gt 0) { exit 1 }
Write-Host 'Veridan Windows Companion preflight passed.'
