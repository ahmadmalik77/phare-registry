import { encryptForRegistry } from '../lib/phare-crypto.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pub = JSON.parse(fs.readFileSync(path.join(root, 'cloudflare/.registry-public.jwk'), 'utf8'));

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
const res = await fetch('https://phare-intake.ahmadmalik77.workers.dev/api/intake', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: 'https://ahmadmalik77.github.io'
    },
    body: JSON.stringify({ ...enc, website: '' })
});

console.log('POST', res.status, await res.text());
console.log('ACAO', res.headers.get('access-control-allow-origin'));