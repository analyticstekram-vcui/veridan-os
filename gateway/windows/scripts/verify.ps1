$ErrorActionPreference = 'Stop'
$tokenPath = Join-Path $env:LOCALAPPDATA 'Veridan\MindVault\token.clixml'
if (-not (Test-Path $tokenPath)) { throw "Mind Vault token not found: $tokenPath. Install the Mind Vault bridge first." }
$secureToken = Import-Clixml $tokenPath
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
  $env:VERIDAN_MIND_VAULT_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  node scripts/veridan-command-gateway-preflight.mjs
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  Remove-Item Env:VERIDAN_MIND_VAULT_TOKEN -ErrorAction SilentlyContinue
}
