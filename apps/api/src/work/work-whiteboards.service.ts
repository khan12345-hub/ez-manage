import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from 'prisma/prisma.service';
import { WorkAccessService } from './work-access.service';

const USER_MINI = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;
const uid = () => randomBytes(9).toString('base64url');
const TYPES = new Set(['note', 'rect', 'ellipse', 'text', 'arrow', 'pen']);
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 10) / 10 : d);

/** Work → Whiteboards: sticky notes, shapes, text, arrows and freehand drawing, saved as JSON. */
@Injectable()
export class WorkWhiteboardsService {
  constructor(private readonly prisma: PrismaService, private readonly access: WorkAccessService) {}

  /** set by the live editor service: a shapes save that didn't come from the live editor */
  onExternalEdit: ((boardId: number) => void) | null = null;

  /** keep only known shape fields (no HTML, bounded sizes) */
  private clean(data: unknown) {
    const shapes = Array.isArray((data as any)?.shapes) ? (data as any).shapes : [];
    if (shapes.length > 2000) throw new BadRequestException('Up to 2,000 items on a board.');
    return {
      shapes: shapes.filter((s: any) => TYPES.has(s?.type)).map((s: any) => ({
        id: String(s.id ?? uid()).slice(0, 40), type: s.type,
        x: num(s.x), y: num(s.y), w: num(s.w, 160), h: num(s.h, 100),
        color: /^#[0-9a-f]{6}$/i.test(s.color ?? '') ? s.color : '#fde68a',
        ...(typeof s.text === 'string' ? { text: s.text.slice(0, 2000) } : {}),
        ...(Array.isArray(s.points) ? { points: s.points.slice(0, 2000).map((p: any) => [num(p?.[0]), num(p?.[1])]) } : {}),
      })),
    };
  }

  private async boardOf(idOrUid: string, userId: number, level: 'view' | 'edit') {
    const b = await this.prisma.workWhiteboard.findFirst({ where: /^\d+$/.test(idOrUid) ? { id: Number(idOrUid) } : { uid: idOrUid } });
    if (!b || b.archivedAt) throw new NotFoundException('Whiteboard not found.');
    await this.access.requireWorkspace(b.workspaceId, userId, level);
    return b;
  }

  async list(workspaceId: number, userId: number) {
    await this.access.requireWorkspace(workspaceId, userId, 'view');
    const rows = await this.prisma.workWhiteboard.findMany({ where: { workspaceId, archivedAt: null }, orderBy: { updatedAt: 'desc' }, select: { id: true, uid: true, title: true, updatedAt: true, updatedById: true, data: true } });
    const people = await this.prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.updatedById))] } }, select: USER_MINI });
    const byId = new Map(people.map((p) => [p.id, p]));
    return rows.map(({ data, ...r }) => ({ ...r, items: Array.isArray((data as any)?.shapes) ? (data as any).shapes.length : 0, updatedBy: byId.get(r.updatedById) ?? null }));
  }

  async create(workspaceId: number, userId: number, title?: string) {
    await this.access.requireWorkspace(workspaceId, userId, 'edit');
    return this.prisma.workWhiteboard.create({ data: { uid: uid(), workspaceId, title: (title ?? '').trim().slice(0, 200) || 'Untitled whiteboard', data: { shapes: [] }, createdById: userId, updatedById: userId } });
  }

  async get(idOrUid: string, userId: number) {
    const b = await this.boardOf(idOrUid, userId, 'view');
    let canEdit = true;
    try { await this.access.requireWorkspace(b.workspaceId, userId, 'edit'); } catch { canEdit = false; }
    const { yState, ...rest } = b;
    return { ...rest, canEdit, live: !!yState?.length };
  }

  /** the row with its live-editing state (for the live editor service only) */
  async forCollab(idOrUid: string, userId: number) {
    const b = await this.get(idOrUid, userId);
    const row = await this.prisma.workWhiteboard.findUnique({ where: { id: b.id }, select: { yState: true } });
    return { ...b, yState: row?.yState ?? null };
  }

  /** live: the shapes copy saved by the live editor (the live state is already up to date) */
  async update(idOrUid: string, userId: number, dto: { title?: string; data?: unknown; live?: boolean }) {
    const b = await this.boardOf(idOrUid, userId, 'edit');
    const data: Record<string, unknown> = { updatedById: userId };
    if (dto.title !== undefined) data.title = dto.title.trim().slice(0, 200) || 'Untitled whiteboard';
    if (dto.data !== undefined) data.data = this.clean(dto.data);
    const u = await this.prisma.workWhiteboard.update({ where: { id: b.id }, data, select: { id: true, uid: true, title: true, updatedAt: true } });
    if (dto.data !== undefined && !dto.live && b.yState) this.onExternalEdit?.(b.id);
    return u;
  }

  async archive(idOrUid: string, userId: number) {
    const b = await this.boardOf(idOrUid, userId, 'edit');
    await this.prisma.workWhiteboard.update({ where: { id: b.id }, data: { archivedAt: new Date() } });
    return { ok: true };
  }
}
