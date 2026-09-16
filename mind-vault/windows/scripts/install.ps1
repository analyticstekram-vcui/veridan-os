$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$stateDirectory = Join-Path $env:LOCALAPPDATA 'Veridan\MindVault'
$tokenPath = Join-Path $stateDirectory 'token.clixml'
$taskName = 'Veridan Mind Vault Bridge'
New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
if (-not (Test-Path $tokenPath)) {
  $bytes = New-Object byte[] 48
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  ConvertTo-SecureString ([Convert]::ToBase64String($bytes)) -AsPlainText -Force | Export-Clixml -Path $tokenPath
}
$argument = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command `"`$secure=Import-Clixml '$tokenPath';`$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR(`$secure);try {`$env:VERIDAN_MIND_VAULT_TOKEN=[Runtime.InteropServices.Marshal]::PtrToStringBSTR(`$ptr);Set-Location '$repoRoot';node scripts/mind-vault-bridge-server.mjs} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR(`$ptr)}`""
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) { Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue; Unregister-ScheduledTask -TaskName $taskName -Confirm:$false }
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argument
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Days 0)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Read-only source-cited Obsidian retrieval for Veridan Core.' -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 2
Write-Host "Installed and started '$taskName'."
Write-Host 'Health: http://127.0.0.1:57446/health'
