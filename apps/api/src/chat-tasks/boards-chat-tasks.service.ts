import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BoardPermission } from '@repo/shared';
import { BoardAccessService } from 'src/boards/board-access.service';
import { TaskCreateService } from 'src/tasks/task-create.service';
import { CellsService } from 'src/cells/cells.service';
import { ChatGateway } from 'src/chat/chat.gateway';
import { ChatService } from 'src/chat/chat.service';
import { WorkAiService } from 'src/work/work-ai.service';
import { resolveStatusCategory } from 'src/common/status-category';

/*
 * Accounts & Invoices (Boards) team chat → tasks: the Task / Many tasks composer, task cards in the
 * chat, and the "Chat work" side panel (tasks with status + resolve, @mentions with done).
 * Items are real board items made through the Boards services as the person (permissions,
 * activity log, automations and notifications behave as usual). Boards and Work data stay apart.
 *
 * Chat lines use the content prefixes `__TASKS__:{json}` (a task card) and `__RESOLVED__:{json}`
 * (an activity line), like the existing `__TASK__:` card, so the chat pipeline is unchanged.
 */

const USER = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;
type Mini = { id: number; firstName: string; lastName: string; avatarUrl: string | null };
const PRIORITY_WORDS: Record<string, RegExp> = {
  URGENT: /urgent|critical|blocker|highest/i,
  HIGH: /high/i,
  NORMAL: /normal|medium|mid/i,
  LOW: /low/i,
};
const dateOf = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === 'string') return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
  if (typeof v === 'object') return dateOf(v.date ?? v.value ?? v.startDate ?? null);
  return null;
};
const plain = (h: string) => h.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

export type ChatTaskItem = { name: string; assigneeIds?: number[]; dueDate?: string | null; priority?: string | null };

@Injectable()
export class BoardsChatTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly creator: TaskCreateService,
    private readonly cells: CellsService,
    private readonly gateway: ChatGateway,
    private readonly ai: WorkAiService,
    private readonly chat: ChatService,
  ) {}

  // ── helpers ──

  /** the channel (in this workspace) and its people; the caller must be in it */
  private async channel(workspaceId: number, channelId: number, userId: number) {
    const ch = await this.prisma.chatChannel.findFirst({
      where: { id: channelId, workspaceId },
      select: {
        id: true, name: true, type: true, workspaceId: true, createdById: true, defaultBoardId: true, defaultGroupId: true,
        members: { select: { userId: true, user: { select: { ...USER, deletedAt: true } } } },
      },
    });
    if (!ch || !ch.members.some((m) => m.userId === userId)) throw new NotFoundException('Channel not found.');
    const people: Mini[] = ch.members.filter((m) => !m.user.deletedAt).map((m) => ({ id: m.user.id, firstName: m.user.firstName, lastName: m.user.lastName, avatarUrl: m.user.avatarUrl }));
    return { ch, people };
  }

  private async can(boardId: number, userId: number, p: BoardPermission) {
    try { await this.access.requirePermission(boardId, userId, p); return true; } catch { return false; }
  }

  /** a board's first status / priority (a status column named "Priority") / date / person columns */
  private async columns(boardId: number) {
    const cols = await this.prisma.boardColumn.findMany({
      where: { boardId, type: { in: ['STATUS', 'DATE', 'PLAIN_DATE', 'PERSON'] } },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, type: true, statusOptions: { where: { isArchived: false }, orderBy: [{ order: 'asc' }, { id: 'asc' }], select: { id: true, label: true, color: true, category: true } } },
    });
    const statuses = cols.filter((c) => c.type === 'STATUS');
    return {
      status: statuses.find((c) => !/priority/i.test(c.name)) ?? null,
      priority: statuses.find((c) => /priority/i.test(c.name)) ?? null,
      date: cols.find((c) => c.type === 'DATE' || c.type === 'PLAIN_DATE') ?? null,
      person: cols.find((c) => c.type === 'PERSON') ?? null,
    };
  }

  private async setCell(taskId: number, columnId: number, value: unknown, userId: number, boardId: number) {
    let cell = await this.prisma.taskCell.findUnique({ where: { taskId_columnId: { taskId, columnId } }, select: { id: true } });
    if (!cell) cell = (await this.cells.create({ taskId, columnId } as any, boardId, userId)) as any;
    await this.cells.updateCell(cell!.id, { value } as any, userId, boardId);
  }

  /** post a system-style line (task card / resolved line) as the person and push it live */
  private async post(channelId: number, userId: number, content: string) {
    const msg = await this.prisma.chatMessage.create({
      data: { channelId, userId, content },
      include: {
        user: { select: USER },
        assignedTo: { select: USER },
        _count: { select: { replies: true } },
        channel: { select: { workspaceId: true } },
        reactions: { select: { id: true, userId: true, emoji: true } },
      },
    });
    await this.prisma.chatChannel.update({ where: { id: channelId }, data: { updatedAt: new Date() } });
    try { this.gateway.server.to(`channel:${channelId}`).emit('message:new', msg); } catch { /* socket server not up */ }
    return msg;
  }

  // ── where tasks can go ──

  /** boards (and their groups) in this workspace where the caller can add items, with the columns they have */
  async targets(workspaceId: number, channelId: number, userId: number) {
    const { ch } = await this.channel(workspaceId, channelId, userId);
    const boards = await this.prisma.board.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
      select: { id: true, uid: true, name: true, groups: { where: { isArchived: false }, orderBy: { order: 'asc' }, select: { id: true, name: true, color: true } } },
    });
    const out: { id: number; uid: string; name: string; groups: { id: number; name: string; color: string | null }[]; has: { person: boolean; date: boolean; status: boolean; priority: boolean } }[] = [];
    for (const b of boards) {
      if (!(await this.can(b.id, userId, BoardPermission.CREATE_TASK))) continue;
      const allowed = await this.access.getAllowedGroupIds(b.id, userId);
      const groups = b.groups.filter((g) => !allowed || allowed.includes(g.id));
      if (!groups.length) continue;
      const c = await this.columns(b.id);
      out.push({ id: b.id, uid: b.uid, name: b.name, groups, has: { person: !!c.person, date: !!c.date, status: !!c.status, priority: !!c.priority } });
    }
    const def = out.find((b) => b.id === ch.defaultBoardId);
    return {
      boards: out,
      default: def ? { boardId: def.id, groupId: def.groups.some((g) => g.id === ch.defaultGroupId) ? ch.defaultGroupId : def.groups[0]!.id } : null,
    };
  }

  async setDefault(workspaceId: number, channelId: number, userId: number, boardId: number | null, groupId: number | null) {
    await this.channel(workspaceId, channelId, userId);
    if (boardId) {
      const g = await this.prisma.group.findFirst({ where: { id: groupId ?? 0, boardId, board: { workspaceId } }, select: { id: true } });
      if (!g) throw new BadRequestException('Pick a group on that board.');
      if (!(await this.can(boardId, userId, BoardPermission.CREATE_TASK))) throw new ForbiddenException("You can't add items to that board.");
    }
    await this.prisma.chatChannel.update({ where: { id: channelId }, data: { defaultBoardId: boardId, defaultGroupId: boardId ? groupId : null } });
    return { ok: true };
  }

  // ── the Tasks panel ──

  async list(workspaceId: number, channelId: number, userId: number) {
    const { ch, people } = await this.channel(workspaceId, channelId, userId);
    const rows = await this.prisma.task.findMany({
      where: { sourceChatChannelId: channelId, group: { board: { workspaceId } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        id: true, name: true, createdAt: true, updatedAt: true, createdById: true, groupId: true,
        group: { select: { name: true, board: { select: { id: true, uid: true, name: true } } } },
        cells: { select: { columnId: true, value: true } },
      },
    });
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { uid: true } });
    const boardIds = [...new Set(rows.map((r) => r.group.board.id))];
    const view = new Map<number, { view: boolean; edit: boolean; groups: number[] | null; cols: Awaited<ReturnType<BoardsChatTasksService['columns']>> }>();
    for (const b of boardIds) {
      const v = await this.can(b, userId, BoardPermission.VIEW);
      view.set(b, { view: v, edit: v && (await this.can(b, userId, BoardPermission.EDIT)), groups: await this.access.getAllowedGroupIds(b, userId), cols: await this.columns(b) });
    }
    const personIds = new Set<number>();
    for (const r of rows) {
      const c = view.get(r.group.board.id)!.cols.person;
      const v = c ? (r.cells.find((x) => x.columnId === c.id)?.value as any) : null;
      for (const u of v?.users ?? []) if (Number.isInteger(Number(u?.id))) personIds.add(Number(u.id));
    }
    const users = personIds.size ? await this.prisma.user.findMany({ where: { id: { in: [...personIds] } }, select: USER }) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const tasks = rows.filter((r) => { const v = view.get(r.group.board.id)!; return v.view && (!v.groups || v.groups.includes(r.groupId)); }).map((r) => {
      const v = view.get(r.group.board.id)!;
      const cell = (id?: number) => (id ? (r.cells.find((x) => x.columnId === id)?.value as any) : undefined);
      const sv = cell(v.cols.status?.id);
      const cat = v.cols.status ? resolveStatusCategory(sv, v.cols.status.statusOptions as any) : null;
      const pv = cell(v.cols.priority?.id);
      const assignees = ((cell(v.cols.person?.id)?.users ?? []) as any[]).map((u) => byId.get(Number(u?.id))).filter(Boolean) as Mini[];
      const done = cat === 'DONE';
      const canResolve = v.edit || r.createdById === userId || ch.createdById === userId || assignees.some((a) => a.id === userId);
      return {
        id: r.id, name: r.name, createdAt: r.createdAt, createdById: r.createdById,
        board: { id: r.group.board.id, uid: r.group.board.uid, name: r.group.board.name }, group: r.group.name, groupId: r.groupId,
        href: `/workspace/${ws?.uid}/board/${r.group.board.uid}?taskId=${r.id}`,
        status: sv?.label ? { label: String(sv.label), color: String(sv.color ?? '#8a8f98'), category: cat } : null,
        statuses: (v.cols.status?.statusOptions ?? []).map((o) => ({ id: o.id, label: o.label, color: o.color, category: o.category })),
        priority: pv?.label ? { label: String(pv.label), color: String(pv.color ?? '#8a8f98') } : null,
        dueDate: dateOf(cell(v.cols.date?.id)), done, doneAt: done ? r.updatedAt : null,
        assignees, canResolve, canEdit: v.edit || canResolve,
      };
    });
    // who can be given work: in a channel, anyone in the workspace (they are added when assigned); in a DM, its people
    const pick = ch.type !== 'CHANNEL' ? people
      : (await this.prisma.workspaceMember.findMany({ where: { workspaceId, deletedAt: null, user: { deletedAt: null } }, select: { user: { select: USER } } })).map((m) => m.user as Mini);
    return { tasks, people: pick, canCreate: true };
  }

  // ── create ──

  async create(workspaceId: number, channelId: number, userId: number, dto: { boardId?: number; groupId?: number; items: ChatTaskItem[] }) {
    const { ch, people } = await this.channel(workspaceId, channelId, userId);
    const items = (dto.items ?? []).map((i) => ({ ...i, name: String(i?.name ?? '').trim() })).filter((i) => i.name);
    if (!items.length) throw new BadRequestException('Add at least one task.');
    if (items.length > 50) throw new BadRequestException('Up to 50 tasks at a time.');
    if (items.some((i) => i.name.length > 500)) throw new BadRequestException('Keep task names under 500 characters.');
    const boardId = dto.boardId ?? ch.defaultBoardId ?? null;
    const groupId = dto.groupId ?? (boardId === ch.defaultBoardId ? ch.defaultGroupId : null) ?? null;
    if (!boardId || !groupId) throw new BadRequestException('Pick the board and group these tasks go to.');
    const group = await this.prisma.group.findFirst({ where: { id: groupId, boardId, isArchived: false, board: { workspaceId } }, select: { id: true } });
    if (!group) throw new BadRequestException('That group is not on a board in this workspace.');
    await this.access.requirePermission(boardId, userId, BoardPermission.CREATE_TASK);
    const allowed = await this.access.getAllowedGroupIds(boardId, userId);
    if (allowed && !allowed.includes(groupId)) throw new ForbiddenException("You can't add items to that group.");
    // who can be given the work: in a DM, its people; in a channel, anyone in the workspace who can see
    // the board — people not in the channel yet are added to it (everyone sees a line)
    const inChat = new Map(people.map((p) => [p.id, p]));
    const wanted = [...new Set(items.flatMap((i) => (i.assigneeIds ?? []).map(Number)))];
    const wsMembers = new Set((await this.prisma.workspaceMember.findMany({ where: { workspaceId, deletedAt: null, userId: { in: wanted } }, select: { userId: true } })).map((m) => m.userId));
    const outside = wanted.filter((id) => !inChat.has(id));
    if (outside.length) {
      if (ch.type !== 'CHANNEL') throw new BadRequestException('Tasks can only go to people in this chat.');
      if (outside.some((id) => !wsMembers.has(id))) throw new BadRequestException('Tasks can only go to people in this workspace.');
      for (const id of outside) {
        if (!(await this.can(boardId, id, BoardPermission.VIEW))) {
          const u = await this.prisma.user.findUnique({ where: { id }, select: { firstName: true, lastName: true } });
          throw new BadRequestException(`${`${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || 'Someone'} can't see that board — pick another board or share it with them first.`);
        }
      }
      const extra = await this.prisma.user.findMany({ where: { id: { in: outside } }, select: USER });
      for (const u of extra) inChat.set(u.id, u as Mini);
    }
    for (const i of items) {
      const ids = [...new Set((i.assigneeIds ?? []).map(Number))];
      if (ids.some((id) => !inChat.has(id) || !wsMembers.has(id))) throw new BadRequestException('Tasks can only go to people in this chat.');
      i.assigneeIds = ids;
      if (i.dueDate && !/^\d{4}-\d{2}-\d{2}/.test(String(i.dueDate))) throw new BadRequestException('Use dates like 2026-11-20.');
    }
    const cols = await this.columns(boardId);
    const missing: string[] = [];
    if (items.some((i) => i.assigneeIds!.length) && !cols.person) missing.push('person');
    if (items.some((i) => i.dueDate) && !cols.date) missing.push('date');
    if (items.some((i) => i.priority) && !cols.priority) missing.push('priority');

    const ids: number[] = [];
    for (const i of items) {
      const t = await this.creator.create({ groupId, name: i.name } as any, userId, boardId);
      ids.push(t.id);
      await this.prisma.task.update({ where: { id: t.id }, data: { sourceChatChannelId: channelId } });
      if (cols.person && i.assigneeIds!.length) {
        await this.setCell(t.id, cols.person.id, { users: i.assigneeIds!.map((id) => { const p = inChat.get(id)!; return { id: p.id, firstName: p.firstName, lastName: p.lastName, avatarUrl: p.avatarUrl }; }) }, userId, boardId);
      }
      if (cols.date && i.dueDate) await this.setCell(t.id, cols.date.id, { date: String(i.dueDate).slice(0, 10) }, userId, boardId);
      if (cols.priority && i.priority) {
        const want = String(i.priority).toUpperCase();
        const opt = cols.priority.statusOptions.find((o) => o.label.toUpperCase() === want) ?? cols.priority.statusOptions.find((o) => PRIORITY_WORDS[want]?.test(o.label));
        if (opt) await this.setCell(t.id, cols.priority.id, { label: opt.label, color: opt.color }, userId, boardId);
      }
    }
    if (outside.length) {
      const { added, note } = await this.chat.addPeople(channelId, userId, outside, outside.length === 1 ? 'a task was assigned to them' : 'tasks were assigned to them');
      for (const u of added) this.gateway.addSocketToChannel(u, channelId);
      if (note) try { this.gateway.server.to(`channel:${channelId}`).emit('message:new', note); } catch { /* socket server not up */ }
    }
    const message = await this.post(channelId, userId, `__TASKS__:${JSON.stringify({ boardId, taskIds: ids })}`);
    return { message, taskIds: ids, missing };
  }

  // ── resolve / status ──

  private async editableTask(workspaceId: number, channelId: number, userId: number, taskId: number) {
    const { tasks } = await this.list(workspaceId, channelId, userId);
    const t = tasks.find((x) => x.id === taskId);
    if (!t) throw new NotFoundException('That task is not from this chat.');
    if (!t.canResolve) throw new ForbiddenException('Only the people on it, its creator, the channel owner or board editors can change it.');
    return t;
  }

  async resolve(workspaceId: number, channelId: number, userId: number, taskId: number, done: boolean) {
    const t = await this.editableTask(workspaceId, channelId, userId, taskId);
    const target = done ? t.statuses.find((s) => s.category === 'DONE') : t.statuses.find((s) => s.category === 'NOT_STARTED') ?? t.statuses.find((s) => s.category !== 'DONE');
    if (!target) throw new BadRequestException(done ? 'This board has no "done" status.' : 'This board has no open status to go back to.');
    const cols = await this.columns(t.board.id);
    await this.setCell(t.id, cols.status!.id, { label: target.label, color: target.color }, userId, t.board.id);
    const message = await this.post(channelId, userId, `__RESOLVED__:${JSON.stringify({ taskId: t.id, name: t.name, done })}`);
    return { ok: true, message };
  }

  async setStatus(workspaceId: number, channelId: number, userId: number, taskId: number, statusId: number) {
    const t = await this.editableTask(workspaceId, channelId, userId, taskId);
    const s = t.statuses.find((x) => x.id === statusId);
    if (!s) throw new BadRequestException('That status is not on this board.');
    const cols = await this.columns(t.board.id);
    await this.setCell(t.id, cols.status!.id, { label: s.label, color: s.color }, userId, t.board.id);
    return { ok: true };
  }

  // ── mentions ──

  async mentions(workspaceId: number, channelId: number, userId: number) {
    const { people } = await this.channel(workspaceId, channelId, userId);
    const msgs = await this.prisma.chatMessage.findMany({
      where: { channelId, isSystemMessage: false, OR: [{ content: { contains: '@' } }, { assignedToId: { not: null } }] },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: { id: true, content: true, createdAt: true, userId: true, user: { select: USER }, assignedTo: { select: USER }, mentionDone: { select: { userId: true } } },
    });
    const named = people.map((p) => ({ p, full: `${p.firstName} ${p.lastName}`.toLowerCase(), first: p.firstName.toLowerCase() }));
    const out: { id: number; at: Date; author: Mini; mine: boolean; snippet: string; mentioned: { user: Mini; done: boolean }[]; assignee: Mini | null; forMe: boolean; done: boolean; canToggle: boolean }[] = [];
    for (const m of msgs) {
      if (m.content.startsWith('__TASK')) continue;
      const text = plain(m.content);
      const said = [...text.matchAll(/@([\p{L}\p{N}_.-]+(?:\s[\p{L}\p{N}_.-]+)?)/gu)].map((x) => x[1]!.toLowerCase());
      const mentioned = named.filter((n) => n.p.id !== m.userId && said.some((s) => n.full.startsWith(s) || s.startsWith(n.first) && (s === n.first || s.startsWith(`${n.first} `)))).map((n) => n.p);
      if (m.assignedTo && !mentioned.some((x) => x.id === m.assignedTo!.id)) mentioned.push(m.assignedTo as Mini);
      if (!mentioned.length) continue;
      const doneBy = new Set(m.mentionDone.map((d) => d.userId));
      const list = mentioned.map((u) => ({ user: u, done: doneBy.has(u.id) }));
      out.push({
        id: m.id, at: m.createdAt, author: m.user, mine: m.userId === userId, snippet: text.slice(0, 280),
        mentioned: list, assignee: m.assignedTo, forMe: list.some((x) => x.user.id === userId),
        done: list.every((x) => x.done), canToggle: m.userId === userId || list.some((x) => x.user.id === userId),
      });
    }
    return out;
  }

  /** the mentioned person marks it done for themself; the author marks it for everyone */
  async mentionDone(workspaceId: number, messageId: number, userId: number, done: boolean) {
    const m = await this.prisma.chatMessage.findFirst({ where: { id: messageId, channel: { workspaceId } }, select: { id: true, channelId: true, userId: true } });
    if (!m) throw new NotFoundException('Message not found.');
    const list = (await this.mentions(workspaceId, m.channelId, userId)).find((x) => x.id === messageId);
    if (!list || !list.canToggle) throw new ForbiddenException('Only the author or the people mentioned can mark it done.');
    const who = m.userId === userId ? list.mentioned.map((x) => x.user.id) : [userId];
    if (done) await this.prisma.chatMentionDone.createMany({ data: who.map((u) => ({ messageId, userId: u })), skipDuplicates: true });
    else await this.prisma.chatMentionDone.deleteMany({ where: { messageId, userId: { in: who } } });
    return { ok: true };
  }

  // ── AI ──

  async aiSplit(workspaceId: number, channelId: number, userId: number, text: string, tz?: string) {
    const { people } = await this.channel(workspaceId, channelId, userId);
    const zone = typeof tz === 'string' && /^[A-Za-z_]+(\/[A-Za-z_+-]+)*$/.test(tz) ? tz : 'UTC';
    return this.ai.splitTasks(String(text ?? ''), people.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`.trim() })), zone);
  }
}
