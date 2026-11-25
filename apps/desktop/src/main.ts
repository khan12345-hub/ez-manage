/*
 * EZ Manage desktop — a thin, secure shell around the EZ Manage web app so the whole platform
 * (Boards, Company Work, EZ Tracker, EZ Vault, EZ Sales, CEO Tower) runs as a native Windows app.
 * It loads the real web UI; it is not a separate copy. External links open in the default browser.
 */
import { app, BrowserWindow, Menu, shell } from 'electron';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

const baked = (() => { try { return JSON.parse(readFileSync(join(__dirname, 'build-config.json'), 'utf8')) as { webUrl?: string }; } catch { return {}; } })();
const WEB_URL = (process.env.EZM_URL?.trim() || baked.webUrl || 'https://staging-manage.ezify.pk').replace(/\/$/, '');
const APP_ORIGIN = (() => { try { return new URL(WEB_URL).origin; } catch { return ''; } })();

let win: BrowserWindow | null = null;

const stateFile = () => join(app.getPath('userData'), 'window.json');
function loadBounds() { try { return JSON.parse(readFileSync(stateFile(), 'utf8')) as { width?: number; height?: number; x?: number; y?: number; max?: boolean }; } catch { return {}; } }
function saveBounds() { if (!win) return; try { writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), max: win.isMaximized() })); } catch { /* ignore */ } }

/** a tiny offline page with a Retry button (shown if the app URL can't be reached) */
const offlinePage = (msg: string) => 'data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><title>EZ Manage</title>
<style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#0b2a1f;color:#eef3f0;font:15px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif}
.c{text-align:center;max-width:420px;padding:24px}.m{width:52px;height:52px;border-radius:14px;background:#b08d57;margin:0 auto 18px;box-shadow:inset 0 0 0 6px #0b2a1f}
h1{font-size:20px;margin:0 0 6px}p{color:#9fb3a7;margin:0 0 18px}button{all:unset;cursor:pointer;background:#1f6f4f;color:#fff;padding:11px 20px;border-radius:10px;font-weight:600}</style></head>
<body><div class="c"><div class="m"></div><h1>Can't reach EZ Manage</h1><p>${msg}</p><button onclick="location.href='${WEB_URL}'">Try again</button></div></body></html>`);

function createWindow() {
  const b = loadBounds();
  win = new BrowserWindow({
    width: b.width ?? 1320, height: b.height ?? 860, x: b.x, y: b.y, minWidth: 940, minHeight: 600,
    title: 'EZ Manage', backgroundColor: '#eef3f0', autoHideMenuBar: true, show: false,
    webPreferences: { preload: join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true },
  });
  if (b.max) win.maximize();
  win.once('ready-to-show', () => win?.show());
  void win.loadURL(WEB_URL);

  const sameApp = (url: string) => { try { return new URL(url).origin === APP_ORIGIN; } catch { return false; } };
  // links to other sites (and target=_blank) open in the real browser; in-app navigation stays in-app
  win.webContents.setWindowOpenHandler(({ url }) => { if (sameApp(url)) return { action: 'allow' }; if (/^https?:/.test(url)) void shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (/^https?:/.test(url) && !sameApp(url)) { e.preventDefault(); void shell.openExternal(url); } });
  win.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3 /* not an aborted nav */ && url.startsWith(WEB_URL)) void win?.loadURL(offlinePage(`${desc || 'The server did not respond'}. Check your connection and try again.`));
  });

  win.on('close', saveBounds);
  win.on('closed', () => { win = null; });
}

function buildMenu() {
  return Menu.buildFromTemplate([
    { label: 'EZ Manage', submenu: [
      { label: 'Home', accelerator: 'Alt+Home', click: () => win && void win.loadURL(WEB_URL) },
      { role: 'reload' }, { role: 'forceReload' },
      { type: 'separator' },
      { role: 'quit' },
    ] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
  ]);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.whenReady().then(() => {
    app.setAppUserModelId('com.ezmanage.app');
    Menu.setApplicationMenu(buildMenu());
    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
