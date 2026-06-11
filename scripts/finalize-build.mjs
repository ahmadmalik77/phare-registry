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

fs.copyFileSync(src, dest);
console.log('index.html updated (production modular build)');