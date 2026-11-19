import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomBytes } from 'crypto';
import { PrismaService } from 'prisma/prisma.service';
import { STORAGE_SERVICE } from 'src/storage/storage.module';
import type { StorageProvider } from 'src/storage/storage.types';
import { hashToken, type TrackerDeviceCaller } from './tracker.guard';

/** the consent text version; bump when the wording on the desktop consent screen changes */
export const CONSENT_VERSION = '2026-11-19';

export type TrackerSettings = {
  screenshotsPer10: number; blur: boolean; trackApps: boolean; trackUrls: boolean; idleMinutes: number;
  retentionDays: number; dayStart: string; trackAll: boolean; trackedUserIds: number[];
};
export const DEFAULT_SETTINGS: TrackerSettings = {
  screenshotsPer10: 1, blur: false, trackApps: true, trackUrls: false, idleMinutes: 5,
  retentionDays: 60, dayStart: '09:00', trackAll: true, trackedUserIds: [],
};

const SLOT_MS = 10 * 60_000;
const STALE_MS = 15 * 60_000; // no heartbeat for 15 min: the session counts as stopped
const SHOT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SHOT = 3 * 1024 * 1024;
const RETENTION = new Set([0, 30, 60, 90, 180]);

type Ctx = { orgId: number; workspaceId: number; userId: number; role: string; isManager: boolean; reports: number[] };
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
 * EZ Tracker: time, screenshots and activity from the desktop app, attached to a Company Work
 * workspace. Owners / admins see everyone, managers (Work "reports to") see their reports,
 * everyone sees themself. Activity is counts only — what was typed is never sent.
 */
@Injectable()
export class TrackerService {
  private readonly log = new Logger('Tracker');
  constructor(private readonly prisma: PrismaService, @Inject(STORAGE_SERVICE) private readonly storage: StorageProvider) {}

  // ───────────── access ─────────────

  settingsOf(raw: unknown): TrackerSettings {
    const s = { ...DEFAULT_SETTINGS, ...((raw && typeof raw === 'object' ? raw : {}) as Partial<TrackerSettings>) };
    return {
      screenshotsPer10: int(s.screenshotsPer10, 0, 3, 1), blur: !!s.blur, trackApps: !!s.trackApps, trackUrls: !!s.trackUrls,
      idleMinutes: int(s.idleMinutes, 1, 60, 5), retentionDays: RETENTION.has(Number(s.retentionDays)) ? Number(s.retentionDays) : 60,
      dayStart: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s.dayStart)) ? String(s.dayStart) : '09:00',
      trackAll: s.trackAll !== false, trackedUserIds: Array.isArray(s.trackedUserIds) ? s.trackedUserIds.map(Number).filter(Number.isInteger) : [],
    };
  }
  private tracked(settings: TrackerSettings, userId: number) { return settings.trackAll || settings.trackedUserIds.includes(userId); }

  private async ensureOrg(workspaceId: number) {
    return this.prisma.trackerOrg.upsert({ where: { workspaceId }, update: {}, create: { workspaceId, settings: DEFAULT_SETTINGS as any } });
  }

  /** Company Work workspace (uid or id) → the caller's place in it. Guests and outsiders: 404. */
  async ctx(ws: string, userId: number): Promise<Ctx> {
    const w = await this.prisma.workWorkspace.findFirst({ where: /^\d+$/.test(ws) ? { id: Number(ws) } : { uid: ws }, select: { id: true } });
    if (!w) throw new NotFoundException('Workspace not found.');
    const m = await this.prisma.workMember.findUnique({ where: { workspaceId_userId: { workspaceId: w.id, userId } }, select: { role: true } });
    if (!m || m.role === 'GUEST') throw new NotFoundException('Workspace not found.');
    const org = await this.ensureOrg(w.id);
    const isManager = m.role === 'OWNER' || m.role === 'ADMIN';
    const reports = isManager ? [] : (await this.prisma.workMember.findMany({ where: { workspaceId: w.id, managerId: userId }, select: { userId: true } })).map((r) => r.userId);
    return { orgId: org.id, workspaceId: w.id, userId, role: m.role, isManager, reports };
  }

  /** who this person may see: everyone (owner/admin), themself + their reports (manager), or themself */
  private async visibleIds(c: Ctx) {
    if (c.isManager) return (await this.prisma.workMember.findMany({ where: { workspaceId: c.workspaceId, role: { not: 'GUEST' } }, select: { userId: true } })).map((m) => m.userId);
    return [c.userId, ...c.reports];
  }
  private async canSee(c: Ctx, userId: number) {
    if (userId === c.userId || c.reports.includes(userId)) return true;
    if (!c.isManager) return false;
    return !!(await this.prisma.workMember.findUnique({ where: { workspaceId_userId: { workspaceId: c.workspaceId, userId } }, select: { role: true } }));
  }
  private async people(ids: number[]) {
    const us = await this.prisma.user.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } });
    return new Map(us.map((u) => [u.id, u]));
  }

  // ───────────── web: workspaces, overview, settings ─────────────

  async workspaces(userId: number) {
    const ms = await this.prisma.workMember.findMany({ where: { userId, role: { not: 'GUEST' } }, select: { role: true, workspace: { select: { id: true, uid: true, name: true, color: true } } }, orderBy: { createdAt: 'asc' } });
    return ms.map((m) => ({ ...m.workspace, role: m.role }));
  }

  async overview(ws: string, userId: number) {
    const c = await this.ctx(ws, userId);
    const org = await this.prisma.trackerOrg.findUniqueOrThrow({ where: { id: c.orgId } });
    const settings = this.settingsOf(org.settings);
    const consent = await this.prisma.trackerConsent.findUnique({ where: { orgId_userId_version: { orgId: c.orgId, userId, version: CONSENT_VERSION } }, select: { acceptedAt: true } });
    const devices = await this.prisma.trackerDevice.count({ where: { userId, orgId: c.orgId, revokedAt: null } });
    const w = await this.prisma.workWorkspace.findUnique({ where: { id: c.workspaceId }, select: { uid: true, name: true, color: true } });
    return {
      workspace: w, role: c.role, isManager: c.isManager, canSeeOthers: c.isManager || c.reports.length > 0,
      settings, tracked: this.tracked(settings, userId), consent: { version: CONSENT_VERSION, acceptedAt: consent?.acceptedAt ?? null }, devices,
    };
  }

  async updateSettings(ws: string, userId: number, b: any) {
    const c = await this.ctx(ws, userId);
    if (!c.isManager) throw new ForbiddenException('Only workspace owners and admins can change tracking settings.');
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
    const m = await this.prisma.workMember.findUnique({ where: { workspaceId_userId: { workspaceId: org.workspaceId, userId: d.userId } }, select: { role: true } });
    const w = await this.prisma.workWorkspace.findUnique({ where: { id: org.workspaceId }, select: { uid: true, name: true } });
    const u = await this.prisma.user.findUnique({ where: { id: d.userId }, select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } });
    const consent = await this.prisma.trackerConsent.findUnique({ where: { orgId_userId_version: { orgId: d.orgId, userId: d.userId, version: CONSENT_VERSION } }, select: { acceptedAt: true } });
    const open = await this.prisma.trackerSession.findFirst({ where: { userId: d.userId, orgId: d.orgId, endedAt: null }, orderBy: { startedAt: 'desc' }, select: { id: true, startedAt: true, taskId: true, projectLabel: true } });
    return {
      user: u, workspace: w, member: !!m && m.role !== 'GUEST',
      settings: { screenshotsPer10: settings.screenshotsPer10, blur: settings.blur, trackApps: settings.trackApps, trackUrls: settings.trackUrls, idleMinutes: settings.idleMinutes },
      tracked: this.tracked(settings, d.userId), consent: { version: CONSENT_VERSION, acceptedAt: consent?.acceptedAt ?? null },
      today: await this.todaySeconds(d.orgId, d.userId), openSession: open,
    };
  }

  async desktopConsent(d: TrackerDeviceCaller, version: string, ip?: string, ua?: string) { return this.consent(d.orgId, d.userId, version, ip, ua); }

  /** can this device record right now? (still a member, tracking on for them, agreed to the current text) */
  private async mayTrack(d: TrackerDeviceCaller) {
    const org = await this.prisma.trackerOrg.findUniqueOrThrow({ where: { id: d.orgId } });
    const m = await this.prisma.workMember.findUnique({ where: { workspaceId_userId: { workspaceId: org.workspaceId, userId: d.userId } }, select: { role: true } });
    if (!m || m.role === 'GUEST') throw new ForbiddenException('You are no longer in this workspace.');
    const settings = this.settingsOf(org.settings);
    if (!this.tracked(settings, d.userId)) throw new ForbiddenException('Time tracking is not turned on for you in this workspace.');
    const ok = await this.prisma.trackerConsent.findUnique({ where: { orgId_userId_version: { orgId: d.orgId, userId: d.userId, version: CONSENT_VERSION } }, select: { id: true } });
    if (!ok) throw new ForbiddenException('Please read and accept what EZ Tracker records before you start.');
    return { org, settings };
  }

  async desktopTasks(d: TrackerDeviceCaller, q: string) {
    const org = await this.prisma.trackerOrg.findUniqueOrThrow({ where: { id: d.orgId } });
    const term = str(q, 80);
    const tasks = await this.prisma.workTask.findMany({
      where: {
        archivedAt: null, completedAt: null, list: { space: { workspaceId: org.workspaceId } },
        assignees: { some: { userId: d.userId } },
        ...(term ? { name: { contains: term, mode: 'insensitive' as const } } : {}),
      },
      select: { id: true, uid: true, name: true, dueDate: true, list: { select: { name: true, space: { select: { name: true, color: true } } } } },
      orderBy: [{ updatedAt: 'desc' }], take: 50,
    });
    return tasks.map((t) => ({ id: t.id, uid: t.uid, name: t.name, dueDate: t.dueDate, where: `${t.list.space.name} / ${t.list.name}`, color: t.list.space.color }));
  }

  private async checkTask(workspaceId: number, userId: number, taskId: number) {
    const t = await this.prisma.workTask.findFirst({ where: { id: taskId, archivedAt: null, list: { space: { workspaceId } } }, select: { id: true, assignees: { where: { userId }, select: { userId: true } } } });
    if (!t) throw new BadRequestException('That task is not in this workspace.');
    return t.id;
  }

  async start(d: TrackerDeviceCaller, b: any) {
    const { org } = await this.mayTrack(d);
    const clientId = cid(b?.clientId);
    const existing = await this.prisma.trackerSession.findUnique({ where: { userId_clientId: { userId: d.userId, clientId } } });
    if (existing) return existing; // a retried start
    const taskId = b?.taskId ? await this.checkTask(org.workspaceId, d.userId, Number(b.taskId)) : null;
    const startedAt = b?.startedAt ? iso(b.startedAt, 'startedAt') : new Date();
    if (startedAt.getTime() > Date.now() + 60_000 || startedAt.getTime() < Date.now() - 7 * 86_400_000) throw new BadRequestException('Start time is out of range.');
    // one running session per person: close any other
    const open = await this.prisma.trackerSession.findMany({ where: { userId: d.userId, endedAt: null } });
    for (const o of open) await this.finish(o.id, o.lastBeatAt ?? startedAt);
    return this.prisma.trackerSession.create({
      data: { orgId: d.orgId, userId: d.userId, deviceId: d.deviceId, clientId, taskId, projectLabel: str(b?.projectLabel, 120) || null, note: str(b?.note, 500) || null, startedAt, lastBeatAt: new Date() },
    });
  }

  private async ownSession(d: TrackerDeviceCaller, id: number) {
    const s = await this.prisma.trackerSession.findUnique({ where: { id } });
    if (!s || s.userId !== d.userId || s.orgId !== d.orgId) throw new NotFoundException('Session not found.');
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

  /** close a session and write its tracked time into Company Work (when it was on a task) */
  private async finish(id: number, endedAt: Date) {
    const s = await this.prisma.trackerSession.update({ where: { id }, data: { endedAt } });
    await this.syncWorkTime(id).catch((e) => this.log.warn(`work time sync ${id}: ${e?.message}`));
    return s;
  }

  /** tracked seconds = slots that are kept (not discarded as idle, not deleted with their screenshot) */
  private async trackedSeconds(sessionId: number) {
    const r = await this.prisma.trackerSlot.aggregate({ where: { sessionId, deletedAt: null, idleDiscarded: false }, _sum: { seconds: true } });
    return r._sum.seconds ?? 0;
  }

  /**
   * Company Work link: one WorkTimeEntry per finished session on a task, kept in step with the
   * tracked seconds (so Work timesheets and the task's time show tracker hours).
   */
  private async syncWorkTime(sessionId: number) {
    const s = await this.prisma.trackerSession.findUnique({ where: { id: sessionId } });
    if (!s || !s.taskId || !s.endedAt) return;
    const secs = await this.trackedSeconds(sessionId);
    if (s.workTimeEntryId) {
      const e = await this.prisma.workTimeEntry.findUnique({ where: { id: s.workTimeEntryId }, select: { id: true } });
      if (e) {
        if (secs <= 0) { await this.prisma.workTimeEntry.delete({ where: { id: e.id } }); await this.prisma.trackerSession.update({ where: { id: s.id }, data: { workTimeEntryId: null } }); }
        else await this.prisma.workTimeEntry.update({ where: { id: e.id }, data: { duration: secs, endedAt: new Date(s.startedAt.getTime() + secs * 1000) } });
        return;
      }
    }
    if (secs <= 0) return;
    const e = await this.prisma.workTimeEntry.create({ data: { taskId: s.taskId, userId: s.userId, startedAt: s.startedAt, endedAt: new Date(s.startedAt.getTime() + secs * 1000), duration: secs, note: 'EZ Tracker' } });
    await this.prisma.trackerSession.update({ where: { id: s.id }, data: { workTimeEntryId: e.id } });
  }

  /** slots arrive in batches (the app keeps them on disk while offline); a re-sent slot is ignored */
  async slots(d: TrackerDeviceCaller, b: any) {
    const { settings } = await this.mayTrack(d);
    const s = await this.ownSession(d, Number(b?.sessionId));
    const list: any[] = Array.isArray(b?.slots) ? b.slots.slice(0, 200) : [];
    if (!list.length) throw new BadRequestException('No slots sent.');
    let saved = 0, skipped = 0;
    for (const x of list) {
      const clientId = cid(x?.clientId);
      const dup = await this.prisma.trackerSlot.findUnique({ where: { userId_clientId: { userId: d.userId, clientId } }, select: { id: true } });
      if (dup) { skipped++; continue; }
      const start = iso(x?.start, 'slot start');
      const aligned = new Date(Math.floor(start.getTime() / SLOT_MS) * SLOT_MS);
      if (aligned.getTime() < s.startedAt.getTime() - SLOT_MS || aligned.getTime() > Date.now() + 60_000) throw new BadRequestException('A slot is outside its session.');
      const seconds = int(x?.seconds, 0, 600);
      const active = int(x?.activeSeconds, 0, seconds);
      const apps: any[] = settings.trackApps && Array.isArray(x?.apps) ? x.apps.slice(0, 30) : [];
      await this.prisma.trackerSlot.create({
        data: {
          sessionId: s.id, orgId: d.orgId, userId: d.userId, clientId, start: aligned, seconds,
          keyboard: int(x?.keyboard, 0, 100_000), mouse: int(x?.mouse, 0, 100_000),
          activityPct: seconds ? Math.round((active / seconds) * 100) : 0, idleDiscarded: !!x?.idleDiscarded,
          apps: { create: apps.map((a) => ({ orgId: d.orgId, userId: d.userId, app: str(a?.app, 120) || 'Unknown', title: str(a?.title, 200) || null, url: settings.trackUrls ? str(a?.url, 300) || null : null, seconds: int(a?.seconds, 0, 600) })) },
        },
      });
      saved++;
    }
    if (s.endedAt) await this.syncWorkTime(s.id);
    await this.prisma.trackerSession.update({ where: { id: s.id }, data: { lastBeatAt: s.endedAt ? undefined : new Date() } });
    return { saved, skipped };
  }

  async shot(d: TrackerDeviceCaller, file: Express.Multer.File | undefined, b: any) {
    const { settings } = await this.mayTrack(d);
    if (settings.screenshotsPer10 === 0) throw new ForbiddenException('Screenshots are turned off for this workspace.');
    if (!file?.buffer?.length) throw new BadRequestException('No screenshot received.');
    if (file.size > MAX_SHOT) throw new BadRequestException('A screenshot must be under 3 MB.');
    const type = sniff(file.buffer);
    if (!type || !SHOT_TYPES.has(type)) throw new BadRequestException('A screenshot must be a JPEG, PNG or WebP image.');
    const clientId = cid(b?.clientId);
    const dup = await this.prisma.trackerShot.findUnique({ where: { userId_clientId: { userId: d.userId, clientId } }, select: { id: true, url: true } });
    if (dup) return dup;
    const slot = await this.prisma.trackerSlot.findUnique({ where: { userId_clientId: { userId: d.userId, clientId: cid(b?.slotClientId, 'slotClientId') } }, select: { id: true, deletedAt: true } });
    if (!slot) throw new ConflictException('Send the time slot first, then its screenshot.');
    if (slot.deletedAt) throw new BadRequestException('That time was deleted.');
    const up = await this.storage.upload({ ...file, mimetype: type, originalname: `shot-${clientId}.${type.split('/')[1]}` } as Express.Multer.File, `tracker/${d.orgId}/${d.userId}`);
    const url = this.storage.getUrl(up.storageKey);
    const f = await this.prisma.file.create({ data: { fileName: up.fileName, mimeType: up.mimeType, fileSize: up.fileSize, storageKey: up.storageKey, url, uploadedById: d.userId } });
    return this.prisma.trackerShot.create({
      data: { slotId: slot.id, orgId: d.orgId, userId: d.userId, clientId, fileId: f.id, url, takenAt: b?.takenAt ? iso(b.takenAt, 'takenAt') : new Date(), screen: int(b?.screen, 0, 8), blurred: String(b?.blurred) === 'true' || b?.blurred === true },
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
      this.prisma.trackerSession.findMany({ where: { orgId: c.orgId, userId: { in: ids }, endedAt: null }, select: { id: true, userId: true, startedAt: true, lastBeatAt: true, taskId: true, projectLabel: true } }),
      this.prisma.trackerSlot.groupBy({ by: ['userId'], where: { orgId: c.orgId, userId: { in: ids }, deletedAt: null, idleDiscarded: false, start: { gte: new Date(dayStart) } }, _sum: { seconds: true }, _avg: { activityPct: true } }),
      this.prisma.trackerShot.findMany({ where: { orgId: c.orgId, userId: { in: ids }, deletedAt: null, takenAt: { gte: new Date(dayStart) } }, orderBy: { takenAt: 'desc' }, distinct: ['userId'], select: { userId: true, url: true, takenAt: true, blurred: true, hiddenAt: true } }),
    ]);
    const taskIds = open.map((o) => o.taskId).filter((x): x is number => !!x);
    const taskRows = taskIds.length ? await this.prisma.workTask.findMany({ where: { id: { in: taskIds } }, select: { id: true, uid: true, name: true } }) : [];
    const tmap = new Map(taskRows.map((t) => [t.id, t]));
    const sum = new Map(slots.map((s) => [s.userId, s]));
    const lastShot = new Map(shots.map((s) => [s.userId, s]));
    return ids.filter((id) => users.has(id)).map((id) => {
      const o = open.find((x) => x.userId === id && x.lastBeatAt && now - x.lastBeatAt.getTime() < STALE_MS);
      const shot = lastShot.get(id);
      const hidden = shot?.hiddenAt && id !== c.userId;
      return {
        user: users.get(id), me: id === c.userId,
        status: o ? 'working' : 'offline', since: o?.startedAt ?? null,
        task: o?.taskId ? tmap.get(o.taskId) ?? null : null, project: o?.projectLabel ?? null,
        todaySeconds: sum.get(id)?._sum.seconds ?? 0, todayActivity: Math.round(sum.get(id)?._avg.activityPct ?? 0),
        lastShot: shot && !hidden ? { url: shot.url, takenAt: shot.takenAt, blurred: shot.blurred } : null,
      };
    }).sort((a, b) => (a.status === b.status ? b.todaySeconds - a.todaySeconds : a.status === 'working' ? -1 : 1));
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
    const slots = await this.prisma.trackerSlot.findMany({ where: { orgId: c.orgId, userId: { in: ids }, deletedAt: null, idleDiscarded: false, start: { gte: a, lt: b } }, select: { userId: true, start: true, seconds: true, activityPct: true, session: { select: { taskId: true, projectLabel: true } } } });
    const taskIds = [...new Set(slots.map((s) => s.session.taskId).filter((x): x is number => !!x))];
    const tasks = new Map((taskIds.length ? await this.prisma.workTask.findMany({ where: { id: { in: taskIds } }, select: { id: true, uid: true, name: true } }) : []).map((t) => [t.id, t]));
    const rows = new Map<number, { days: Record<string, { seconds: number; act: number; n: number }>; total: number; tasks: Map<string, { name: string; uid: string | null; seconds: number }> }>();
    for (const id of ids) rows.set(id, { days: {}, total: 0, tasks: new Map() });
    for (const s of slots) {
      const r = rows.get(s.userId)!;
      const k = this.dayKey(s.start.getTime(), off);
      const d = (r.days[k] ??= { seconds: 0, act: 0, n: 0 });
      d.seconds += s.seconds; d.act += s.activityPct * s.seconds; d.n += s.seconds;
      r.total += s.seconds;
      const t = s.session.taskId ? tasks.get(s.session.taskId) : null;
      const tk = t ? `t${t.id}` : `p${s.session.projectLabel ?? ''}`;
      const tr = r.tasks.get(tk) ?? { name: t?.name ?? s.session.projectLabel ?? 'No task', uid: t?.uid ?? null, seconds: 0 };
      tr.seconds += s.seconds; r.tasks.set(tk, tr);
    }
    return ids.filter((id) => users.has(id)).map((id) => {
      const r = rows.get(id)!;
      return {
        user: users.get(id), total: r.total,
        days: Object.fromEntries(Object.entries(r.days).map(([k, v]) => [k, { seconds: v.seconds, activity: v.n ? Math.round(v.act / v.n) : 0 }])),
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
        session: { select: { taskId: true, projectLabel: true } },
        shots: { where: { deletedAt: null, ...(own ? {} : { hiddenAt: null }) }, orderBy: { takenAt: 'asc' }, select: { id: true, url: true, takenAt: true, blurred: true, screen: true, hiddenAt: true } },
        apps: { orderBy: { seconds: 'desc' }, take: 5, select: { app: true, title: true, url: true, seconds: true } },
      },
    });
    const taskIds = [...new Set(slots.map((s) => s.session.taskId).filter((x): x is number => !!x))];
    const tasks = new Map((taskIds.length ? await this.prisma.workTask.findMany({ where: { id: { in: taskIds } }, select: { id: true, uid: true, name: true } }) : []).map((t) => [t.id, t]));
    const user = (await this.people([who])).get(who) ?? null;
    return {
      user, own, canHide: c.isManager && !own,
      slots: slots.map((s) => ({ ...s, task: s.session.taskId ? tasks.get(s.session.taskId) ?? null : null, project: s.session.projectLabel, session: undefined, shots: s.shots.map((x) => ({ ...x, url: x.hiddenAt && !own ? null : x.url })) })),
      totalSeconds: slots.filter((s) => !s.idleDiscarded).reduce((n, s) => n + s.seconds, 0),
    };
  }

  /** apps & sites: time per app (and URL when site tracking is on) */
  async apps(ws: string, userId: number, q: any) {
    const c = await this.ctx(ws, userId);
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

  // ───────────── screenshots: delete own, hide (managers) ─────────────

  /** deleting your screenshot removes its whole 10-minute block of time (and the other shots in it) */
  async deleteShot(id: number, userId: number) {
    const s = await this.prisma.trackerShot.findUnique({ where: { id }, select: { id: true, userId: true, slotId: true, deletedAt: true } });
    if (!s || s.userId !== userId) throw new NotFoundException('Screenshot not found.');
    if (s.deletedAt) return { ok: true };
    const slot = await this.prisma.trackerSlot.update({ where: { id: s.slotId }, data: { deletedAt: new Date() }, select: { sessionId: true } });
    const shots = await this.prisma.trackerShot.findMany({ where: { slotId: s.slotId, deletedAt: null }, select: { id: true, fileId: true } });
    for (const x of shots) await this.removeImage(x.id, x.fileId);
    await this.syncWorkTime(slot.sessionId);
    return { ok: true, removedShots: shots.length };
  }

  async hideShot(id: number, userId: number, hidden: boolean) {
    const s = await this.prisma.trackerShot.findUnique({ where: { id }, select: { id: true, orgId: true, userId: true } });
    if (!s) throw new NotFoundException('Screenshot not found.');
    const org = await this.prisma.trackerOrg.findUnique({ where: { id: s.orgId }, select: { workspaceId: true } });
    const m = org && (await this.prisma.workMember.findUnique({ where: { workspaceId_userId: { workspaceId: org.workspaceId, userId } }, select: { role: true } }));
    if (!m || !['OWNER', 'ADMIN'].includes(m.role)) throw new ForbiddenException('Only workspace owners and admins can hide screenshots.');
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
