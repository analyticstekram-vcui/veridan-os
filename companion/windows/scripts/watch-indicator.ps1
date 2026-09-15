$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$port = $env:VERIDAN_COMPANION_PORT
$token = $env:VERIDAN_COMPANION_TOKEN
$readyFile = $env:VERIDAN_INDICATOR_READY_FILE
if (-not $port -or -not $token -or -not $readyFile) { throw 'Companion port, token, and indicator readiness file are required.' }

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Veridan WATCH'
$form.Size = New-Object System.Drawing.Size(360, 90)
$form.StartPosition = 'CenterScreen'
$form.TopMost = $true
$form.FormBorderStyle = 'FixedToolWindow'
$form.BackColor = [System.Drawing.Color]::FromArgb(127, 29, 29)
$form.ForeColor = [System.Drawing.Color]::White
$form.ShowInTaskbar = $true

$label = New-Object System.Windows.Forms.Label
$label.Text = 'VERIDAN WATCH ACTIVE'
$label.Font = New-Object System.Drawing.Font('Segoe UI', 12, [System.Drawing.FontStyle]::Bold)
$label.Location = New-Object System.Drawing.Point(14, 16)
$label.AutoSize = $true
$form.Controls.Add($label)

$stopButton = New-Object System.Windows.Forms.Button
$stopButton.Text = 'STOP'
$stopButton.Location = New-Object System.Drawing.Point(260, 13)
$stopButton.Size = New-Object System.Drawing.Size(70, 32)
$stopButton.BackColor = [System.Drawing.Color]::White
$stopButton.ForeColor = [System.Drawing.Color]::FromArgb(127, 29, 29)
$stopButton.Add_Click({ $form.Close() })
$form.Controls.Add($stopButton)
$form.Add_Shown({ Set-Content -Path $readyFile -Value 'ready' -Encoding ASCII })
$form.Add_FormClosing({
  try {
    Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$port/v1/watch/stop" -Headers @{ Authorization = "Bearer $token" } | Out-Null
  } catch {
    # The companion may already be stopping. Closing the indicator must still succeed.
  }
})

[void]$form.ShowDialog()
