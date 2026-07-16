import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, 'index.production.html');
const dest = path.join(root, 'index.html');
const backup = path.join(root, 'archive', 'index.monolith.html');

if (!fs.existsSync(path.join(root, 'archive'))) {
    fs.mkdirSync(path.join(root, 'archive'), { recursive: true });
}

if (!fs.existsSync(backup)) {
    const current = fs.readFileSync(dest, 'utf8');
    if (current.includes('<style>')) {
        fs.writeFileSync(backup, current, 'utf8');
        console.log('archived monolith to archive/index.monolith.html');
    }
}

if (!fs.existsSync(src)) {
    console.error('finalize-build: missing index.production.html — run npm run build:html');
    process.exit(1);
}

const prod = fs.readFileSync(src, 'utf8');
if (!prod.includes('<main class="frame">')) {
    console.error('finalize-build: index.production.html missing intake markup — refusing to overwrite index.html');
    process.exit(1);
}
if (!/assets\/app[^"']*\.js/.test(prod) || !/assets\/styles[^"']*\.css/.test(prod)) {
    console.error('finalize-build: production HTML missing required asset links — refusing to overwrite');
    process.exit(1);
}

// H-2: always deploy production HTML so build optimizations reach GitHub Pages
fs.copyFileSync(src, dest);
console.log('index.html updated from index.production.html');
