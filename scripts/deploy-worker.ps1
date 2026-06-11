# Deploy Phare Cloudflare Worker
# Prerequisites: wrangler login, KV namespace id in wrangler.toml, secrets set

$ErrorActionPreference = 'Stop'
$cloudflare = Join-Path $PSScriptRoot '..\cloudflare'
Set-Location $cloudflare

Write-Host '=== Phare Worker Deploy ===' -ForegroundColor Cyan
Write-Host 'Required secrets (run once):'
Write-Host '  wrangler secret put REGISTRY_PRIVATE_JWK'
Write-Host '  wrangler secret put ALLOWED_ORIGINS'
Write-Host '  wrangler secret put IP_HASH_SALT'
Write-Host '  wrangler secret put INVITE_TOKEN   # optional'
Write-Host ''

if ((Get-Content wrangler.toml -Raw) -match 'REPLACE_WITH_YOUR_KV_NAMESPACE_ID') {
    Write-Host 'ERROR: Set your KV namespace id in cloudflare/wrangler.toml first.' -ForegroundColor Red
    exit 1
}

wrangler deploy
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host 'Worker deployed. Next:' -ForegroundColor Green
Write-Host '  1. npm run setup   (create assets/config.js with Worker URL)'
Write-Host '  2. npm run fingerprint (optional pubkey pin)'
Write-Host '  3. Push to GitHub Pages'