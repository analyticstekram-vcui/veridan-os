$ErrorActionPreference = 'Stop'
$stateDirectory = Join-Path $env:LOCALAPPDATA 'Veridan\Companion'
$secretPath = Join-Path $stateDirectory 'token.clixml'
$repositoryPath = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path

if (-not (Test-Path $secretPath)) { throw 'Companion token not found. Run install.ps1 first.' }
$secureToken = Import-Clixml -Path $secretPath
$credential = New-Object System.Management.Automation.PSCredential('veridan', $secureToken)

try {
  $env:VERIDAN_COMPANION_TOKEN = $credential.GetNetworkCredential().Password
  $env:VERIDAN_COMPANION_URL = 'http://127.0.0.1:4701'
  Push-Location $repositoryPath
  try {
    & node 'scripts/veridan-core-companion-preflight.mjs'
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } finally {
    Pop-Location
  }
} finally {
  Remove-Item Env:VERIDAN_COMPANION_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:VERIDAN_COMPANION_URL -ErrorAction SilentlyContinue
}
