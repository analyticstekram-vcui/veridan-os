param(
  [string]$RepositoryPath = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
)

$ErrorActionPreference = 'Stop'
$stateDirectory = Join-Path $env:LOCALAPPDATA 'Veridan\Companion'
$launcherPath = Join-Path $stateDirectory 'start-veridan-companion.ps1'
$secretPath = Join-Path $stateDirectory 'token.clixml'
$taskName = 'Veridan Windows Companion'
$port = 4701

New-Item -ItemType Directory -Force -Path $stateDirectory | Out-Null

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
}

$listener = Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -First 1
if ($listener) {
  $companionProcessId = $listener.OwningProcess
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $companionProcessId"
  $expectedCommandPattern = 'companion[\\/]+windows[\\/]+src[\\/]+main\.mjs'
  if ($process.Name -ine 'node.exe' -or [string]$process.CommandLine -notmatch $expectedCommandPattern) {
    throw "Port $port is owned by an unexpected process. Installation stopped without rotating credentials."
  }

  Stop-Process -Id $companionProcessId -Force
  Wait-Process -Id $companionProcessId -Timeout 10 -ErrorAction SilentlyContinue
  if (Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
    throw "The previous Veridan Companion did not release port $port. Installation stopped without rotating credentials."
  }
}

$bytes = New-Object byte[] 48
$generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $generator.GetBytes($bytes)
} finally {
  $generator.Dispose()
}
$token = [Convert]::ToBase64String($bytes)
$secureToken = ConvertTo-SecureString $token -AsPlainText -Force
$secureToken | Export-Clixml -Path $secretPath

$escapedSecretPath = $secretPath.Replace("'", "''")
$escapedRepositoryPath = $RepositoryPath.Replace("'", "''")

$launcher = @"
`$ErrorActionPreference = 'Stop'
`$secureToken = Import-Clixml -Path '$escapedSecretPath'
`$credential = New-Object System.Management.Automation.PSCredential('veridan', `$secureToken)
`$env:VERIDAN_COMPANION_TOKEN = `$credential.GetNetworkCredential().Password
`$env:VERIDAN_COMPANION_PORT = '$port'
Set-Location '$escapedRepositoryPath'
& node 'companion/windows/src/main.mjs'
"@
Set-Content -Path $launcherPath -Value $launcher -Encoding UTF8

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

Write-Host "Installed and started '$taskName'."
Write-Host "Health: http://127.0.0.1:$port/health"
