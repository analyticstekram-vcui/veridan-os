$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$sampleWidth = 32
$sampleHeight = 18
$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
$source = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$sourceGraphics = [System.Drawing.Graphics]::FromImage($source)
$sample = New-Object System.Drawing.Bitmap $sampleWidth, $sampleHeight
$sampleGraphics = [System.Drawing.Graphics]::FromImage($sample)

try {
  $sourceGraphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bounds.Size)
  $sampleGraphics.DrawImage($source, 0, 0, $sampleWidth, $sampleHeight)
  $pixels = New-Object System.Collections.Generic.List[int]
  for ($y = 0; $y -lt $sampleHeight; $y++) {
    for ($x = 0; $x -lt $sampleWidth; $x++) {
      $color = $sample.GetPixel($x, $y)
      $luma = [int](0.2126 * $color.R + 0.7152 * $color.G + 0.0722 * $color.B)
      $pixels.Add($luma)
    }
  }
} finally {
  $sampleGraphics.Dispose()
  $sample.Dispose()
  $sourceGraphics.Dispose()
  $source.Dispose()
}

@{
  width = $sampleWidth
  height = $sampleHeight
  pixels = $pixels
  observedAt = [DateTime]::UtcNow.ToString('o')
} | ConvertTo-Json -Compress -Depth 3
