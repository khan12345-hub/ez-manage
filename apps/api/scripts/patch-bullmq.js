/**
 * Patches BullMQ's redis-connection.js to skip the Redis version check.
 * Local dev uses Redis 3.x; production server has Redis 5+.
 * Run automatically via postinstall.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find the bullmq package path
let bullmqPath;
try {
  const result = execSync('pnpm list bullmq --json', { encoding: 'utf8' });
  // Try to find the path from node_modules
  const searchBase = path.resolve(__dirname, '../../..', 'node_modules/.pnpm');
  const dirs = fs.readdirSync(searchBase).filter(d => d.startsWith('bullmq@'));
  if (!dirs.length) return;
  bullmqPath = path.join(searchBase, dirs[0], 'node_modules/bullmq/dist/cjs/classes/redis-connection.js');
} catch {
  return;
}

if (!fs.existsSync(bullmqPath)) return;

let content = fs.readFileSync(bullmqPath, 'utf8');
const before = `if (this.skipVersionCheck !== true && !this.closing) {`;
const after  = `if (false /* patched: skip version check for local dev */ && this.skipVersionCheck !== true && !this.closing) {`;

if (content.includes(after)) {
  console.log('[patch-bullmq] Already patched, skipping.');
  return;
}
if (!content.includes(before)) {
  console.log('[patch-bullmq] Pattern not found, nothing to patch.');
  return;
}

fs.writeFileSync(bullmqPath, content.replace(before, after), 'utf8');
console.log('[patch-bullmq] Patched redis-connection.js successfully.');
