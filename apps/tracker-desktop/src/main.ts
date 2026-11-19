/*
 * EZ Tracker desktop (Electron main process).
 * Screens: pair (code from the web) → consent (what is / isn't recorded) → main (task, Start / Stop).
 * While tracking, a tray icon is always visible. Closing the window keeps tracking (in the tray);
 * Quit stops the session first.
 */
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell, Tray } from 'electron';
import { hostname, platform, release } from 'node:os';
import { join } from 'node:path';
import { Api, ApiError, type Me } from './api';
import { Engine } from './engine';
import { DEFAULT_API, clearQueue, getToken, loadConfig, saveConfig, setToken, type Config } from './store';

const CONSENT_VERSION = '2026-11-19';
let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let cfg: Config;
let me: Me | null = null;
let lastError: string | null = null;
let quitting = false;

const api = () => new Api(cfg.apiBase, getToken(cfg));
const engine = new Engine(api, () => me, () => push(), async (minutes) => {
  if (win) { win.show(); win.focus(); }
  const r = await dialog.showMessageBox({
    type: 'question', title: 'EZ Tracker', buttons: ['Keep the time', 'Discard it'], defaultId: 0, cancelId: 0, noLink: true,
    message: `You were away for about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    detail: 'Keep that time as work, or discard it? Discarded time is not counted and has no screenshots.',
  });
  return r.response === 0;
});

/** a round tray / window icon drawn in code (green while tracking, grey when stopped) */
function icon(size: number, on: boolean) {
  const buf = Buffer.alloc(size * size * 4);
  const [r, g, b] = on ? [5, 150, 105] : [110, 120, 125];
  const c = (size - 1) / 2, rad = size / 2 - 0.5;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - c, y - c);
    const i = (y * size + x) * 4;
    const ring = d > rad - size * 0.16;
    const hand = (Math.abs(x - c) < size * 0.07 && y < c && y > c - rad * 0.6) || (Math.abs(y - c) < size * 0.07 && x > c && x < c + rad * 0.45);
    const a = d <= rad ? 255 : d <= rad + 1 ? Math.round(255 * (rad + 1 - d)) : 0;
    const inside = !ring && !hand;
    // BGRA
    buf[i] = inside ? 255 : b; buf[i + 1] = inside ? 255 : g; buf[i + 2] = inside ? 255 : r; buf[i + 3] = a;
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

const fmt = (s: number) => `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;

function screenName(): 'pair' | 'consent' | 'main' {
  if (!getToken(cfg) || !me) return 'pair';
  if (!me.consent.acceptedAt) return 'consent';
  return 'main';
}

function push() {
  const st = engine.state();
  win?.webContents.send('state', { screen: screenName(), apiBase: cfg.apiBase, me, engine: st, consentVersion: CONSENT_VERSION, autoStart: !!cfg.autoStart, error: lastError });
  updateTray();
}

function updateTray() {
  const st = engine.state();
  if (!tray) { tray = new Tray(icon(32, st.running)); tray.on('click', () => { win?.show(); win?.focus(); }); }
  tray.setImage(icon(32, st.running));
  tray.setToolTip(st.running ? `EZ Tracker: tracking ${fmt(st.sessionSeconds)}${st.taskName ? ` on ${st.taskName}` : ''}` : 'EZ Tracker: not tracking');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: st.running ? `● Tracking ${fmt(st.sessionSeconds)}` : 'Not tracking', enabled: false },
    { type: 'separator' },
    st.running ? { label: 'Stop', click: () => void engine.stop() } : { label: 'Open to start…', click: () => { win?.show(); win?.focus(); } },
    { label: 'Open EZ Tracker', click: () => { win?.show(); win?.focus(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => void quit() },
  ]));
}

async function refreshMe() {
  if (!getToken(cfg)) { me = null; return; }
  try { me = await api().me(); lastError = null; engine.todayBase = me.today; engine.offline = false; }
  catch (e) {
    if (e instanceof ApiError && e.status === 401) { cfg = setToken(cfg, null); me = null; lastError = 'This computer was signed out. Pair it again with a new code.'; }
    else engine.offline = true;
  }
}

async function quit() {
  if (engine.state().running) { await engine.stop(); }
  quitting = true;
  app.quit();
}

function createWindow() {
  win = new BrowserWindow({
    width: 420, height: 680, minWidth: 380, minHeight: 560, title: 'EZ Tracker', icon: icon(64, false), backgroundColor: '#f4f7f6', autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.removeMenu();
  win.loadFile(join(__dirname, 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) void shell.openExternal(url); return { action: 'deny' }; });
  win.on('close', (e) => { if (!quitting && engine.state().running) { e.preventDefault(); win?.hide(); } });
  win.webContents.on('did-finish-load', () => push());
}

// dev / tests only: a separate data folder (pairing, queue) for this run
if (process.env.EZT_USER_DATA) app.setPath('userData', process.env.EZT_USER_DATA);

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { win?.show(); win?.focus(); });
  app.whenReady().then(async () => {
    app.setAppUserModelId('com.ezmanage.tracker');
    cfg = loadConfig();
    await refreshMe();
    createWindow();
    updateTray();
    // settings (screenshots, blur, idle…) are picked up within a minute
    setInterval(() => void refreshMe().then(push), 60_000);
    // leftovers from last time (offline / crashed): upload them
    void engine.flush();
  });
  app.on('before-quit', (e) => { if (!quitting && engine.state().running) { e.preventDefault(); void quit(); } });
  app.on('window-all-closed', () => { if (!engine.state().running) void quit(); });
}

// ── renderer ↔ main ──
const ok = <T>(p: Promise<T>) => p.then((data) => ({ ok: true as const, data })).catch((e: any) => ({ ok: false as const, error: String(e?.message ?? e) }));

ipcMain.handle('pair', (_e, b: { apiBase: string; code: string }) => ok((async () => {
  const base = (b.apiBase || DEFAULT_API).trim().replace(/\/$/, '');
  if (!/^https?:\/\/.+/.test(base)) throw new Error('Enter the server address, e.g. https://app.example.com/api');
  const r = await new Api(base, null).pair(b.code, hostname().slice(0, 80), `${platform()} ${release()}`, app.getVersion());
  cfg = setToken({ ...cfg, apiBase: base }, r.token);
  lastError = null;
  await refreshMe();
  push();
  return true;
})()));
ipcMain.handle('consent', () => ok((async () => { await api().consent(CONSENT_VERSION); await refreshMe(); push(); return true; })()));
ipcMain.handle('tasks', (_e, q: string) => ok(api().tasks(String(q ?? ''))));
ipcMain.handle('start', (_e, t: { id?: number | null; name?: string | null }) => ok((async () => { await refreshMe(); if (!me?.tracked) throw new Error('Time tracking is not turned on for you in this workspace.'); await engine.start(t); return true; })()));
ipcMain.handle('stop', () => ok((async () => { await engine.stop(); await refreshMe(); push(); return true; })()));
ipcMain.handle('signout', () => ok((async () => { if (engine.state().running) await engine.stop(); clearQueue(); cfg = setToken(cfg, null); me = null; push(); return true; })()));
ipcMain.handle('autostart', (_e, on: boolean) => ok((async () => { cfg = { ...cfg, autoStart: !!on }; saveConfig(cfg); app.setLoginItemSettings({ openAtLogin: !!on }); push(); return true; })()));
ipcMain.handle('openWeb', () => ok((async () => {
  const web = cfg.apiBase.replace(/\/api\/?$/, '').replace(':3010', ':3000');
  await shell.openExternal(`${web}/tracker${me?.workspace ? `/${me.workspace.uid}` : ''}`);
  return true;
})()));
ipcMain.handle('refresh', () => ok((async () => { await refreshMe(); push(); return true; })()));
