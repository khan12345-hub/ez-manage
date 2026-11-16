import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BoardPermission } from '@repo/shared';
import { WorkService } from 'src/work/work.service';
import { CommentsService } from 'src/comments/comments.service';
import { CellsService } from 'src/cells/cells.service';
import { BoardAccessService } from 'src/boards/board-access.service';
import { resolveStatusCategory } from 'src/common/status-category';
import { CeoTowerService } from './ceo-tower.service';

const USER_MINI = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;
const escapeHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Boards comments are HTML: show them as plain text (line breaks kept) — nothing from them runs */
const htmlToText = (h: string) =>
  h.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n').trim();
const dateOf = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === 'string') return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
  if (typeof v === 'object') return dateOf(v.date ?? v.value ?? v.from ?? v.to ?? null);
  return null;
};

export type Source = 'boards' | 'work';
type Person = { id: number; firstName: string; lastName: string; avatarUrl: string | null };
export type CeoTaskFile = { name: string; mime: string; url: string };
export type CeoTaskComment = { id: number; parentId: number | null; user: Person | null; text: string; createdAt: Date; files: CeoTaskFile[] };
const FILE = { select: { fileName: true, mimeType: true, url: true } } as const;
/** files CEO Tower accepts on an instruction: images, PDF, Office, text, audio (voice notes) */
export const CEO_FILE_TYPES = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/(plain|csv)|audio\/(webm|ogg|mpeg|mp4|wav|x-m4a)|video\/webm|application\/(msword|vnd\.openxmlformats-officedocument\.[\w.]+|vnd\.ms-excel|vnd\.ms-powerpoint))(;.*)?$/;
export type CeoTaskDetail = {
  source: Source; id: number; uid: string; name: string; description: string | null;
  company: { key: string; name: string }; where: string; href: string;
  status: { id: number | null; label: string; color: string; category: string | null } | null;
  statuses: { id: number; label: string; color: string; category: string }[];
  priority: string | null; due: string | null; done: boolean; createdAt: Date;
  createdBy: Person | null; assignees: Person[]; comments: CeoTaskComment[];
  /** who can be put on this task (Work: workspace members; Boards: board members) */
  people: Person[];
  /** what can be edited here: Boards has no priority, and a board may lack a date / person column */
  editable: { due: boolean; people: boolean; priority: boolean };
};
const PRIORITIES = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];

/**
 * CEO Tower → one task, from either product: read inside the CEO's companies; comment and
 * status changes go through the product's own services as the CEO (its permission checks,
 * notifications and activity log), so nothing bypasses Boards or Work.
 */
@Injectable()
export class CeoTaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tower: CeoTowerService,
    private readonly work: WorkService,
    private readonly comments: CommentsService,
    private readonly cells: CellsService,
    private readonly boardAccess: BoardAccessService,
  ) {}

  private async scope(userId: number) {
    const own = await this.tower.owned(userId);
    if (!own.boards.length && !own.work.length) throw new ForbiddenException('CEO Tower is for company owners and the people they share it with.');
    return own;
  }

  async get(userId: number, source: Source, id: number): Promise<CeoTaskDetail> {
    const own = await this.scope(userId);
    return source === 'work' ? this.getWork(own, id) : this.getBoards(own, id);
  }

  private async getWork(own: Awaited<ReturnType<CeoTowerService['owned']>>, id: number): Promise<CeoTaskDetail> {
    const t = await this.prisma.workTask.findFirst({
      where: { id, archivedAt: null, list: { space: { workspaceId: { in: own.work.map((w) => w.id) } } } },
      select: {
        id: true, uid: true, name: true, description: true, priority: true, dueDate: true, completedAt: true, createdAt: true,
        status: { select: { id: true, name: true, color: true, category: true } },
        createdBy: { select: USER_MINI },
        assignees: { select: { user: { select: USER_MINI } } },
        list: { select: { id: true, uid: true, name: true, folderId: true, spaceId: true, folder: { select: { name: true } }, space: { select: { name: true, workspaceId: true } } } },
      },
    });
    if (!t) throw new NotFoundException('That task is not in your companies.');
    const [statuses, comments] = await Promise.all([
      this.work.effectiveStatuses({ id: t.list.id, folderId: t.list.folderId, spaceId: t.list.spaceId }),
      this.prisma.workComment.findMany({ where: { taskId: t.id, deletedAt: null }, orderBy: { createdAt: 'asc' }, take: 300, select: { id: true, parentId: true, content: true, createdAt: true, user: { select: USER_MINI }, attachments: { select: { file: FILE } } } }),
    ]);
    const ws = own.work.find((w) => w.id === t.list.space.workspaceId)!;
    const members = await this.prisma.workMember.findMany({ where: { workspaceId: ws.id, user: { deletedAt: null } }, orderBy: { createdAt: 'asc' }, select: { user: { select: USER_MINI } } });
    return {
      people: members.map((m) => m.user), editable: { due: true, people: true, priority: true },
      source: 'work', id: t.id, uid: t.uid, name: t.name, description: t.description ? htmlToText(t.description) : null,
      company: { key: `work:${ws.id}`, name: ws.name },
      where: [t.list.space.name, t.list.folder?.name, t.list.name].filter(Boolean).join(' / '),
      href: `/work/${ws.uid}/list/${t.list.uid}?task=${t.uid}`,
      status: t.status ? { id: t.status.id, label: t.status.name, color: t.status.color, category: t.status.category } : null,
      statuses: (statuses as any[]).map((s) => ({ id: s.id, label: s.name, color: s.color, category: s.category })),
      priority: t.priority ?? null, due: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null, done: !!t.completedAt,
      createdAt: t.createdAt, createdBy: t.createdBy, assignees: t.assignees.map((a) => a.user),
      comments: comments.map((c) => ({ id: c.id, parentId: c.parentId, user: c.user, text: c.content, createdAt: c.createdAt, files: c.attachments.map((a) => ({ name: a.file.fileName, mime: a.file.mimeType, url: a.file.url })) })),
    };
  }

  /** a Boards task's first STATUS / DATE / PERSON columns (the same rule the rest of CEO Tower uses) */
  private async boardColumns(boardId: number) {
    const cols = await this.prisma.boardColumn.findMany({
      where: { boardId, type: { in: ['STATUS', 'DATE', 'PLAIN_DATE', 'PERSON'] } },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      select: { id: true, type: true, statusOptions: { where: { isArchived: false }, orderBy: [{ order: 'asc' }, { id: 'asc' }], select: { id: true, label: true, color: true, category: true } } },
    });
    return {
      status: cols.find((c) => c.type === 'STATUS'),
      date: cols.find((c) => c.type === 'DATE' || c.type === 'PLAIN_DATE'),
      person: cols.find((c) => c.type === 'PERSON'),
    };
  }

  private async getBoards(own: Awaited<ReturnType<CeoTowerService['owned']>>, id: number): Promise<CeoTaskDetail> {
    const t = await this.prisma.task.findFirst({
      where: { id, group: { board: { workspaceId: { in: own.boards.map((w) => w.id) } } } },
      select: {
        id: true, name: true, createdAt: true, createdBy: { select: USER_MINI },
        group: { select: { name: true, board: { select: { id: true, uid: true, name: true, workspaceId: true } } } },
        cells: { select: { columnId: true, value: true } },
      },
    });
    if (!t) throw new NotFoundException('That task is not in your companies.');
    const board = t.group.board;
    const cols = await this.boardColumns(board.id);
    const cell = (colId?: number) => (colId ? t.cells.find((c) => c.columnId === colId)?.value : undefined) as any;
    const sv = cell(cols.status?.id);
    const cat = cols.status ? resolveStatusCategory(sv, cols.status.statusOptions as any) : null;
    const opt = cols.status?.statusOptions.find((o) => o.label === sv?.label);
    const personIds = ((cell(cols.person?.id)?.users ?? []) as any[]).map((u) => Number(u?.id)).filter(Number.isInteger);
    const [people, comments] = await Promise.all([
      personIds.length ? this.prisma.user.findMany({ where: { id: { in: personIds } }, select: USER_MINI }) : [],
      this.prisma.taskComment.findMany({ where: { taskId: t.id }, orderBy: { createdAt: 'asc' }, take: 300, select: { id: true, parentId: true, content: true, createdAt: true, user: { select: USER_MINI }, files: { select: { file: FILE } } } }),
    ]);
    const ws = own.boards.find((w) => w.id === board.workspaceId)!;
    const boardPeople = await this.prisma.boardMember.findMany({ where: { boardId: board.id, user: { deletedAt: null } }, select: { user: { select: USER_MINI } } });
    return {
      people: boardPeople.map((m) => m.user), editable: { due: !!cols.date, people: !!cols.person, priority: false },
      source: 'boards', id: t.id, uid: String(t.id), name: t.name, description: null,
      company: { key: `boards:${ws.id}`, name: ws.name },
      where: `${board.name} / ${t.group.name}`,
      href: `/workspace/${ws.uid}/board/${board.uid}?taskId=${t.id}`,
      status: sv?.label ? { id: opt?.id ?? null, label: String(sv.label), color: String(sv.color ?? '#8a8f98'), category: cat } : null,
      statuses: (cols.status?.statusOptions ?? []).map((o) => ({ id: o.id, label: o.label, color: o.color, category: o.category })),
      priority: null, due: dateOf(cell(cols.date?.id)), done: cat === 'DONE',
      createdAt: t.createdAt, createdBy: t.createdBy, assignees: people,
      comments: comments.map((c) => ({ id: c.id, parentId: c.parentId, user: c.user, text: htmlToText(c.content), createdAt: c.createdAt, files: c.files.map((f) => ({ name: f.file.fileName, mime: f.file.mimeType, url: f.file.url })) })),
    };
  }

  /** "Send instruction": a comment on the task as the CEO (assignees and creator are notified by the product) */
  async comment(userId: number, source: Source, id: number, text: string, parentId?: number, extra: { attachmentIds?: number[]; files?: Express.Multer.File[] } = {}) {
    const files = extra.files ?? [];
    const hasFiles = files.length > 0 || (extra.attachmentIds?.length ?? 0) > 0;
    const body = (text ?? '').trim() || (hasFiles ? (files.some((f) => f.mimetype.startsWith('audio/')) ? '🎙️ Voice note' : '📎 Attachment') : '');
    if (!body) throw new BadRequestException('Write something.');
    for (const f of files) {
      if (!CEO_FILE_TYPES.test(f.mimetype)) throw new BadRequestException(`"${f.originalname}" can't be attached here. Use images, PDF, Office, text or audio files.`);
      if (f.size > 25 * 1024 * 1024) throw new BadRequestException(`"${f.originalname}" is over 25 MB.`);
    }
    if (body.length > 10000) throw new BadRequestException('Keep it under 10,000 characters.');
    await this.get(userId, source, id); // must be in the CEO's companies
    if (source === 'work') {
      await this.work.createComment(id, userId, { content: body, ...(parentId ? { parentId } : {}), ...(extra.attachmentIds?.length ? { attachmentIds: extra.attachmentIds } : {}) } as any);
    } else {
      await this.boardAccess.requireTaskPermission(id, userId, BoardPermission.EDIT);
      const html = `<p>${escapeHtml(body).replace(/\n/g, '<br>')}</p>`;
      if (parentId) {
        const parent = await this.prisma.taskComment.findFirst({ where: { id: parentId, taskId: id }, select: { id: true, parentId: true } });
        if (!parent) throw new BadRequestException('That comment is not on this task.');
        await this.comments.createReply(id, parent.parentId ?? parent.id, userId, { content: html } as any, files);
      } else {
        await this.comments.create(id, userId, { content: html } as any, files);
      }
    }
    return this.get(userId, source, id);
  }

  /** due date / people / priority, through the product as the CEO (its checks and notifications) */
  async update(userId: number, source: Source, id: number, dto: { due?: string | null; assigneeIds?: number[]; priority?: string | null }) {
    const task = await this.get(userId, source, id);
    if (dto.due !== undefined && dto.due !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dto.due)) throw new BadRequestException('Use a date like 2026-11-20.');
    if (dto.assigneeIds) {
      const ok = new Set(task.people.map((p) => p.id));
      const ids = [...new Set(dto.assigneeIds.map(Number))];
      if (ids.some((i) => !ok.has(i))) throw new BadRequestException(source === 'boards' ? 'Pick people who are on this board.' : 'Pick people in this company.');
      dto.assigneeIds = ids;
    }
    if (source === 'work') {
      if (dto.priority !== undefined && dto.priority !== null && !PRIORITIES.includes(dto.priority)) throw new BadRequestException('Unknown priority.');
      await this.work.updateTask(id, userId, {
        ...(dto.due !== undefined ? { dueDate: dto.due ? new Date(`${dto.due}T17:00:00Z`).toISOString() : null } : {}),
        ...(dto.assigneeIds ? { assigneeIds: dto.assigneeIds } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      } as any);
      return this.get(userId, source, id);
    }
    if (dto.priority !== undefined) throw new BadRequestException('Boards tasks have no priority.');
    const { boardId } = (await this.boardAccess.requireTaskPermission(id, userId, BoardPermission.EDIT)) as any;
    const cols = await this.boardColumns(boardId);
    const cellFor = async (columnId: number) => {
      const c = await this.prisma.taskCell.findUnique({ where: { taskId_columnId: { taskId: id, columnId } }, select: { id: true } });
      return c ?? ((await this.cells.create({ taskId: id, columnId } as any, boardId, userId)) as any as { id: number });
    };
    if (dto.due !== undefined) {
      if (!cols.date) throw new BadRequestException('This board has no date column.');
      const cell = await cellFor(cols.date.id);
      await this.cells.updateCell(cell.id, { value: dto.due ? { date: dto.due } : null } as any, userId, boardId);
    }
    if (dto.assigneeIds) {
      if (!cols.person) throw new BadRequestException('This board has no person column.');
      const users = task.people.filter((p) => dto.assigneeIds!.includes(p.id)).map((p) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName }));
      const cell = await cellFor(cols.person.id);
      await this.cells.updateCell(cell.id, { value: { users } } as any, userId, boardId);
    }
    return this.get(userId, source, id);
  }

  /** change status (or "Mark completed": the first DONE status) through the product, as the CEO */
  async setStatus(userId: number, source: Source, id: number, statusId?: number) {
    const task = await this.get(userId, source, id);
    const target = statusId ? task.statuses.find((s) => s.id === statusId) : task.statuses.find((s) => s.category === 'DONE');
    if (!target) throw new BadRequestException(statusId ? 'That status is not available for this task.' : 'This task has no "done" status to move to.');
    if (source === 'work') {
      await this.work.updateTask(id, userId, { statusId: target.id } as any);
    } else {
      const { boardId } = (await this.boardAccess.requireTaskPermission(id, userId, BoardPermission.EDIT)) as any;
      const cols = await this.boardColumns(boardId);
      if (!cols.status) throw new BadRequestException('This board has no status column.');
      let cell = await this.prisma.taskCell.findUnique({ where: { taskId_columnId: { taskId: id, columnId: cols.status.id } }, select: { id: true } });
      if (!cell) cell = (await this.cells.create({ taskId: id, columnId: cols.status.id } as any, boardId, userId)) as any;
      await this.cells.updateCell(cell!.id, { value: { label: target.label, color: target.color } } as any, userId, boardId);
    }
    return this.get(userId, source, id);
  }
}
