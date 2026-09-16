param(
  [string]$RepositoryPath = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
)

$ErrorActionPreference = 'Stop'
$stateDirectory = Join-Path $env:LOCALAPPDATA 'Veridan\MindVault'
$launcherPath = Join-Path $stateDirectory 'start-veridan-mind-vault.ps1'
$secretPath = Join-Path $stateDirectory 'token.clixml'
$taskName = 'Veridan Mind Vault Bridge'
$port = 57446
New-Item -ItemType Directory -Force -Path $stateDirectory | Out-Null

$listener = Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  $bridgeProcessId = $listener.OwningProcess
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $bridgeProcessId"
  $expectedCommandPattern = 'scripts[\\/]+mind-vault-bridge-server\.mjs'
  if ($process.Name -ine 'node.exe' -or [string]$process.CommandLine -notmatch $expectedCommandPattern) {
    throw "Port $port is owned by an unexpected process. Installation stopped without changing credentials."
  }
  Stop-Process -Id $bridgeProcessId -Force
  Wait-Process -Id $bridgeProcessId -Timeout 10 -ErrorAction SilentlyContinue
}

if (-not (Test-Path $secretPath)) {
  $bytes = New-Object byte[] 48
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  ConvertTo-SecureString ([Convert]::ToBase64String($bytes)) -AsPlainText -Force | Export-Clixml -Path $secretPath
}

$escapedSecretPath = $secretPath.Replace("'", "''")
$escapedRepositoryPath = $RepositoryPath.Replace("'", "''")
$launcher = @"
`$ErrorActionPreference = 'Stop'
`$secureToken = Import-Clixml -Path '$escapedSecretPath'
`$credential = New-Object System.Management.Automation.PSCredential('veridan', `$secureToken)
`$env:VERIDAN_MIND_VAULT_TOKEN = `$credential.GetNetworkCredential().Password
Set-Location '$escapedRepositoryPath'
& node 'scripts/mind-vault-bridge-server.mjs'
"@
Set-Content -Path $launcherPath -Value $launcher -Encoding UTF8

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) { Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue; Unregister-ScheduledTask -TaskName $taskName -Confirm:$false }
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host "Installed and started '$taskName' as the current user."
Write-Host "Health: http://127.0.0.1:$port/health"
