param([string]$RawUrl)

$allowed = 'D:\NOOOOOOOT\Downloads\2- Crew'
$path = $null
if ($RawUrl -match '[?&]path=([^&]+)') {
  $path = [Uri]::UnescapeDataString($Matches[1])
}
if ([string]::IsNullOrWhiteSpace($path)) { exit 1 }

$full = [System.IO.Path]::GetFullPath($path)
$root = [System.IO.Path]::GetFullPath($allowed)
if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { exit 1 }
if (-not (Test-Path -LiteralPath $full)) { exit 1 }

Start-Process -FilePath $full
