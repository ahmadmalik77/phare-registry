import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function extractBodyFromModular(html) {
    const match = html.match(/<body>\s*([\s\S]*?)\s*<script src="assets\/config\.js[^"]*"/);
    return match ? match[1].trim() : '';
}

function extractBodyFromMonolith(lines) {
    return lines.slice(990, 1251).join('\n');
}

const modularPath = path.join(root, 'index.html');
const monolithPath = path.join(root, 'archive', 'index.monolith.html');

let modular = fs.existsSync(modularPath) ? fs.readFileSync(modularPath, 'utf8') : '';
let body = modular.includes('<main class="frame">')
    ? extractBodyFromModular(modular)
    : '';

if (!body && fs.existsSync(monolithPath)) {
    const lines = fs.readFileSync(monolithPath, 'utf8').split(/\r?\n/);
    body = extractBodyFromMonolith(lines);
}

if (!body.includes('<main class="frame">')) {
    console.error('build-html: could not extract intake markup from index.html or archive/index.monolith.html');
    process.exit(1);
}

// Prefer versioned asset filenames (cache-proof), fall back to ?v= query bust
const stylesMatch = modular.match(/href="(assets\/styles[^"]+)"/i);
const configMatch = modular.match(/src="(assets\/config\.js[^"]*)"/i);
const appMatch = modular.match(/src="(assets\/app[^"]+)"/i);

const stylesHref = stylesMatch?.[1] || 'assets/styles-20.css';
const configHref = configMatch?.[1] || 'assets/config.js?v=20';
const appHref = appMatch?.[1] || 'assets/app-20.js';

const head = modular.includes('<!DOCTYPE html>')
    ? modular.split('</head>')[0]
        .replace(/<link rel="stylesheet" href="assets\/styles[^"]*">\s*/i, '')
        .trim()
    : fs.readFileSync(monolithPath, 'utf8').split(/\r?\n/).slice(0, 17).join('\n');

const html = `${head}
    <link rel="stylesheet" href="${stylesHref}">
</head>
<body>

${body}

    <script src="${configHref}"></script>
    <script src="${appHref}" defer></script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, 'index.production.html'), html, 'utf8');
console.log('built index.production.html', html.length, 'app:', appHref, 'styles:', stylesHref);
