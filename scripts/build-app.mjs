import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const VERSION = pkg.version || '2026.06-production';

const canonical = path.join(root, 'assets', 'app.js');
const raw = path.join(root, 'assets', 'app.raw.js');

let js = fs.readFileSync(canonical, 'utf8');
if (!js.includes('importRegistryPublicKey') && fs.existsSync(raw)) {
    console.warn('build-app: canonical app.js missing production crypto — falling back to app.raw.js');
    js = fs.readFileSync(raw, 'utf8');
}

js = js.replace(/const PHARE_VERSION = ['"][^'"]+['"];/, `const PHARE_VERSION = '${VERSION}';`);
js = js.replace(/\s*URL\.revokeObjectURL\(workerBlobUrl\);\s*/g, '\n');

if (js.includes('workerBlobUrl')) {
    console.error('build-app: workerBlobUrl still present after sanitization');
    process.exit(1);
}

if (!js.includes('importRegistryPublicKey') && !js.includes("['deriveBits']")) {
    console.error('build-app: missing production ECDH path (deriveBits / importRegistryPublicKey)');
    process.exit(1);
}

fs.writeFileSync(canonical, js, 'utf8');
fs.writeFileSync(raw, js, 'utf8');
console.log('built assets/app.js', js.length, 'version:', VERSION);