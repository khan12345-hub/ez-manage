import { Prisma } from 'generated/prisma/client';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomBytes } from 'crypto';
import { PrismaService } from 'prisma/prisma.service';
import { STORAGE_SERVICE } from 'src/storage/storage.module';
import type { StorageProvider } from 'src/storage/storage.types';
import { hashToken, type TrackerDeviceCaller } from './tracker.guard';
import { NotificationsService } from 'src/notifications/notifications.service';
import { ProductAdminService } from 'src/access/product-admin.service';

/** the consent text version; bump when the wording on the desktop consent screen changes */
export const CONSENT_VERSION = '2026-11-19.2';

export type TrackerSettings = {
  screenshotsPer10: number; blur: boolean; trackApps: boolean; trackUrls: boolean; idleMinutes: number;
  retentionDays: number; dayStart: string;
};
export const DEFAULT_SETTINGS: TrackerSettings = {
  screenshotsPer10: 1, blur: false, trackApps: true, trackUrls: false, idleMinutes: 15,
  retentionDays: 60, dayStart: '09:00',
};

const SLOT_MS = 10 * 60_000;
const STALE_MS = 15 * 60_000; // no heartbeat for 15 min: the session counts as stopped
const SHOT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SHOT = 3 * 1024 * 1024;
const RETENTION = new Set([0, 30, 60, 90, 180]);

export type Src = 'work' | 'boards' | 'org';
type Ctx = { orgId: number; source: Src; workspaceId: number; userId: number; role: string; isManager: boolean; isSystemAdmin: boolean; member: { role: string; tracking: boolean } | null };
type TaskRef = { id: number; uid: string | null; name: string; source: Src; boardUid?: string | null };
const BOARDS_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;
/** route key of a company: "w-<uid>" (Company Work) or "b-<uid>" (Accounts & Invoices); a bare uid is an old Work link */
export const companyKey = (source: Src, uid: string) => `${source === 'boards' ? 'b' : 'w'}-${uid}`;
const iso = (v: unknown, name: string) => { const d = new Date(String(v ?? '')); if (isNaN(+d)) throw new BadRequestException(`${name} is not a date.`); return d; };
const int = (v: unknown, min: number, max: number, def = 0) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def; };
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const cid = (v: unknown, name = 'clientId') => { const s = str(v, 64); if (!/^[A-Za-z0-9_-]{6,64}$/.test(s)) throw new BadRequestException(`${name} is missing.`); return s; };

/** image check by magic bytes (the mimetype header alone can lie) */
function sniff(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

/**
 * EZ Tracker: time, screenshots and activity from the desktop app, for a company in Company Work
 * or in Accounts & Invoices. EZ Tracker has its OWN people per company (TrackerMember): being in
 * the company is required but not enough — a Tracker admin or the system Administrator adds you.
 * Members see only their own data; Tracker admins and the Administrator see the team. Product
 * roles (company owner / admin) do not carry over. Activity is counts only — what was typed is
 * never sent.
 */
@Injectable()
export class TrackerService {
  private readonly log = new Logger('Tracker');
  constructor(private readonly prisma: PrismaService, @Inject(STORAGE_SERVICE) private readonly storage: StorageProvider, private readonly notifications: NotificationsService, private readonly productAdmin: ProductAdminService) {}

  // ───────────── access ─────────────

  settingsOf(raw: unknown): TrackerSettings {
    const s = { ...DEFAULT_SETTINGS, ...((raw && typeof raw === 'object' ? raw : {}) as Partial<TrackerSettings>) };
    return {
      screenshotsPer10: int(s.screenshotsPer10, 0, 3, 1), blur: !!s.blur, trackApps: !!s.trackApps, trackUrls: !!s.trackUrls,
      idleMinutes: int(s.idleMinutes, 1, 60, 15), retentionDays: RETENTION.has(Number(s.retentionDays)) ? Number(s.retentionDays) : 60,
      dayStart: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s.dayStart)) ? String(s.dayStart) : '09:00',
    };
  }

  /** EZ Tracker is one organization-wide tracker: a single org row (source 'org', workspaceId 0). */
  private async ensureOrg() {
    return this.prisma.trackerOrg.upsert({ where: { source_workspaceId: { source: 'org', workspaceId: 0 } }, update: {}, create: { source: 'org', workspaceId: 0, settings: DEFAULT_SETTINGS as any } });
  }

  private async isSystemAdmin(userId: number) {
    return (await this.prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } }))?.systemRole === 'SUPER_ADMIN';
  }
  /** EZ Tracker manager: the system Administrator, an EZ Tracker product Administrator, or a Tracker admin */
  private async isManagerOf(orgId: number, userId: number) {
    if (await this.isSystemAdmin(userId)) return true;
    if (await this.productAdmin.is(userId, 'tracker')) return true;
    return (await this.prisma.trackerMember.findUnique({ where: { orgId_userId: { orgId, userId } }, select: { role: true } }))?.role === 'admin';
  }
  /** everyone in EZ Tracker */
  private async trackerIds(orgId: number) {
    return (await this.prisma.trackerMember.findMany({ where: { orgId }, select: { userId: true } })).map((m) => m.userId);
  }

  /**
   * The caller's place in EZ Tracker (the single org). Tracker members and the system
   * Administrator get in; everyone else: 404. The `ws` route param is ignored (one org).
   */
  async ctx(_ws: string, userId: number): Promise<Ctx> {
    const org = await this.ensureOrg();
    const sys = await this.isSystemAdmin(userId);
    const prodAdmin = sys ? false : await this.productAdmin.is(userId, 'tracker');
    const m = await this.prisma.trackerMember.findUnique({ where: { orgId_userId: { orgId: org.id, userId } }, select: { role: true, tracking: true } });
    if (!m && !sys && !prodAdmin) throw new NotFoundException('EZ Tracker is not set up for you.');
    const member = m ?? null;
    const isManager = sys || prodAdmin || member?.role === 'admin';
    return { orgId: org.id, source: 'org', workspaceId: 0, userId, role: member?.role ?? 'administrator', isManager, isSystemAdmin: sys, member };
  }

  /** who this person may see: everyone (manager) or only themself */
  private async visibleIds(c: Ctx) {
    if (c.isManager) return this.trackerIds(c.orgId);
    return [c.userId];
  }
  private async canSee(c: Ctx, userId: number) {
    if (userId === c.userId) return true;
    if (!c.isManager) return false;
    return !!(await this.prisma.trackerMember.findUnique({ where: { orgId_userId: { orgId: c.orgId, userId } }, select: { id: true } }));
  }
  private needManager(c: Ctx) {
    if (!c.isManager) throw new ForbiddenException('Only Tracker admins and the Administrator can do this.');
  }
  private needMember(c: Ctx) {
    if (!c.member) throw new ForbiddenException('You are not in EZ Tracker. A Tracker admin can add you.');
  }

  /** names of the tasks older sessions were on (new sessions carry no task) */
  private async taskMap(rows: { taskId: number | null; taskSource: string | null }[]) {
    const work = [...new Set(rows.filter((r) => r.taskId && r.taskSource !== 'boards').map((r) => r.taskId!))];
    const boards = [...new Set(rows.filter((r) => r.taskId && r.taskSource === 'boards').map((r) => r.taskId!))];
    const out = new Map<string, TaskRef>();
    if (work.length) for (const t of await this.prisma.workTask.findMany({ where: { id: { in: work } }, select: { id: true, uid: true, name: true } })) out.set(`work:${t.id}`, { ...t, source: 'work' });
    if (boards.length) for (const t of await this.prisma.task.findMany({ where: { id: { in: boards } }, select: { id: true, name: true, group: { select: { board: { select: { uid: true } } } } } })) out.set(`boards:${t.id}`, { id: t.id, uid: null, name: t.name, source: 'boards', boardUid: t.group.board.uid });
    return (taskId: number | null, taskSource: string | null) => (taskId ? out.get(`${taskSource === 'boards' ? 'boards' : 'work'}:${taskId}`) ?? null : null);
  }
  private async people(ids: number[]) {
    const us = await this.prisma.user.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } });
    return new Map(us.map((u) => [u.id, u]));
  }

  // ───────────── web: workspaces, overview, settings ─────────────

  /** one entry: the organization. `manager` = the caller sees everyone (Tracker admin / Administrator). */
  async workspaces(userId: number) {
    const org = await this.ensureOrg();
    const sys = await this.isSystemAdmin(userId);
    const m = await this.prisma.trackerMember.findUnique({ where: { orgId_userId: { orgId: org.id, userId } }, select: { role: true } });
    if (!m && !sys) return [];
    return [{ id: 0, uid: 'org', name: 'Organization', color: '#0369a1', role: m?.role ?? null, source: 'org' as Src, key: 'org', manager: sys || m?.role === 'admin' }];
  }

  async overview(ws: string, userId: number) {
    const c = await this.ctx(ws, userId);
    const org = await this.prisma.trackerOrg.findUniqueOrThrow({ where: { id: c.orgId } });
    const settings = this.settingsOf(org.settings);
    const consent = await this.prisma.trackerConsent.findUnique({ where: { orgId_userId_version: { orgId: c.orgId, userId, version: CONSENT_VERSION } }, select: { acceptedAt: true } });
    const devices = await this.prisma.trackerDevice.count({ where: { userId, orgId: c.orgId, revokedAt: null } });
    return {
      workspace: { uid: 'org', name: 'Organization', color: '#0369a1', source: 'org' as Src, key: 'org' },
      role: c.role, isManager: c.isManager, isSystemAdmin: c.isSystemAdmin, member: !!c.member, canSeeOthers: c.isManager,
      settings, tracked: !!c.member?.tracking, consent: { version: CONSENT_VERSION, acceptedAt: consent?.acceptedAt ?? null }, devices,
    };
  }

  async updateSettings(ws: string, userId: number, b: any) {
    const c = await this.ctx(ws, userId);
    this.needManager(c);
    const org = await this.prisma.trackerOrg.findUniqueOrThrow({ where: { id: c.orgId } });
    const cur = this.settingsOf(org.settings);
    const next = this.settingsOf({ ...cur, ...(b && typeof b === 'object' ? b : {}) });
    if (b?.retentionDays !== undefined && !RETENTION.has(Number(b.retentionDays))) throw new BadRequestException('Keep screenshots for 30, 60, 90 or 180 days, or forever.');
    await this.prisma.trackerOrg.update({ where: { id: c.orgId }, data: { settings: next as any } });
    return next;
  }

  /** consent from the web (the desktop app asks too) */
  async acceptConsent(ws: string, userId: number, version: string, ip?: string, ua?: string) {
    const c = await this.ctx(ws, userId);
    return this.consent(c.orgId, userId, version, ip, ua);
  }
  private async consent(orgId: number, userId: number, version: string, ip?: string, ua?: string) {
    if (version !== CONSENT_VERSION) throw new BadRequestException('Please read the latest consent text and agree again.');
    const row = await this.prisma.trackerConsent.upsert({
      where: { orgId_userId_version: { orgId, userId, version } }, update: {},
      create: { orgId, userId, version, ip: ip?.slice(0, 64) ?? null, userAgent: ua?.slice(0, 300) ?? null },
    });
    return { version: row.version, acceptedAt: row.acceptedAt };
  }

  // ───────────── web: pairing + devices ─────────────

  async pairCode(ws: string, userId: number) {
    const c = await this.ctx(ws, userId);
    this.needMember(c);
    const raw = randomBytes(5).toString('hex').toUpperCase().replace(/[01OI]/g, 'X').slice(0, 8);
    const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    await this.prisma.trackerPairCode.deleteMany({ where: { userId, OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] } });
    await this.prisma.trackerPairCode.create({ data: { orgId: c.orgId, userId, codeHash: hashToken(code.replace('-', '')), expiresAt } });
    return { code, expiresAt };
  }

  /** desktop exchanges a pairing code for its own token (shown once, only the hash is kept) */
  async pair(b: any) {
    const code = str(b?.code, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 8) throw new BadRequestException('Enter the 8-character code from EZ Tracker on the web.');
    const row = await this.prisma.trackerPairCode.findUnique({ where: { codeHash: hashToken(code) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) throw new BadRequestException('This code is wrong or expired. Make a new one on the web.');
    if (!(await this.prisma.trackerMember.findUnique({ where: { orgId_userId: { orgId: row.orgId, userId: row.userId } }, select: { id: true } }))) throw new ForbiddenException('You are not in EZ Tracker anymore.');
    await this.prisma.trackerPairCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    const token = `ezt_${randomBytes(36).toString('base64url')}`;
    const d = await this.prisma.trackerDevice.create({
      data: { orgId: row.orgId, userId: row.userId, name: str(b?.name, 80) || 'Computer', os: str(b?.os, 40) || null, appVersion: str(b?.appVersion, 20) || null, tokenHash: hashToken(token), lastSeenAt: new Date() },
    });
    return { token, deviceId: d.id, ...(await this.desktopMe({ userId: row.userId, deviceId: d.id, orgId: row.orgId })) };
  }

  /**
   * Auto-connect ("connect with my account"): the desktop makes a secret nonce, opens the web signed
   * in as the person, who confirms — the browser registers that nonce for their account. The desktop
   * then exchanges the same nonce for its token. No code to type.
   */
  async connectStart(userId: number, nonce: string) {
    const n = str(nonce, 200).replace(/[^A-Za-z0-9_-]/g, '');
    if (n.length < 20) throw new BadRequestException('Open EZ Tracker on this computer and press “Connect with my account” — this link is incomplete.');
    const org = await this.ensureOrg();
    const member = await this.prisma.trackerMember.findUnique({ where: { orgId_userId: { orgId: org.id, userId } }, select: { id: true } });
    if (!member) throw new ForbiddenException('You are not in EZ Tracker.');
    await this.prisma.trackerPairCode.deleteMany({ where: { userId, OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] } });
    await this.prisma.trackerPairCode.create({ data: { orgId: org.id, userId, codeHash: hashToken(n), expiresAt: new Date(Date.now() + 10 * 60_000) } });
    return { ok: true };
  }

  /** Public: where the desktop should send the person to confirm an auto-connect. */
  publicConfig() { return { webUrl: process.env.FRONTEND_URL ?? null }; }

  // ───────── zero-touch deployment codes (ezd_…) ─────────

  /** manager: list the deploy codes for a company's people (status only — the code is shown once) */
  async deployCodes(ws: string, userId: number) {
    const c = await this.ctx(ws, userId);
    this.needManager(c);
    const rows = await this.prisma.trackerDeployCode.findMany({ where: { orgId: c.orgId, revokedAt: null }, orderBy: { createdAt: 'desc' } });
    const ids = [...new Set(rows.map((r) => r.userId).filter((x): x is number => x != null))];
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } });
    // user null = an organisation token (assign devices later)
    return rows.map((r) => ({ id: r.id, org: r.userId == null, user: r.userId == null ? null : users.find((u) => u.id === r.userId) ?? null, lastUsedAt: r.lastUsedAt, createdAt: r.createdAt }));
  }

  /**
   * manager: make a long-lived, revocable deploy code and bake it into an installer.
   *  - with a userId  → per-person: devices connect straight to that person
   *  - without one    → an ORGANISATION token: devices enrol unassigned, an admin assigns them later
   */
  async createDeployCode(ws: string, userId: number, b: any) {
    const c = await this.ctx(ws, userId);
    this.needManager(c);
    const hasTarget = b?.userId !== undefined && b?.userId !== null && b?.userId !== '';
    let target: number | null = null;
    if (hasTarget) {
      target = Number(b.userId);
      if (!Number.isInteger(target) || target <= 0) throw new BadRequestException('Pick a person.');
      if (!(await this.prisma.trackerMember.findUnique({ where: { orgId_userId: { orgId: c.orgId, userId: target } }, select: { id: true } }))) throw new BadRequestException('Add them to EZ Tracker first.');
    }
    const code = `ezd_${randomBytes(24).toString('base64url')}`;
    await this.prisma.trackerDeployCode.create({ data: { orgId: c.orgId, userId: target, codeHash: hashToken(code), createdById: c.userId } });
    return { code };
  }

  async revokeDeployCode(ws: string, userId: number, id: number) {
    const c = await this.ctx(ws, userId);
    this.needManager(c);
    await this.prisma.trackerDeployCode.updateMany({ where: { id, orgId: c.orgId, revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  /** Public: a silent-deployed desktop exchanges its baked deploy code for that person's device token. */
  async deployExchange(b: any) {
    const code = str(b?.code, 120).trim();
    if (!/^ezd_[A-Za-z0-9_-]{20,80}$/.test(code)) throw new BadRequestException('Bad deploy code.');
    const row = await this.prisma.trackerDeployCode.findUnique({ where: { codeHash: hashToken(code) } });
    if (!row || row.revokedAt) throw new ForbiddenException('This deploy code is not valid anymore.');
    // per-person code: the person must still be a member. Org token (userId null): device enrols unassigned.
    if (row.userId != null && !(await this.prisma.trackerMember.findUnique({ where: { orgId_userId: { orgId: row.orgId, userId: row.userId } }, select: { id: true } }))) throw new ForbiddenException('That person is not in EZ Tracker anymore.');
    await this.prisma.trackerDeployCode.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
    const token = `ezt_${randomBytes(36).toString('base64url')}`;
    const d = await this.prisma.trackerDevice.create({
      data: { orgId: row.orgId, userId: row.userId, name: str(b?.name, 80) || 'Computer', os: str(b?.os, 40) || null, appVersion: str(b?.appVersion, 20) || null, tokenHash: hashToken(token), lastSeenAt: new Date() },
    });
    return { token, deviceId: d.id, ...(await this.desktopMe({ userId: row.userId, deviceId: d.id, orgId: row.orgId })) };
  }

  /** manager: computers enrolled with an org token but not yet assigned to a person */
  async unassignedDevices(ws: string, userId: number) {
    const c = await this.ctx(ws, userId);
    this.needManager(c);
    return this.prisma.trackerDevice.findMany({
      where: { orgId: c.orgId, userId: null, revokedAt: null },
      select: { id: true, name: true, os: true, appVersion: true, lastSeenAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** manager: assign an enrolled computer to a person (it starts tracking them within a minute) */
  async assignDevice(ws: string, userId: number, deviceId: number, b: any) {
    const c = await this.ctx(ws, userId);
    this.needManager(c);
    const target = Number(b?.userId);
    if (!Number.isInteger(target) || target <= 0) throw new BadRequestException('Pick a person.');
    if (!(await this.prisma.trackerMember.findUnique({ where: { orgId_userId: { orgId: c.orgId, userId: target } }, select: { id: true } }))) throw new BadRequestException('Add them to EZ Tracker first.');
    const dev = await this.prisma.trackerDevice.findFirst({ where: { id: deviceId, orgId: c.orgId, revokedAt: null }, select: { id: true, userId: true } });
    if (!dev) throw new NotFoundException('Computer not found.');
    await this.prisma.trackerDevice.update({ where: { id: dev.id }, data: { userId: target, assignedById: c.userId, assignedAt: new Date() } });
    return { ok: true };
  }

  async connectExchange(b: any) {
    const n = str(b?.nonce, 200).replace(/[^A-Za-z0-9_-]/g, '');
    if (n.length < 20) throw new BadRequestException('Bad connect code.');
    const row = await this.prisma.trackerPairCode.findUnique({ where: { codeHash: hashToken(n) } });
    if (!row) return { pending: true as const };               // the person hasn't confirmed in the browser yet
    if (row.usedAt || row.expiresAt < new Date()) throw new BadRequestException('This connect link expired. Try again from the app.');
    if (!(await this.prisma.trackerMember.findUnique({ where: { orgId_userId: { orgId: row.orgId, userId: row.userId } }, select: { id: true } }))) throw new ForbiddenException('You are not in EZ Tracker anymore.');
    await this.prisma.trackerPairCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    const token = `ezt_${randomBytes(36).toString('base64url')}`;
    const d = await this.prisma.trackerDevice.create({
      data: { orgId: row.orgId, userId: row.userId, name: str(b?.name, 80) || 'Computer', os: str(b?.os, 40) || null, appVersion: str(b?.appVersion, 20) || null, tokenHash: hashToken(token), lastSeenAt: new Date() },
    });
    return { token, deviceId: d.id, ...(await this.desktopMe({ userId: row.userId, deviceId: d.id, orgId: row.orgId })) };
  }

  async devices(ws: string, userId: number) {
    const c = await this.ctx(ws, userId);
    return this.prisma.trackerDevice.findMany({ where: { userId, orgId: c.orgId, revokedAt: null }, select: { id: true, name: true, os: true, appVersion: true, lastSeenAt: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
  }
  async revokeDevice(id: number, userId: number) {
    const d = await this.prisma.trackerDevice.findUnique({ where: { id }, select: { userId: true, revokedAt: true } });
    if (!d || d.userId !== userId) throw new NotFoundException('Device not found.');
    if (!d.revokedAt) await this.prisma.trackerDevice.update({ where: { id }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  // ───────────── desktop ─────────────

  async desktopMe(d: TrackerDeviceCaller) {
    const org = await this.prisma.trackerOrg.findUniqueOrThrow({ where: { id: d.orgId } });
    const settings = this.settingsOf(org.settings);
    // enrolled with an org token but not assigned to a person yet: the app waits (no user, not tracked)
    if (d.userId == null) {
      return {
        user: null, workspace: { uid: 'org', name: 'Organization', source: 'org', key: 'org' }, member: false, pending: true as const,
        settings: { screenshotsPer10: settings.screenshotsPer10, blur: settings.blur, trackApps: settings.trackApps, trackUrls: settings.trackUrls, idleMinutes: settings.idleMinutes },
        tracked: false, consent: { version: CONSENT_VERSION, acceptedAt: null }, today: 0, openSession: null, webUrl: process.env.FRONTEND_URL ?? null,
      };
    }
    const member = await this.prisma.trackerMember.findUnique({ where: { orgId_userId: { orgId: d.orgId, userId: d.userId } }, select: { role: true, tracking: true } });
    const u = await this.prisma.user.findUnique({ where: { id: d.userId }, select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } });
    const consent = await this.prisma.trackerConsent.findUnique({ where: { orgId_userId_version: { orgId: d.orgId, userId: d.userId, version: CONSENT_VERSION } }, select: { acceptedAt: true } });
    const open = await this.prisma.trackerSession.findFirst({ where: { userId: d.userId, orgId: d.orgId, endedAt: null }, orderBy: { startedAt: 'desc' }, select: { id: true, startedAt: true, note: true } });
    return {
      user: u, workspace: { uid: 'org', name: 'Organization', source: 'org', key: 'org' }, member: !!member,
      settings: { screenshotsPer10: settings.screenshotsPer10, blur: settings.blur, trackApps: settings.trackApps, trackUrls: settings.trackUrls, idleMinutes: settings.idleMinutes },
      tracked: !!member?.tracking, consent: { version: CONSENT_VERSION, acceptedAt: consent?.acceptedAt ?? null },
      today: await this.todaySeconds(d.orgId, d.userId), openSession: open,
      webUrl: process.env.FRONTEND_URL ?? null,
    };
  }

  /** a device that hasn't been assigned to a person yet can't record — only poll /me */
  private need(d: TrackerDeviceCaller): number {
    if (d.userId == null) throw new ForbiddenException('This computer is waiting to be assigned to a person in EZ Tracker on the web.');
    return d.userId;
  }

  async desktopConsent(d: TrackerDeviceCaller, version: string, ip?: string, ua?: string) { return this.consent(d.orgId, this.need(d), version, ip, ua); }

  /** can this device record right now? (still a Tracker member here, tracking on for them, agreed to the current text) */
  private async mayTrack(d: TrackerDeviceCaller) {
    const uid = this.need(d);
    const org = await this.prisma.trackerOrg.findUniqueOrThrow({ where: { id: d.orgId } });
    const member = await this.prisma.trackerMember.findUnique({ where: { orgId_userId: { orgId: d.orgId, userId: uid } }, select: { tracking: true } });
    if (!member) throw new ForbiddenException('You are not in EZ Tracker anymore.');
    const settings = this.settingsOf(org.settings);
    if (!member.tracking) throw new ForbiddenException('Time tracking is paused for you.');
    const ok = await this.prisma.trackerConsent.findUnique({ where: { orgId_userId_version: { orgId: d.orgId, userId: uid, version: CONSENT_VERSION } }, select: { id: true } });
    if (!ok) throw new ForbiddenException('Please read and accept what EZ Tracker records before you start.');
    return { org, settings };
  }

  /** no task picker anymore — EZ Tracker is a system tracker (task timing lives in Company Work) */
  async desktopTasks(_d: TrackerDeviceCaller, _q: string): Promise<[]> { return []; }
  private async checkTask(source: Src, workspaceId: number, taskId: number) {
    if (source === 'boards') {
      const t = await this.prisma.task.findFirst({ where: { id: taskId, group: { board: { workspaceId } } }, select: { id: true } });
      if (!t) throw new BadRequestException('That item is not in this workspace.');
      return t.id;
    }
    const t = await this.prisma.workTask.findFirst({ where: { id: taskId, archivedAt: null, list: { space: { workspaceId } } }, select: { id: true } });
    if (!t) throw new BadRequestException('That task is not in this workspace.');
    return t.id;
  }

  async start(d: TrackerDeviceCaller, b: any) {
    const uid = this.need(d);
    await this.mayTrack(d);
    const clientId = cid(b?.clientId);
    const existing = await this.prisma.trackerSession.findUnique({ where: { userId_clientId: { userId: uid, clientId } } });
    if (existing) return existing; // a retried start
    // system tracker: just time + screenshots + activity, plus an optional free-text note.
    // a fresh online start sends no time (the server stamps it); a queued / offline start sends when it
    // really began. Clamp a future PC-clock time to now; reject only a genuinely old queued start.
    const now = Date.now();
    let startedAt = b?.startedAt ? iso(b.startedAt, 'startedAt') : new Date();
    if (startedAt.getTime() > now) startedAt = new Date(now);
    if (startedAt.getTime() < now - 7 * 86_400_000) throw new BadRequestException('That start time is too old to record.');
    const open = await this.prisma.trackerSession.findMany({ where: { userId: uid, endedAt: null } });
    for (const o of open) await this.finish(o.id, o.lastBeatAt ?? startedAt);
    return this.prisma.trackerSession.create({
      data: { orgId: d.orgId, userId: uid, deviceId: d.deviceId, clientId, note: str(b?.note, 500) || str(b?.projectLabel, 120) || null, startedAt, lastBeatAt: new Date() },
    });
  }

  private async ownSession(d: TrackerDeviceCaller, id: number) {
    const s = await this.prisma.trackerSession.findUnique({ where: { id } });
    if (!s || s.userId !== this.need(d) || s.orgId !== d.orgId) throw new NotFoundException('Session not found.');
    return s;
  }

  async stop(d: TrackerDeviceCaller, id: number, b: any) {
    const s = await this.ownSession(d, id);
    if (s.endedAt) return s;
    const endedAt = b?.endedAt ? iso(b.endedAt, 'endedAt') : new Date();
    return this.finish(s.id, endedAt < s.startedAt ? s.startedAt : endedAt);
  }

  async heartbeat(d: TrackerDeviceCaller, id: number) {
    const s = await this.ownSession(d, id);
    if (s.endedAt) return { ended: true };
    await this.prisma.trackerSession.update({ where: { id }, data: { lastBeatAt: new Date() } });
    return { ended: false };
  }

  /** close a session and write its tracked time into its product (when it was on a task / item) */
  private async finish(id: number, endedAt: Date) {
    const s = await this.prisma.trackerSession.update({ where: { id }, data: { endedAt } });
    await this.syncTime(id).catch((e) => this.log.warn(`time sync ${id}: ${e?.message}`));
    return s;
  }

  /** tracked seconds = slots that are kept (not discarded as idle, not deleted with their screenshot) */
  private async trackedSeconds(sessionId: number) {
    const r = await this.prisma.trackerSlot.aggregate({ where: { sessionId, deletedAt: null, idleDiscarded: false }, _sum: { seconds: true } });
    return r._sum.seconds ?? 0;
  }

  /**
   * Product link: one time entry per finished session on a task, kept in step with the tracked
   * seconds — a WorkTimeEntry (Company Work timesheets) or a Boards TimeEntry (Accounts & Invoices
   * item time tracking).
   */
  private async syncTime(sessionId: number) {
    const s = await this.prisma.trackerSession.findUnique({ where: { id: sessionId } });
    if (!s || !s.taskId || !s.endedAt) return;
    const secs = await this.trackedSeconds(sessionId);
    const end = new Date(s.startedAt.getTime() + secs * 1000);
    if (s.taskSource === 'boards') {
      if (s.boardsTimeEntryId) {
        const e = await this.prisma.timeEntry.findUnique({ where: { id: s.boardsTimeEntryId }, select: { id: true } });
        if (e) {
          if (secs <= 0) { await this.prisma.timeEntry.delete({ where: { id: e.id } }); await this.prisma.trackerSession.update({ where: { id: s.id }, data: { boardsTimeEntryId: null } }); }
          else await this.prisma.timeEntry.update({ where: { id: e.id }, data: { durationMs: secs * 1000, endedAt: end } });
          return;
        }
      }
      if (secs <= 0) return;
      const t = await this.prisma.task.findUnique({ where: { id: s.taskId }, select: { id: true, group: { select: { boardId: true } } } });
      if (!t) return;
      const e = await this.prisma.timeEntry.create({ data: { taskId: t.id, boardId: t.group.boardId, userId: s.userId, startedAt: s.startedAt, endedAt: end, durationMs: secs * 1000, note: 'EZ Tracker' } });
      await this.prisma.trackerSession.update({ where: { id: s.id }, data: { boardsTimeEntryId: e.id } });
      return;
    }
    if (s.workTimeEntryId) {
      const e = await this.prisma.workTimeEntry.findUnique({ where: { id: s.workTimeEntryId }, select: { id: true } });
      if (e) {
        if (secs <= 0) { await this.prisma.workTimeEntry.delete({ where: { id: e.id } }); await this.prisma.trackerSession.update({ where: { id: s.id }, data: { workTimeEntryId: null } }); }
        else await this.prisma.workTimeEntry.update({ where: { id: e.id }, data: { duration: secs, endedAt: end } });
        return;
      }
    }
    if (secs <= 0) return;
    const e = await this.prisma.workTimeEntry.create({ data: { taskId: s.taskId, userId: s.userId, startedAt: s.startedAt, endedAt: end, duration: secs, note: 'EZ Tracker' } });
    await this.prisma.trackerSession.update({ where: { id: s.id }, data: { workTimeEntryId: e.id } });
  }

  /** slots arrive in batches (the app keeps them on disk while offline); a re-sent slot is ignored */
  async slots(d: TrackerDeviceCaller, b: any) {
    const uid = this.need(d);
    const { settings } = await this.mayTrack(d);
    const s = await this.ownSession(d, Number(b?.sessionId));
    const list: any[] = Array.isArray(b?.slots) ? b.slots.slice(0, 200) : [];
    if (!list.length) throw new BadRequestException('No slots sent.');
    let saved = 0, skipped = 0;
    for (const x of list) {
      const clientId = cid(x?.clientId);
      const dup = await this.prisma.trackerSlot.findUnique({ where: { userId_clientId: { userId: uid, clientId } }, select: { id: true } });
      if (dup) { skipped++; continue; }
      const start = iso(x?.start, 'slot start');
      const aligned = new Date(Math.floor(start.getTime() / SLOT_MS) * SLOT_MS);
      // tolerate a PC clock ahead of the server by up to one slot (the slot start is aligned to the PC clock)
      if (aligned.getTime() < s.startedAt.getTime() - SLOT_MS || aligned.getTime() > Date.now() + SLOT_MS) throw new BadRequestException('A slot is outside its session.');
      const seconds = int(x?.seconds, 0, 600);
      const active = int(x?.activeSeconds, 0, seconds);
      const apps: any[] = settings.trackApps && Array.isArray(x?.apps) ? x.apps.slice(0, 30) : [];
      await this.prisma.trackerSlot.create({
        data: {
          sessionId: s.id, orgId: d.orgId, userId: uid, clientId, start: aligned, seconds,
          keyboard: int(x?.keyboard, 0, 100_000), mouse: int(x?.mouse, 0, 100_000),
          activityPct: seconds ? Math.round((active / seconds) * 100) : 0, idleDiscarded: !!x?.idleDiscarded,
          apps: { create: apps.map((a) => ({ orgId: d.orgId, userId: uid, app: str(a?.app, 120) || 'Unknown', title: str(a?.title, 200) || null, url: settings.trackUrls ? str(a?.url, 300) || null : null, seconds: int(a?.seconds, 0, 600) })) },
        },
      });
      saved++;
    }
    if (s.endedAt) await this.syncTime(s.id);
    await this.prisma.trackerSession.update({ where: { id: s.id }, data: { lastBeatAt: s.endedAt ? undefined : new Date() } });
    return { saved, skipped };
  }

  async shot(d: TrackerDeviceCaller, file: Express.Multer.File | undefined, b: any) {
    const uid = this.need(d);
    const { settings } = await this.mayTrack(d);
    if (settings.screenshotsPer10 === 0) throw new ForbiddenException('Screenshots are turned off for this workspace.');
    if (!file?.buffer?.length) throw new BadRequestException('No screenshot received.');
    if (file.size > MAX_SHOT) throw new BadRequestException('A screenshot must be under 3 MB.');
    const type = sniff(file.buffer);
    if (!type || !SHOT_TYPES.has(type)) throw new BadRequestException('A screenshot must be a JPEG, PNG or WebP image.');
    const clientId = cid(b?.clientId);
    const dup = await this.prisma.trackerShot.findUnique({ where: { userId_clientId: { userId: uid, clientId } }, select: { id: true, url: true } });
    if (dup) return dup;
    const slot = await this.prisma.trackerSlot.findUnique({ where: { userId_clientId: { userId: uid, clientId: cid(b?.slotClientId, 'slotClientId') } }, select: { id: true, deletedAt: true } });
    if (!slot) throw new ConflictException('Send the time slot first, then its screenshot.');
    if (slot.deletedAt) throw new BadRequestException('That time was deleted.');
    const up = await this.storage.upload({ ...file, mimetype: type, originalname: `shot-${clientId}.${type.split('/')[1]}` } as Express.Multer.File, `tracker/${d.orgId}/${uid}`);
    const url = this.storage.getUrl(up.storageKey);
    const f = await this.prisma.file.create({ data: { fileName: up.fileName, mimeType: up.mimeType, fileSize: up.fileSize, storageKey: up.storageKey, url, uploadedById: uid } });
    return this.prisma.trackerShot.create({
      data: { slotId: slot.id, orgId: d.orgId, userId: uid, clientId, fileId: f.id, url, takenAt: b?.takenAt ? iso(b.takenAt, 'takenAt') : new Date(), screen: int(b?.screen, 0, 8), blurred: String(b?.blurred) === 'true' || b?.blurred === true },
      select: { id: true, url: true },
    });
  }

  // ───────────── web: views ─────────────

  private async todaySeconds(orgId: number, userId: number) {
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const r = await this.prisma.trackerSlot.aggregate({ where: { orgId, userId, deletedAt: null, idleDiscarded: false, start: { gte: from } }, _sum: { seconds: true } });
    return r._sum.seconds ?? 0;
  }

  /** who is working right now, on what, and today's numbers */
  async live(ws: string, userId: number, offsetMin: number) {
    const c = await this.ctx(ws, userId);
    const ids = await this.visibleIds(c);
    const users = await this.people(ids);
    const now = Date.now();
    const dayStart = this.dayStart(now, offsetMin);
    const [open, slots, shots] = await Promise.all([
      this.prisma.trackerSession.findMany({ where: { orgId: c.orgId, userId: { in: ids }, endedAt: null }, select: { id: true, userId: true, startedAt: true, lastBeatAt: true, taskId: true, taskSource: true, projectLabel: true } }),
      this.prisma.trackerSlot.groupBy({ by: ['userId'], where: { orgId: c.orgId, userId: { in: ids }, deletedAt: null, idleDiscarded: false, start: { gte: new Date(dayStart) } }, _sum: { seconds: true }, _avg: { activityPct: true } }),
      this.prisma.trackerShot.findMany({ where: { orgId: c.orgId, userId: { in: ids }, deletedAt: null, takenAt: { gte: new Date(dayStart) } }, orderBy: { takenAt: 'desc' }, distinct: ['userId'], select: { userId: true, url: true, takenAt: true, blurred: true, hiddenAt: true } }),
    ]);
    const taskOf = await this.taskMap(open);
    // Away ("not on seat") = a running person whose latest 10-minute slots show ~0 keyboard+mouse
    const liveIds = open.filter((o) => o.lastBeatAt && now - o.lastBeatAt.getTime() < STALE_MS).map((o) => o.userId);
    const recent = liveIds.length ? await this.prisma.trackerSlot.findMany({ where: { orgId: c.orgId, userId: { in: liveIds }, deletedAt: null, start: { gte: new Date(now - 60 * 60_000) } }, orderBy: { start: 'desc' }, select: { userId: true, start: true, seconds: true, keyboard: true, mouse: true } }) : [];
    const awaySince = new Map<number, number>();
    for (const uid of liveIds) {
      let since: number | null = null;
      for (const sl of recent.filter((x) => x.userId === uid)) { if (sl.seconds > 0 && sl.keyboard + sl.mouse === 0) since = sl.start.getTime(); else break; }
      if (since !== null) awaySince.set(uid, since);
    }
    const sum = new Map(slots.map((s) => [s.userId, s]));
    const lastShot = new Map(shots.map((s) => [s.userId, s]));
    return ids.filter((id) => users.has(id)).map((id) => {
      const o = open.find((x) => x.userId === id && x.lastBeatAt && now - x.lastBeatAt.getTime() < STALE_MS);
      const shot = lastShot.get(id);
      const hidden = shot?.hiddenAt && id !== c.userId;
      const away = !!o && awaySince.has(id);
      return {
        user: users.get(id), me: id === c.userId,
        status: o ? (away ? 'away' : 'working') : 'offline', since: o?.startedAt ?? null, awaySince: away ? new Date(awaySince.get(id)!) : null,
        task: o ? taskOf(o.taskId, o.taskSource) : null, project: o?.projectLabel ?? null,
        todaySeconds: sum.get(id)?._sum.seconds ?? 0, todayActivity: Math.round(sum.get(id)?._avg.activityPct ?? 0),
        lastShot: shot && !hidden ? { url: shot.url, takenAt: shot.takenAt, blurred: shot.blurred } : null,
      };
    }).sort((a, b) => { const off = (x: string) => (x === 'offline' ? 1 : 0); return off(a.status) - off(b.status) || b.todaySeconds - a.todaySeconds; });
  }

  /** the system Administrator: who is working right now across the organization */
  async liveAll(userId: number, offsetMin: number) {
    if (!(await this.isSystemAdmin(userId))) throw new ForbiddenException('Only the Administrator sees everyone.');
    const rows = await this.live('org', userId, offsetMin);
    return [{ company: { key: 'org', name: 'Organization', source: 'org' as Src, color: '#0369a1' }, working: rows.filter((r) => r.status === 'working'), people: rows.length, todaySeconds: rows.reduce((n, r) => n + r.todaySeconds, 0) }];
  }

  /** local day start for the viewer's time zone (offsetMin = Date#getTimezoneOffset in the browser) */
  private dayStart(t: number, offsetMin: number) { const local = t - offsetMin * 60_000; return Math.floor(local / 86_400_000) * 86_400_000 + offsetMin * 60_000; }
  private dayKey(t: number, offsetMin: number) { return new Date(t - offsetMin * 60_000).toISOString().slice(0, 10); }
  private range(from: unknown, to: unknown) {
    const a = iso(from, 'from'), b = iso(to, 'to');
    if (b <= a || b.getTime() - a.getTime() > 62 * 86_400_000) throw new BadRequestException('Pick a range of up to 62 days.');
    return { a, b };
  }
  private async who(c: Ctx, userId?: unknown) {
    if (userId !== undefined && userId !== '' && userId !== null) {
      const id = Number(userId);
      if (!(await this.canSee(c, id))) throw new NotFoundException('Person not found.');
      return [id];
    }
    return this.visibleIds(c);
  }

  /** hours per person per day (+ per task) */
  async timesheet(ws: string, userId: number, q: any) {
    const c = await this.ctx(ws, userId);
    const { a, b } = this.range(q.from, q.to);
    const off = int(q.offset, -840, 840);
    const ids = await this.who(c, q.userId);
    const users = await this.people(ids);
    const slots = await this.prisma.trackerSlot.findMany({ where: { orgId: c.orgId, userId: { in: ids }, deletedAt: null, idleDiscarded: false, start: { gte: a, lt: b } }, select: { userId: true, start: true, seconds: true, keyboard: true, mouse: true, activityPct: true, session: { select: { taskId: true, taskSource: true, projectLabel: true } } } });
    const taskOf = await this.taskMap(slots.map((s) => s.session));
    const rows = new Map<number, { days: Record<string, { seconds: number; active: number; act: number; n: number }>; total: number; active: number; tasks: Map<string, { name: string; uid: string | null; seconds: number }> }>();
    for (const id of ids) rows.set(id, { days: {}, total: 0, active: 0, tasks: new Map() });
    for (const s of slots) {
      const r = rows.get(s.userId)!;
      const k = this.dayKey(s.start.getTime(), off);
      const d = (r.days[k] ??= { seconds: 0, active: 0, act: 0, n: 0 });
      const active = s.keyboard + s.mouse > 0 ? s.seconds : 0;
      d.seconds += s.seconds; d.active += active; d.act += s.activityPct * s.seconds; d.n += s.seconds;
      r.total += s.seconds; r.active += active;
      const t = taskOf(s.session.taskId, s.session.taskSource);
      const tk = t ? `t${t.source}${t.id}` : `p${s.session.projectLabel ?? ''}`;
      const tr = r.tasks.get(tk) ?? { name: t?.name ?? s.session.projectLabel ?? 'No task', uid: t?.uid ?? null, seconds: 0 };
      tr.seconds += s.seconds; r.tasks.set(tk, tr);
    }
    return ids.filter((id) => users.has(id)).map((id) => {
      const r = rows.get(id)!;
      return {
        user: users.get(id), total: r.total, activeTotal: r.active,
        days: Object.fromEntries(Object.entries(r.days).map(([k, v]) => [k, { seconds: v.seconds, active: v.active, activity: v.n ? Math.round(v.act / v.n) : 0 }])),
        tasks: [...r.tasks.values()].sort((x, y) => y.seconds - x.seconds),
      };
    }).sort((x, y) => y.total - x.total);
  }

  /** one person's day: 10-minute blocks with activity, screenshots and apps */
  async day(ws: string, userId: number, q: any) {
    const c = await this.ctx(ws, userId);
    const { a, b } = this.range(q.from, q.to);
    const [who] = await this.who(c, q.userId ?? userId);
    const own = who === userId;
    const slots = await this.prisma.trackerSlot.findMany({
      where: { orgId: c.orgId, userId: who, deletedAt: null, start: { gte: a, lt: b } }, orderBy: { start: 'asc' },
      select: {
        id: true, start: true, seconds: true, keyboard: true, mouse: true, activityPct: true, idleDiscarded: true,
        session: { select: { taskId: true, taskSource: true, projectLabel: true } },
        shots: { where: { deletedAt: null, ...(own ? {} : { hiddenAt: null }) }, orderBy: { takenAt: 'asc' }, select: { id: true, url: true, takenAt: true, blurred: true, screen: true, hiddenAt: true } },
        apps: { orderBy: { seconds: 'desc' }, take: 5, select: { app: true, title: true, url: true, seconds: true } },
      },
    });
    const taskOf = await this.taskMap(slots.map((s) => s.session));
    const user = (await this.people([who])).get(who) ?? null;
    return {
      user, own, canHide: c.isManager && !own,
      canSeeScreens: c.isManager,
      slots: slots.map((s) => ({ ...s, away: s.keyboard + s.mouse === 0 && !s.idleDiscarded && s.seconds > 0, task: taskOf(s.session.taskId, s.session.taskSource), project: s.session.projectLabel, session: undefined, apps: c.isManager ? s.apps : [], shots: c.isManager ? s.shots.map((x) => ({ ...x, url: x.hiddenAt && !own ? null : x.url })) : [] })),
      totalSeconds: slots.filter((s) => !s.idleDiscarded).reduce((n, s) => n + s.seconds, 0),
    };
  }

  /** apps & sites: time per app (and URL when site tracking is on) */
  async apps(ws: string, userId: number, q: any) {
    const c = await this.ctx(ws, userId);
    this.needManager(c);
    const { a, b } = this.range(q.from, q.to);
    const ids = await this.who(c, q.userId);
    const rows = await this.prisma.trackerAppUsage.groupBy({ by: ['app'], where: { orgId: c.orgId, userId: { in: ids }, slot: { deletedAt: null, idleDiscarded: false, start: { gte: a, lt: b } } }, _sum: { seconds: true }, _count: { userId: true }, orderBy: { _sum: { seconds: 'desc' } }, take: 50 });
    const urls = await this.prisma.trackerAppUsage.groupBy({ by: ['url'], where: { orgId: c.orgId, userId: { in: ids }, url: { not: null }, slot: { deletedAt: null, idleDiscarded: false, start: { gte: a, lt: b } } }, _sum: { seconds: true }, orderBy: { _sum: { seconds: 'desc' } }, take: 50 });
    return { apps: rows.map((r) => ({ app: r.app, seconds: r._sum.seconds ?? 0 })), urls: urls.map((r) => ({ url: r.url!, seconds: r._sum.seconds ?? 0 })) };
  }

  /** first start / last stop per person per day, late vs the workspace day start */
  async attendance(ws: string, userId: number, q: any) {
    const c = await this.ctx(ws, userId);
    const { a, b } = this.range(q.from, q.to);
    const off = int(q.offset, -840, 840);
    const org = await this.prisma.trackerOrg.findUniqueOrThrow({ where: { id: c.orgId } });
    const settings = this.settingsOf(org.settings);
    const [hh, mm] = settings.dayStart.split(':').map(Number);
    const ids = await this.who(c, q.userId);
    const users = await this.people(ids);
    const sessions = await this.prisma.trackerSession.findMany({ where: { orgId: c.orgId, userId: { in: ids }, startedAt: { gte: a, lt: b } }, select: { userId: true, startedAt: true, endedAt: true, lastBeatAt: true, id: true }, orderBy: { startedAt: 'asc' } });
    const secs = await this.prisma.trackerSlot.groupBy({ by: ['sessionId'], where: { sessionId: { in: sessions.map((s) => s.id) }, deletedAt: null, idleDiscarded: false }, _sum: { seconds: true } });
    const bySession = new Map(secs.map((s) => [s.sessionId, s._sum.seconds ?? 0]));
    const out: { user: unknown; day: string; firstStart: Date; lastEnd: Date | null; seconds: number; late: boolean; lateMinutes: number }[] = [];
    const map = new Map<string, (typeof out)[number]>();
    for (const s of sessions) {
      const day = this.dayKey(s.startedAt.getTime(), off);
      const k = `${s.userId}:${day}`;
      let r = map.get(k);
      if (!r) {
        const dayStartUtc = Date.parse(`${day}T00:00:00Z`) + off * 60_000 + ((hh ?? 9) * 60 + (mm ?? 0)) * 60_000;
        const lateMin = Math.round((s.startedAt.getTime() - dayStartUtc) / 60_000);
        r = { user: users.get(s.userId), day, firstStart: s.startedAt, lastEnd: null, seconds: 0, late: lateMin > 5, lateMinutes: Math.max(0, lateMin) };
        map.set(k, r); out.push(r);
      }
      const end = s.endedAt ?? s.lastBeatAt;
      if (end && (!r.lastEnd || end > r.lastEnd)) r.lastEnd = end;
      r.seconds += bySession.get(s.id) ?? 0;
    }
    return { dayStart: settings.dayStart, rows: out.filter((r) => r.user).sort((x, y) => (x.day === y.day ? 0 : x.day < y.day ? 1 : -1)) };
  }

  // ───────────── managers: EZ Tracker people ─────────────

  /** company members who are not in EZ Tracker yet (for the "Add people" picker) */
  async candidates(ws: string, userId: number) {
    const c = await this.ctx(ws, userId);
    this.needManager(c);
    const inTracker = await this.trackerIds(c.orgId);
    return this.prisma.user.findMany({ where: { deletedAt: null, status: 'ACTIVE', id: { notIn: inTracker.length ? inTracker : [0] } }, select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true }, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }], take: 1000 });
  }

  /**
   * Add people to EZ Tracker for this company — the one place Tracker access starts. They must be in
   * the company already (picked from it, or found by email). Each gets an in-app notification + email.
   */
  async addMembers(ws: string, userId: number, b: any) {
    const c = await this.ctx(ws, userId);
    this.needManager(c);
    const company = 'EZ Tracker';
    const ids = new Set<number>((Array.isArray(b?.userIds) ? b.userIds : []).map(Number).filter(Number.isInteger));
    const emails: string[] = (Array.isArray(b?.emails) ? b.emails : []).map((e: unknown) => str(e, 200).toLowerCase()).filter(Boolean).slice(0, 50);
    for (const e of emails) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new BadRequestException(`"${e}" is not an email address.`);
      const u = await this.prisma.user.findFirst({ where: { email: { equals: e, mode: 'insensitive' }, deletedAt: null }, select: { id: true } });
      if (!u) throw new BadRequestException(`There is no EZ Manage account for ${e}.`);
      ids.add(u.id);
    }
    if (!ids.size) throw new BadRequestException('Pick at least one person.');
    if (ids.size > 100) throw new BadRequestException('Add up to 100 people at a time.');
    const users = await this.people([...ids]);
    for (const id of ids) if (!users.has(id)) throw new BadRequestException('That person no longer has an EZ Manage account.');
    const added: number[] = [];
    for (const id of ids) {
      const had = await this.prisma.trackerMember.findUnique({ where: { orgId_userId: { orgId: c.orgId, userId: id } }, select: { id: true } });
      if (had) continue;
      await this.prisma.trackerMember.create({ data: { orgId: c.orgId, userId: id, role: b?.role === 'admin' ? 'admin' : 'member', addedById: userId } });
      added.push(id);
    }
    const link = `${(process.env.FRONTEND_URL ?? '').replace(/\/$/, '')}/tracker/org/me`;
    for (const id of added) {
      await this.notifications.notify({
        recipientId: id, type: 'AUTOMATION' as any, title: `You've been added to EZ Tracker`,
        message: `To start: 1) open My tracking (${link}) and download the desktop app, 2) press "Get a pairing code" there and type it into the app, 3) read and agree to what it records, then press Start.`,
        metadata: { event: 'tracker_added', href: link }, sendEmail: true,
      }).catch((e) => this.log.warn(`added notice ${id}: ${e?.message}`));
    }
    return { added: added.length, people: await this.peopleRows(c, 0) };
  }

  /** remove from EZ Tracker for this company: their computers here are signed out, their history stays for admins */
  async removeMember(ws: string, userId: number, target: number) {
    const c = await this.ctx(ws, userId);
    this.needManager(c);
    const m = await this.prisma.trackerMember.findUnique({ where: { orgId_userId: { orgId: c.orgId, userId: target } } });
    if (!m) throw new NotFoundException('Person not found.');
    const open = await this.prisma.trackerSession.findMany({ where: { orgId: c.orgId, userId: target, endedAt: null }, select: { id: true, lastBeatAt: true, startedAt: true } });
    for (const s of open) await this.finish(s.id, s.lastBeatAt ?? s.startedAt);
    await this.prisma.trackerDevice.updateMany({ where: { orgId: c.orgId, userId: target, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.prisma.trackerPairCode.deleteMany({ where: { orgId: c.orgId, userId: target } });
    await this.prisma.trackerMember.delete({ where: { id: m.id } });
    return { ok: true };
  }

  /** member ↔ Tracker admin */
  async setRole(ws: string, userId: number, target: number, role: string) {
    const c = await this.ctx(ws, userId);
    this.needManager(c);
    if (role !== 'admin' && role !== 'member') throw new BadRequestException('Role is member or admin.');
    const m = await this.prisma.trackerMember.findUnique({ where: { orgId_userId: { orgId: c.orgId, userId: target } } });
    if (!m) throw new NotFoundException('Person not found.');
    await this.prisma.trackerMember.update({ where: { id: m.id }, data: { role } });
    return { ok: true, role };
  }

  /** tracking on / off for one person (paused without removing them) */
  async setTracking(ws: string, userId: number, target: number, on: boolean) {
    const c = await this.ctx(ws, userId);
    this.needManager(c);
    const m = await this.prisma.trackerMember.findUnique({ where: { orgId_userId: { orgId: c.orgId, userId: target } } });
    if (!m) throw new NotFoundException('Person not found.');
    await this.prisma.trackerMember.update({ where: { id: m.id }, data: { tracking: on } });
    return { tracked: on };
  }

  async peopleList(ws: string, userId: number, offsetMin: number) {
    const c = await this.ctx(ws, userId);
    this.needManager(c);
    return this.peopleRows(c, offsetMin);
  }
  private async peopleRows(c: Ctx, offsetMin: number) {
    const members = await this.prisma.trackerMember.findMany({ where: { orgId: c.orgId }, select: { userId: true, role: true, tracking: true, createdAt: true } });
    const ids = members.map((m) => m.userId);
    const [users, devices, consents, today, beats, reminders] = await Promise.all([
      this.people(ids),
      this.prisma.trackerDevice.findMany({ where: { orgId: c.orgId, userId: { in: ids }, revokedAt: null }, select: { id: true, userId: true, name: true, os: true, lastSeenAt: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.trackerConsent.findMany({ where: { orgId: c.orgId, userId: { in: ids } }, select: { userId: true, version: true, acceptedAt: true }, orderBy: { acceptedAt: 'desc' } }),
      this.prisma.trackerSlot.groupBy({ by: ['userId'], where: { orgId: c.orgId, userId: { in: ids }, deletedAt: null, idleDiscarded: false, start: { gte: new Date(this.dayStart(Date.now(), offsetMin)) } }, _sum: { seconds: true } }),
      this.prisma.trackerSession.groupBy({ by: ['userId'], where: { orgId: c.orgId, userId: { in: ids } }, _max: { lastBeatAt: true, startedAt: true } }),
      this.prisma.trackerReminder.groupBy({ by: ['userId'], where: { orgId: c.orgId, userId: { in: ids } }, _max: { sentAt: true } }),
    ]);
    return members.filter((m) => users.has(m.userId)).map((m) => {
      const id = m.userId;
      const dv = devices.filter((d) => d.userId === id);
      const cs = consents.filter((x) => x.userId === id);
      const current = cs.find((x) => x.version === CONSENT_VERSION);
      const b = beats.find((x) => x.userId === id)?._max;
      const last = [b?.lastBeatAt, b?.startedAt, ...dv.map((d) => d.lastSeenAt)].filter((x): x is Date => !!x).sort((x, y) => +y - +x)[0] ?? null;
      return {
        user: users.get(id)!, company: null,
        role: m.role, addedAt: m.createdAt,
        devices: dv, installed: dv.length > 0, lastSeenAt: dv.map((d) => d.lastSeenAt).filter((x): x is Date => !!x).sort((x, y) => +y - +x)[0] ?? null,
        consent: current ? { state: 'agreed' as const, at: current.acceptedAt } : cs.length ? { state: 'outdated' as const, at: cs[0]!.acceptedAt } : { state: 'never' as const, at: null },
        tracked: m.tracking, trackerAdmin: m.role === 'admin',
        todaySeconds: today.find((x) => x.userId === id)?._sum.seconds ?? 0, lastActiveAt: last,
        lastRemindedAt: reminders.find((x) => x.userId === id)?._max.sentAt ?? null,
      };
    }).sort((x, y) => (x.user.firstName ?? '').localeCompare(y.user.firstName ?? ''));
  }
  /** the system Administrator: the Tracker people of every company, as one list */
  async peopleAll(userId: number, offsetMin: number) {
    if (!(await this.isSystemAdmin(userId))) throw new ForbiddenException('Only the Administrator sees everyone.');
    return this.peopleRows(await this.ctx('org', userId), offsetMin);
  }

  /** one person's full admin profile: identity + contact, devices, consent, and day/week/month tracked vs active */
  async person(ws: string, userId: number, target: number, offsetMin: number) {
    const c = await this.ctx(ws, userId);
    this.needManager(c);
    const m = await this.prisma.trackerMember.findUnique({ where: { orgId_userId: { orgId: c.orgId, userId: target } }, select: { role: true, tracking: true, createdAt: true, addedById: true } });
    if (!m) throw new NotFoundException('Person not found.');
    const u = await this.prisma.user.findUnique({ where: { id: target }, select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, phone: true, jobTitle: true, systemRole: true } });
    if (!u) throw new NotFoundException('Person not found.');
    const now = Date.now();
    const todayStart = this.dayStart(now, offsetMin);
    const monthStart = todayStart - 29 * 86_400_000;
    const [devices, consents, slots, org, addedBy] = await Promise.all([
      this.prisma.trackerDevice.findMany({ where: { orgId: c.orgId, userId: target, revokedAt: null }, select: { id: true, name: true, os: true, appVersion: true, lastSeenAt: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.trackerConsent.findMany({ where: { orgId: c.orgId, userId: target }, select: { version: true, acceptedAt: true }, orderBy: { acceptedAt: 'desc' } }),
      this.prisma.trackerSlot.findMany({ where: { orgId: c.orgId, userId: target, deletedAt: null, idleDiscarded: false, start: { gte: new Date(monthStart) } }, select: { start: true, seconds: true, keyboard: true, mouse: true, activityPct: true } }),
      this.prisma.trackerOrg.findUniqueOrThrow({ where: { id: c.orgId } }),
      m.addedById ? this.people([m.addedById]) : Promise.resolve(null),
    ]);
    const byDay = new Map<string, { tracked: number; active: number; act: number; n: number }>();
    for (const s of slots) {
      const k = this.dayKey(s.start.getTime(), offsetMin);
      const d = byDay.get(k) ?? { tracked: 0, active: 0, act: 0, n: 0 };
      const active = s.keyboard + s.mouse > 0 ? s.seconds : 0;
      d.tracked += s.seconds; d.active += active; d.act += s.activityPct * s.seconds; d.n += s.seconds;
      byDay.set(k, d);
    }
    const days = [...byDay.entries()].map(([day, v]) => ({ day, tracked: v.tracked, active: v.active, activity: v.n ? Math.round(v.act / v.n) : 0 })).sort((a, b) => (a.day < b.day ? 1 : -1));
    const todayKey = this.dayKey(now, offsetMin);
    const weekCut = this.dayKey(todayStart - 6 * 86_400_000, offsetMin);
    const sum = (pred: (day: string) => boolean) => days.filter((d) => pred(d.day)).reduce((a, d) => ({ tracked: a.tracked + d.tracked, active: a.active + d.active }), { tracked: 0, active: 0 });
    const cur = consents.find((x) => x.version === CONSENT_VERSION);
    return {
      user: u,
      member: { role: m.role, tracking: m.tracking, addedAt: m.createdAt, addedBy: m.addedById ? (addedBy?.get(m.addedById) ?? null) : null },
      devices, installed: devices.length > 0,
      consent: { version: CONSENT_VERSION, state: cur ? 'agreed' : consents.length ? 'outdated' : 'never', acceptedAt: cur?.acceptedAt ?? consents[0]?.acceptedAt ?? null, history: consents.map((x) => ({ version: x.version, acceptedAt: x.acceptedAt })) },
      periods: { day: sum((d) => d === todayKey), week: sum((d) => d >= weekCut), month: sum(() => true) },
      days, idleMinutes: this.settingsOf(org.settings).idleMinutes, canSeeScreens: true,
    };
  }

  /** a manager signs out someone's computer in this company */
  async revokeDeviceAs(ws: string, userId: number, deviceId: number) {
    const c = await this.ctx(ws, userId);
    this.needManager(c);
    const d = await this.prisma.trackerDevice.findUnique({ where: { id: deviceId }, select: { orgId: true, revokedAt: true } });
    if (!d || d.orgId !== c.orgId) throw new NotFoundException('Device not found.');
    if (!d.revokedAt) await this.prisma.trackerDevice.update({ where: { id: deviceId }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  /** "please set up EZ Tracker": in-app notification + email, once per person per day */
  async remind(ws: string, userId: number, target: number) {
    const c = await this.ctx(ws, userId);
    this.needManager(c);
    if (!(await this.prisma.trackerMember.findUnique({ where: { orgId_userId: { orgId: c.orgId, userId: target } }, select: { id: true } }))) throw new NotFoundException('Person not found.');
    const recent = await this.prisma.trackerReminder.findFirst({ where: { orgId: c.orgId, userId: target, sentAt: { gt: new Date(Date.now() - 86_400_000) } }, select: { sentAt: true } });
    if (recent) throw new ConflictException('A reminder already went to this person today.');
    const from = (await this.people([userId])).get(userId);
    const link = `${(process.env.FRONTEND_URL ?? '').replace(/\/$/, '')}/tracker/org/me`;
    const message = `${from ? `${from.firstName} ${from.lastName}`.trim() : 'Your manager'} asked you to set up EZ Tracker: `
      + `1) open My tracking (${link}) and download the app, 2) make a pairing code there and type it into the app, 3) read and agree to what it records, then press Start.`;
    await this.prisma.trackerReminder.create({ data: { orgId: c.orgId, userId: target, sentById: userId } });
    await this.notifications.notify({
      recipientId: target, type: 'AUTOMATION' as any, title: 'Please set up EZ Tracker', message,
      metadata: { event: 'tracker_reminder', href: link }, sendEmail: true,
    }).catch((e) => this.log.warn(`reminder ${target}: ${e?.message}`));
    return { ok: true, sentAt: new Date() };
  }

  // ───────────── screenshots: delete own, hide (managers) ─────────────

  /** deleting your screenshot removes its whole 10-minute block of time (and the other shots in it) */
  async deleteShot(id: number, userId: number) {
    const s = await this.prisma.trackerShot.findUnique({ where: { id }, select: { id: true, userId: true, slotId: true, deletedAt: true } });
    if (!s || s.userId !== userId) throw new NotFoundException('Screenshot not found.');
    if (s.deletedAt) return { ok: true };
    const slot = await this.prisma.trackerSlot.update({ where: { id: s.slotId }, data: { deletedAt: new Date() }, select: { sessionId: true } });
    const shots = await this.prisma.trackerShot.findMany({ where: { slotId: s.slotId, deletedAt: null }, select: { id: true, fileId: true } });
    for (const x of shots) await this.removeImage(x.id, x.fileId);
    await this.syncTime(slot.sessionId);
    return { ok: true, removedShots: shots.length };
  }

  async hideShot(id: number, userId: number, hidden: boolean) {
    const s = await this.prisma.trackerShot.findUnique({ where: { id }, select: { id: true, orgId: true, userId: true } });
    if (!s) throw new NotFoundException('Screenshot not found.');
    if (!(await this.isManagerOf(s.orgId, userId))) throw new ForbiddenException('Only Tracker admins and the Administrator can hide screenshots.');
    await this.prisma.trackerShot.update({ where: { id }, data: { hiddenAt: hidden ? new Date() : null } });
    return { ok: true };
  }

  private async removeImage(shotId: number, fileId: number | null) {
    if (fileId) {
      const f = await this.prisma.file.findUnique({ where: { id: fileId }, select: { id: true, storageKey: true } });
      if (f) {
        await this.storage.delete(f.storageKey).catch((e) => this.log.warn(`delete image ${f.id}: ${e?.message}`));
        await this.prisma.file.delete({ where: { id: f.id } }).catch(() => null);
      }
    }
    await this.prisma.trackerShot.update({ where: { id: shotId }, data: { deletedAt: new Date(), url: null, fileId: null } });
  }

  // ───────────── housekeeping ─────────────

  /** daily: screenshots older than each workspace's retention are deleted (the time stays) */
  @Cron('30 3 * * *')
  async retention(now = new Date()) {
    const orgs = await this.prisma.trackerOrg.findMany({ select: { id: true, settings: true } });
    let removed = 0;
    for (const o of orgs) {
      const days = this.settingsOf(o.settings).retentionDays;
      if (!days) continue;
      const old = await this.prisma.trackerShot.findMany({ where: { orgId: o.id, deletedAt: null, takenAt: { lt: new Date(now.getTime() - days * 86_400_000) } }, select: { id: true, fileId: true }, take: 2000 });
      for (const s of old) { await this.removeImage(s.id, s.fileId); removed++; }
    }
    if (removed) this.log.log(`retention: removed ${removed} screenshots`);
    return { removed };
  }

  /** every 10 min: a session with no heartbeat for 15 min is closed at its last heartbeat */
  @Cron('*/10 * * * *')
  async closeStale() {
    const stale = await this.prisma.trackerSession.findMany({ where: { endedAt: null, lastBeatAt: { lt: new Date(Date.now() - STALE_MS) } }, select: { id: true, lastBeatAt: true } });
    for (const s of stale) await this.finish(s.id, s.lastBeatAt!);
    return { closed: stale.length };
  }
}
