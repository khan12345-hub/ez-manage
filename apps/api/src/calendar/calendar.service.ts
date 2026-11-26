import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from 'prisma/prisma.service';

// calendar.events lets us create the meeting (with a Google Meet link) on the person's Google Calendar;
// readonly is kept so the merged calendar view keeps working.
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events'];
const COLORS = ['#047857', '#2563eb', '#b45309', '#7c3aed', '#db2777', '#0891b2', '#dc2626', '#4d7c0f'];
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API = 'https://www.googleapis.com/calendar/v3';

export type CalEvent = {
  id: string; source: 'google' | 'ezmanage'; accountId: number | null; accountEmail: string | null; color: string;
  calendarName: string; title: string; start: string; end: string; allDay: boolean; location: string | null;
  meetLink: string | null; htmlLink: string | null; attendees: number; status: string;
};

/** CEO Tower calendar: read-only Google Calendar accounts (several per person), merged with CEO Tower meetings. */
@Injectable()
export class CalendarService {
  private readonly log = new Logger(CalendarService.name);
  /** short per-account cache of events: key `${accountId}:${from}:${to}` */
  private cache = new Map<string, { at: number; events: CalEvent[] }>();

  constructor(private readonly prisma: PrismaService) {}

  private get cfg() {
    const id = process.env.GOOGLE_CLIENT_ID, secret = process.env.GOOGLE_CLIENT_SECRET;
    const redirect = process.env.GOOGLE_REDIRECT_URI || `${(process.env.API_PUBLIC_URL || 'http://localhost:3010/api').replace(/\/$/, '')}/calendar/google/callback`;
    return id && secret ? { id, secret, redirect } : null;
  }
  private get frontend() { return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, ''); }

  // ---------- secrets ----------
  private key() {
    const base = process.env.CALENDAR_TOKEN_KEY || process.env.SESSION_SECRET;
    if (!base) throw new Error('Set CALENDAR_TOKEN_KEY or SESSION_SECRET');
    return createHash('sha256').update(`ez-calendar:${base}`).digest();
  }
  private enc(plain: string) {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.key(), iv);
    const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return [iv, c.getAuthTag(), body].map((b) => b.toString('base64')).join('.');
  }
  private dec(s: string) {
    const [iv, tag, body] = s.split('.').map((p) => Buffer.from(p, 'base64'));
    const d = createDecipheriv('aes-256-gcm', this.key(), iv!);
    d.setAuthTag(tag!);
    return Buffer.concat([d.update(body!), d.final()]).toString('utf8');
  }
  /** state = userId.expiry.nonce.hmac — ties the Google round trip to the person who started it */
  private sign(userId: number) {
    const payload = `${userId}.${Date.now() + 10 * 60_000}.${randomBytes(12).toString('hex')}`;
    return `${payload}.${createHmac('sha256', this.key()).update(payload).digest('hex')}`;
  }
  private verify(state: string): number | null {
    const parts = (state ?? '').split('.');
    if (parts.length !== 4) return null;
    const payload = parts.slice(0, 3).join('.');
    const want = createHmac('sha256', this.key()).update(payload).digest();
    const got = Buffer.from(parts[3]!, 'hex');
    if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
    if (Number(parts[1]) < Date.now()) return null;
    const id = Number(parts[0]);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  async assertAdmin(userId: number) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
    if (u?.systemRole !== 'SUPER_ADMIN') throw new ForbiddenException('The calendar in Executive Hub is only for Administrators.');
  }

  // ---------- accounts ----------
  async accounts(userId: number) {
    await this.assertAdmin(userId);
    const rows = await this.prisma.calendarAccount.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { id: true, provider: true, email: true, color: true, enabled: true, createdAt: true } });
    return { configured: !!this.cfg, accounts: rows };
  }

  async connectUrl(userId: number) {
    await this.assertAdmin(userId);
    const cfg = this.cfg;
    if (!cfg) return { configured: false as const, url: null };
    const q = new URLSearchParams({
      client_id: cfg.id, redirect_uri: cfg.redirect, response_type: 'code', scope: SCOPES.join(' '),
      access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'true', state: this.sign(userId),
    });
    return { configured: true as const, url: `${AUTH_URL}?${q}` };
  }

  /** Google sends the browser here; always ends with a redirect back to CEO Tower */
  async callback(code: string | undefined, state: string | undefined, error: string | undefined) {
    const back = (p: Record<string, string>) => `${this.frontend}/ceo?${new URLSearchParams({ view: 'calendar', ...p })}`;
    const cfg = this.cfg;
    if (!cfg) return back({ calendar_error: 'not_configured' });
    if (error) return back({ calendar_error: error === 'access_denied' ? 'denied' : 'google' });
    const userId = this.verify(state ?? '');
    if (!userId || !code) return back({ calendar_error: 'expired' });
    try {
      await this.assertAdmin(userId);
      const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: cfg.id, client_secret: cfg.secret, redirect_uri: cfg.redirect, grant_type: 'authorization_code' }) });
      const t: any = await r.json();
      if (!r.ok || !t.access_token) { this.log.warn(`Google token exchange failed (${r.status})`); return back({ calendar_error: 'google' }); }
      const info: any = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${t.access_token}` } })).json();
      const email = String(info?.email ?? '').toLowerCase();
      if (!email) return back({ calendar_error: 'google' });
      const existing = await this.prisma.calendarAccount.findUnique({ where: { userId_provider_email: { userId, provider: 'google', email } } });
      if (!t.refresh_token && !existing) return back({ calendar_error: 'no_refresh' });
      const count = await this.prisma.calendarAccount.count({ where: { userId } });
      const data = { accessToken: this.enc(t.access_token), expiresAt: new Date(Date.now() + (Number(t.expires_in) || 3600) * 1000 - 60_000), ...(t.refresh_token ? { refreshToken: this.enc(t.refresh_token) } : {}) };
      if (existing) await this.prisma.calendarAccount.update({ where: { id: existing.id }, data: { ...data, enabled: true } });
      else await this.prisma.calendarAccount.create({ data: { userId, provider: 'google', email, color: COLORS[count % COLORS.length]!, refreshToken: data.refreshToken!, accessToken: data.accessToken, expiresAt: data.expiresAt } });
      this.dropCache();
      return back({ connected: '1', email });
    } catch (e: any) {
      this.log.warn(`Google calendar connect failed: ${e?.message ?? 'error'}`);
      return back({ calendar_error: 'google' });
    }
  }

  async update(userId: number, id: number, dto: { enabled?: boolean; color?: string }) {
    await this.assertAdmin(userId);
    const a = await this.prisma.calendarAccount.findFirst({ where: { id, userId } });
    if (!a) throw new NotFoundException('That calendar account was not found.');
    if (dto.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(dto.color)) throw new BadRequestException('Pick a colour.');
    this.dropCache();
    return this.prisma.calendarAccount.update({ where: { id }, data: { ...(dto.enabled !== undefined ? { enabled: !!dto.enabled } : {}), ...(dto.color ? { color: dto.color } : {}) }, select: { id: true, provider: true, email: true, color: true, enabled: true, createdAt: true } });
  }

  async remove(userId: number, id: number) {
    await this.assertAdmin(userId);
    const a = await this.prisma.calendarAccount.findFirst({ where: { id, userId } });
    if (!a) throw new NotFoundException('That calendar account was not found.');
    try { await fetch(REVOKE_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: this.dec(a.refreshToken) }) }); } catch { /* removed here either way */ }
    await this.prisma.calendarAccount.delete({ where: { id } });
    this.dropCache();
    return { ok: true };
  }

  // ---------- events ----------
  private dropCache() { this.cache.clear(); }

  private async token(a: { id: number; refreshToken: string; accessToken: string | null; expiresAt: Date | null }) {
    if (a.accessToken && a.expiresAt && +a.expiresAt > Date.now()) return this.dec(a.accessToken);
    const cfg = this.cfg!;
    const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: cfg.id, client_secret: cfg.secret, refresh_token: this.dec(a.refreshToken), grant_type: 'refresh_token' }) });
    const t: any = await r.json().catch(() => ({}));
    if (!r.ok || !t.access_token) throw new Error(t?.error === 'invalid_grant' ? 'reconnect' : `refresh ${r.status}`);
    await this.prisma.calendarAccount.update({ where: { id: a.id }, data: { accessToken: this.enc(t.access_token), expiresAt: new Date(Date.now() + (Number(t.expires_in) || 3600) * 1000 - 60_000) } });
    return t.access_token as string;
  }

  private async accountEvents(a: { id: number; email: string; color: string; refreshToken: string; accessToken: string | null; expiresAt: Date | null }, from: Date, to: Date): Promise<CalEvent[]> {
    const ck = `${a.id}:${+from}:${+to}`;
    const hit = this.cache.get(ck);
    if (hit && Date.now() - hit.at < 60_000) return hit.events;
    const tok = await this.token(a);
    const get = async (url: string) => { const r = await fetch(url, { headers: { authorization: `Bearer ${tok}` } }); if (!r.ok) throw new Error(`google ${r.status}`); return r.json() as Promise<any>; };
    const list = await get(`${API}/users/me/calendarList?minAccessRole=reader&maxResults=50`);
    const cals = ((list.items ?? []) as any[]).filter((c) => c.selected !== false && !c.hidden).slice(0, 20);
    const out: CalEvent[] = [];
    await Promise.all(cals.map(async (c) => {
      const q = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', timeMin: from.toISOString(), timeMax: to.toISOString(), maxResults: '250' });
      let ev: any;
      try { ev = await get(`${API}/calendars/${encodeURIComponent(c.id)}/events?${q}`); } catch { return; }
      for (const e of (ev.items ?? []) as any[]) {
        if (e.status === 'cancelled') continue;
        const allDay = !!e.start?.date;
        const video = (e.conferenceData?.entryPoints ?? []).find((p: any) => p.entryPointType === 'video')?.uri ?? null;
        out.push({
          id: `g${a.id}:${c.id}:${e.id}`, source: 'google', accountId: a.id, accountEmail: a.email, color: a.color,
          calendarName: c.summaryOverride ?? c.summary ?? a.email, title: e.summary || '(No title)',
          start: allDay ? e.start.date : e.start?.dateTime, end: allDay ? e.end?.date : e.end?.dateTime ?? e.start?.dateTime, allDay,
          location: e.location ?? null, meetLink: e.hangoutLink ?? video, htmlLink: e.htmlLink ?? null,
          attendees: Array.isArray(e.attendees) ? e.attendees.length : 0, status: e.status ?? 'confirmed',
        });
      }
    }));
    this.cache.set(ck, { at: Date.now(), events: out });
    if (this.cache.size > 200) this.cache.delete(this.cache.keys().next().value!);
    return out;
  }

  async events(userId: number, fromS?: string, toS?: string) {
    await this.assertAdmin(userId);
    const from = new Date(fromS ?? ''), to = new Date(toS ?? '');
    if (isNaN(+from) || isNaN(+to) || to <= from) throw new BadRequestException('Give a date range.');
    if (+to - +from > 100 * 86_400_000) throw new BadRequestException('Ask for 100 days or less at a time.');
    const [accounts, meetings] = await Promise.all([
      this.cfg ? this.prisma.calendarAccount.findMany({ where: { userId, enabled: true } }) : Promise.resolve([]),
      this.prisma.ceoMeeting.findMany({ where: { cancelledAt: null, scheduledAt: { gte: from, lt: to }, OR: [{ createdById: userId }, { attendees: { some: { userId } } }] }, include: { _count: { select: { attendees: true } } }, take: 300 }),
    ]);
    const errors: { accountId: number; email: string; reconnect: boolean }[] = [];
    const lists = await Promise.all(accounts.map((a) => this.accountEvents(a, from, to).catch((e: any) => { errors.push({ accountId: a.id, email: a.email, reconnect: e?.message === 'reconnect' }); return [] as CalEvent[]; })));
    const ez: CalEvent[] = meetings.map((m) => ({
      id: `ez${m.id}`, source: 'ezmanage', accountId: null, accountEmail: null, color: '#b08d57', calendarName: 'Executive Hub meetings',
      title: m.title, start: m.scheduledAt.toISOString(), end: new Date(+m.scheduledAt + 60 * 60_000).toISOString(), allDay: false,
      location: null, meetLink: m.meetingLink, htmlLink: null, attendees: m._count.attendees, status: 'confirmed',
    }));
    const events = [...lists.flat(), ...ez].sort((a, b) => a.start.localeCompare(b.start));
    return { configured: !!this.cfg, events, errors };
  }

  // ---------- writing events (meetings) ----------

  /** Is a Google account connected that we can write to? (configured app + at least one enabled account) */
  async hasGoogle(userId: number) {
    if (!this.cfg) return { configured: false, connected: false };
    const connected = await this.prisma.calendarAccount.count({ where: { userId, provider: 'google', enabled: true } });
    return { configured: true, connected: connected > 0 };
  }

  /**
   * Create an event on the person's primary Google Calendar, optionally with a Google Meet link.
   * Returns null if they have no connected Google account; throws Error('reconnect') if the stored
   * token lacks write access (the person connected before we asked for calendar.events).
   */
  async createMeetingEvent(userId: number, o: { title: string; description?: string | null; start: Date; end: Date; attendeeEmails: string[]; addMeet: boolean }): Promise<{ accountId: number; eventId: string; meetLink: string | null; htmlLink: string | null } | null> {
    if (!this.cfg) return null;
    const account = await this.prisma.calendarAccount.findFirst({ where: { userId, provider: 'google', enabled: true }, orderBy: { createdAt: 'asc' } });
    if (!account) return null;
    const tok = await this.token(account);
    const body: any = {
      summary: o.title,
      description: o.description || undefined,
      start: { dateTime: o.start.toISOString() },
      end: { dateTime: o.end.toISOString() },
      attendees: [...new Set(o.attendeeEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))].map((email) => ({ email })),
    };
    if (o.addMeet) body.conferenceData = { createRequest: { requestId: `ezm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } };
    const r = await fetch(`${API}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (r.status === 401 || r.status === 403) throw new Error('reconnect');
    if (!r.ok) { this.log.warn(`Google event create failed (${r.status})`); return null; }
    const ev: any = await r.json().catch(() => ({}));
    const meetLink = ev.hangoutLink ?? (ev.conferenceData?.entryPoints ?? []).find((p: any) => p.entryPointType === 'video')?.uri ?? null;
    this.dropCache();
    return { accountId: account.id, eventId: ev.id, meetLink, htmlLink: ev.htmlLink ?? null };
  }

  /** Update a previously-created meeting event (reschedule / attendee change). */
  async patchMeetingEvent(accountId: number, eventId: string, o: { title?: string; description?: string | null; start?: Date; end?: Date; attendeeEmails?: string[] }): Promise<boolean> {
    if (!this.cfg) return false;
    const account = await this.prisma.calendarAccount.findFirst({ where: { id: accountId, provider: 'google' } });
    if (!account) return false;
    const tok = await this.token(account).catch(() => null);
    if (!tok) return false;
    const body: any = {};
    if (o.title !== undefined) body.summary = o.title;
    if (o.description !== undefined) body.description = o.description || '';
    if (o.start) body.start = { dateTime: o.start.toISOString() };
    if (o.end) body.end = { dateTime: o.end.toISOString() };
    if (o.attendeeEmails) body.attendees = [...new Set(o.attendeeEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))].map((email) => ({ email }));
    const r = await fetch(`${API}/calendars/primary/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1&sendUpdates=all`, { method: 'PATCH', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    this.dropCache();
    return r.ok;
  }

  /** Remove a meeting event from Google (on cancel). 410 = already gone, treat as success. */
  async deleteMeetingEvent(accountId: number, eventId: string): Promise<boolean> {
    if (!this.cfg) return false;
    const account = await this.prisma.calendarAccount.findFirst({ where: { id: accountId, provider: 'google' } });
    if (!account) return false;
    const tok = await this.token(account).catch(() => null);
    if (!tok) return false;
    const r = await fetch(`${API}/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`, { method: 'DELETE', headers: { authorization: `Bearer ${tok}` } });
    this.dropCache();
    return r.ok || r.status === 410;
  }
}
