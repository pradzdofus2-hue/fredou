# Importe uniquement les cartes et la configuration. Aucun compte joueur.
# Usage : powershell -ExecutionPolicy Bypass -File .\scripts\import-catalog-supabase.ps1
$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))
if (!(Test-Path ".\data\fredou.sqlite")) { throw "Base locale data/fredou.sqlite introuvable." }

Write-Host "Verification du catalogue local (aucune ecriture)..." -ForegroundColor Cyan
python .\scripts\import-public-catalog.py
if ($LASTEXITCODE -ne 0) { throw "Simulation echouee" }

Write-Host ""
Write-Host "Attention : import dans Supabase des cartes/series/boosters seulement." -ForegroundColor Yellow
$answer = Read-Host "Confirmer l'import du catalogue dans le projet fredou ? (OUI)"
if ($answer -cne "OUI") { Write-Host "Operation annulee."; exit 0 }

# pip install is idempotent and does not emit a failing 'package not found' warning.
Write-Host "Installation / verification du pilote PostgreSQL..." -ForegroundColor Cyan
python -m pip install "psycopg[binary]"
if ($LASTEXITCODE -ne 0) { throw "Installation de psycopg echouee" }

# Use temporary process-only environment. Never save URL in a file or commit.
$secret = Read-Host "Supabase > Connect > URI PostgreSQL (saisie masquee)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
    $env:SUPABASE_DB_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    python .\scripts\import-public-catalog.py --apply
    if ($LASTEXITCODE -ne 0) { throw "Import echoue : transaction annulee ou connexion invalide" }
} finally {
    Remove-Item Env:SUPABASE_DB_URL -ErrorAction SilentlyContinue
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}
