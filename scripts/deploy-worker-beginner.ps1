# Phare Worker — beginner deploy (run AFTER: npx wrangler login)
$ErrorActionPreference = 'Stop'
$env:Path = "C:\Program Files\nodejs;" + $env:Path
$cloudflare = Join-Path $PSScriptRoot '..\cloudflare'
Set-Location $cloudflare

Write-Host "`n=== Phare Cloudflare Worker Deploy ===" -ForegroundColor Cyan

if ((Get-Content wrangler.toml -Raw) -match 'REPLACE_WITH_YOUR_KV_NAMESPACE_ID') {
    Write-Host "Creating KV namespace..." -ForegroundColor Yellow
    npx wrangler kv namespace create PHARE_KV
    Write-Host "`nPaste the id above into cloudflare/wrangler.toml, then run this script again." -ForegroundColor Red
    exit 1
}

Write-Host "Deploying worker..." -ForegroundColor Green
npx wrangler deploy

Write-Host "`nDone. Set secrets if you have not yet:" -ForegroundColor Cyan
Write-Host "  npx wrangler secret put REGISTRY_PRIVATE_JWK"
Write-Host "  npx wrangler secret put ALLOWED_ORIGINS    # https://ahmadmalik77.github.io"
Write-Host "  npx wrangler secret put IP_HASH_SALT"
Write-Host "`nTest: curl https://phare-intake.ahmadmalik77.workers.dev/api/intake/health"