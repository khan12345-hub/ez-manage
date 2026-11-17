import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from 'prisma/prisma.service';
import { WorkAccessService } from './work-access.service';

const USER_MINI = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;
const uid = () => randomBytes(9).toString('base64url');

/**
 * Doc HTML comes from the editor; keep it to formatting only: no scripts / styles / frames /
 * forms, no event handlers, no javascript: links.
 */
export function cleanDocHtml(html: string) {
  return String(html ?? '')
    // whole blocks first (tag + what is inside), then any stray opening / closing tags
    .replace(/<\s*(script|style|iframe|object|embed|form|textarea|select)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|form|input|button|textarea|select|link|meta|base)\b[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*(javascript|vbscript|data:text\/html)[^"']*\2/gi, '$1="#"')
    .slice(0, 2_000_000);
}

/** Work → Docs: rich-text pages in a workspace (optionally a space), nested one under another. */
@Injectable()
export class WorkDocsService {
  constructor(private readonly prisma: PrismaService, private readonly access: WorkAccessService) {}

  /** set by the live editor service: a content save that didn't come from the live editor */
  onExternalEdit: ((docId: number) => void) | null = null;

  private async docOf(idOrUid: string, userId: number, level: 'view' | 'edit') {
    const d = await this.prisma.workDoc.findFirst({ where: /^\d+$/.test(idOrUid) ? { id: Number(idOrUid) } : { uid: idOrUid } });
    if (!d || d.archivedAt) throw new NotFoundException('Doc not found.');
    const ws = await this.access.requireWorkspace(d.workspaceId, userId, level);
    if (d.spaceId) await this.access.requireSpace(d.spaceId, userId, level);
    else if (ws.scope === 'shared') throw new NotFoundException('Doc not found.');
    return d;
  }

  async list(workspaceId: number, userId: number) {
    const ws = await this.access.requireWorkspace(workspaceId, userId, 'view');
    const docs = await this.prisma.workDoc.findMany({
      where: { workspaceId, archivedAt: null, ...(ws.scope === 'shared' ? { spaceId: { not: null } } : {}) },
      orderBy: [{ updatedAt: 'desc' }],
      select: { id: true, uid: true, title: true, spaceId: true, parentId: true, updatedAt: true, createdById: true, updatedById: true, content: true },
    });
    // only docs in spaces this person can open
    const spaceIds = [...new Set(docs.map((d) => d.spaceId).filter((v): v is number => !!v))];
    const ok = new Set<number>();
    for (const s of spaceIds) { try { await this.access.requireSpace(s, userId, 'view'); ok.add(s); } catch { /* hidden */ } }
    const people = await this.prisma.user.findMany({ where: { id: { in: [...new Set(docs.map((d) => d.updatedById))] } }, select: USER_MINI });
    const byId = new Map(people.map((p) => [p.id, p]));
    return docs.filter((d) => !d.spaceId || ok.has(d.spaceId)).map(({ content, ...d }) => ({
      ...d, updatedBy: byId.get(d.updatedById) ?? null,
      preview: content.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160),
    }));
  }

  async get(idOrUid: string, userId: number) {
    const d = await this.docOf(idOrUid, userId, 'view');
    const [by, children] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: d.updatedById }, select: USER_MINI }),
      this.prisma.workDoc.findMany({ where: { parentId: d.id, archivedAt: null }, orderBy: { createdAt: 'asc' }, select: { id: true, uid: true, title: true } }),
    ]);
    let canEdit = true;
    try { await this.access.requireWorkspace(d.workspaceId, userId, 'edit'); if (d.spaceId) await this.access.requireSpace(d.spaceId, userId, 'edit'); } catch { canEdit = false; }
    const parent = d.parentId ? await this.prisma.workDoc.findUnique({ where: { id: d.parentId }, select: { uid: true, title: true } }) : null;
    const { yState, ...rest } = d;
    return { ...rest, updatedBy: by, children, parent, canEdit, live: !!yState?.length };
  }

  /** the row with its live-editing state (for the live editor service only) */
  async forCollab(idOrUid: string, userId: number) {
    const d = await this.get(idOrUid, userId);
    const row = await this.prisma.workDoc.findUnique({ where: { id: d.id }, select: { yState: true } });
    return { ...d, yState: row?.yState ?? null };
  }

  async create(workspaceId: number, userId: number, dto: { title?: string; spaceId?: number | null; parentId?: number | null; content?: string }) {
    await this.access.requireWorkspace(workspaceId, userId, 'edit');
    let spaceId = dto.spaceId ? Number(dto.spaceId) : null;
    if (dto.parentId) {
      const p = await this.docOf(String(dto.parentId), userId, 'edit');
      if (p.workspaceId !== workspaceId) throw new BadRequestException('That page is in another workspace.');
      spaceId = p.spaceId;
    }
    if (spaceId) {
      const s = await this.prisma.space.findFirst({ where: { id: spaceId, workspaceId }, select: { id: true } });
      if (!s) throw new BadRequestException('That space is not in this workspace.');
      await this.access.requireSpace(spaceId, userId, 'edit');
    }
    return this.prisma.workDoc.create({
      data: { uid: uid(), workspaceId, spaceId, parentId: dto.parentId ? Number(dto.parentId) : null, title: (dto.title ?? '').trim().slice(0, 300) || 'Untitled', content: cleanDocHtml(dto.content ?? ''), createdById: userId, updatedById: userId },
    });
  }

  /** live: the HTML copy saved by the live editor (the live state is already up to date) */
  async update(idOrUid: string, userId: number, dto: { title?: string; content?: string; live?: boolean }) {
    const d = await this.docOf(idOrUid, userId, 'edit');
    const data: Record<string, unknown> = { updatedById: userId };
    if (dto.title !== undefined) data.title = dto.title.trim().slice(0, 300) || 'Untitled';
    if (dto.content !== undefined) data.content = cleanDocHtml(dto.content);
    const u = await this.prisma.workDoc.update({ where: { id: d.id }, data, select: { id: true, uid: true, title: true, updatedAt: true } });
    if (dto.content !== undefined && !dto.live && d.yState) this.onExternalEdit?.(d.id);
    return u;
  }

  /** archive the page and its sub-pages */
  async archive(idOrUid: string, userId: number) {
    const d = await this.docOf(idOrUid, userId, 'edit');
    const ids = [d.id];
    for (let i = 0; i < ids.length && ids.length < 500; i++) {
      const kids = await this.prisma.workDoc.findMany({ where: { parentId: ids[i] }, select: { id: true } });
      ids.push(...kids.map((k) => k.id));
    }
    await this.prisma.workDoc.updateMany({ where: { id: { in: ids } }, data: { archivedAt: new Date() } });
    return { ok: true, archived: ids.length };
  }
}
