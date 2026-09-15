$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$port = $env:VERIDAN_COMPANION_PORT
$token = $env:VERIDAN_COMPANION_TOKEN
if (-not $port -or -not $token) { throw 'Companion port and token are required.' }

$context = New-Object System.Windows.Forms.ContextMenuStrip
$statusItem = $context.Items.Add('Veridan Companion: ONLINE')
$statusItem.Enabled = $false
$stopWatchItem = $context.Items.Add('Stop WATCH')
$exitItem = $context.Items.Add('Hide tray icon')

$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Text = 'Veridan Windows Companion'
$notify.Icon = [System.Drawing.SystemIcons]::Shield
$notify.ContextMenuStrip = $context
$notify.Visible = $true
$notify.ShowBalloonTip(3000, 'Veridan Companion', 'Local sensory service is online.', [System.Windows.Forms.ToolTipIcon]::Info)

$stopWatchItem.Add_Click({
  try {
    Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$port/v1/watch/stop" -Headers @{ Authorization = "Bearer $token" } | Out-Null
  } catch {
    $notify.ShowBalloonTip(3000, 'Veridan Companion', 'Could not stop WATCH. Check /last-error.', [System.Windows.Forms.ToolTipIcon]::Error)
  }
})

$exitItem.Add_Click({
  $notify.Visible = $false
  [System.Windows.Forms.Application]::ExitThread()
})

try {
  [System.Windows.Forms.Application]::Run()
} finally {
  $notify.Visible = $false
  $notify.Dispose()
  $context.Dispose()
}
