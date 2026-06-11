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

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (index.includes('<style>') && index.includes('const CONFIG')) {
    errors.push('index.html still contains inline monolith — run npm run build');
}
if (!index.includes('assets/styles.css')) errors.push('index.html must link assets/styles.css');
if (!index.includes('assets/config.js')) errors.push('index.html must load assets/config.js');
if (!index.includes('<main class="frame">')) errors.push('index.html missing intake wizard markup');
if (!index.includes('id="a7_hp_trap"')) errors.push('index.html missing honeypot field a7_hp_trap');
if (fs.existsSync(path.join(root, 'decrypt.html'))) {
    errors.push('decrypt.html must not be at public root — use operator/decrypt.html');
}

const app = fs.readFileSync(path.join(root, 'assets', 'app.js'), 'utf8');
if (app.includes('workerBlobUrl')) errors.push('assets/app.js must not reference workerBlobUrl');
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

const configExample = fs.readFileSync(path.join(root, 'assets', 'config.example.js'), 'utf8');
if (!configExample.includes('PUBKEY_FINGERPRINT')) {
    errors.push('config.example.js missing PUBKEY_FINGERPRINT');
}

if (errors.length) {
    console.error('Validation failed:\n' + errors.map(e => '  - ' + e).join('\n'));
    process.exit(1);
}

console.log('Validation passed (production structure OK)');