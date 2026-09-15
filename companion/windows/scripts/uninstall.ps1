$ErrorActionPreference = 'Stop'
$taskName = 'Veridan Windows Companion'
$stateDirectory = Join-Path $env:LOCALAPPDATA 'Veridan\Companion'

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

if (Test-Path $stateDirectory) {
  Remove-Item -Path $stateDirectory -Recurse -Force
}

Write-Host "Removed '$taskName' and its local token."
