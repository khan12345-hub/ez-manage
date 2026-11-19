/*
 * Local state on this computer (in Electron's userData folder):
 *  - config.json: API address, auto-start; the device token is encrypted with the OS keychain (safeStorage)
 *  - queue/: slots and screenshots waiting to be uploaded (kept while offline, retried later)
 */
import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Config = { apiBase: string; tokenEnc?: string; autoStart?: boolean };
export type QueuedSlot = {
  kind: 'slot'; sessionId: number; clientId: string; start: string; seconds: number; activeSeconds: number;
  keyboard: number; mouse: number; idleDiscarded: boolean; apps: { app: string; title?: string; url?: string; seconds: number }[];
};
export type QueuedShot = { kind: 'shot'; clientId: string; slotClientId: string; takenAt: string; screen: number; blurred: boolean; file: string };

const dir = () => app.getPath('userData');
const qdir = () => { const d = join(dir(), 'queue'); mkdirSync(d, { recursive: true }); return d; };
const cfgFile = () => join(dir(), 'config.json');
export const DEFAULT_API = process.env.EZ_TRACKER_API ?? 'http://localhost:3010/api';

export function loadConfig(): Config {
  try { return { apiBase: DEFAULT_API, ...JSON.parse(readFileSync(cfgFile(), 'utf8')) }; } catch { return { apiBase: DEFAULT_API }; }
}
export function saveConfig(c: Config) { mkdirSync(dir(), { recursive: true }); writeFileSync(cfgFile(), JSON.stringify(c, null, 2)); }

export function getToken(c: Config): string | null {
  if (!c.tokenEnc) return null;
  try {
    const buf = Buffer.from(c.tokenEnc, 'base64');
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8');
  } catch { return null; }
}
export function setToken(c: Config, token: string | null): Config {
  const next = { ...c };
  if (!token) delete next.tokenEnc;
  else next.tokenEnc = (safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(token) : Buffer.from(token, 'utf8')).toString('base64');
  saveConfig(next);
  return next;
}

/** queue: one JSON file per item; slots first, then screenshots, each by time */
export function enqueue(item: QueuedSlot | QueuedShot, image?: Buffer) {
  const d = qdir();
  // slots sort before screenshots (a screenshot needs its slot on the server first)
  const name = `${item.kind === 'slot' ? 'a' : 'b'}-${Date.now()}-${item.clientId}`;
  if (item.kind === 'shot' && image) { writeFileSync(join(d, `${name}.jpg`), image); item.file = `${name}.jpg`; }
  writeFileSync(join(d, `${name}.json`), JSON.stringify(item));
}
export function queued(): { name: string; item: QueuedSlot | QueuedShot }[] {
  const d = qdir();
  return readdirSync(d).filter((f) => f.endsWith('.json')).sort().flatMap((f) => {
    try { return [{ name: f, item: JSON.parse(readFileSync(join(d, f), 'utf8')) }]; } catch { rmSync(join(d, f), { force: true }); return []; }
  });
}
export function readShot(file: string) { const p = join(qdir(), file); return existsSync(p) ? readFileSync(p) : null; }
export function dequeue(name: string, item: QueuedSlot | QueuedShot) {
  rmSync(join(qdir(), name), { force: true });
  if (item.kind === 'shot' && item.file) rmSync(join(qdir(), item.file), { force: true });
}
/** rewrite a queued slot (idle decision changes it before upload) */
export function rewrite(name: string, item: QueuedSlot) { writeFileSync(join(qdir(), name), JSON.stringify(item)); }
export function clearQueue() { rmSync(qdir(), { recursive: true, force: true }); }
