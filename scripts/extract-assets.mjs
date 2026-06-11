import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Monolith source preserved in archive after first production build

// Source monolith: archive/index.monolith.html after first build
const source = fs.existsSync(path.join(root, 'archive', 'index.monolith.html'))
  ? path.join(root, 'archive', 'index.monolith.html')
  : path.join(root, 'index.html');
const srcLines = fs.readFileSync(source, 'utf8').split(/\r?\n/);
const css = srcLines.slice(18, 988).join('\n');
const js = srcLines.slice(1253, 2430).join('\n');
fs.writeFileSync(path.join(root, 'assets', 'styles.css'), css, 'utf8');
fs.writeFileSync(path.join(root, 'assets', 'app.raw.js'), js, 'utf8');

const marker = 'const cryptoWorkerCode = `';
const start = js.indexOf(marker);
const end = js.indexOf('`;', start + marker.length);
if (start !== -1 && end !== -1) {
  const worker = js.slice(start + marker.length, end);
  fs.writeFileSync(path.join(root, 'assets', 'draft-crypto-worker.js'), worker, 'utf8');
}

console.log('extracted', { css: css.length, js: js.length, worker: end - start });