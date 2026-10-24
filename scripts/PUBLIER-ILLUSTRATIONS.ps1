# Publish only local card artwork; never commit secrets or unrelated files.
$ErrorActionPreference='Stop'
$root=Join-Path $env:USERPROFILE 'Desktop\fredou'
if (-not (Test-Path (Join-Path $root '.git'))) { throw "Dossier Git introuvable : $root" }
Set-Location $root
$branch=(& git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -ne 'feature/dofus-catalogue') { throw "Branche inattendue : $branch. Attendue : feature/dofus-catalogue." }
if (-not (Test-Path 'public/art')) { throw 'public/art introuvable. Ne pas publier un catalogue sans images.' }
& git add -A -- public/art
if ($LASTEXITCODE -ne 0) { throw 'git add a echoue.' }
$changed=@(& git diff --cached --name-only -- public/art)
if ($LASTEXITCODE -ne 0) { throw 'git diff a echoue.' }
if ($changed.Count -eq 0) { Write-Host 'Aucune illustration nouvelle a publier.'; exit 0 }
Write-Host ("Illustrations preparees : "+$changed.Count)
& git commit -m "Publish collectible card illustrations" --only -- public/art
if ($LASTEXITCODE -ne 0) { throw 'git commit a echoue.' }
& git push origin feature/dofus-catalogue
if ($LASTEXITCODE -ne 0) { throw "Push refuse : verifier git pull --rebase avant de relancer." }
Write-Host 'Illustrations publiees sur la branche feature/dofus-catalogue.'
