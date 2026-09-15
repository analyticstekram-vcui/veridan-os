$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$path = Join-Path ([System.IO.Path]::GetTempPath()) ("veridan-see-{0}.png" -f [guid]::NewGuid())

try {
  $graphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bounds.Size)
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}

@{
  path = $path
  width = $bounds.Width
  height = $bounds.Height
  capturedAt = [DateTime]::UtcNow.ToString('o')
} | ConvertTo-Json -Compress
