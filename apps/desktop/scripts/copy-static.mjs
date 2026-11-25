// Bake the web address this build opens (EZM_URL=https://manage.example.com pnpm dist:win).
import { writeFileSync, rmSync } from 'node:fs';
const url = process.env.EZM_URL?.trim();
if (url) { writeFileSync('dist/build-config.json', JSON.stringify({ webUrl: url.replace(/\/$/, '') })); console.log('web url baked in:', url); }
else { rmSync('dist/build-config.json', { force: true }); console.log('no EZM_URL baked (will use default / EZM_URL at runtime)'); }
