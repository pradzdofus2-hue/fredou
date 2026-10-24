# One-command release validation for Windows PowerShell 5.1+.
# Does not print or store the PostgreSQL connection URI.
$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
function Run-Step([string]$Label, [string]$Command) {
    Write-Host "`n=== $Label ===" -ForegroundColor Cyan
    & npm.cmd run $Command
    if ($LASTEXITCODE -ne 0) { throw "$Label a echoue (code $LASTEXITCODE)." }
}
try {
    Run-Step 'TypeScript' 'typecheck'
    Run-Step 'Tests unitaires' 'test'
    Run-Step 'Build production' 'build'
    Run-Step 'Images locales' 'art:check'
    $secure = Read-Host 'URI PostgreSQL Session Pooler (saisie masquee)' -AsSecureString
    $env:DATABASE_URL = (New-Object System.Net.NetworkCredential('', $secure)).Password
    try {
        Run-Step 'Lecture Supabase' 'db:check:runtime'
        Run-Step 'Illustrations du catalogue Supabase complet' 'db:check:artwork'
        Run-Step 'Ecritures Supabase et rollback' 'db:test:writes'
    }
    finally {
        Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
        $secure.Dispose()
    }
    Write-Host "`nValidation locale terminee sans erreur. Tester encore Discord, GitHub assets et Vercel en preproduction." -ForegroundColor Green
}
catch {
    Write-Host "`nVALIDATION BLOQUEE : $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
