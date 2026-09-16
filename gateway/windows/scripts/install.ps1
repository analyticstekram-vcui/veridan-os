param(
  [string]$RepositoryPath = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
)

$ErrorActionPreference = 'Stop'
$stateDirectory = Join-Path $env:LOCALAPPDATA 'Veridan\CommandGateway'
$launcherPath = Join-Path $stateDirectory 'start-veridan-command-gateway.ps1'
$mindVaultSecretPath = Join-Path $env:LOCALAPPDATA 'Veridan\MindVault\token.clixml'
$taskName = 'Veridan Command Gateway'
$port = 4700

if (-not (Test-Path $mindVaultSecretPath)) { throw "Mind Vault token not found: $mindVaultSecretPath. Install the Mind Vault bridge first." }
New-Item -ItemType Directory -Force -Path $stateDirectory | Out-Null

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
}

$listener = Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  $gatewayProcessId = $listener.OwningProcess
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $gatewayProcessId"
  $expectedCommandPattern = 'scripts[\\/]+veridan-command-gateway\.mjs'
  if ($process.Name -ine 'node.exe' -or [string]$process.CommandLine -notmatch $expectedCommandPattern) {
    throw "Port $port is owned by an unexpected process. Installation stopped without changing credentials."
  }
  Stop-Process -Id $gatewayProcessId -Force
  Wait-Process -Id $gatewayProcessId -Timeout 10 -ErrorAction SilentlyContinue
  if (Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
    throw "The previous Veridan Command Gateway did not release port $port. Installation stopped."
  }
}

$escapedSecretPath = $mindVaultSecretPath.Replace("'", "''")
$escapedRepositoryPath = $RepositoryPath.Replace("'", "''")
$launcher = @"
`$ErrorActionPreference = 'Stop'
`$secureToken = Import-Clixml -Path '$escapedSecretPath'
`$credential = New-Object System.Management.Automation.PSCredential('veridan', `$secureToken)
`$env:VERIDAN_MIND_VAULT_TOKEN = `$credential.GetNetworkCredential().Password
`$env:VERIDAN_COMMAND_GATEWAY_PORT = '$port'
Set-Location '$escapedRepositoryPath'
& node 'scripts/veridan-command-gateway.mjs'
"@
Set-Content -Path $launcherPath -Value $launcher -Encoding UTF8

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false }
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host "Installed and started '$taskName' as the current user."
Write-Host "Command Desk: http://127.0.0.1:$port/"
