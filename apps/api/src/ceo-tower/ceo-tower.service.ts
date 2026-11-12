import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

  /** the companies this person owns, in each product */
  async owned(userId: number) {
    const [boards, work] = await Promise.all([
      this.prisma.workspaceMember.findMany({ where: { userId, role: 'OWNER', deletedAt: null }, select: { workspace: { select: { id: true, uid: true, name: true, timezone: true } } } }),
      this.prisma.workMember.findMany({ where: { userId, role: 'OWNER', workspace: { deletedAt: null } }, select: { workspace: { select: { id: true, uid: true, name: true } } } }),
    ]);
    return { boards: boards.map((b) => b.workspace), work: work.map((w) => w.workspace) };
  }

  async access(userId: number) {
    const o = await this.owned(userId);
    return { allowed: o.boards.length + o.work.length > 0, boards: o.boards.length, work: o.work.length };
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
        status, href: `/workspace/${wsUid.get(b.workspaceId)}/board/${b.uid}?taskId=${t.id}`,
      };
    });
  }

  /** Work: top-level tasks in live lists / spaces */
  private async workFacts(ws: { id: number; uid: string; name: string }[]): Promise<TaskFact[]> {
    if (!ws.length) return [];
    const tasks = await this.prisma.workTask.findMany({
      where: { parentId: null, archivedAt: null, list: { archivedAt: null, space: { workspaceId: { in: ws.map((w) => w.id) }, archivedAt: null } } },
      select: { id: true, uid: true, name: true, dueDate: true, completedAt: true, priority: true, status: { select: { category: true, name: true, color: true } }, list: { select: { uid: true, name: true, space: { select: { workspaceId: true } } } }, assignees: { select: { userId: true } } },
      take: 20000,
    });
    const wsUid = new Map(ws.map((w) => [w.id, w.uid]));
    return tasks.map((t) => ({
      source: 'work' as const, companyKey: `work:${t.list.space.workspaceId}`, id: t.id, uid: t.uid, name: t.name, where: t.list.name,
      due: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null, done: !!t.completedAt, active: !t.completedAt && t.status?.category === 'ACTIVE',
      doneAt: t.completedAt, assignees: t.assignees.map((a) => a.userId),
      status: t.status ? { label: t.status.name, color: t.status.color } : null, priority: t.priority,
      href: `/work/${wsUid.get(t.list.space.workspaceId)}/list/${t.list.uid}?task=${t.uid}`,
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
  async tasks(userId: number, o: { source?: Source; company?: string; person?: number; state?: string; q?: string; limit?: number }) {
    const own = await this.require(userId);
    const source = o.source ?? 'all';
    let boardsWs = source === 'work' ? [] : own.boards;
    let workWs = source === 'boards' ? [] : own.work;
    if (o.company) {
      boardsWs = boardsWs.filter((w) => `boards:${w.id}` === o.company);
      workWs = workWs.filter((w) => `work:${w.id}` === o.company);
      if (!boardsWs.length && !workWs.length) throw new ForbiddenException('That company is not one of yours.');
    }
    const facts: (TaskFact & { _tz?: string })[] = [...(await this.boardsFacts(boardsWs)), ...(await this.workFacts(workWs))];
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
        overdue: this.overdue(f), doneAt: f.doneAt, status: f.status, priority: f.priority ?? null, href: f.href,
        assignees: f.assignees.map((i) => userById.get(i)).filter(Boolean),
      })),
    };
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
