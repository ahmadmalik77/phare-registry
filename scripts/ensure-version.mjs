import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rawPath = path.join(root, 'assets', 'app.raw.js');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const VERSION = pkg.version;

let js = fs.readFileSync(rawPath, 'utf8');
if (!js.includes(VERSION) || !js.includes('PHARE_VERSION')) {
    if (/const PHARE_VERSION\s*=/.test(js)) {
        js = js.replace(/const PHARE_VERSION\s*=\s*['"][^'"]*['"]\s*;/, `const PHARE_VERSION = '${VERSION}';`);
    } else {
        js = js.replace(
            /(['"]use strict['"];\s*\n)/,
            `$1\n    const PHARE_VERSION = '${VERSION}';\n\n`
        );
    }
    fs.writeFileSync(rawPath, js, 'utf8');
    console.log('ensured PHARE_VERSION =', VERSION);
} else {
    console.log('PHARE_VERSION already present:', VERSION);
}
