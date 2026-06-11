import readline from 'readline';
import { fingerprintPublicJwk } from '../lib/phare-crypto.mjs';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log('Paste registry PUBLIC JWK JSON (single line), then Enter:');

rl.on('line', async line => {
    rl.close();
    try {
        const jwk = JSON.parse(line.trim());
        const fp = await fingerprintPublicJwk(jwk);
        console.log('\nPUBKEY_FINGERPRINT for assets/config.js:\n');
        console.log(fp);
    } catch (e) {
        console.error('Invalid JWK:', e.message);
        process.exit(1);
    }
});