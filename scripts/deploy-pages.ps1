# Prepare public GitHub Pages payload (excludes operator tools)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$out = Join-Path $root 'dist-pages'

if (-not (Test-Path (Join-Path $root 'assets\config.js'))) {
    Write-Host 'ERROR: assets/config.js missing. Run: npm run setup' -ForegroundColor Red
    exit 1
}

if ((Get-Content (Join-Path $root 'assets\config.js') -Raw) -match 'YOUR_SUBDOMAIN') {
    Write-Host 'ERROR: Replace YOUR_SUBDOMAIN in assets/config.js before deploy.' -ForegroundColor Red
    exit 1
}

& 'C:\Program Files\nodejs\npm.cmd' run build --prefix $root
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out | Out-Null

Copy-Item (Join-Path $root 'index.html') $out
Copy-Item (Join-Path $root 'assets') (Join-Path $out 'assets') -Recurse
Copy-Item (Join-Path $root 'deploy\_headers') $out -ErrorAction SilentlyContinue
Copy-Item (Join-Path $root '.nojekyll') $out -ErrorAction SilentlyContinue

Write-Host "Pages bundle ready: $out" -ForegroundColor Green
Write-Host 'Deploy dist-pages/ contents to GitHub Pages (root). operator/ is excluded.'