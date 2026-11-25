// copy the renderer's HTML / CSS next to its compiled JS
import { copyFileSync, mkdirSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
const src = 'src/renderer', out = 'dist/renderer';
mkdirSync(out, { recursive: true });
for (const f of readdirSync(src)) if (/\.(html|css)$/.test(f)) copyFileSync(join(src, f), join(out, f));
// baked at build time into dist/build-config.json:
//  EZT_DEFAULT_API=https://…/api  → the server the installed app talks to
//  EZT_SILENT=1                   → this build runs unattended (no window/tray, auto-track on login)
const api = process.env.EZT_DEFAULT_API?.trim();
const silent = /^(1|true|yes|on)$/i.test(process.env.EZT_SILENT ?? '');
const baked = {};
if (api) baked.apiBase = api.replace(/\/$/, '');
if (silent) baked.silent = true;
if (Object.keys(baked).length) { writeFileSync('dist/build-config.json', JSON.stringify(baked)); console.log('baked in:', baked); }
else rmSync('dist/build-config.json', { force: true });
console.log('static copied');
