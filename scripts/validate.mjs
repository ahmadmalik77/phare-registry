import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const errors = [];

function req(rel) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) errors.push(`Missing required file: ${rel}`);
    return p;
}

req('index.html');
req('assets/styles.css');
req('assets/app.js');
req('assets/config.example.js');
req('assets/draft-crypto-worker.js');
req('cloudflare/worker.js');
req('operator/decrypt.html');
req('lib/intake-validate.mjs');
req('lib/worker-http.mjs');
req('deploy/_headers');

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (index.includes('<style>') && index.includes('const CONFIG')) {
    errors.push('index.html still contains inline monolith — run npm run build');
}
const stylesHref = index.match(/href="(assets\/styles[^"]+)"/)?.[1];
if (!stylesHref) errors.push('index.html must link a styles stylesheet');
const stylesFile = stylesHref?.split('?')[0] || 'assets/styles.css';
if (!fs.existsSync(path.join(root, stylesFile))) errors.push(`Missing stylesheet file: ${stylesFile}`);
const styles = fs.readFileSync(path.join(root, stylesFile.startsWith('assets/') ? stylesFile : 'assets/styles.css'), 'utf8');
if (!styles.includes('@font-face')) errors.push('styles must include self-hosted @font-face fonts');
if (index.includes('fonts.googleapis.com')) errors.push('index.html must not load Google Fonts CDN');
if (index.includes('assets/fonts.css')) errors.push('index.html must not link separate fonts.css — fonts are in styles.css');
if (!index.includes('assets/config.js')) errors.push('index.html must load assets/config.js');
const appHref = index.match(/src="(assets\/app[^"]+)"/)?.[1];
if (!appHref) errors.push('index.html must load app script');
const appFile = (appHref || 'assets/app.js').split('?')[0];
if (!fs.existsSync(path.join(root, appFile))) errors.push(`Missing app script file: ${appFile}`);
if (!index.includes('<main class="frame">')) errors.push('index.html missing intake wizard markup');
if (!index.includes('id="a7_hp_trap"')) errors.push('index.html missing honeypot field a7_hp_trap');
if (index.includes('invitation-only') || index.includes('By invitation only')) {
    errors.push('index.html still has stale invitation-only copy — use confidential channel wording');
}
if (!index.includes('Content-Security-Policy')) {
    errors.push('index.html missing CSP meta tag for GitHub Pages hardening');
}
const metaCsp = index.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
if (metaCsp) {
    const csp = metaCsp[1];
    if (csp.includes('frame-ancestors')) {
        errors.push('index.html meta CSP must not include frame-ancestors (ignored in meta; use deploy/_headers)');
    }
    if (csp.includes('style-src') && !csp.includes("'unsafe-inline'")) {
        errors.push('index.html meta CSP style-src needs unsafe-inline for JS-driven cursor/animations');
    }
}
if (index.match(/style="margin-top:0/)) {
    errors.push('index.html must not use inline style attributes — use .restore-actions .cta in styles.css');
}
const prodHtml = path.join(root, 'index.production.html');
if (fs.existsSync(prodHtml)) {
    const prod = fs.readFileSync(prodHtml, 'utf8');
    if (prod.includes('By invitation only') || prod.includes('invitation-only')) {
        errors.push('index.production.html stale — run npm run build:html (check cache-bust script URLs)');
    }
}
if (fs.existsSync(path.join(root, 'decrypt.html'))) {
    errors.push('decrypt.html must not be at public root — use operator/decrypt.html');
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'assets', 'app.js'), 'utf8');
// Support esbuild-minified app.js (const name may be mangled; version string remains)
if (!app.includes(pkg.version)) {
    errors.push(`Version drift: package.json ${pkg.version} not found in assets/app.js`);
}
if (!app.includes('PHARE_CONFIG')) {
    errors.push('assets/app.js missing PHARE_CONFIG load path (loadConfig was stripped)');
}
// Readable source (if present) must declare CONFIG for transmit
const appRawPath = path.join(root, 'assets', 'app.raw.js');
if (fs.existsSync(appRawPath)) {
    const raw = fs.readFileSync(appRawPath, 'utf8');
    if (!raw.includes('function loadConfig') || !raw.includes('const CONFIG = loadConfig()')) {
        errors.push('assets/app.raw.js missing loadConfig/CONFIG — transmit will throw ReferenceError');
    }
}
if (app.includes('workerBlobUrl')) errors.push('assets/app.js must not reference workerBlobUrl');
if (app.includes('window.PhareRegistry')) errors.push('assets/app.js must not expose window.PhareRegistry');
if (app.match(/crypto:\s*Object\.freeze/)) errors.push('assets/app.js must not expose crypto on public API');
if (app.includes("['deriveKey']") && app.includes('importRegistryPublicKey') === false) {
    if (app.match(/importKey\([\s\S]*?\['deriveKey'\]/)) {
        errors.push('assets/app.js must not import ECDH public keys with deriveKey usage');
    }
}
if (!app.includes('deriveBits') && !app.includes('importRegistryPublicKey')) {
    errors.push('assets/app.js missing production ECDH path');
}

const worker = fs.readFileSync(path.join(root, 'cloudflare', 'worker.js'), 'utf8');
if (worker.includes("headers['Access-Control-Allow-Origin'] = origin || '*'")) {
    errors.push('worker.js must not allow wildcard CORS');
}
if (!worker.includes('IP_HASH_SALT')) errors.push('worker.js must hash IPs for rate limiting');
if (!worker.includes('intake-validate')) errors.push('worker.js must use lib/intake-validate.mjs');
if (!worker.includes('worker-http')) errors.push('worker.js must use lib/worker-http.mjs');
if (worker.includes('function buildCors(')) errors.push('worker.js must not duplicate buildCors — use lib/worker-http.mjs');

const headers = fs.readFileSync(path.join(root, 'deploy', '_headers'), 'utf8');
if (!headers.trim().startsWith('/*') || !headers.includes('Content-Security-Policy')) {
    errors.push('deploy/_headers must be valid Netlify/Cloudflare Pages format with CSP');
}
if (/^\s*\*\/\s*$/m.test(headers)) {
    errors.push('deploy/_headers must not use block-comment closers (*/); use Netlify path syntax only');
}

const testPost = fs.readFileSync(path.join(root, 'scripts', 'test-post.mjs'), 'utf8');
if (testPost.match(/PHARE_INVITE\s*\|\|\s*['"]/)) {
    errors.push('scripts/test-post.mjs must not hardcode invite tokens — use PHARE_INVITE env');
}

const configExample = fs.readFileSync(path.join(root, 'assets', 'config.example.js'), 'utf8');
if (!configExample.includes('PUBKEY_FINGERPRINT')) {
    errors.push('config.example.js missing PUBKEY_FINGERPRINT');
}

if (errors.length) {
    console.error('Validation failed:\n' + errors.map(e => '  - ' + e).join('\n'));
    process.exit(1);
}

console.log('Validation passed (production structure OK)');