# Deploy Phare Worker using API token from cloudflare/.cloudflare-token
# DO NOT commit .cloudflare-token to git.

$ErrorActionPreference = 'Stop'
$env:Path = "C:\Program Files\nodejs;" + $env:Path
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$cf = Join-Path $root 'cloudflare'
$tokenFile = Join-Path $cf '.cloudflare-token'

if (-not (Test-Path $tokenFile)) {
    Write-Host "Missing: cloudflare\.cloudflare-token" -ForegroundColor Red
    Write-Host "1. Copy cloudflare\.cloudflare-token.example to cloudflare\.cloudflare-token"
    Write-Host "2. Paste your Cloudflare API token on one line (no quotes)"
    Write-Host "3. Run this script again"
    exit 1
}

$token = (Get-Content $tokenFile -Raw).Trim()
if ($token.Length -lt 20) {
    Write-Host "Token in .cloudflare-token looks too short. Check the file." -ForegroundColor Red
    exit 1
}

$env:CLOUDFLARE_API_TOKEN = $token
Set-Location $cf

Write-Host "Checking Cloudflare account..." -ForegroundColor Cyan
npx wrangler whoami

$toml = Get-Content 'wrangler.toml' -Raw
if ($toml -match 'REPLACE_WITH_YOUR_KV_NAMESPACE_ID') {
    Write-Host "Creating KV namespace PHARE_KV..." -ForegroundColor Yellow
    $out = npx wrangler kv namespace create PHARE_KV 2>&1 | Out-String
    Write-Host $out
    if ($out -match 'id\s*=\s*"([a-f0-9]+)"') {
        $kvId = $Matches[1]
        $toml = $toml -replace 'REPLACE_WITH_YOUR_KV_NAMESPACE_ID', $kvId
        Set-Content 'wrangler.toml' $toml -NoNewline
        Write-Host "Updated wrangler.toml with KV id: $kvId" -ForegroundColor Green
    } else {
        Write-Host "Could not parse KV id — paste it into wrangler.toml manually, then re-run." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Deploying worker..." -ForegroundColor Green
npx wrangler deploy

Write-Host "`nNext (if not done yet):" -ForegroundColor Cyan
Write-Host "  npx wrangler secret put REGISTRY_PRIVATE_JWK"
Write-Host "  npx wrangler secret put ALLOWED_ORIGINS    # https://ahmadmalik77.github.io"
Write-Host "  npx wrangler secret put IP_HASH_SALT"
Write-Host "`nTest: https://phare-intake.ahmadmalik77.workers.dev/api/intake/health"