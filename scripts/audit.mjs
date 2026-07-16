/**
 * BMad + Grok Builder production audit — runs CI gates plus version/CSP sync checks.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const errors = [];
const warnings = [];

function read(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

const pkg = JSON.parse(read('package.json'));
const index = read('index.html');
const app = read('assets/app.js');
const headers = read('deploy/_headers');

// Support readable source and esbuild-minified app.js
const verMatch =
    app.match(/PHARE_VERSION\s*=\s*['"]([^'"]+)['"]/) ||
    app.match(/['"](2026\.06-production\.\d+)['"]/);
if (!app.includes(pkg.version)) {
    errors.push(`Version drift: package.json ${pkg.version} not found in app.js (got ${verMatch?.[1] || 'none'})`);
}

const cacheMatch = index.match(/\?v=([a-z0-9]+)/i);
const caches = [...index.matchAll(/\?v=([a-z0-9]+)/gi)].map(m => m[1]);
if (new Set(caches).size > 1) {
    errors.push(`index.html cache-bust mismatch: ${[...new Set(caches)].join(', ')}`);
}
// Versioned filenames (app-20.js) are preferred over ?v= alone
const hasVersionedAssets = /assets\/app-\d+\.js/.test(index) || /assets\/styles-\d+\.css/.test(index);
if (!cacheMatch && !hasVersionedAssets) warnings.push('index.html has no ?v= cache bust or versioned asset filenames');

const metaCsp = index.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
if (!metaCsp) {
    errors.push('Missing meta CSP');
} else {
    const csp = metaCsp[1];
    if (csp.includes('frame-ancestors')) errors.push('Meta CSP must not include frame-ancestors');
    if (!csp.includes("'unsafe-inline'")) errors.push('Meta CSP style-src needs unsafe-inline');
    if (!csp.includes('phare-intake')) errors.push('Meta CSP connect-src missing worker origin');
    if (csp.includes('fonts.googleapis.com') || csp.includes('fonts.gstatic.com')) {
        errors.push('Meta CSP must use font-src self (self-hosted fonts)');
    }
}

const styles = read('assets/styles.css');
if (!styles.includes('@font-face')) errors.push('assets/styles.css must include self-hosted @font-face fonts');
if (index.includes('fonts.googleapis.com')) errors.push('index.html must not reference Google Fonts CDN');
if (index.includes('assets/fonts.css')) errors.push('index.html must not link separate fonts.css');

if (index.match(/style="margin-top/)) errors.push('index.html has forbidden inline style attributes');
if (app.includes('window.PhareRegistry')) errors.push('app.js exposes window.PhareRegistry');
if (!headers.includes("'unsafe-inline'")) errors.push('deploy/_headers missing unsafe-inline in style-src');
if (!headers.includes('frame-ancestors')) warnings.push('deploy/_headers missing frame-ancestors (HTTP-only framing policy)');

console.log('=== Phare Production Audit ===');
console.log('Version:', pkg.version);
console.log('Cache bust:', cacheMatch?.[1] || 'none');

console.log('\n--- npm run ci ---');
try {
    execSync('npm run ci', { cwd: root, stdio: 'inherit' });
} catch (_) {
    errors.push('npm run ci failed');
}

if (warnings.length) {
    console.log('\nWarnings:');
    warnings.forEach(w => console.log('  ⚠', w));
}

if (errors.length) {
    console.error('\nAudit FAILED:');
    errors.forEach(e => console.error('  ✗', e));
    process.exit(1);
}

console.log('\nAudit PASSED — production 10/10 gates OK');