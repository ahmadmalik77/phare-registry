import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { transform } from 'esbuild';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const VERSION = pkg.version || '2026.06-production';

const canonical = path.join(root, 'assets', 'app.js');
const raw = path.join(root, 'assets', 'app.raw.js');
const stylesPath = path.join(root, 'assets', 'styles.css');
const stylesRawPath = path.join(root, 'assets', 'styles.raw.css');

function looksMinified(src) {
    if (!src) return true;
    const lines = src.split(/\n/).length;
    return lines < 20 || (src.length > 5000 && lines < 50);
}

function hasProductionCrypto(src) {
    return src.includes('phare-aes-gcm-ecdh-v2') && src.includes('deriveBits');
}

function pickJsSource() {
    const fromCanonical = fs.existsSync(canonical) ? fs.readFileSync(canonical, 'utf8') : '';
    const fromRaw = fs.existsSync(raw) ? fs.readFileSync(raw, 'utf8') : '';

    // Prefer unminified source with production crypto
    if (fromRaw && hasProductionCrypto(fromRaw) && !looksMinified(fromRaw)) return fromRaw;
    if (fromCanonical && hasProductionCrypto(fromCanonical) && !looksMinified(fromCanonical)) return fromCanonical;
    if (fromRaw && hasProductionCrypto(fromRaw)) return fromRaw;
    if (fromCanonical && hasProductionCrypto(fromCanonical)) return fromCanonical;

    console.error('build-app: missing production ECDH path (phare-aes-gcm-ecdh-v2 / deriveBits)');
    process.exit(1);
}

let js = pickJsSource();

// Stamp version whether minified or not
if (/const PHARE_VERSION = ['"][^'"]+['"]/.test(js)) {
    js = js.replace(/const PHARE_VERSION = ['"][^'"]+['"];/, `const PHARE_VERSION = '${VERSION}';`);
} else if (/"2026\.06-production\.\d+"/.test(js)) {
    js = js.replace(/"2026\.06-production\.\d+"/g, `"${VERSION}"`);
} else if (/'2026\.06-production\.\d+'/.test(js)) {
    js = js.replace(/'2026\.06-production\.\d+'/g, `'${VERSION}'`);
} else {
    console.warn('build-app: could not stamp PHARE_VERSION — ensure version string appears in source');
}

js = js.replace(/\s*URL\.revokeObjectURL\(workerBlobUrl\);\s*/g, '\n');

if (js.includes('workerBlobUrl')) {
    console.error('build-app: workerBlobUrl still present after sanitization');
    process.exit(1);
}

if (!hasProductionCrypto(js)) {
    console.error('build-app: missing production ECDH path after processing');
    process.exit(1);
}

// Keep unminified when input was unminified; otherwise keep existing readable raw if any
if (!looksMinified(js)) {
    fs.writeFileSync(raw, js, 'utf8');
    console.log('wrote assets/app.raw.js', js.length, 'bytes (source)');
}

const { code: minJs } = await transform(js, {
    minify: true,
    target: 'es2020',
    legalComments: 'none'
});
fs.writeFileSync(canonical, minJs, 'utf8');
// Cache-proof deploy filename (browsers cannot reuse broken app.js?v= cache)
const deployApp = path.join(root, 'assets', 'app-20.js');
fs.writeFileSync(deployApp, minJs, 'utf8');
console.log('built assets/app.js + assets/app-20.js', minJs.length, 'bytes (minified), version:', VERSION);

// Minify CSS — prefer styles.raw.css when present and unminified
if (fs.existsSync(stylesPath) || fs.existsSync(stylesRawPath)) {
    let css = '';
    if (fs.existsSync(stylesRawPath)) {
        const rawCss = fs.readFileSync(stylesRawPath, 'utf8');
        if (rawCss.includes('@font-face') && !looksMinified(rawCss)) css = rawCss;
    }
    if (!css && fs.existsSync(stylesPath)) {
        const live = fs.readFileSync(stylesPath, 'utf8');
        if (live.includes('@font-face')) css = live;
    }
    if (!css) {
        console.error('build-app: styles.css missing @font-face');
        process.exit(1);
    }
    if (!looksMinified(css)) {
        fs.writeFileSync(stylesRawPath, css, 'utf8');
        console.log('wrote assets/styles.raw.css', css.length, 'bytes (source)');
    }
    const { code: minCss } = await transform(css, {
        loader: 'css',
        minify: true,
        legalComments: 'none'
    });
    fs.writeFileSync(stylesPath, minCss, 'utf8');
    const deployCss = path.join(root, 'assets', 'styles-20.css');
    fs.writeFileSync(deployCss, minCss, 'utf8');
    console.log('built assets/styles.css + assets/styles-20.css', minCss.length, 'bytes (minified)');
}
