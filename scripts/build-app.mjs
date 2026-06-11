import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let js = fs.readFileSync(path.join(root, 'assets', 'app.raw.js'), 'utf8');

const configBlock = `    function loadConfig() {
        const raw = window.PHARE_CONFIG;
        if (!raw || typeof raw !== 'object') {
            throw new Error('Missing assets/config.js — copy config.example.js and set your Worker URLs before deploy.');
        }
        const required = ['API_URL', 'PUBKEY_URL'];
        for (const key of required) {
            if (!raw[key] || String(raw[key]).includes('YOUR_SUBDOMAIN')) {
                throw new Error('Invalid PHARE_CONFIG.' + key + ' — run npm run setup or edit assets/config.js');
            }
        }
        return Object.freeze({
            API_URL: String(raw.API_URL),
            PUBKEY_URL: String(raw.PUBKEY_URL),
            REGISTRY_EMAIL: String(raw.REGISTRY_EMAIL || 'registry@phare.lighthouse'),
            PUBKEY_FINGERPRINT: raw.PUBKEY_FINGERPRINT ? String(raw.PUBKEY_FINGERPRINT) : null,
            INVITE_TOKEN: raw.INVITE_TOKEN ? String(raw.INVITE_TOKEN) : null
        });
    }

    const CONFIG = loadConfig();`;

js = js.replace(
    /const CONFIG = Object\.freeze\(\{[\s\S]*?\}\);/,
    configBlock
);

const workerBlock = `    const cryptoWorker = new Worker(new URL('./draft-crypto-worker.js', import.meta.url), { type: 'module' });`;

js = js.replace(
    /const cryptoWorkerCode = `[\s\S]*?`;\s*\n\s*const workerBlobUrl[\s\S]*?const cryptoWorker = new Worker\(workerBlobUrl\);/,
    workerBlock
);

// draft worker can't use import.meta.url in classic script - index loads app.js as module
// Fix: use relative path from document
const workerBlockClassic = `    const cryptoWorker = new Worker('assets/draft-crypto-worker.js');`;
js = js.replace(workerBlock, workerBlockClassic);

const fingerprintHelper = `
    async function fingerprintPublicJwk(jwk) {
        const canonical = JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y });
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
`;

if (!js.includes('fingerprintPublicJwk')) {
    js = js.replace(
        '    async function fetchRegistryPublicKey() {',
        fingerprintHelper + '\n    async function fetchRegistryPublicKey() {'
    );
}

js = js.replace(
    `        if (!res.ok) throw new Error('Could not reach registry key endpoint');
        const data = await res.json();
        return crypto.subtle.importKey(`,
    `        if (!res.ok) throw new Error('Could not reach registry key endpoint');
        const data = await res.json();
        if (CONFIG.PUBKEY_FINGERPRINT) {
            const fp = await fingerprintPublicJwk(data.publicKey);
            if (fp !== CONFIG.PUBKEY_FINGERPRINT.toLowerCase()) {
                throw new Error('Registry public key fingerprint mismatch — possible interception');
            }
        }
        return crypto.subtle.importKey(`
);

js = js.replace(
    `        const response = await fetchWithTimeout(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                ...encryptedPayload,
                website: el('a7_website')?.value || ''
            })
        }, 20000);`,
    `        const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
        const invite = CONFIG.INVITE_TOKEN || sessionStorage.getItem('phare_invite_token');
        if (invite) headers['X-Phare-Invite'] = invite;

        const response = await fetchWithTimeout(CONFIG.API_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                ...encryptedPayload,
                website: el('a7_website')?.value || ''
            })
        }, 20000);`
);

// Capture invite token from URL once
const inviteCapture = `
    (function captureInviteFromUrl() {
        try {
            const token = new URLSearchParams(location.search).get('invite');
            if (token) sessionStorage.setItem('phare_invite_token', token);
        } catch (_) {}
    })();
`;
js = js.replace(`    const CONFIG = loadConfig();`, `    const CONFIG = loadConfig();\n${inviteCapture}`);

js = js.replace(
    `    const PHARE_VERSION = '2026.06-evenmore';`,
    `    const PHARE_VERSION = '2026.06-production';`
);

fs.writeFileSync(path.join(root, 'assets', 'app.js'), js, 'utf8');
console.log('built assets/app.js', js.length);