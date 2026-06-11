/**
 * Live intake smoke test (operator). Requires network + valid registry keys.
 *
 *   set PHARE_API_URL=https://your-worker.workers.dev/api/intake
 *   set PHARE_ORIGIN=https://youruser.github.io
 *   node scripts/test-post.mjs
 */
import { encryptForRegistry } from '../lib/phare-crypto.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pubPath = path.join(root, 'cloudflare/.registry-public.jwk');
if (!fs.existsSync(pubPath)) {
    console.error('Missing cloudflare/.registry-public.jwk — generate keys first.');
    process.exit(1);
}
const pub = JSON.parse(fs.readFileSync(pubPath, 'utf8'));

const apiUrl = process.env.PHARE_API_URL || 'https://phare-intake.ahmadmalik77.workers.dev/api/intake';
const origin = process.env.PHARE_ORIGIN || 'https://ahmadmalik77.github.io';

const intake = {
    operational_visibility: 'corp',
    weight_concentration: 'fatigue',
    access_point: 'digital',
    pressure_source: 'leadership',
    relief_preference: 'clarity',
    start_preference: 'call',
    designation: 'Test Executive',
    contact: 'test@example.com',
    timestamp: new Date().toISOString(),
    registry: 'Phare — The Lighthouse • 2026'
};

const enc = await encryptForRegistry(intake, pub);
const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Origin: origin
};
if (process.env.PHARE_INVITE) headers['X-Phare-Invite'] = process.env.PHARE_INVITE;

const res = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...enc, b_hp_x7k9: '' })
});

const text = await res.text();
console.log('POST', res.status, text);
console.log('ACAO', res.headers.get('access-control-allow-origin'));
process.exit(res.status === 202 ? 0 : 1);