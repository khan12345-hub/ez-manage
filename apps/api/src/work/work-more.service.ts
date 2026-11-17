import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { STORAGE_SERVICE } from 'src/storage/storage.module';
import type { StorageProvider } from 'src/storage/storage.types';
import { WorkAccessService } from './work-access.service';
import { WorkService } from './work.service';
import { WorkDetailService } from './work-detail.service';
import { ATTACHMENT_SELECT } from './work-files.service';

const USER_MINI = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;
const uid = () => randomBytes(9).toString('base64url');
const PAGE = 40;
const CLIP_TYPES = new Set(['video/webm', 'video/mp4', 'video/quicktime']);

type TemplateData = {
  name: string; description: string | null; priority: string | null; timeEstimate: number | null; taskType: string | null;
  checklists: { name: string; items: string[] }[];
  subtasks: { name: string; description: string | null; priority: string | null }[];
};

/**
 * The rest of ClickUp's menus: list Activity & Files (Collection) views, Make Owner,
 * task Merge / Convert / Templates / Description history / Email to task, Clips, and
 * the address search behind the Map view.
 */
@Injectable()
export class WorkMoreService {
  private readonly logger = new Logger(WorkMoreService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkAccessService,
    private readonly work: WorkService,
    private readonly detail: WorkDetailService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageProvider,
  ) {}

  private async listOf(uidOrId: string, userId: number) {
    const n = Number(uidOrId);
    const l = await this.prisma.workList.findFirst({ where: { archivedAt: null, ...(Number.isInteger(n) && String(n) === uidOrId ? { id: n } : { uid: uidOrId }) }, select: { id: true } });
    if (!l) throw new NotFoundException('List not found.');
    return this.access.requireList(l.id, userId, 'view');
  }

  private async taskOf(uidOrId: string, userId: number, level: 'view' | 'comment' | 'edit') {
    const n = Number(uidOrId);
    const t = await this.prisma.workTask.findFirst({ where: { archivedAt: null, ...(Number.isInteger(n) && String(n) === uidOrId ? { id: n } : { uid: uidOrId }) }, select: { id: true, parentId: true } });
    if (!t) throw new NotFoundException('Task not found.');
    const r = await this.access.requireTask(t.id, userId, level);
    return { task: { ...r.task, parentId: t.parentId }, access: r.access };
  }

  // ───────── list views ─────────

  /** Activity view: everything that happened to the list's tasks, newest first */
  async listActivity(listUid: string, userId: number, before?: string) {
    const { list } = await this.listOf(listUid, userId);
    const until = before && !Number.isNaN(Date.parse(before)) ? new Date(before) : undefined;
    const taskWhere = { listId: list.id, archivedAt: null };
    const [acts, comments] = await Promise.all([
      this.prisma.workActivity.findMany({
        where: { task: taskWhere, ...(until ? { createdAt: { lt: until } } : {}) },
        orderBy: { createdAt: 'desc' }, take: PAGE,
        select: { id: true, action: true, fromValue: true, toValue: true, createdAt: true, user: { select: USER_MINI }, task: { select: { uid: true, name: true } } },
      }),
      this.prisma.workComment.findMany({
        where: { task: taskWhere, deletedAt: null, ...(until ? { createdAt: { lt: until } } : {}) },
        orderBy: { createdAt: 'desc' }, take: PAGE,
        select: { id: true, content: true, createdAt: true, user: { select: USER_MINI }, task: { select: { uid: true, name: true } } },
      }),
    ]);
    const items = [
      ...acts.map((a) => ({ kind: 'activity' as const, ...a })),
      ...comments.map((c) => ({ kind: 'comment' as const, ...c, content: c.content.slice(0, 600) })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, PAGE);
    return { items, next: items.length === PAGE ? items[items.length - 1].createdAt.toISOString() : null };
  }

  /** Collection view: every file on the list's tasks */
  async listFiles(listUid: string, userId: number) {
    const { list } = await this.listOf(listUid, userId);
    return this.prisma.workAttachment.findMany({
      where: { task: { listId: list.id, archivedAt: null } },
      orderBy: { createdAt: 'desc' }, take: 300,
      select: { ...ATTACHMENT_SELECT, task: { select: { uid: true, name: true } } },
    });
  }

  // ───────── make owner ─────────

  /** the owner hands the workspace to another member; the old owner becomes an admin */
  async transferOwner(workspaceId: number, userId: number, targetId: number) {
    const me = await this.access.roleIn(workspaceId, userId);
    if (me.role !== 'OWNER') throw new ForbiddenException('Only the workspace owner can do this.');
    if (targetId === userId) throw new BadRequestException('You are already the owner.');
    const m = await this.prisma.workMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: targetId } }, select: { role: true } });
    if (!m) throw new NotFoundException('Not a Work member.');
    if (m.role === 'GUEST') throw new BadRequestException('A guest can’t be the owner. Change their role first.');
    await this.prisma.$transaction([
      this.prisma.workMember.update({ where: { workspaceId_userId: { workspaceId, userId: targetId } }, data: { role: 'OWNER' } }),
      this.prisma.workMember.update({ where: { workspaceId_userId: { workspaceId, userId } }, data: { role: 'ADMIN' } }),
    ]);
    return { ok: true };
  }

  // ───────── merge / convert ─────────

  /** merge other tasks into this one: comments, files, subtasks, checklists, time and people move over; the others are archived */
  async merge(targetUid: string, sourceUids: string[], userId: number) {
    const { task: target, access } = await this.taskOf(targetUid, userId, 'edit');
    const uids = [...new Set((sourceUids ?? []).map(String))].slice(0, 20);
    if (!uids.length) throw new BadRequestException('Pick the tasks to merge.');
    const sources = [] as { id: number; name: string; description: string | null }[];
    for (const u of uids) {
      const { task, access: a } = await this.taskOf(u, userId, 'edit');
      if (task.id === target.id) continue;
      if (a.workspaceId !== access.workspaceId) throw new BadRequestException('Tasks must be in the same workspace.');
      const row = await this.prisma.workTask.findUnique({ where: { id: task.id }, select: { id: true, name: true, description: true } });
      sources.push(row!);
    }
    if (!sources.length) throw new BadRequestException('Pick other tasks to merge.');
    const ids = sources.map((s) => s.id);
    const t = await this.prisma.workTask.findUnique({ where: { id: target.id }, select: { description: true, listId: true } });
    const extra = sources.filter((s) => s.description?.trim()).map((s) => `<p><strong>From “${s.name.replace(/[<>&]/g, '')}”:</strong></p>${s.description}`).join('');
    const people = await this.prisma.workTaskAssignee.findMany({ where: { taskId: { in: ids } }, select: { userId: true } });
    await this.prisma.$transaction([
      this.prisma.workComment.updateMany({ where: { taskId: { in: ids } }, data: { taskId: target.id } }),
      this.prisma.workAttachment.updateMany({ where: { taskId: { in: ids } }, data: { taskId: target.id } }),
      this.prisma.workChecklist.updateMany({ where: { taskId: { in: ids } }, data: { taskId: target.id } }),
      this.prisma.workTimeEntry.updateMany({ where: { taskId: { in: ids } }, data: { taskId: target.id } }),
      this.prisma.workTask.updateMany({ where: { parentId: { in: ids }, archivedAt: null }, data: { parentId: target.id, listId: t!.listId } }),
      this.prisma.workTaskAssignee.createMany({ data: [...new Set(people.map((p) => p.userId))].map((u) => ({ taskId: target.id, userId: u })), skipDuplicates: true }),
      ...(extra ? [this.prisma.workTask.update({ where: { id: target.id }, data: { description: `${t!.description ?? ''}${extra}` } })] : []),
      this.prisma.workTask.updateMany({ where: { id: { in: ids } }, data: { archivedAt: new Date() } }),
    ]);
    await this.detail.log(target.id, userId, 'merged', null, sources.map((s) => s.name));
    return { ok: true, merged: sources.length };
  }

  /** Convert to: subtask of another task, a top-level task, or a list (its subtasks become the list's tasks) */
  async convert(taskUid: string, userId: number, b: { to?: string; parentUid?: string }) {
    const { task } = await this.taskOf(taskUid, userId, 'edit');
    if (b.to === 'task') {
      if (!task.parentId) return { ok: true };
      await this.prisma.workTask.update({ where: { id: task.id }, data: { parentId: null } });
      await this.detail.log(task.id, userId, 'converted', 'subtask', 'task');
      return { ok: true };
    }
    if (b.to === 'subtask') {
      const { task: parent } = await this.taskOf(String(b.parentUid ?? ''), userId, 'edit');
      if (parent.id === task.id) throw new BadRequestException('A task can’t be its own subtask.');
      if (parent.parentId === task.id) throw new BadRequestException('That task is already a subtask of this one.');
      if ((await this.prisma.workTask.count({ where: { parentId: task.id, archivedAt: null } })) > 0) throw new BadRequestException('Move this task’s subtasks first: a subtask can’t have its own subtasks.');
      if (parent.parentId) throw new BadRequestException('Pick a top-level task as the parent.');
      if (parent.listId !== task.listId) await this.work.updateTask(task.id, userId, { listId: parent.listId } as any);
      await this.prisma.workTask.update({ where: { id: task.id }, data: { parentId: parent.id } });
      await this.detail.log(task.id, userId, 'converted', 'task', 'subtask');
      return { ok: true };
    }
    if (b.to === 'list') {
      const row = await this.prisma.workTask.findUnique({ where: { id: task.id }, select: { name: true, description: true, list: { select: { spaceId: true, folderId: true } } } });
      const list = await this.work.createList(row!.list.spaceId, userId, { name: row!.name.slice(0, 200), folderId: row!.list.folderId ?? undefined, description: undefined } as any);
      const kids = await this.prisma.workTask.findMany({ where: { parentId: task.id, archivedAt: null }, select: { id: true } });
      for (const k of kids) await this.work.updateTask(k.id, userId, { listId: list.id } as any);
      await this.prisma.workTask.update({ where: { id: task.id }, data: { archivedAt: new Date() } });
      return { ok: true, list: { id: list.id, uid: list.uid, name: list.name } };
    }
    throw new BadRequestException('Convert to what?');
  }

  // ───────── description history ─────────

  async descriptionHistory(taskUid: string, userId: number) {
    const { task } = await this.taskOf(taskUid, userId, 'view');
    const rows = await this.prisma.workDescriptionVersion.findMany({ where: { taskId: task.id }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, description: true, createdAt: true, userId: true } });
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.userId))] } }, select: USER_MINI });
    return rows.map(({ userId: uId, ...r }) => ({ ...r, user: users.find((x) => x.id === uId) ?? null }));
  }

  async restoreDescription(versionId: number, userId: number) {
    const v = await this.prisma.workDescriptionVersion.findUnique({ where: { id: versionId }, select: { taskId: true, description: true } });
    if (!v) throw new NotFoundException('Version not found.');
    await this.access.requireTask(v.taskId, userId, 'edit');
    await this.work.updateTask(v.taskId, userId, { description: v.description } as any);
    return { ok: true };
  }

  // ───────── templates ─────────

  async templates(workspaceId: number, userId: number) {
    await this.access.requireWorkspace(workspaceId, userId, 'edit');
    const rows = await this.prisma.workTaskTemplate.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 200, select: { id: true, name: true, data: true, createdById: true, createdAt: true } });
    return rows.map((r) => { const d = r.data as TemplateData; return { id: r.id, name: r.name, createdById: r.createdById, createdAt: r.createdAt, taskName: d.name, checklists: d.checklists?.length ?? 0, subtasks: d.subtasks?.length ?? 0 }; });
  }

  async saveTemplate(taskUid: string, userId: number, name?: string) {
    const { task, access } = await this.taskOf(taskUid, userId, 'view');
    await this.access.requireWorkspace(access.workspaceId, userId, 'edit');
    const t = await this.prisma.workTask.findUnique({
      where: { id: task.id },
      select: {
        name: true, description: true, priority: true, timeEstimate: true, taskType: true,
        checklists: { orderBy: [{ order: 'asc' }, { id: 'asc' }], select: { name: true, items: { orderBy: [{ order: 'asc' }, { id: 'asc' }], select: { name: true } } } },
        subtasks: { where: { archivedAt: null }, orderBy: [{ order: 'asc' }, { id: 'asc' }], take: 100, select: { name: true, description: true, priority: true } },
      },
    });
    const data: TemplateData = {
      name: t!.name, description: t!.description, priority: t!.priority, timeEstimate: t!.timeEstimate, taskType: t!.taskType,
      checklists: t!.checklists.map((c) => ({ name: c.name, items: c.items.map((i) => i.name) })),
      subtasks: t!.subtasks.map((s) => ({ name: s.name, description: s.description, priority: s.priority })),
    };
    return this.prisma.workTaskTemplate.create({ data: { workspaceId: access.workspaceId, name: (name ?? '').trim().slice(0, 200) || t!.name, data: data as unknown as Prisma.InputJsonValue, createdById: userId }, select: { id: true, name: true } });
  }

  /** a new task from a template, in the given list */
  async applyTemplate(templateId: number, userId: number, listUid: string, name?: string) {
    const tpl = await this.prisma.workTaskTemplate.findUnique({ where: { id: templateId } });
    if (!tpl) throw new NotFoundException('Template not found.');
    const { list, access } = await this.listOf(listUid, userId);
    if (access.workspaceId !== tpl.workspaceId) throw new BadRequestException('That template is in another workspace.');
    const d = tpl.data as unknown as TemplateData;
    const created: any = await this.work.createTask(list.id, userId, { name: (name ?? '').trim() || d.name, description: d.description ?? undefined, priority: (d.priority as any) ?? undefined } as any);
    if (d.timeEstimate || d.taskType) await this.prisma.workTask.update({ where: { id: created.id }, data: { timeEstimate: d.timeEstimate ?? null, taskType: d.taskType ?? null } });
    let order = 1000;
    for (const c of d.checklists ?? []) {
      await this.prisma.workChecklist.create({ data: { taskId: created.id, name: c.name.slice(0, 200), order: (order += 1000), items: { create: c.items.slice(0, 200).map((n, i) => ({ name: n.slice(0, 500), order: (i + 1) * 1000 })) } } });
    }
    for (const s of (d.subtasks ?? []).slice(0, 100)) {
      await this.work.createTask(list.id, userId, { name: s.name, parentId: created.id, description: s.description ?? undefined, priority: (s.priority as any) ?? undefined } as any);
    }
    return created;
  }

  async deleteTemplate(templateId: number, userId: number) {
    const tpl = await this.prisma.workTaskTemplate.findUnique({ where: { id: templateId }, select: { workspaceId: true, createdById: true } });
    if (!tpl) throw new NotFoundException('Template not found.');
    const a = await this.access.requireWorkspace(tpl.workspaceId, userId, 'view');
    if (tpl.createdById !== userId && !a.canManage) throw new ForbiddenException('Only the person who saved it or an admin can delete it.');
    await this.prisma.workTaskTemplate.delete({ where: { id: templateId } });
    return { ok: true };
  }

  // ───────── email to task ─────────

  private domain() { return process.env.INBOUND_EMAIL_DOMAIN?.trim() || null; }

  async taskEmail(taskUid: string, userId: number, create: boolean) {
    const { task, access } = await this.taskOf(taskUid, userId, 'comment');
    let link = await this.prisma.workLink.findFirst({ where: { kind: 'TASK_EMAIL', targetId: task.id, revokedAt: null } });
    if (!link && create) link = await this.prisma.workLink.create({ data: { token: randomBytes(18).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20), kind: 'TASK_EMAIL', workspaceId: access.workspaceId, targetId: task.id, createdById: userId } });
    const d = this.domain();
    return { address: link && d ? `tk-${link.token}@${d}` : null, token: link?.token ?? null, configured: !!d };
  }

  async revokeTaskEmail(taskUid: string, userId: number) {
    const { task } = await this.taskOf(taskUid, userId, 'comment');
    await this.prisma.workLink.updateMany({ where: { kind: 'TASK_EMAIL', targetId: task.id, revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  // ───────── clips (screen recordings) ─────────

  private clipRow = { id: true, uid: true, title: true, durationSec: true, createdAt: true, createdById: true, workspaceId: true, fileId: true } as const;

  private async shapeClips(rows: { id: number; uid: string; title: string; durationSec: number; createdAt: Date; createdById: number; fileId: number }[]) {
    const files = await this.prisma.file.findMany({ where: { id: { in: rows.map((r) => r.fileId) } }, select: { id: true, url: true, mimeType: true, fileSize: true } });
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } }, select: USER_MINI });
    return rows.map(({ fileId, createdById, ...r }) => ({ ...r, file: files.find((f) => f.id === fileId) ?? null, createdBy: users.find((u) => u.id === createdById) ?? null }));
  }

  async clips(workspaceId: number, userId: number) {
    await this.access.requireWorkspace(workspaceId, userId, 'edit');
    return this.shapeClips(await this.prisma.workClip.findMany({ where: { workspaceId, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 200, select: this.clipRow }));
  }

  async clip(clipUid: string, userId: number) {
    const c = await this.prisma.workClip.findFirst({ where: { uid: clipUid, deletedAt: null }, select: this.clipRow });
    if (!c) throw new NotFoundException('Clip not found.');
    const a = await this.access.forWorkspace(c.workspaceId, userId).catch(() => null);
    if (!a?.canView) throw new NotFoundException('Clip not found.');
    return (await this.shapeClips([c]))[0];
  }

  async createClip(workspaceId: number, userId: number, file: Express.Multer.File | undefined, b: { title?: string; durationSec?: string | number }) {
    await this.access.requireWorkspace(workspaceId, userId, 'comment');
    if (!file) throw new BadRequestException('No recording received.');
    const mime = (file.mimetype || '').split(';')[0];
    if (!CLIP_TYPES.has(mime)) throw new BadRequestException('A clip must be a WebM or MP4 video.');
    const up = await this.storage.upload({ ...file, mimetype: mime } as Express.Multer.File, 'work-clips');
    const f = await this.prisma.file.create({ data: { fileName: up.fileName, mimeType: up.mimeType, fileSize: up.fileSize, storageKey: up.storageKey, url: this.storage.getUrl(up.storageKey), uploadedById: userId } });
    const title = String(b?.title ?? '').trim().slice(0, 200) || `Clip ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
    const dur = Math.max(0, Math.min(6 * 3600, Math.round(Number(b?.durationSec) || 0)));
    const c = await this.prisma.workClip.create({ data: { uid: uid(), workspaceId, fileId: f.id, title, durationSec: dur, createdById: userId }, select: this.clipRow });
    return (await this.shapeClips([c]))[0];
  }

  private async ownClip(clipUid: string, userId: number) {
    const c = await this.prisma.workClip.findFirst({ where: { uid: clipUid, deletedAt: null }, select: { id: true, workspaceId: true, createdById: true, fileId: true } });
    if (!c) throw new NotFoundException('Clip not found.');
    const a = await this.access.requireWorkspace(c.workspaceId, userId, 'view');
    if (c.createdById !== userId && !a.canManage) throw new ForbiddenException('Only the person who recorded it or an admin can change it.');
    return c;
  }

  async renameClip(clipUid: string, userId: number, title: string) {
    const c = await this.ownClip(clipUid, userId);
    await this.prisma.workClip.update({ where: { id: c.id }, data: { title: String(title ?? '').trim().slice(0, 200) || 'Untitled clip' } });
    return { ok: true };
  }

  async deleteClip(clipUid: string, userId: number) {
    const c = await this.ownClip(clipUid, userId);
    await this.prisma.workClip.update({ where: { id: c.id }, data: { deletedAt: new Date() } });
    const f = await this.prisma.file.findUnique({ where: { id: c.fileId }, select: { id: true, storageKey: true } });
    if (f) {
      await this.prisma.file.delete({ where: { id: f.id } }).catch(() => null);
      this.storage.delete(f.storageKey).catch((e) => this.logger.warn(`clip storage delete failed: ${e?.message ?? e}`));
    }
    return { ok: true };
  }

  // ───────── address search (Map view) ─────────

  private geoCache = new Map<string, { at: number; rows: { address: string; lat: number; lng: number }[] }>();
  private geoLast = 0;

  /** OpenStreetMap address search; cached, and at most one lookup a second (their usage policy) */
  async geocode(q: string) {
    const query = String(q ?? '').trim().slice(0, 200);
    if (query.length < 3) return [];
    const key = query.toLowerCase();
    const hit = this.geoCache.get(key);
    if (hit && Date.now() - hit.at < 24 * 3600_000) return hit.rows;
    const wait = this.geoLast + 1100 - Date.now();
    this.geoLast = Math.max(Date.now(), this.geoLast + 1100);
    if (wait > 0) await new Promise((r) => setTimeout(r, Math.min(wait, 5000)));
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`, { headers: { 'User-Agent': 'EzManage/1.0 (Work map view)', 'Accept-Language': 'en' }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) return [];
      const rows = ((await r.json()) as any[]).map((x) => ({ address: String(x.display_name), lat: Number(x.lat), lng: Number(x.lon) })).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng));
      if (this.geoCache.size > 2000) this.geoCache.clear();
      this.geoCache.set(key, { at: Date.now(), rows });
      return rows;
    } catch {
      return [];
    }
  }
}
