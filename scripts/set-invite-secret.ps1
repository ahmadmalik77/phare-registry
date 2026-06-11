# Set INVITE_TOKEN on Cloudflare Worker (invitation-only intake)
# Usage: .\set-invite-secret.ps1 -Token "your-secret-token"
param(
    [Parameter(Mandatory = $true)]
    [string]$Token
)

$ErrorActionPreference = 'Stop'
$cloudflare = Join-Path $PSScriptRoot '..\cloudflare'
Set-Location $cloudflare
$Token | npx wrangler secret put INVITE_TOKEN
Write-Host 'INVITE_TOKEN set. Share intake as:' -ForegroundColor Green
Write-Host "  https://ahmadmalik77.github.io/phare-registry/?invite=$Token"