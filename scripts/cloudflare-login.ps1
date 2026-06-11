# Browser-based Cloudflare login (like GitHub OAuth flow)
$ErrorActionPreference = 'Stop'
$env:Path = "C:\Program Files\nodejs;" + $env:Path
Set-Location (Join-Path $PSScriptRoot '..\cloudflare')

Write-Host "`n=== Cloudflare browser login ===" -ForegroundColor Cyan
Write-Host "A browser window should open. Approve access, then return here.`n"
npx wrangler login

Write-Host "`nVerifying account..." -ForegroundColor Green
npx wrangler whoami

Write-Host "`nIf whoami shows your account, run:" -ForegroundColor Cyan
Write-Host "  ..\scripts\deploy-with-token.ps1"
Write-Host "  — or —"
Write-Host "  npx wrangler deploy"