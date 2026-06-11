import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const target = path.join(root, 'assets', 'config.js');
const example = path.join(root, 'assets', 'config.example.js');

if (fs.existsSync(target)) {
    console.log('assets/config.js already exists — edit manually or delete first.');
    process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(r => rl.question(q, r));

const workerOrigin = await ask('Worker origin (e.g. https://phare-intake.yourname.workers.dev): ');
const invite = await ask('Invite token (optional, press Enter to skip): ');
const fingerprint = await ask('Pubkey fingerprint (optional, press Enter to skip): ');
rl.close();

if (!workerOrigin.trim()) {
    console.error('Worker origin is required.');
    process.exit(1);
}

const origin = workerOrigin.trim().replace(/\/$/, '');
const cfg = `window.PHARE_CONFIG = Object.freeze({
    API_URL: '${origin}/api/intake',
    PUBKEY_URL: '${origin}/api/intake/pubkey',
    REGISTRY_EMAIL: 'registry@phare.lighthouse',
    PUBKEY_FINGERPRINT: ${fingerprint.trim() ? `'${fingerprint.trim()}'` : 'null'},
    INVITE_TOKEN: ${invite.trim() ? `'${invite.trim()}'` : 'null'}
});
`;

fs.writeFileSync(target, `/**\n * Deploy configuration — do not commit (gitignored).\n */\n${cfg}`, 'utf8');
console.log('Created assets/config.js');