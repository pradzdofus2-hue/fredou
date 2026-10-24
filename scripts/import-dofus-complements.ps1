# Copy supplementary verified images into FREDOU. No database modifications.
param([string]$AssetsRoot = (Join-Path $HOME 'Desktop\fredou-dofus-assets'))
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dest = Join-Path $root 'public\art\dofus'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$report = Join-Path $root 'docs\rapport-images-complement.csv'
$rows = @(Import-Csv -LiteralPath $report -Delimiter ';' -Encoding UTF8)
$copied = 0
$missing = @()
foreach ($entry in $rows) {
  $id = $entry.gfxId
  $category = if ($entry.type_asset -eq 'item') { 'items' } else { 'monsters' }
  $paths = @(
    (Join-Path $AssetsRoot "$category\2x\$id.png"),
    (Join-Path $AssetsRoot "$category\1x\$id.png")
  )
  $src = $paths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if ($null -ne $src) {
    Copy-Item -LiteralPath $src -Destination (Join-Path $dest "$($entry.card_number).png") -Force
    $copied++
  } else {
    $missing += "$($entry.nom_reference) (gfxId $id, categorie $category)"
  }
}
Write-Host "Complements copies : $copied / $($rows.Count)" -ForegroundColor Green
if ($missing.Count -gt 0) {
  Write-Host 'Sources absentes :'
  $missing | ForEach-Object { Write-Host " - $_" }
}
Write-Host 'Verifier les droits de redistribution avant publication.'
