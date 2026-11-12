import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { WorkNotifyService } from 'src/work/work-notify.service';
import { NotificationType } from 'generated/prisma/enums';
import { isDoneCategory, resolveStatusCategory, type StatusCategory } from 'src/common/status-category';

/**
 * CEO Tower — a read-only view across every company the person OWNS:
 * Boards workspaces (WorkspaceMember OWNER) and Work workspaces (WorkMember OWNER).
 * Nothing here writes to Boards or Work.
 */
export type Source = 'all' | 'boards' | 'work';
type Person = { id: number; firstName: string; lastName: string; avatarUrl: string | null };
type TaskFact = {
  source: 'boards' | 'work';
  companyKey: string;
  id: number;
  uid: string;
  name: string;
  where: string;
  due: string | null; // YYYY-MM-DD
  done: boolean;
  active: boolean;
  doneAt: Date | null;
  assignees: number[];
  status: { label: string; color: string } | null;
  priority?: string | null;
  href: string;
  /** the list (Work) or board (Boards) the task lives in */
  place: { type: 'list' | 'board'; id: number };
};

const USER_MINI = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;
const DAY = 86_400_000;
const ymd = (d: Date, tz = 'UTC') => {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); } catch { return d.toISOString().slice(0, 10); }
};
const dateOf = (v: unknown): string | null => {
  if (!v) return null;
  if (typeof v === 'string') return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
  if (typeof v === 'object') { const o = v as any; return dateOf(o.date ?? o.value ?? o.from ?? o.to ?? null); }
  return null;
};

@Injectable()
export class CeoTowerService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly workNotify?: WorkNotifyService,
  ) {}

  /**
   * The companies this person sees in CEO Tower: the ones they own, plus the ones
   * owned by anyone who shared CEO Tower with them.
   */
  async owned(userId: number) {
    const own = await this.ownOnly(userId);
    const grants = await this.prisma.ceoAccessGrant.findMany({ where: { userId }, select: { ownerId: true } });
    if (!grants.length) return own;
    const shared = await Promise.all(grants.filter((g) => g.ownerId !== userId).map((g) => this.ownOnly(g.ownerId)));
    const merge = <T extends { id: number }>(lists: T[][]) => [...new Map(lists.flat().map((x) => [x.id, x] as [number, T])).values()];
    return { boards: merge([own.boards, ...shared.map((x) => x.boards)]), work: merge([own.work, ...shared.map((x) => x.work)]) };
  }

  /** only the companies this person really owns (decides who may share access) */
  async ownOnly(userId: number) {
    const [boards, work] = await Promise.all([
      this.prisma.workspaceMember.findMany({ where: { userId, role: 'OWNER', deletedAt: null }, select: { workspace: { select: { id: true, uid: true, name: true, timezone: true } } } }),
      this.prisma.workMember.findMany({ where: { userId, role: 'OWNER', workspace: { deletedAt: null } }, select: { workspace: { select: { id: true, uid: true, name: true } } } }),
    ]);
    return { boards: boards.map((b) => b.workspace), work: work.map((w) => w.workspace) };
  }

  async access(userId: number) {
    const [mine, o, grants] = await Promise.all([this.ownOnly(userId), this.owned(userId), this.prisma.ceoAccessGrant.findMany({ where: { userId }, select: { ownerId: true } })]);
    const owners = grants.length ? await this.prisma.user.findMany({ where: { id: { in: grants.map((g) => g.ownerId) } }, select: { id: true, firstName: true, lastName: true } }) : [];
    // a share only counts while the person who shared still owns something
    const sharedBy: { id: number; name: string }[] = [];
    for (const u of owners) {
      const theirs = await this.ownOnly(u.id);
      if (theirs.boards.length + theirs.work.length) sharedBy.push({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() });
    }
    return {
      allowed: o.boards.length + o.work.length > 0,
      /** true when they own a company themselves: only owners can share CEO Tower */
      canShare: mine.boards.length + mine.work.length > 0,
      sharedBy,
      boards: o.boards.length,
      work: o.work.length,
    };
  }

  // ---------- sharing CEO Tower ----------

  private async requireOwner(ownerId: number) {
    const mine = await this.ownOnly(ownerId);
    if (!mine.boards.length && !mine.work.length) throw new ForbiddenException('Only company owners can share CEO Tower.');
    return mine;
  }

  /** who this owner has shared CEO Tower with */
  async accessGrants(ownerId: number) {
    await this.requireOwner(ownerId);
    const rows = await this.prisma.ceoAccessGrant.findMany({ where: { ownerId }, orderBy: { createdAt: 'asc' } });
    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { ...USER_MINI, email: true } });
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.filter((r) => byId.has(r.userId)).map((r) => ({ id: r.id, user: byId.get(r.userId)!, createdAt: r.createdAt }));
  }

  /** share CEO Tower with someone in one of your companies: they see your companies, nothing else */
  async grantAccess(ownerId: number, userId: number) {
    const mine = await this.requireOwner(ownerId);
    if (!Number.isInteger(userId) || userId <= 0) throw new BadRequestException('Pick a person.');
    if (userId === ownerId) throw new BadRequestException('You already have CEO Tower.');
    const [b, w] = await Promise.all([
      this.prisma.workspaceMember.findFirst({ where: { userId, deletedAt: null, workspaceId: { in: mine.boards.map((x) => x.id) } }, select: { id: true } }),
      this.prisma.workMember.findFirst({ where: { userId, workspaceId: { in: mine.work.map((x) => x.id) } }, select: { userId: true } }),
    ]);
    if (!b && !w) throw new BadRequestException('You can only share with people in your companies.');
    const existing = await this.prisma.ceoAccessGrant.findUnique({ where: { ownerId_userId: { ownerId, userId } } });
    if (existing) return { ok: true, already: true };
    await this.prisma.ceoAccessGrant.create({ data: { ownerId, userId } });

    const owner = await this.prisma.user.findUnique({ where: { id: ownerId }, select: { firstName: true, lastName: true } });
    const who = owner ? `${owner.firstName} ${owner.lastName}`.trim() : 'An owner';
    const title = `${who} shared CEO Tower with you`;
    const message = 'You can now see their companies in CEO Tower. Open it from the CEO tile.';
    if (b) await this.notifications?.notify({ recipientId: userId, type: NotificationType.CEO_TASK_REMINDER, title, message, metadata: { url: '/ceo' } }).catch(() => {});
    if (w) await this.workNotify?.send({ recipientId: userId, type: 'CEO_ACCESS', title, message, metadata: { event: 'ceo_access', url: '/ceo' } }).catch(() => {});
    return { ok: true };
  }

  /** take CEO Tower access back: it stops at once */
  async revokeAccess(ownerId: number, userId: number) {
    await this.requireOwner(ownerId);
    const r = await this.prisma.ceoAccessGrant.deleteMany({ where: { ownerId, userId } });
    if (!r.count) throw new NotFoundException('That person does not have access from you.');
    return { ok: true };
  }

  private async require(userId: number) {
    const o = await this.owned(userId);
    if (!o.boards.length && !o.work.length) throw new ForbiddenException('CEO Tower is for workspace owners.');
    return o;
  }

  // ---------- facts ----------

  /** Boards: top-level tasks in live groups; status / due / people come from the first STATUS / DATE / PERSON cells */
  private async boardsFacts(ws: { id: number; uid: string; name: string; timezone: string | null }[]): Promise<(TaskFact & { _tz?: string })[]> {
    if (!ws.length) return [];
    const tz = new Map(ws.map((w) => [w.id, w.timezone || 'UTC']));
    const wsUid = new Map(ws.map((w) => [w.id, w.uid]));
    const boards = await this.prisma.board.findMany({ where: { workspaceId: { in: ws.map((w) => w.id) } }, select: { id: true, uid: true, name: true, workspaceId: true } });
    if (!boards.length) return [];
    const columns = await this.prisma.boardColumn.findMany({
      where: { boardId: { in: boards.map((b) => b.id) }, type: { in: ['STATUS', 'DATE', 'PLAIN_DATE', 'PERSON'] } },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      select: { id: true, boardId: true, type: true, statusOptions: { select: { id: true, label: true, category: true } } },
    });
    // first column of each kind per board
    const first = new Map<string, (typeof columns)[number]>();
    for (const c of columns) {
      const kind = c.type === 'PLAIN_DATE' ? 'DATE' : c.type;
      const k = `${c.boardId}:${kind}`;
      if (!first.has(k)) first.set(k, c);
    }
    const useCols = [...first.values()];
    const boardOf = new Map(boards.map((b) => [b.id, b]));
    const tasks = await this.prisma.task.findMany({
      where: { parentId: null, group: { isArchived: false, boardId: { in: boards.map((b) => b.id) } } },
      select: { id: true, name: true, updatedAt: true, group: { select: { boardId: true } }, cells: { where: { columnId: { in: useCols.map((c) => c.id) } }, select: { columnId: true, value: true } } },
      take: 20000,
    });
    const colById = new Map(useCols.map((c) => [c.id, c]));
    return tasks.map((t) => {
      const b = boardOf.get(t.group.boardId)!;
      let cat: StatusCategory | null = null, due: string | null = null, people: number[] = [];
      let status: { label: string; color: string } | null = null;
      for (const cell of t.cells) {
        const c = colById.get(cell.columnId);
        if (!c) continue;
        if (c.type === 'STATUS') {
          cat = resolveStatusCategory(cell.value, c.statusOptions);
          const v = cell.value as any;
          if (v?.label) status = { label: String(v.label), color: String(v.color ?? '#8a8f98') };
        }
        else if (c.type === 'PERSON') people = (((cell.value as any)?.users ?? []) as any[]).map((u) => Number(u?.id)).filter(Number.isInteger);
        else due = dateOf(cell.value);
      }
      const done = isDoneCategory(cat);
      // Boards has no "completed at": a done task's last update stands in for it
      return {
        source: 'boards' as const, companyKey: `boards:${b.workspaceId}`, id: t.id, uid: String(t.id), name: t.name, where: b.name,
        due, done, active: !done && cat === 'ACTIVE', doneAt: done ? t.updatedAt : null, assignees: people, _tz: tz.get(b.workspaceId),
        status, href: `/workspace/${wsUid.get(b.workspaceId)}/board/${b.uid}?taskId=${t.id}`, place: { type: 'board' as const, id: b.id },
      };
    });
  }

  /** Work: top-level tasks in live lists / spaces */
  private async workFacts(ws: { id: number; uid: string; name: string }[]): Promise<TaskFact[]> {
    if (!ws.length) return [];
    const tasks = await this.prisma.workTask.findMany({
      where: { parentId: null, archivedAt: null, list: { archivedAt: null, space: { workspaceId: { in: ws.map((w) => w.id) }, archivedAt: null } } },
      select: { id: true, uid: true, name: true, dueDate: true, completedAt: true, priority: true, status: { select: { category: true, name: true, color: true } }, list: { select: { id: true, uid: true, name: true, space: { select: { workspaceId: true } } } }, assignees: { select: { userId: true } } },
      take: 20000,
    });
    const wsUid = new Map(ws.map((w) => [w.id, w.uid]));
    return tasks.map((t) => ({
      source: 'work' as const, companyKey: `work:${t.list.space.workspaceId}`, id: t.id, uid: t.uid, name: t.name, where: t.list.name,
      due: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null, done: !!t.completedAt, active: !t.completedAt && t.status?.category === 'ACTIVE',
      doneAt: t.completedAt, assignees: t.assignees.map((a) => a.userId),
      status: t.status ? { label: t.status.name, color: t.status.color } : null, priority: t.priority,
      href: `/work/${wsUid.get(t.list.space.workspaceId)}/list/${t.list.uid}?task=${t.uid}`,
      place: { type: 'list' as const, id: t.list.id },
    }));
  }

  private overdue(f: TaskFact & { _tz?: string }) {
    return !f.done && !!f.due && f.due < ymd(new Date(), f._tz ?? 'UTC');
  }

  // ---------- a person, as the CEO sees them ----------

  /**
   * Where this person works among the CEO's companies, and which of the CEO's Work companies
   * can reach them (messages and assignments go through Work, as the CEO).
   * People outside the CEO's companies are not found.
   */
  async person(userId: number, personId: number) {
    const own = await this.require(userId);
    const [boards, work, user] = await Promise.all([
      this.prisma.workspaceMember.findMany({ where: { userId: personId, deletedAt: null, workspaceId: { in: own.boards.map((w) => w.id) } }, select: { role: true, workspaceId: true } }),
      this.prisma.workMember.findMany({ where: { userId: personId, workspaceId: { in: own.work.map((w) => w.id) } }, select: { role: true, workspaceId: true, title: true } }),
      this.prisma.user.findFirst({ where: { id: personId, deletedAt: null }, select: { ...USER_MINI, email: true } }),
    ]);
    if (!user || (!boards.length && !work.length)) throw new NotFoundException('This person is not in your companies.');
    const bName = new Map(own.boards.map((w) => [w.id, w]));
    const wName = new Map(own.work.map((w) => [w.id, w]));
    return {
      user,
      title: work.find((m) => m.title)?.title ?? null,
      memberships: [
        ...boards.map((m) => ({ key: `boards:${m.workspaceId}`, source: 'boards' as const, name: bName.get(m.workspaceId)!.name, uid: bName.get(m.workspaceId)!.uid, role: m.role })),
        ...work.map((m) => ({ key: `work:${m.workspaceId}`, source: 'work' as const, name: wName.get(m.workspaceId)!.name, uid: wName.get(m.workspaceId)!.uid, role: m.role })),
      ],
      // Work companies where a DM / assignment can reach them
      reach: work.map((m) => ({ key: `work:${m.workspaceId}`, uid: wName.get(m.workspaceId)!.uid, name: wName.get(m.workspaceId)!.name })),
      isMe: personId === userId,
    };
  }

  // ---------- Attention → For you: people asking the CEO for something ----------

  /**
   * Unread items aimed at the CEO from both products: tasks assigned to them, @mentions,
   * replies, comments on their work, comments assigned to them, chat DMs / mentions / replies.
   * Status changes, reactions, reminders and form submissions are left out on purpose.
   */
  async forYou(userId: number) {
    await this.require(userId);
    const since = new Date(Date.now() - 30 * DAY);
    const [work, boards] = await Promise.all([
      this.prisma.workNotification.findMany({
        where: { recipientId: userId, isRead: false, clearedAt: null, createdAt: { gte: since }, type: { in: ['TASK_ASSIGNED', 'COMMENT_MENTION', 'COMMENT_REPLY', 'COMMENT_CREATED', 'CHAT'] } },
        orderBy: { createdAt: 'desc' }, take: 80,
        select: { id: true, type: true, title: true, message: true, metadata: true, createdAt: true },
      }),
      this.prisma.notification.findMany({
        where: { recipientId: userId, product: 'boards', isRead: false, clearedAt: null, createdAt: { gte: since }, type: { in: ['TASK_ASSIGNED', 'COMMENT_MENTION', 'COMMENT_REPLY', 'COMMENT_CREATED', 'FILE_COMMENT'] } },
        orderBy: { createdAt: 'desc' }, take: 80,
        select: { id: true, type: true, title: true, message: true, entityType: true, entityId: true, metadata: true, createdAt: true },
      }),
    ]);
    const kindOf = (type: string, event?: string) =>
      event === 'reaction' ? null
      : type === 'TASK_ASSIGNED' || event === 'assigned_comment' ? 'assigned'
      : type === 'COMMENT_MENTION' || event === 'chat_mention' || event === 'mention' ? 'mention'
      : type === 'COMMENT_REPLY' || event === 'chat_reply' || event === 'reply' ? 'reply'
      : event === 'chat_dm' ? 'message'
      : type === 'CHAT' ? 'message'
      : 'comment';
    // Boards links: board (+ task) from the notification's metadata / entity
    const boardIds = [...new Set(boards.map((n) => Number((n.metadata as any)?.boardId ?? (n.entityType === 'BOARD' ? n.entityId : NaN))).filter(Number.isInteger))];
    const boardRows = boardIds.length ? await this.prisma.board.findMany({ where: { id: { in: boardIds } }, select: { id: true, uid: true, workspace: { select: { uid: true } } } }) : [];
    const boardById = new Map(boardRows.map((b) => [b.id, b]));
    const items = [
      ...work.map((n) => {
        const m = (n.metadata ?? {}) as Record<string, any>;
        const kind = kindOf(n.type, m.event);
        return kind && { source: 'work' as const, id: n.id, kind, title: n.title, message: n.message, at: n.createdAt, href: typeof m.url === 'string' && m.url.startsWith('/work/') ? m.url : null, actor: m.actorName ?? null };
      }),
      ...boards.map((n) => {
        const m = (n.metadata ?? {}) as Record<string, any>;
        const kind = kindOf(n.type, m.event);
        const b = boardById.get(Number(m.boardId ?? (n.entityType === 'BOARD' ? n.entityId : NaN)));
        const taskId = Number(m.taskId ?? (n.entityType === 'TASK' ? n.entityId : NaN));
        const href = b ? `/workspace/${b.workspace.uid}/board/${b.uid}${Number.isInteger(taskId) ? `?taskId=${taskId}` : ''}` : null;
        return kind && { source: 'boards' as const, id: n.id, kind, title: n.title, message: n.message, at: n.createdAt, href, actor: m.actorName ?? m.senderName ?? null };
      }),
    ].filter(Boolean).sort((a, b) => +b!.at - +a!.at).slice(0, 60) as { source: 'work' | 'boards'; id: string; kind: string; title: string; message: string; at: Date; href: string | null; actor: string | null }[];
    return { count: items.length, items };
  }

  /** opening an item marks it read in the CEO's own inbox (the only write CEO Tower makes) */
  async markForYouRead(userId: number, source: 'work' | 'boards', id: string) {
    await this.require(userId);
    if (source === 'work') {
      await this.prisma.workNotification.updateMany({ where: { id, recipientId: userId }, data: { isRead: true, readAt: new Date() } });
    } else {
      await this.prisma.notification.updateMany({ where: { id, recipientId: userId, product: 'boards' }, data: { isRead: true, readAt: new Date() } });
    }
    return { ok: true };
  }

  // ---------- the Tasks view: every task, filtered ----------

  /**
   * state: open | in_progress | overdue | due_week | done_week | unassigned | all
   * company: "boards:<id>" / "work:<id>"; person: a user id; q: words in the task name
   */
  /** the CEO's companies narrowed by product / one company, and their task facts */
  private async scoped(userId: number, source: Source = 'all', company?: string) {
    const own = await this.require(userId);
    let boardsWs = source === 'work' ? [] : own.boards;
    let workWs = source === 'boards' ? [] : own.work;
    if (company) {
      boardsWs = boardsWs.filter((w) => `boards:${w.id}` === company);
      workWs = workWs.filter((w) => `work:${w.id}` === company);
      if (!boardsWs.length && !workWs.length) throw new ForbiddenException('That company is not one of yours.');
    }
    const facts: (TaskFact & { _tz?: string })[] = [...(await this.boardsFacts(boardsWs)), ...(await this.workFacts(workWs))];
    return { own, boardsWs, workWs, facts };
  }

  /** a place → which task facts belong to it (spaces / folders roll up their lists) */
  private async placeFilter(own: Awaited<ReturnType<CeoTowerService['owned']>>, place: { type: string; id: number }) {
    if (place.type === 'board') {
      if (!(await this.prisma.board.findFirst({ where: { id: place.id, workspaceId: { in: own.boards.map((b) => b.id) } }, select: { id: true } }))) throw new ForbiddenException('That board is not in your companies.');
      return (f: TaskFact) => f.place.type === 'board' && f.place.id === place.id;
    }
    const mine = { workspaceId: { in: own.work.map((w) => w.id) } };
    const exists = place.type === 'list' ? await this.prisma.workList.findFirst({ where: { id: place.id, space: mine }, select: { id: true } })
      : place.type === 'folder' ? await this.prisma.workFolder.findFirst({ where: { id: place.id, space: mine }, select: { id: true } })
      : place.type === 'space' ? await this.prisma.space.findFirst({ where: { id: place.id, ...mine }, select: { id: true } }) : null;
    if (!exists) throw new ForbiddenException('That place is not in your companies.');
    const where = place.type === 'list' ? { id: place.id } : place.type === 'folder' ? { folderId: place.id } : { spaceId: place.id };
    const lists = await this.prisma.workList.findMany({ where: { ...where, space: mine }, select: { id: true } });
    const set = new Set(lists.map((l) => l.id));
    return (f: TaskFact) => f.place.type === 'list' && set.has(f.place.id);
  }

  private stats(list: (TaskFact & { _tz?: string })[]) {
    const open = list.filter((f) => !f.done);
    const weekAgo = Date.now() - 7 * DAY;
    return {
      total: list.length, open: open.length, done: list.length - open.length,
      inProgress: open.filter((f) => f.active).length, overdue: open.filter((f) => this.overdue(f)).length,
      doneWeek: list.filter((f) => f.done && f.doneAt && +f.doneAt >= weekAgo).length,
      progress: list.length ? Math.round(((list.length - open.length) / list.length) * 100) : 0,
    };
  }

  async tasks(userId: number, o: { source?: Source; company?: string; person?: number; state?: string; q?: string; limit?: number; place?: { type: string; id: number } }) {
    const { own, facts: allFacts } = await this.scoped(userId, o.source ?? 'all', o.company);
    const inPlace = o.place ? await this.placeFilter(own, o.place) : null;
    const facts = inPlace ? allFacts.filter(inPlace) : allFacts;
    const today = (f: TaskFact & { _tz?: string }) => ymd(new Date(), f._tz ?? 'UTC');
    const weekAgo = Date.now() - 7 * DAY;
    const inWeek = (f: TaskFact & { _tz?: string }) => !!f.due && f.due >= today(f) && f.due <= ymd(new Date(Date.now() + 7 * DAY), f._tz ?? 'UTC');
    const state = o.state ?? 'open';
    const q = (o.q ?? '').trim().toLowerCase();
    const counts = {
      open: facts.filter((f) => !f.done).length,
      in_progress: facts.filter((f) => f.active).length,
      overdue: facts.filter((f) => this.overdue(f)).length,
      due_week: facts.filter((f) => !f.done && inWeek(f)).length,
      done_week: facts.filter((f) => f.done && f.doneAt && +f.doneAt >= weekAgo).length,
      unassigned: facts.filter((f) => !f.done && !f.assignees.length).length,
      all: facts.length,
    };
    const list = facts.filter((f) =>
      (state === 'open' ? !f.done : state === 'in_progress' ? f.active : state === 'overdue' ? this.overdue(f) : state === 'due_week' ? !f.done && inWeek(f)
        : state === 'done_week' ? f.done && !!f.doneAt && +f.doneAt >= weekAgo : state === 'unassigned' ? !f.done && !f.assignees.length : true)
      && (!o.person || f.assignees.includes(o.person))
      && (!q || f.name.toLowerCase().includes(q) || f.where.toLowerCase().includes(q)));
    // overdue first, then by due date, undated last; done lists newest first
    list.sort((a, b) => state === 'done_week' ? +(b.doneAt ?? 0) - +(a.doneAt ?? 0)
      : (+this.overdue(b) - +this.overdue(a)) || (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.name.localeCompare(b.name));
    const limit = Math.min(Math.max(o.limit ?? 300, 1), 1000);
    const page = list.slice(0, limit);
    const ids = [...new Set(page.flatMap((f) => f.assignees))];
    const users = ids.length ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: USER_MINI }) : [];
    const userById = new Map(users.map((u) => [u.id, u]));
    type Co = { key: string; name: string; source: 'boards' | 'work'; uid: string };
    const companies = new Map<string, Co>();
    for (const w of own.boards) companies.set(`boards:${w.id}`, { key: `boards:${w.id}`, name: w.name, source: 'boards', uid: w.uid });
    for (const w of own.work) companies.set(`work:${w.id}`, { key: `work:${w.id}`, name: w.name, source: 'work', uid: w.uid });
    return {
      state, counts, total: list.length, truncated: list.length > limit,
      tasks: page.map((f) => ({
        source: f.source, id: f.id, uid: f.uid, name: f.name, where: f.where, company: companies.get(f.companyKey)!, due: f.due, done: f.done, active: f.active,
        overdue: this.overdue(f), doneAt: f.doneAt, status: f.status, priority: f.priority ?? null, href: f.href, place: f.place,
        assignees: f.assignees.map((i) => userById.get(i)).filter(Boolean),
      })),
    };
  }

  // ---------- Team: everyone across the companies ----------

  async team(userId: number, source: Source = 'all', company?: string) {
    const { boardsWs, workWs, facts } = await this.scoped(userId, source, company);
    const [bm, wm] = await Promise.all([
      this.prisma.workspaceMember.findMany({ where: { workspaceId: { in: boardsWs.map((w) => w.id) }, deletedAt: null }, select: { workspaceId: true, userId: true, role: true } }),
      this.prisma.workMember.findMany({ where: { workspaceId: { in: workWs.map((w) => w.id) } }, select: { workspaceId: true, userId: true, role: true, title: true, managerId: true } }),
    ]);
    const ids = [...new Set([...bm, ...wm].map((m) => m.userId))];
    const [users, lastChat] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: ids }, deletedAt: null }, select: USER_MINI }),
      ids.length && workWs.length ? this.prisma.workChatMessage.groupBy({ by: ['userId'], _max: { createdAt: true }, where: { userId: { in: ids }, deletedAt: null, channel: { workspaceId: { in: workWs.map((w) => w.id) } } } }) : [],
    ]);
    const name = new Map([...boardsWs.map((w) => [`boards:${w.id}`, w.name] as const), ...workWs.map((w) => [`work:${w.id}`, w.name] as const)]);
    const byUser = new Map<number, typeof facts>();
    for (const f of facts) for (const u of f.assignees) byUser.set(u, [...(byUser.get(u) ?? []), f]);
    const last = new Map((lastChat as { userId: number; _max: { createdAt: Date | null } }[]).map((r) => [r.userId, r._max.createdAt]));
    const userName = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
    return users.map((u) => {
      const work = wm.filter((m) => m.userId === u.id);
      const memberships = [
        ...bm.filter((m) => m.userId === u.id).map((m) => ({ key: `boards:${m.workspaceId}`, source: 'boards' as const, name: name.get(`boards:${m.workspaceId}`)!, role: m.role })),
        ...work.map((m) => ({ key: `work:${m.workspaceId}`, source: 'work' as const, name: name.get(`work:${m.workspaceId}`)!, role: m.role })),
      ];
      const managerId = work.find((m) => m.managerId)?.managerId ?? null;
      return {
        user: u, title: work.find((m) => m.title)?.title ?? null, manager: managerId ? { id: managerId, name: userName.get(managerId) ?? null } : null,
        reports: wm.filter((m) => m.managerId === u.id).map((m) => m.userId).filter((v, i, a) => a.indexOf(v) === i).length,
        memberships, stats: this.stats(byUser.get(u.id) ?? []), lastActive: last.get(u.id) ?? null,
      };
    }).sort((a, b) => b.stats.overdue - a.stats.overdue || b.stats.open - a.stats.open || a.user.firstName.localeCompare(b.user.firstName));
  }

  /** one person in depth: work in hand, overdue, finished, and who they talk to (counts only) */
  async personReport(userId: number, personId: number, days = 7) {
    const p = await this.person(userId, personId);
    const all = (await this.tasks(userId, { person: personId, state: 'all', limit: 1000 })).tasks;
    const since = Date.now() - days * DAY;
    const soon = ymd(new Date(Date.now() + 7 * DAY));
    const own = await this.owned(userId);
    const [team, reports] = await Promise.all([
      this.prisma.workTeam.findMany({ where: { workspaceId: { in: own.work.map((w) => w.id) }, members: { some: { userId: personId } } }, select: { name: true } }),
      this.prisma.workMember.findMany({ where: { workspaceId: { in: own.work.map((w) => w.id) }, managerId: personId }, select: { userId: true } }),
    ]);
    return {
      ...p,
      days,
      counts: { open: all.filter((t) => !t.done).length, inProgress: all.filter((t) => t.active).length, overdue: all.filter((t) => t.overdue).length, doneInWindow: all.filter((t) => t.done && t.doneAt && +new Date(t.doneAt) >= since).length },
      inProgress: all.filter((t) => t.active).slice(0, 20),
      overdue: all.filter((t) => t.overdue).slice(0, 20),
      dueSoon: all.filter((t) => !t.done && !t.overdue && !!t.due && t.due <= soon).slice(0, 15),
      finished: all.filter((t) => t.done && t.doneAt && +new Date(t.doneAt) >= since).slice(0, 20),
      talkingWith: (await this.chatActivity(own.work.map((w) => w.id), days, personId)).conversations.slice(0, 12),
      teams: [...new Set(team.map((t) => t.name))],
      directReports: [...new Set(reports.map((r) => r.userId))],
    };
  }

  /** message counts per conversation (never contents) in the CEO's Work companies */
  async chatActivity(workIds: number[], days: number, personId?: number, channelsOnly = false) {
    if (!workIds.length) return { window_days: days, conversations: [] as { conversation: string; kind: string; messages: number; sent_by_person?: number; last_message_at: Date | null; workspaceId: number; uid: string }[] };
    const since = new Date(Date.now() - days * DAY);
    const counts = await this.prisma.workChatMessage.groupBy({
      by: ['channelId'], _count: { _all: true },
      where: { deletedAt: null, kind: { not: 'system' }, createdAt: { gte: since }, channel: { workspaceId: { in: workIds }, archivedAt: null, ...(channelsOnly ? { kind: 'channel' } : {}), ...(personId ? { members: { some: { userId: personId } } } : {}) } },
    });
    const chans = await this.prisma.workChannel.findMany({ where: { id: { in: counts.map((c) => c.channelId) } }, select: { id: true, uid: true, workspaceId: true, kind: true, name: true, lastMessageAt: true, members: { select: { user: { select: { id: true, firstName: true, lastName: true } } } } } });
    const byId = new Map(chans.map((c) => [c.id, c]));
    const sent = personId ? await this.prisma.workChatMessage.groupBy({ by: ['channelId'], _count: { _all: true }, where: { userId: personId, deletedAt: null, createdAt: { gte: since }, channelId: { in: counts.map((c) => c.channelId) } } }) : [];
    const sentBy = new Map(sent.map((s) => [s.channelId, s._count._all]));
    return {
      window_days: days,
      conversations: counts.map((c) => {
        const ch = byId.get(c.channelId)!;
        const names = ch.members.map((m) => `${m.user.firstName} ${m.user.lastName}`.trim());
        return {
          conversation: ch.kind === 'channel' ? `#${ch.name}` : `DM: ${names.join(' & ')}`,
          kind: ch.kind, messages: c._count._all, ...(personId ? { sent_by_person: sentBy.get(c.channelId) ?? 0 } : {}),
          last_message_at: ch.lastMessageAt, workspaceId: ch.workspaceId, uid: ch.uid,
        };
      }).sort((a, b) => b.messages - a.messages).slice(0, 25),
    };
  }

  // ---------- Boards / Work: each company's structure with progress ----------

  async structure(userId: number, product: 'boards' | 'work', company?: string) {
    const { boardsWs, workWs, facts } = await this.scoped(userId, product, company);
    const people = (l: typeof facts) => new Set(l.flatMap((f) => f.assignees)).size;
    if (product === 'boards') {
      const boards = await this.prisma.board.findMany({ where: { workspaceId: { in: boardsWs.map((w) => w.id) } }, orderBy: { name: 'asc' }, select: { id: true, uid: true, name: true, workspaceId: true } });
      return boardsWs.map((w) => ({
        key: `boards:${w.id}`, uid: w.uid, name: w.name,
        stats: this.stats(facts.filter((f) => f.companyKey === `boards:${w.id}`)),
        boards: boards.filter((b) => b.workspaceId === w.id).map((b) => {
          const l = facts.filter((f) => f.place.type === 'board' && f.place.id === b.id);
          return { id: b.id, uid: b.uid, name: b.name, stats: this.stats(l), people: people(l), href: `/workspace/${w.uid}/board/${b.uid}` };
        }).sort((a, b) => b.stats.overdue - a.stats.overdue || b.stats.open - a.stats.open),
      }));
    }
    const [spaces, activity] = await Promise.all([
      this.prisma.space.findMany({
        where: { workspaceId: { in: workWs.map((w) => w.id) }, archivedAt: null }, orderBy: [{ order: 'asc' }, { id: 'asc' }],
        select: { id: true, uid: true, name: true, color: true, workspaceId: true, isPrivate: true,
          folders: { where: { archivedAt: null }, orderBy: [{ order: 'asc' }, { id: 'asc' }], select: { id: true, uid: true, name: true, lists: { where: { archivedAt: null }, orderBy: [{ order: 'asc' }, { id: 'asc' }], select: { id: true, uid: true, name: true } } } },
          lists: { where: { archivedAt: null, folderId: null }, orderBy: [{ order: 'asc' }, { id: 'asc' }], select: { id: true, uid: true, name: true } } },
      }),
      this.chatActivity(workWs.map((w) => w.id), 7, undefined, true),
    ]);
    const ofList = (id: number) => facts.filter((f) => f.place.type === 'list' && f.place.id === id);
    return workWs.map((w) => ({
      key: `work:${w.id}`, uid: w.uid, name: w.name,
      stats: this.stats(facts.filter((f) => f.companyKey === `work:${w.id}`)),
      channels: activity.conversations.filter((c) => c.workspaceId === w.id).slice(0, 6).map((c) => ({ name: c.conversation, messages: c.messages, href: `/work/${w.uid}/chat/${c.uid}` })),
      spaces: spaces.filter((s) => s.workspaceId === w.id).map((s) => {
        const listRow = (l: { id: number; uid: string; name: string }) => { const t = ofList(l.id); return { type: 'list' as const, id: l.id, name: l.name, stats: this.stats(t), people: people(t), href: `/work/${w.uid}/list/${l.uid}` }; };
        const folders = s.folders.map((f) => {
          const lists = f.lists.map(listRow);
          const t = f.lists.flatMap((l) => ofList(l.id));
          return { type: 'folder' as const, id: f.id, name: f.name, stats: this.stats(t), people: people(t), href: `/work/${w.uid}/folder/${f.uid}`, lists };
        });
        const lists = s.lists.map(listRow);
        const t = [...s.folders.flatMap((f) => f.lists), ...s.lists].flatMap((l) => ofList(l.id));
        return { type: 'space' as const, id: s.id, name: s.name, color: s.color, isPrivate: s.isPrivate, stats: this.stats(t), people: people(t), href: `/work/${w.uid}/space/${s.uid}`, folders, lists };
      }),
    }));
  }

  // ---------- the Task view: KPIs, companies, people, updates ----------

  /** company: "boards:<id>" / "work:<id>" narrows everything to that one company (must be one you own) */
  async overview(userId: number, source: Source = 'all', company?: string) {
    const o = await this.require(userId);
    let boardsWs = source === 'work' ? [] : o.boards;
    let workWs = source === 'boards' ? [] : o.work;
    if (company) {
      boardsWs = boardsWs.filter((w) => `boards:${w.id}` === company);
      workWs = workWs.filter((w) => `work:${w.id}` === company);
      if (!boardsWs.length && !workWs.length) throw new ForbiddenException('That company is not one of yours.');
    }
    const [bf, wf, boardMembers, workMembers] = await Promise.all([
      this.boardsFacts(boardsWs), this.workFacts(workWs),
      boardsWs.length ? this.prisma.workspaceMember.findMany({ where: { workspaceId: { in: boardsWs.map((w) => w.id) }, deletedAt: null }, select: { workspaceId: true, userId: true, role: true } }) : [],
      workWs.length ? this.prisma.workMember.findMany({ where: { workspaceId: { in: workWs.map((w) => w.id) } }, select: { workspaceId: true, userId: true, role: true } }) : [],
    ]);
    const facts: (TaskFact & { _tz?: string })[] = [...bf, ...wf];
    const weekAgo = Date.now() - 7 * DAY;
    const stats = (list: typeof facts) => {
      const open = list.filter((f) => !f.done);
      return {
        total: list.length, open: open.length, done: list.length - open.length,
        inProgress: open.filter((f) => f.active).length, overdue: open.filter((f) => this.overdue(f)).length,
        doneWeek: list.filter((f) => f.done && f.doneAt && +f.doneAt >= weekAgo).length,
        progress: list.length ? Math.round(((list.length - open.length) / list.length) * 100) : 0,
      };
    };
    const health = (s: ReturnType<typeof stats>) => (s.overdue >= 5 || (s.open && s.overdue / s.open > 0.25) ? 'critical' : s.overdue > 0 ? 'attention' : 'healthy');
    const members = new Map<string, { userId: number; role: string }[]>();
    for (const m of boardMembers) members.set(`boards:${m.workspaceId}`, [...(members.get(`boards:${m.workspaceId}`) ?? []), m]);
    for (const m of workMembers) members.set(`work:${m.workspaceId}`, [...(members.get(`work:${m.workspaceId}`) ?? []), m]);
    const companies = [
      ...boardsWs.map((w) => ({ source: 'boards' as const, key: `boards:${w.id}`, id: w.id, uid: w.uid, name: w.name })),
      ...workWs.map((w) => ({ source: 'work' as const, key: `work:${w.id}`, id: w.id, uid: w.uid, name: w.name })),
    ].map((c) => {
      const s = stats(facts.filter((f) => f.companyKey === c.key));
      const ms = members.get(c.key) ?? [];
      return { ...c, stats: s, health: health(s), people: ms.length, admins: ms.filter((m) => ['OWNER', 'ADMIN'].includes(m.role)).map((m) => m.userId) };
    }).sort((a, b) => b.stats.overdue - a.stats.overdue || b.stats.open - a.stats.open);

    // people across all companies (same user account in both products is one person)
    const userIds = [...new Set([...boardMembers.map((m) => m.userId), ...workMembers.map((m) => m.userId)])];
    const users = userIds.length ? await this.prisma.user.findMany({ where: { id: { in: userIds }, deletedAt: null }, select: USER_MINI }) : [];
    const byUser = new Map<number, typeof facts>();
    for (const f of facts) for (const u of f.assignees) byUser.set(u, [...(byUser.get(u) ?? []), f]);
    const companyName = new Map(companies.map((c) => [c.key, c.name]));
    const companyRef = new Map(companies.map((c) => [c.key, { key: c.key, name: c.name, source: c.source }]));
    const people = users.map((u: Person) => {
      const list = byUser.get(u.id) ?? [];
      return { user: u, stats: stats(list), companies: [...new Set(list.map((f) => f.companyKey))].map((k) => companyRef.get(k)!).filter(Boolean), memberOf: companies.filter((c) => (members.get(c.key) ?? []).some((m) => m.userId === u.id)).length };
    }).sort((a, b) => b.stats.overdue - a.stats.overdue || b.stats.open - a.stats.open);

    // updates: recently finished work and what just slipped
    const since = Date.now() - 7 * DAY;
    const named = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
    const updates = facts.filter((f) => f.done && f.doneAt && +f.doneAt >= since).sort((a, b) => +b.doneAt! - +a.doneAt!).slice(0, 12).map((f) => ({
      kind: 'done' as const, source: f.source, task: { id: f.id, uid: f.uid, name: f.name }, where: f.where, company: companyName.get(f.companyKey), at: f.doneAt, people: f.assignees.map((i) => named.get(i)).filter(Boolean),
    }));
    const overdueList = facts.filter((f) => this.overdue(f)).sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '')).slice(0, 50).map((f) => ({
      source: f.source, task: { id: f.id, uid: f.uid, name: f.name }, where: f.where, company: companyName.get(f.companyKey), due: f.due, people: f.assignees.map((i) => named.get(i)).filter(Boolean),
    }));
    const all = stats(facts);
    return {
      source,
      company: company ?? null,
      owned: { boards: o.boards.length, work: o.work.length },
      kpis: { companies: companies.length, people: users.length, ...all, unassigned: facts.filter((f) => !f.done && !f.assignees.length).length },
      companies,
      people: people.slice(0, 40),
      updates,
      attention: { companies: companies.filter((c) => c.health !== 'healthy').map((c) => ({ key: c.key, name: c.name, source: c.source, overdue: c.stats.overdue })), overdue: overdueList },
    };
  }
}
