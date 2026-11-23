/*
 * The tracking engine: a session is cut into 10-minute slots aligned to the clock (:00, :10, …).
 * Every second it notes whether there was any keyboard / mouse input (counts only — key values are
 * never read), which app is in front, and whether the person is idle. Screenshots are taken at random
 * moments inside each slot. Finished slots and screenshots go to a disk queue and are uploaded
 * (retried while offline). Idle time is held back until the person decides to keep or discard it.
 */
import { desktopCapturer, nativeImage, powerMonitor, screen } from 'electron';
import { randomUUID } from 'node:crypto';
import { Api, ApiError, type Me } from './api';
import { dequeue, enqueue, queued, readShot, rewrite, type QueuedSlot } from './store';

const SLOT = 10 * 60_000;
const id = (p: string) => `${p}_${randomUUID().replace(/-/g, '').slice(0, 24)}`;

/** optional native helpers (activity counts, front app); the app still works without them */
type Hook = { on: (e: string, f: () => void) => void; start: () => void; stop: () => void };
function loadHook(): Hook | null { try { return require('uiohook-napi').uIOhook as Hook; } catch { return null; } }
type ActiveWin = () => Promise<{ title?: string; owner?: { name?: string; path?: string }; url?: string } | undefined>;
let activeWindow: ActiveWin | null = null;
async function loadActive() {
  if (activeWindow) return activeWindow;
  try { const m: any = await (new Function('m', 'return import(m)'))('get-windows'); activeWindow = m.activeWindow; } catch { activeWindow = null; }
  return activeWindow;
}

const BROWSERS = /chrome|msedge|firefox|brave|opera|vivaldi|safari/i;
/** a site name from a browser window title ("Inbox - Gmail - Google Chrome" → "Gmail") */
function siteFromTitle(title: string) {
  const parts = title.split(/ [-–—|] /).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return undefined;
  const site = parts[parts.length - 2]!;
  return site.length <= 60 ? site : undefined;
}

type Slot = { clientId: string; start: number; seconds: number; activeSeconds: number; keyboard: number; mouse: number; idleSeconds: number; apps: Map<string, { app: string; title?: string; url?: string; seconds: number }>; shotsAt: number[] };

export type EngineState = { running: boolean; sessionId: number | null; startedAt: string | null; taskName: string | null; sessionSeconds: number; todaySeconds: number; pending: number; offline: boolean; idlePrompt: boolean; nativeActivity: boolean };

export class Engine {
  private sessionId: number | null = null;
  private sessionClient: string | null = null;
  /** the company (account) this session belongs to: its slots / screenshots upload with its token */
  private sessionAcct: string | null = null;
  private startedAt: number | null = null;
  private taskName: string | null = null;
  private slot: Slot | null = null;
  private tick: NodeJS.Timeout | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private beatTimer: NodeJS.Timeout | null = null;
  private hook = loadHook();
  private hookOn = false;
  private kb = 0; private ms = 0; private inputThisSecond = false;
  private appTick = 0; private lastApp: { app: string; title?: string; url?: string } | null = null;
  private idleSince: number | null = null;
  idlePrompt = false;
  private sessionSeconds = 0;
  todayBase = 0;
  offline = false;

  constructor(private api: (acct?: string | null) => Api, private account: () => string | null, private me: () => Me | null, private onChange: () => void, private askIdle: (minutes: number) => Promise<boolean>) {
    if (this.hook) {
      this.hook.on('keydown', () => { this.kb++; this.inputThisSecond = true; });
      this.hook.on('mousedown', () => { this.ms++; this.inputThisSecond = true; });
      this.hook.on('wheel', () => { this.ms++; this.inputThisSecond = true; });
      let last = 0;
      this.hook.on('mousemove', () => { const n = Date.now(); if (n - last > 250) { this.ms++; last = n; } this.inputThisSecond = true; });
    }
  }

  state(): EngineState {
    return {
      running: !!this.sessionId, sessionId: this.sessionId, startedAt: this.startedAt ? new Date(this.startedAt).toISOString() : null, taskName: this.taskName,
      sessionSeconds: this.sessionSeconds, todaySeconds: this.todayBase + this.sessionSeconds, pending: queued().length, offline: this.offline, idlePrompt: this.idlePrompt, nativeActivity: !!this.hook,
    };
  }

  async start(task: { id?: number | null; name?: string | null; note?: string | null }) {
    if (this.sessionId) return;
    const clientId = id('s');
    const acct = this.account();
    // a fresh online start: the server stamps the time (so a PC clock ahead of the server can't fail)
    const note = (task.note ?? task.name) ?? null;
    const s = await this.api(acct).start({ clientId, projectLabel: note });
    this.sessionId = s.id; this.sessionClient = clientId; this.sessionAcct = acct; this.startedAt = Date.parse(s.startedAt); this.taskName = note; this.sessionSeconds = 0;
    this.newSlot(Date.now());
    if (this.hook && !this.hookOn) { try { this.hook.start(); this.hookOn = true; } catch { this.hook = null; } }
    this.tick = setInterval(() => void this.second(), 1000);
    this.flushTimer = setInterval(() => void this.flush(), 30_000);
    this.beatTimer = setInterval(() => void this.beat(), 60_000);
    this.onChange();
  }

  /** serverEnded: the server already closed it (e.g. this computer was offline too long) */
  async stop(serverEnded = false) {
    if (!this.sessionId) return;
    const sid = this.sessionId;
    const acct = this.sessionAcct;
    if (this.idlePrompt) return; // decide about idle time first
    this.closeSlot();
    for (const t of [this.tick, this.flushTimer, this.beatTimer]) if (t) clearInterval(t);
    this.tick = this.flushTimer = this.beatTimer = null;
    if (this.hookOn) { try { this.hook?.stop(); } catch { /* ignore */ } this.hookOn = false; }
    this.todayBase += this.sessionSeconds; this.sessionSeconds = 0;
    this.sessionId = null; this.sessionClient = null; this.sessionAcct = null; this.startedAt = null; this.taskName = null;
    await this.flush();
    if (!serverEnded) try { await this.api(acct).stop(sid, new Date().toISOString()); } catch { this.offline = true; /* the server closes it after 15 min without a heartbeat */ }
    this.onChange();
  }

  private newSlot(now: number) {
    const start = Math.floor(now / SLOT) * SLOT;
    const n = this.me()?.settings.screenshotsPer10 ?? 0;
    // random moments in what is left of this slot (at least 20 s in)
    const from = Math.max(now + 20_000, start + 20_000), to = start + SLOT - 15_000;
    const shotsAt = to > from ? Array.from({ length: n }, () => from + Math.random() * (to - from)).sort((a, b) => a - b) : [];
    // dev / tests only: first screenshot a few seconds after Start
    if (process.env.EZT_DEV_FAST_SHOTS === '1' && n) shotsAt.unshift(now + 4000);
    this.slot = { clientId: id('t'), start, seconds: 0, activeSeconds: 0, keyboard: 0, mouse: 0, idleSeconds: 0, apps: new Map(), shotsAt };
  }

  private closeSlot() {
    const s = this.slot;
    if (!s || !this.sessionId || s.seconds === 0) return;
    const item: QueuedSlot = {
      kind: 'slot', acct: this.sessionAcct ?? undefined, sessionId: this.sessionId, clientId: s.clientId, start: new Date(s.start).toISOString(), seconds: s.seconds, activeSeconds: s.activeSeconds,
      keyboard: s.keyboard, mouse: s.mouse, idleDiscarded: false, apps: [...s.apps.values()].sort((a, b) => b.seconds - a.seconds).slice(0, 30),
    };
    enqueue(item);
    this.slot = null;
  }

  /** once a second */
  private async second() {
    if (!this.sessionId || !this.slot) return;
    const now = Date.now();
    if (now >= this.slot.start + SLOT) { this.closeSlot(); this.newSlot(now); void this.flush(); }
    const s = this.slot!;
    s.seconds = Math.min(600, s.seconds + 1);
    this.sessionSeconds++;
    // activity: native hook when available, otherwise the OS idle clock (input within the last second)
    const active = this.hook ? this.inputThisSecond : powerMonitor.getSystemIdleTime() < 1;
    if (active) s.activeSeconds++;
    s.keyboard += this.kb; s.mouse += this.ms; this.kb = 0; this.ms = 0; this.inputThisSecond = false;

    // front app every 5 seconds
    if (++this.appTick % 5 === 0) void this.sampleApp();
    if (this.lastApp && this.me()?.settings.trackApps) {
      const k = `${this.lastApp.app}|${this.lastApp.url ?? ''}`;
      const a = s.apps.get(k) ?? { ...this.lastApp, seconds: 0 };
      a.seconds++; s.apps.set(k, a);
    }

    // idle: no input for idleMinutes → ask keep / discard when the person is back
    const idleLimit = (this.me()?.settings.idleMinutes ?? 5) * 60;
    const idle = powerMonitor.getSystemIdleTime();
    if (idle >= idleLimit && this.idleSince === null) this.idleSince = now - idle * 1000;
    if (this.idleSince !== null && idle < 2 && !this.idlePrompt) void this.idleBack(now);

    // screenshots
    while (s.shotsAt.length && now >= s.shotsAt[0]!) { s.shotsAt.shift(); if (this.idleSince === null) void this.capture(s.clientId); }
    if (this.sessionSeconds % 5 === 0) this.onChange();
  }

  private async idleBack(now: number) {
    const since = this.idleSince!;
    this.idlePrompt = true; this.onChange();
    const minutes = Math.round((now - since) / 60_000);
    const keep = await this.askIdle(minutes);
    if (!keep) this.discard(since, now);
    this.idleSince = null; this.idlePrompt = false; this.onChange();
  }

  /** take idle seconds out of the open slot and of queued (not yet uploaded) slots */
  private discard(from: number, to: number) {
    const cut = (start: number, seconds: number) => Math.max(0, Math.min(start + SLOT, to) - Math.max(start, from)) / 1000;
    if (this.slot) {
      const c = Math.min(this.slot.seconds, Math.round(cut(this.slot.start, this.slot.seconds)));
      this.slot.seconds -= c; this.slot.activeSeconds = Math.min(this.slot.activeSeconds, this.slot.seconds); this.sessionSeconds -= c;
    }
    for (const { name, item } of queued()) {
      if (item.kind !== 'slot') continue;
      const start = Date.parse(item.start);
      const c = Math.min(item.seconds, Math.round(cut(start, item.seconds)));
      if (!c) continue;
      this.sessionSeconds -= c;
      if (c >= item.seconds - 30) item.idleDiscarded = true; else { item.seconds -= c; item.activeSeconds = Math.min(item.activeSeconds, item.seconds); }
      rewrite(name, item);
    }
    this.sessionSeconds = Math.max(0, this.sessionSeconds);
  }

  private async sampleApp() {
    const aw = await loadActive();
    if (!aw) { this.lastApp = null; return; }
    try {
      const w = await aw();
      if (!w) { this.lastApp = null; return; }
      const app = (w.owner?.name ?? 'Unknown').replace(/\.exe$/i, '');
      const title = (w.title ?? '').slice(0, 200);
      const urls = this.me()?.settings.trackUrls;
      const url = urls && BROWSERS.test(app) ? siteFromTitle(title) : undefined;
      this.lastApp = { app, title: urls ? title : undefined, url };
    } catch { this.lastApp = null; }
  }

  /** every screen; blurred on this computer before upload when the workspace asks for it */
  private async capture(slotClientId: string) {
    try {
      const st = this.me()?.settings;
      if (!st?.screenshotsPer10) return;
      const displays = screen.getAllDisplays();
      const biggest = Math.max(...displays.map((d) => d.size.width * d.scaleFactor), 1280);
      const scale = Math.min(1, 1600 / biggest);
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round(biggest * scale), height: Math.round(Math.max(...displays.map((d) => d.size.height * d.scaleFactor)) * scale) } });
      sources.forEach((src, i) => {
        let img = src.thumbnail;
        if (img.isEmpty()) return;
        if (img.getSize().width > 1600) img = img.resize({ width: 1600, quality: 'good' });
        if (st.blur) { const { width, height } = img.getSize(); img = nativeImage.createFromBuffer(img.resize({ width: Math.max(16, Math.round(width / 14)), quality: 'good' }).toPNG()).resize({ width, height, quality: 'good' }); }
        enqueue({ kind: 'shot', acct: this.sessionAcct ?? undefined, clientId: id('p'), slotClientId, takenAt: new Date().toISOString(), screen: i, blurred: !!st.blur, file: '' }, img.toJPEG(68));
      });
    } catch { /* a missed screenshot is not fatal */ }
  }

  private async beat() {
    if (!this.sessionId) return;
    try { const r = await this.api(this.sessionAcct).heartbeat(this.sessionId); this.offline = false; if (r.ended) await this.stop(true); }
    catch (e) { this.offline = !(e instanceof ApiError); }
  }

  /** upload the queue in order; slots wait while an idle decision is pending */
  async flush(pass = 0): Promise<void> {
    if (this.idlePrompt) return;
    let waiting = 0, sent = 0;
    for (const { name, item } of queued()) {
      try {
        if (item.kind === 'slot') {
          const { kind, acct, sessionId, ...slot } = item; void kind;
          await this.api(acct ?? 'legacy').slots(sessionId, [slot]);
        } else {
          const buf = readShot(item.file);
          if (buf) await this.api(item.acct ?? 'legacy').shot({ clientId: item.clientId, slotClientId: item.slotClientId, takenAt: item.takenAt, screen: String(item.screen), blurred: String(item.blurred) }, buf);
        }
        dequeue(name, item);
        this.offline = false; sent++;
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) { waiting++; continue; } // its slot is not there yet: try next time
        if (e instanceof ApiError && e.status >= 400 && e.status < 500) { dequeue(name, item); continue; } // rejected for good (e.g. tracking turned off)
        this.offline = true; break; // network: keep everything, retry later
      }
    }
    // a screenshot waited for a slot that has just gone up: one more pass
    if (waiting && sent && pass === 0) return this.flush(1);
    this.onChange();
  }
}

export { SLOT };
