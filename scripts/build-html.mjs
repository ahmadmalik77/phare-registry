import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lines = fs.readFileSync(path.join(root, 'index.html'), 'utf8').split(/\r?\n/);

const head = lines.slice(0, 17).join('\n');
const body = lines.slice(990, 1251).join('\n');

const html = `${head}
    <link rel="stylesheet" href="assets/styles.css">
</head>
${body}

    <script src="assets/config.js"></script>
    <script src="assets/app.js" defer></script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, 'index.production.html'), html, 'utf8');
console.log('built index.production.html', html.length);