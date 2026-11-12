import { ForbiddenException, Injectable } from '@nestjs/common';
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
    const boards = await this.prisma.board.findMany({ where: { workspaceId: { in: ws.map((w) => w.id) } }, select: { id: true, name: true, workspaceId: true } });
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
      for (const cell of t.cells) {
        const c = colById.get(cell.columnId);
        if (!c) continue;
        if (c.type === 'STATUS') cat = resolveStatusCategory(cell.value, c.statusOptions);
        else if (c.type === 'PERSON') people = (((cell.value as any)?.users ?? []) as any[]).map((u) => Number(u?.id)).filter(Number.isInteger);
        else due = dateOf(cell.value);
      }
      const done = isDoneCategory(cat);
      // Boards has no "completed at": a done task's last update stands in for it
      return {
        source: 'boards' as const, companyKey: `boards:${b.workspaceId}`, id: t.id, uid: String(t.id), name: t.name, where: b.name,
        due, done, active: !done && cat === 'ACTIVE', doneAt: done ? t.updatedAt : null, assignees: people, _tz: tz.get(b.workspaceId),
      };
    });
  }

  /** Work: top-level tasks in live lists / spaces */
  private async workFacts(ws: { id: number; uid: string; name: string }[]): Promise<TaskFact[]> {
    if (!ws.length) return [];
    const tasks = await this.prisma.workTask.findMany({
      where: { parentId: null, archivedAt: null, list: { archivedAt: null, space: { workspaceId: { in: ws.map((w) => w.id) }, archivedAt: null } } },
      select: { id: true, uid: true, name: true, dueDate: true, completedAt: true, status: { select: { category: true } }, list: { select: { name: true, space: { select: { workspaceId: true } } } }, assignees: { select: { userId: true } } },
      take: 20000,
    });
    return tasks.map((t) => ({
      source: 'work' as const, companyKey: `work:${t.list.space.workspaceId}`, id: t.id, uid: t.uid, name: t.name, where: t.list.name,
      due: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null, done: !!t.completedAt, active: !t.completedAt && t.status?.category === 'ACTIVE',
      doneAt: t.completedAt, assignees: t.assignees.map((a) => a.userId),
    }));
  }

  private overdue(f: TaskFact & { _tz?: string }) {
    return !f.done && !!f.due && f.due < ymd(new Date(), f._tz ?? 'UTC');
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
