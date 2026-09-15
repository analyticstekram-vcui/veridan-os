$ErrorActionPreference = 'Stop'

Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class VeridanActiveWindow {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", SetLastError=true)] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
}
'@

$handle = [VeridanActiveWindow]::GetForegroundWindow()
$processId = [uint32]0
[void][VeridanActiveWindow]::GetWindowThreadProcessId($handle, [ref]$processId)
$title = New-Object System.Text.StringBuilder 1024
[void][VeridanActiveWindow]::GetWindowText($handle, $title, $title.Capacity)
$process = Get-Process -Id $processId -ErrorAction Stop

@{
  title = $title.ToString()
  processName = $process.ProcessName
  processId = $processId
  observedAt = [DateTime]::UtcNow.ToString('o')
} | ConvertTo-Json -Compress
