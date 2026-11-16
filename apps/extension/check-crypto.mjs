// node apps/extension/check-crypto.mjs — the extension's crypto must be the web app's, byte for byte.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const a = readFileSync(join(here, 'vault-crypto.js'));
const b = readFileSync(join(here, '..', 'web', 'lib', 'vault', 'vault-crypto.js'));
if (!a.equals(b)) { console.error('vault-crypto.js differs from apps/web/lib/vault/vault-crypto.js — copy it over.'); process.exit(1); }
console.log('vault-crypto.js is identical.');
