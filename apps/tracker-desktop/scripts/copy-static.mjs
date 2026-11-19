// copy the renderer's HTML / CSS next to its compiled JS
import { copyFileSync, mkdirSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
const src = 'src/renderer', out = 'dist/renderer';
mkdirSync(out, { recursive: true });
for (const f of readdirSync(src)) if (/\.(html|css)$/.test(f)) copyFileSync(join(src, f), join(out, f));
// the server the installed app talks to (EZT_DEFAULT_API=https://…/api pnpm dist:win)
const api = process.env.EZT_DEFAULT_API?.trim();
if (api) { writeFileSync('dist/build-config.json', JSON.stringify({ apiBase: api.replace(/\/$/, '') })); console.log('server baked in:', api); }
else rmSync('dist/build-config.json', { force: true });
console.log('static copied');
