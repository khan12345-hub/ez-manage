// copy the renderer's HTML / CSS next to its compiled JS
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const src = 'src/renderer', out = 'dist/renderer';
mkdirSync(out, { recursive: true });
for (const f of readdirSync(src)) if (/\.(html|css)$/.test(f)) copyFileSync(join(src, f), join(out, f));
console.log('static copied');
