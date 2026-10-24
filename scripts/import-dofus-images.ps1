# Copy confirmed Dofus monster images into the site's expected asset paths.
# Run from the repository root. No database, catalog or user data is modified.
param([string]$AssetsRoot = "$HOME\\Desktop\\fredou-dofus-assets")
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$report = Join-Path $repoRoot 'docs\\rapport-images-fredou.csv'
if (!(Test-Path $report)) { throw "Rapport introuvable: $report" }
$target = Join-Path $repoRoot 'public\\art\\dofus'
New-Item -ItemType Directory -Path $target -Force | Out-Null
$success = 0; $missing = @()
foreach ($row in (Import-Csv -LiteralPath $report -Delimiter ';' -Encoding UTF8)) {
  if ($row.statut -ne 'OK') { continue }
  $n = [int]$row.card_number
  $id = $row.gfxId
  $paths = @(
    (Join-Path $AssetsRoot "monsters\\2x\\$id.png"),
    (Join-Path $AssetsRoot "monsters\\1x\\$id.png")
  )
  $source = $paths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if ($source) { Copy-Item -LiteralPath $source -Destination (Join-Path $target "$n.png") -Force; $success++ }
  else { $missing += "$($row.nom) (gfxId $id)" }
}
Write-Host "Images copiees : $success / 48"
if ($missing.Count) { Write-Warning ("PNG absents : " + ($missing -join ', ')) }
Write-Host 'Verifier les droits de redistribution avant de publier les images.'
