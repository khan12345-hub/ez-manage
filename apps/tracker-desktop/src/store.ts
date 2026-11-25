/*
 * Local state on this computer (in Electron's userData folder):
 *  - config.json: API address, auto-start, and one account per paired company (Company Work or
 *    Accounts & Invoices); each device token is encrypted with the OS keychain (safeStorage)
 *  - queue/: slots and screenshots waiting to be uploaded (kept while offline, retried later)
 */
import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** one paired company on this computer (its own device token) */
export type Account = { id: string; name: string; source?: string; apiBase: string; tokenEnc: string };
export type Config = { apiBase: string; accounts?: Account[]; active?: string | null; autoStart?: boolean; /** unattended/silent deployment: no window or tray, auto-start tracking on login (org-managed devices) */ silent?: boolean; /** before multi-company */ tokenEnc?: string };
export type QueuedSlot = {
  kind: 'slot'; acct?: string; sessionId: number; clientId: string; start: string; seconds: number; activeSeconds: number;
  keyboard: number; mouse: number; idleDiscarded: boolean; apps: { app: string; title?: string; url?: string; seconds: number }[];
};
export type QueuedShot = { kind: 'shot'; acct?: string; clientId: string; slotClientId: string; takenAt: string; screen: number; blurred: boolean; file: string };

const dir = () => app.getPath('userData');
const qdir = () => { const d = join(dir(), 'queue'); mkdirSync(d, { recursive: true }); return d; };
const cfgFile = () => join(dir(), 'config.json');
// baked in at build time (scripts/copy-static.mjs writes dist/build-config.json from EZT_DEFAULT_API / EZT_SILENT)
const baked = (() => { try { return JSON.parse(readFileSync(join(__dirname, 'build-config.json'), 'utf8')) as { apiBase?: string; silent?: boolean }; } catch { return {}; } })();
export const DEFAULT_API = process.env.EZ_TRACKER_API ?? baked.apiBase ?? 'http://localhost:3010/api';
/** a build made with EZT_SILENT=1 runs unattended by default (no window/tray, auto-track on login) */
export const DEFAULT_SILENT = baked.silent === true;

export function loadConfig(): Config {
  let c: Config;
  try { c = { apiBase: DEFAULT_API, ...JSON.parse(readFileSync(cfgFile(), 'utf8')) }; } catch { c = { apiBase: DEFAULT_API }; }
  // one-company configs from the first version become the first account
  if (c.tokenEnc && !c.accounts?.length) { c = { ...c, accounts: [{ id: 'legacy', name: '', apiBase: c.apiBase, tokenEnc: c.tokenEnc }], active: 'legacy' }; delete c.tokenEnc; saveConfig(c); }
  return c;
}
export function saveConfig(c: Config) { mkdirSync(dir(), { recursive: true }); writeFileSync(cfgFile(), JSON.stringify(c, null, 2)); }

const enc = (t: string) => (safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(t) : Buffer.from(t, 'utf8')).toString('base64');
const dec = (e: string) => { try { const buf = Buffer.from(e, 'base64'); return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8'); } catch { return null; } };

export const activeAccount = (c: Config) => c.accounts?.find((a) => a.id === c.active) ?? null;
export const accountOf = (c: Config, id?: string | null) => (id ? c.accounts?.find((a) => a.id === id) ?? null : activeAccount(c));
/** the token of an account (the active one by default) */
export function getToken(c: Config, id?: string | null): string | null { const a = accountOf(c, id); return a ? dec(a.tokenEnc) : null; }
export function addAccount(c: Config, a: { id: string; name: string; source?: string; apiBase: string; token: string }): Config {
  const next: Config = { ...c, apiBase: a.apiBase, accounts: [...(c.accounts ?? []).filter((x) => x.id !== a.id), { id: a.id, name: a.name, source: a.source, apiBase: a.apiBase, tokenEnc: enc(a.token) }], active: a.id };
  saveConfig(next); return next;
}
export function removeAccount(c: Config, id: string): Config {
  const accounts = (c.accounts ?? []).filter((x) => x.id !== id);
  const next: Config = { ...c, accounts, active: c.active === id ? accounts[0]?.id ?? null : c.active };
  saveConfig(next); return next;
}
export function setActive(c: Config, id: string): Config { if (!c.accounts?.some((a) => a.id === id)) return c; const next = { ...c, active: id }; saveConfig(next); return next; }
export function renameAccount(c: Config, id: string, name: string, source?: string): Config {
  const a = c.accounts?.find((x) => x.id === id);
  if (!a || (a.name === name && a.source === source)) return c;
  const next = { ...c, accounts: c.accounts!.map((x) => (x.id === id ? { ...x, name, source } : x)) }; saveConfig(next); return next;
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
/** drop what is waiting for one company (it was signed out on this computer) */
export function dropQueue(acct: string) { for (const { name, item } of queued()) if ((item.acct ?? 'legacy') === acct || (!item.acct && acct === 'legacy')) dequeue(name, item); }
