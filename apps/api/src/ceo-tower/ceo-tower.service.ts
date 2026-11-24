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
  /** who created (gave out) the task */
  createdById: number;
  createdAt: Date;
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
    if (!(await this.isAdmin(userId))) return { boards: [], work: [] };
    const own = await this.ownOnly(userId);
    const grants = await this.prisma.ceoAccessGrant.findMany({ where: { userId }, select: { ownerId: true } });
    if (!grants.length) return own;
    const shared = await Promise.all(grants.filter((g) => g.ownerId !== userId).map((g) => this.ownOnly(g.ownerId)));
    const merge = <T extends { id: number }>(lists: T[][]) => [...new Map(lists.flat().map((x) => [x.id, x] as [number, T])).values()];
    return { boards: merge([own.boards, ...shared.map((x) => x.boards)]), work: merge([own.work, ...shared.map((x) => x.work)]) };
  }

  /** only the companies this person really owns (decides who may share access) */
  async ownOnly(userId: number) {
    if (!(await this.isAdmin(userId))) return { boards: [] as { id: number; uid: string; name: string; timezone: string }[], work: [] as { id: number; uid: string; name: string }[] };
    const [boards, work] = await Promise.all([
      this.prisma.workspaceMember.findMany({ where: { userId, role: 'OWNER', deletedAt: null }, select: { workspace: { select: { id: true, uid: true, name: true, timezone: true } } } }),
      this.prisma.workMember.findMany({ where: { userId, role: 'OWNER', workspace: { deletedAt: null } }, select: { workspace: { select: { id: true, uid: true, name: true } } } }),
    ]);
    return { boards: boards.map((b) => b.workspace), work: work.map((w) => w.workspace) };
  }

  /** CEO Tower is only for Administrators (system role SUPER_ADMIN) */
  async isAdmin(userId: number) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
    return u?.systemRole === 'SUPER_ADMIN';
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
    if (!mine.boards.length && !mine.work.length) throw new ForbiddenException('Only Administrators who own a company can share Executive Hub.');
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
    if (userId === ownerId) throw new BadRequestException('You already have Executive Hub.');
    if (!(await this.isAdmin(userId))) throw new BadRequestException('Executive Hub is only for Administrators. Make this person an Administrator first.');
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
    const title = `${who} shared Executive Hub with you`;
    const message = 'You can now see their companies in Executive Hub. Open it from the Executive Hub tile.';
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
    if (!o.boards.length && !o.work.length) throw new ForbiddenException('Executive Hub is only for Administrators.');
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
      select: { id: true, name: true, updatedAt: true, createdAt: true, createdById: true, group: { select: { boardId: true } }, cells: { where: { columnId: { in: useCols.map((c) => c.id) } }, select: { columnId: true, value: true } } },
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
        status, href: `/workspace/${wsUid.get(b.workspaceId)}/board/${b.uid}?taskId=${t.id}`, place: { type: 'board' as const, id: b.id }, createdById: t.createdById, createdAt: t.createdAt,
      };
    });
  }

  /** Work: top-level tasks in live lists / spaces */
  private async workFacts(ws: { id: number; uid: string; name: string }[]): Promise<TaskFact[]> {
    if (!ws.length) return [];
    const tasks = await this.prisma.workTask.findMany({
      where: { parentId: null, archivedAt: null, list: { archivedAt: null, space: { workspaceId: { in: ws.map((w) => w.id) }, archivedAt: null } } },
      select: { id: true, uid: true, name: true, dueDate: true, completedAt: true, priority: true, createdById: true, createdAt: true, status: { select: { category: true, name: true, color: true } }, list: { select: { id: true, uid: true, name: true, space: { select: { workspaceId: true } } } }, assignees: { select: { userId: true } } },
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
      createdById: t.createdById,
      createdAt: t.createdAt,
    }));
  }

  private overdue(f: TaskFact & { _tz?: string }) {
    return !f.done && !!f.due && f.due < ymd(new Date(), f._tz ?? 'UTC');
  }

  /**
   * When each person last did something in these companies: task changes and comments in both
   * products, and chat messages in both. (Times only — never what was written.)
   */
  private async lastActivity(ids: number[], boardsIds: number[], workIds: number[]) {
    const last = new Map<number, Date>();
    if (!ids.length) return last;
    const take = (rows: { userId: number; _max: { createdAt: Date | null } }[]) => {
      for (const r of rows) if (r._max.createdAt && (!last.has(r.userId) || r._max.createdAt > last.get(r.userId)!)) last.set(r.userId, r._max.createdAt);
    };
    const user = { in: ids };
    const results = await Promise.all([
      this.prisma.workChatMessage.groupBy({ by: ['userId'], _max: { createdAt: true }, where: { userId: user, deletedAt: null, channel: { workspaceId: { in: workIds } } } }),
      this.prisma.workActivity.groupBy({ by: ['userId'], _max: { createdAt: true }, where: { userId: user, task: { list: { space: { workspaceId: { in: workIds } } } } } }),
      this.prisma.workComment.groupBy({ by: ['userId'], _max: { createdAt: true }, where: { userId: user, deletedAt: null, task: { list: { space: { workspaceId: { in: workIds } } } } } }),
      this.prisma.activityLog.groupBy({ by: ['userId'], _max: { createdAt: true }, where: { userId: user, board: { workspaceId: { in: boardsIds } } } }),
      this.prisma.taskComment.groupBy({ by: ['userId'], _max: { createdAt: true }, where: { userId: user, task: { group: { board: { workspaceId: { in: boardsIds } } } } } }),
      this.prisma.chatMessage.groupBy({ by: ['userId'], _max: { createdAt: true }, where: { userId: user, channel: { workspaceId: { in: boardsIds } } } }),
    ]);
    for (const r of results) take(r as any);
    return last;
  }

  // ---------- trends ----------

  /**
   * Weekly created vs completed for the last 8 weeks (from the tasks themselves), and the daily
   * open / overdue line from CEO Tower's own daily snapshots (it fills in from the day it started).
   */
  async trends(userId: number, source: Source = 'all', company?: string) {
    const { boardsWs, workWs, facts } = await this.scoped(userId, source, company);
    const monday = (d: Date) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x; };
    const start = monday(new Date(Date.now() - 7 * 7 * DAY));
    const weeks = Array.from({ length: 8 }, (_, i) => { const from = new Date(+start + i * 7 * DAY); return { start: from.toISOString().slice(0, 10), from: +from, to: +from + 7 * DAY, created: 0, completed: 0 }; });
    for (const f of facts) {
      const c = +f.createdAt;
      const w = weeks.find((x) => c >= x.from && c < x.to); if (w) w.created++;
      if (f.done && f.doneAt) { const d = +f.doneAt; const w2 = weeks.find((x) => d >= x.from && d < x.to); if (w2) w2.completed++; }
    }
    const keys = [...boardsWs.map((w) => `boards:${w.id}`), ...workWs.map((w) => `work:${w.id}`)];
    const since = new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10);
    const snaps = keys.length ? await this.prisma.ceoSnapshot.findMany({ where: { companyKey: { in: keys }, day: { gte: since } }, orderBy: { day: 'asc' } }) : [];
    const byDay = new Map<string, { day: string; open: number; overdue: number; done: number }>();
    for (const r of snaps) { const d = byDay.get(r.day) ?? { day: r.day, open: 0, overdue: 0, done: 0 }; d.open += r.open; d.overdue += r.overdue; d.done += r.done; byDay.set(r.day, d); }
    return { weeks: weeks.map(({ start, created, completed }) => ({ start, created, completed })), days: [...byDay.values()] };
  }

  // ---------- Management: every manager and the people under them ----------

  /**
   * Managers = owners / admins of the CEO's companies, plus anyone people report to (Work "reports to").
   * Under each: their direct reports (Work), with workload. Everyone else is listed as not under a manager.
   * The CEO is left out (they are the top).
   */
  async management(userId: number, source: Source = 'all', company?: string) {
    const o = await this.overview(userId, source, company);
    const own = await this.require(userId);
    const boardsIds = o.companies.filter((c) => c.source === 'boards').map((c) => c.id);
    const workIds = o.companies.filter((c) => c.source === 'work').map((c) => c.id);
    const [bm, wm, bl] = await Promise.all([
      this.prisma.workspaceMember.findMany({ where: { workspaceId: { in: boardsIds }, deletedAt: null, user: { deletedAt: null } }, select: { workspaceId: true, userId: true, role: true } }),
      this.prisma.ceoReportLine.findMany({ where: { workspaceId: { in: boardsIds } }, select: { workspaceId: true, userId: true, managerId: true } }),
      this.prisma.workMember.findMany({ where: { workspaceId: { in: workIds }, user: { deletedAt: null } }, select: { workspaceId: true, userId: true, role: true, title: true, managerId: true } }),
    ]).then(([b, l, w]) => [b, w, l] as const);
    const co = new Map(o.companies.map((c) => [c.key, { key: c.key, name: c.name, source: c.source, uid: c.uid }]));
    const allIds = [...new Set([...bm.map((m) => m.userId), ...wm.map((m) => m.userId)])];
    const users = allIds.length ? await this.prisma.user.findMany({ where: { id: { in: allIds } }, select: { ...USER_MINI, email: true } }) : [];
    const userById = new Map(users.map((u) => [u.id, u]));
    const statOf = new Map(o.people.map((p) => [p.user.id, { stats: p.stats, fromCeo: p.fromCeo }]));
    const empty = { total: 0, open: 0, done: 0, inProgress: 0, overdue: 0, doneWeek: 0, progress: 0 };
    const rolesOf = (id: number) => [
      ...bm.filter((m) => m.userId === id).map((m) => ({ company: co.get(`boards:${m.workspaceId}`)!, role: m.role as string })),
      ...wm.filter((m) => m.userId === id).map((m) => ({ company: co.get(`work:${m.workspaceId}`)!, role: m.role as string })),
    ].filter((r) => r.company);
    const titleOf = (id: number) => wm.find((m) => m.userId === id && m.title)?.title ?? null;
    const person = (id: number) => ({ user: userById.get(id)!, title: titleOf(id), roles: rolesOf(id), stats: statOf.get(id)?.stats ?? empty, fromCeo: statOf.get(id)?.fromCeo ?? 0 });

    // only lines between people still in that Boards company
    const boardsLines = bl.filter((l) => bm.some((m) => m.workspaceId === l.workspaceId && m.userId === l.userId) && bm.some((m) => m.workspaceId === l.workspaceId && m.userId === l.managerId));
    const managerIds = new Set<number>([
      ...bm.filter((m) => ['OWNER', 'ADMIN'].includes(m.role)).map((m) => m.userId),
      ...wm.filter((m) => ['OWNER', 'ADMIN'].includes(m.role)).map((m) => m.userId),
      ...wm.map((m) => m.managerId).filter((v): v is number => !!v),
      ...boardsLines.map((l) => l.managerId),
    ]);
    managerIds.delete(userId);
    const managers = [...managerIds].filter((id) => userById.has(id)).map((id) => {
      const reports = [
        ...wm.filter((m) => m.managerId === id).map((m) => ({ ...person(m.userId), company: co.get(`work:${m.workspaceId}`)! })),
        ...boardsLines.filter((l) => l.managerId === id).map((l) => ({ ...person(l.userId), company: co.get(`boards:${l.workspaceId}`)! })),
      ];
      const team = reports.reduce((s, r) => ({ open: s.open + r.stats.open, overdue: s.overdue + r.stats.overdue, inProgress: s.inProgress + r.stats.inProgress, doneWeek: s.doneWeek + r.stats.doneWeek }), { open: 0, overdue: 0, inProgress: 0, doneWeek: 0 });
      return { ...person(id), reports, team };
    }).sort((a, b) => b.reports.length - a.reports.length || b.stats.overdue - a.stats.overdue || a.user.firstName.localeCompare(b.user.firstName));
    const managed = new Set([...wm.filter((m) => m.managerId).map((m) => m.userId), ...boardsLines.map((l) => l.userId)]);
    const unmanaged = allIds.filter((id) => id !== userId && !managerIds.has(id) && !managed.has(id) && userById.has(id)).map(person)
      .sort((a, b) => b.stats.overdue - a.stats.overdue || a.user.firstName.localeCompare(b.user.firstName));
    // for "Reports to": the Work companies where you can set it (owner / admin there)
    void own;
    const myWork = await this.prisma.workMember.findMany({ where: { userId, workspaceId: { in: workIds }, role: { in: ['OWNER', 'ADMIN'] } }, select: { workspaceId: true } });
    return {
      managers,
      unmanaged,
      // per company: who is in it, who they report to, and whether you can change it (owner / admin there)
      work: [
        ...workIds.map((id) => ({
          company: co.get(`work:${id}`)!, canSet: myWork.some((m) => m.workspaceId === id),
          members: wm.filter((m) => m.workspaceId === id).map((m) => ({ userId: m.userId, managerId: m.managerId ?? null })),
        })),
        ...boardsIds.map((id) => ({
          company: co.get(`boards:${id}`)!, canSet: bm.some((m) => m.workspaceId === id && m.userId === userId && ['OWNER', 'ADMIN'].includes(m.role)),
          members: bm.filter((m) => m.workspaceId === id).map((m) => ({ userId: m.userId, managerId: boardsLines.find((l) => l.workspaceId === id && l.userId === m.userId)?.managerId ?? null })),
        })),
      ],
      counts: { managers: managers.length, people: allIds.filter((i) => i !== userId).length, unmanaged: unmanaged.length },
    };
  }

  /**
   * "Reports to" for a Boards company (Boards has no reporting line of its own, so CEO Tower keeps it).
   * Only its owners / admins can set it; both people must be in that company; no loops.
   */
  async setBoardsReportLine(userId: number, workspaceId: number, personId: number, managerId: number | null) {
    const own = await this.require(userId);
    if (!own.boards.some((w) => w.id === workspaceId)) throw new ForbiddenException('That company is not one of yours.');
    const me = await this.prisma.workspaceMember.findFirst({ where: { workspaceId, userId, deletedAt: null, role: { in: ['OWNER', 'ADMIN'] } }, select: { id: true } });
    if (!me) throw new ForbiddenException('Only the owner or an admin of this company can set who people report to.');
    const inCo = async (id: number) => !!(await this.prisma.workspaceMember.findFirst({ where: { workspaceId, userId: id, deletedAt: null }, select: { id: true } }));
    if (!(await inCo(personId))) throw new BadRequestException('That person is not in this company.');
    if (managerId === null) {
      await this.prisma.ceoReportLine.deleteMany({ where: { workspaceId, userId: personId } });
      return { ok: true };
    }
    if (managerId === personId) throw new BadRequestException("Someone can't report to themselves.");
    if (!(await inCo(managerId))) throw new BadRequestException('The manager must be in this company.');
    // no loops: walk up from the new manager
    let cur: number | null = managerId;
    for (let i = 0; cur && i < 50; i++) {
      if (cur === personId) throw new BadRequestException('That would make a loop in who reports to whom.');
      cur = (await this.prisma.ceoReportLine.findUnique({ where: { workspaceId_userId: { workspaceId, userId: cur } }, select: { managerId: true } }))?.managerId ?? null;
    }
    await this.prisma.ceoReportLine.upsert({ where: { workspaceId_userId: { workspaceId, userId: personId } }, create: { workspaceId, userId: personId, managerId, setById: userId }, update: { managerId, setById: userId } });
    return { ok: true };
  }

  // ---------- managing a company's people (the changes go through Boards / Work themselves) ----------

  /**
   * One company's members, for the "Manage people" screen: Boards workspace members (with the
   * membership id Boards' own role / remove routes use) and boards to invite into, or Work members
   * and pending invites. canManage: you are its owner / admin (the product checks again on every change).
   */
  async companyPeople(userId: number, key: string) {
    const own = await this.require(userId);
    const m = /^(boards|work):(\d+)$/.exec(key);
    if (!m) throw new NotFoundException('Unknown company.');
    const id = Number(m[2]);
    if (m[1] === 'boards') {
      const ws = own.boards.find((w) => w.id === id);
      if (!ws) throw new ForbiddenException('That company is not one of yours.');
      const [members, boards] = await Promise.all([
        this.prisma.workspaceMember.findMany({ where: { workspaceId: id, deletedAt: null, user: { deletedAt: null } }, orderBy: { createdAt: 'asc' }, select: { id: true, role: true, createdAt: true, user: { select: { ...USER_MINI, email: true } } } }),
        this.prisma.board.findMany({ where: { workspaceId: id }, orderBy: { id: 'asc' }, select: { id: true, name: true } }),
      ]);
      const me = members.find((x) => x.user.id === userId);
      return {
        source: 'boards' as const, key, id, uid: ws.uid, name: ws.name, canManage: !!me && ['OWNER', 'ADMIN'].includes(me.role),
        roles: ['ADMIN', 'MEMBER', 'VIEWER', 'GUEST'], boards,
        members: members.map((x) => ({ memberId: x.id, role: x.role, since: x.createdAt, user: x.user })),
        invites: [] as { id: number; email: string; role: string; createdAt: Date }[],
      };
    }
    const ws = own.work.find((w) => w.id === id);
    if (!ws) throw new ForbiddenException('That company is not one of yours.');
    const [members, invites] = await Promise.all([
      this.prisma.workMember.findMany({ where: { workspaceId: id, user: { deletedAt: null } }, orderBy: { createdAt: 'asc' }, select: { role: true, createdAt: true, user: { select: { ...USER_MINI, email: true } } } }),
      this.prisma.workInvitation.findMany({ where: { workspaceId: id, status: 'PENDING', expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, select: { id: true, email: true, role: true, createdAt: true } }),
    ]);
    const me = members.find((x) => x.user.id === userId);
    return {
      source: 'work' as const, key, id, uid: ws.uid, name: ws.name, canManage: !!me && ['OWNER', 'ADMIN'].includes(me.role),
      roles: ['ADMIN', 'MEMBER', 'LIMITED_MEMBER', 'GUEST'], boards: [] as { id: number; name: string }[],
      members: members.map((x) => ({ memberId: x.user.id, role: x.role, since: x.createdAt, user: x.user })),
      invites: invites.map((i) => ({ id: i.id, email: i.email, role: String(i.role), createdAt: i.createdAt })),
    };
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
    // a DM needs a company both of you are in (someone shared into CEO Tower may not be in every company)
    const [myWork, myBoards] = await Promise.all([
      this.prisma.workMember.findMany({ where: { userId, workspaceId: { in: work.map((m) => m.workspaceId) } }, select: { workspaceId: true } }),
      this.prisma.workspaceMember.findMany({ where: { userId, deletedAt: null, workspaceId: { in: boards.map((m) => m.workspaceId) } }, select: { workspaceId: true } }),
    ]);
    const inWork = new Set(myWork.map((m) => m.workspaceId));
    const inBoards = new Set(myBoards.map((m) => m.workspaceId));
    return {
      user,
      title: work.find((m) => m.title)?.title ?? null,
      memberships: [
        ...boards.map((m) => ({ key: `boards:${m.workspaceId}`, source: 'boards' as const, name: bName.get(m.workspaceId)!.name, uid: bName.get(m.workspaceId)!.uid, role: m.role })),
        ...work.map((m) => ({ key: `work:${m.workspaceId}`, source: 'work' as const, name: wName.get(m.workspaceId)!.name, uid: wName.get(m.workspaceId)!.uid, role: m.role })),
      ],
      // Work companies where a DM / assignment can reach them
      reach: work.filter((m) => inWork.has(m.workspaceId)).map((m) => ({ key: `work:${m.workspaceId}`, uid: wName.get(m.workspaceId)!.uid, name: wName.get(m.workspaceId)!.name })),
      // Boards companies where a Boards chat DM can reach them (people who are only in Boards)
      boardsReach: boards.filter((m) => inBoards.has(m.workspaceId)).map((m) => ({ key: `boards:${m.workspaceId}`, id: m.workspaceId, uid: bName.get(m.workspaceId)!.uid, name: bName.get(m.workspaceId)!.name })),
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
        where: { recipientId: userId, isRead: false, clearedAt: null, createdAt: { gte: since }, type: { in: ['TASK_ASSIGNED', 'COMMENT_MENTION', 'COMMENT_REPLY', 'COMMENT_CREATED', 'CHAT', 'TASK_STATUS_CHANGED'] } },
        orderBy: { createdAt: 'desc' }, take: 80,
        select: { id: true, type: true, title: true, message: true, metadata: true, createdAt: true, taskId: true },
      }),
      this.prisma.notification.findMany({
        where: { recipientId: userId, product: 'boards', isRead: false, clearedAt: null, createdAt: { gte: since }, type: { in: ['TASK_ASSIGNED', 'COMMENT_MENTION', 'COMMENT_REPLY', 'COMMENT_CREATED', 'FILE_COMMENT', 'TASK_STATUS_CHANGED'] } },
        orderBy: { createdAt: 'desc' }, take: 80,
        select: { id: true, type: true, title: true, message: true, entityType: true, entityId: true, metadata: true, createdAt: true },
      }),
    ]);
    const kindOf = (type: string, event?: string, done?: boolean) =>
      event === 'reaction' ? null
      : type === 'TASK_STATUS_CHANGED' ? (done ? 'completed' : null)
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
    // Boards comment notices point at the comment: find its task so the CEO can answer in the task popup
    const commentIds = boards.filter((n) => n.entityType === 'COMMENT' && n.entityId).map((n) => n.entityId!);
    const commentTask = new Map((commentIds.length ? await this.prisma.taskComment.findMany({ where: { id: { in: commentIds } }, select: { id: true, taskId: true } }) : []).map((c) => [c.id, c.taskId]));
    const num = (v: unknown) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
    // Boards status notices: "completed" when the new status is a done one (from the column's status options)
    const statusCols = [...new Set(boards.filter((n) => n.type === 'TASK_STATUS_CHANGED').map((n) => num((n.metadata as any)?.columnId)).filter((x): x is number => !!x))];
    const doneLabels = new Set((statusCols.length ? await this.prisma.statusOption.findMany({ where: { columnId: { in: statusCols }, category: 'DONE' }, select: { columnId: true, label: true } }) : []).map((o) => `${o.columnId}:${o.label}`));
    const items = [
      ...work.map((n) => {
        const m = (n.metadata ?? {}) as Record<string, any>;
        const kind = kindOf(n.type, m.event, m.done === true);
        return kind && { source: 'work' as const, id: n.id, kind, title: n.title, message: n.message, at: n.createdAt, href: typeof m.url === 'string' && m.url.startsWith('/work/') ? m.url : null, actor: m.actorName ?? null,
          // answer in place: the task's thread, or a direct message back to the sender
          task: n.taskId ? { source: 'work' as const, id: n.taskId } : null, actorId: num(m.actorId ?? m.senderId) };
      }),
      ...boards.map((n) => {
        const m = (n.metadata ?? {}) as Record<string, any>;
        const kind = kindOf(n.type, m.event, n.type === 'TASK_STATUS_CHANGED' && typeof m.newStatus === 'string' && doneLabels.has(`${m.columnId}:${m.newStatus}`));
        const b = boardById.get(Number(m.boardId ?? (n.entityType === 'BOARD' ? n.entityId : NaN)));
        const taskId = Number(m.taskId ?? (n.entityType === 'TASK' ? n.entityId : NaN));
        const href = b ? `/workspace/${b.workspace.uid}/board/${b.uid}${Number.isInteger(taskId) ? `?taskId=${taskId}` : ''}` : null;
        const tid = Number.isInteger(taskId) ? taskId : n.entityType === 'COMMENT' && n.entityId ? commentTask.get(n.entityId) ?? null : null;
        return kind && { source: 'boards' as const, id: n.id, kind, title: n.title, message: n.message, at: n.createdAt, href, actor: m.actorName ?? m.senderName ?? null,
          task: tid ? { source: 'boards' as const, id: tid } : null, actorId: num(m.actorId ?? m.senderId ?? m.userId) };
      }),
    ].filter(Boolean).sort((a, b) => +b!.at - +a!.at).slice(0, 60) as { source: 'work' | 'boards'; id: string; kind: string; title: string; message: string; at: Date; href: string | null; actor: string | null; task: { source: 'work' | 'boards'; id: number } | null; actorId: number | null }[];
    // approval requests: someone asks the CEO to approve / sign off on something in a task
    const APPROVAL = /\b(approv\w*|sign[\s-]?off|go[\s-]?ahead|permission|green[\s-]?light|manzoor\w*|ijazat)\b/i;
    const withApproval = items.map((i) => ({ ...i, approval: !!i.task && !['assigned', 'completed'].includes(i.kind) && APPROVAL.test(`${i.title} ${i.message}`) }));
    return { count: withApproval.length, approvals: withApproval.filter((i) => i.approval).length, items: withApproval };
  }

  /**
   * "Assigned by me": every Work task the Administrator created and gave to someone else, across their
   * Work companies (chat-created ones say which channel), with who finished it and when, plus totals
   * and a per-person breakdown.
   */
  async assignedByMe(userId: number, o: { person?: number; company?: string; state?: string; source?: 'work' | 'boards' } = {}) {
    const own = await this.require(userId);
    // the tower's product switch (All / Accounts / Work) and company scope apply here too
    const wsIds = o.source === 'boards' ? [] : own.work.map((w) => w.id).filter((id) => !o.company || `work:${id}` === o.company);
    const boardsWs = o.source === 'work' ? [] : own.boards.filter((w) => !o.company || `boards:${w.id}` === o.company);
    const rows = !wsIds.length ? [] : await this.prisma.workTask.findMany({
      where: { createdById: userId, archivedAt: null, assignees: { some: { userId: { not: userId } } }, list: { archivedAt: null, space: { archivedAt: null, workspaceId: { in: wsIds } } } },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      select: {
        id: true, uid: true, name: true, priority: true, dueDate: true, completedAt: true, createdAt: true,
        status: { select: { name: true, color: true, category: true } },
        list: { select: { uid: true, name: true, space: { select: { name: true, workspace: { select: { id: true, uid: true, name: true } } } } } },
        assignees: { select: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } },
        sourceChannel: { select: { uid: true, name: true, kind: true } },
      },
    });
    // who finished it: the latest status change on a done task
    const doneIds = rows.filter((t) => t.completedAt).map((t) => t.id);
    const acts = doneIds.length ? await this.prisma.workActivity.findMany({ where: { taskId: { in: doneIds }, action: 'status' }, orderBy: { createdAt: 'desc' }, select: { taskId: true, createdAt: true, user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } }) : [];
    const finisher = new Map<number, { id: number; firstName: string | null; lastName: string | null; avatarUrl: string | null }>();
    for (const a of acts) if (!finisher.has(a.taskId)) finisher.set(a.taskId, a.user);
    const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
    const weekAgo = Date.now() - 7 * DAY;
    const workRows = rows.map((t) => {
      const assignees = t.assignees.map((a) => a.user).filter((u) => u.id !== userId);
      const overdue = !t.completedAt && !!t.dueDate && t.dueDate < startOfToday;
      return {
        source: 'work' as const, id: t.id, uid: t.uid, name: t.name, priority: t.priority, dueDate: t.dueDate, completedAt: t.completedAt, createdAt: t.createdAt, status: t.status, overdue,
        company: { key: `work:${t.list.space.workspace.id}`, uid: t.list.space.workspace.uid, name: t.list.space.workspace.name },
        where: `${t.list.space.name} / ${t.list.name}`, listUid: t.list.uid,
        channel: t.sourceChannel ? { uid: t.sourceChannel.uid, name: t.sourceChannel.kind === 'channel' ? `#${t.sourceChannel.name}` : 'Direct message' } : null,
        assignees, completedBy: t.completedAt ? finisher.get(t.id) ?? null : null,
        hoursToDone: t.completedAt ? Math.max(0, Math.round((+t.completedAt - +t.createdAt) / 3_600_000)) : null,
      };
    });
    const all = [...workRows, ...(await this.assignedBoards(userId, boardsWs))].sort((a, b) => +b.createdAt - +a.createdAt);
    // per person (a task with two people counts for both)
    const per = new Map<number, { user: (typeof all)[number]['assignees'][number]; assigned: number; open: number; done: number; overdue: number; hours: number[] }>();
    for (const t of all) for (const u of t.assignees) {
      const p = per.get(u.id) ?? { user: u, assigned: 0, open: 0, done: 0, overdue: 0, hours: [] };
      p.assigned++; if (t.completedAt) { p.done++; if (t.hoursToDone !== null) p.hours.push(t.hoursToDone); } else p.open++;
      if (t.overdue) p.overdue++;
      per.set(u.id, p);
    }
    const people = [...per.values()].map(({ hours, ...p }) => ({ ...p, avgHoursToDone: hours.length ? Math.round(hours.reduce((a, b) => a + b, 0) / hours.length) : null })).sort((a, b) => b.overdue - a.overdue || b.open - a.open);
    const summary = {
      total: all.length, open: all.filter((t) => !t.completedAt).length, done: all.filter((t) => t.completedAt).length,
      overdue: all.filter((t) => t.overdue).length, doneWeek: all.filter((t) => t.completedAt && +t.completedAt >= weekAgo).length,
    };
    const state = o.state ?? 'all';
    const tasks = all.filter((t) => (!o.person || t.assignees.some((u) => u.id === o.person)) && (state === 'all' || (state === 'open' ? !t.completedAt : state === 'done' ? !!t.completedAt : t.overdue)));
    return { summary, people, tasks: tasks.slice(0, 500), companies: [...(o.source === 'boards' ? [] : own.work.map((w) => ({ key: `work:${w.id}`, name: w.name }))), ...(o.source === 'work' ? [] : own.boards.map((w) => ({ key: `boards:${w.id}`, name: w.name })))] };
  }

  /** Accounts & Invoices items the Administrator created and gave to someone else (rows shaped like the Work ones) */
  private async assignedBoards(userId: number, ws: { id: number; uid: string; name: string; timezone: string | null }[]) {
    if (!ws.length) return [];
    const facts = (await this.boardsFacts(ws)).filter((f) => f.createdById === userId && f.assignees.some((a) => a !== userId));
    if (!facts.length) return [];
    const ids = facts.map((f) => f.id);
    const [tasks, people, acts, cols] = await Promise.all([
      this.prisma.task.findMany({ where: { id: { in: ids } }, select: { id: true, group: { select: { name: true, board: { select: { name: true } } } }, sourceChatChannel: { select: { id: true, name: true, type: true } } } }),
      this.prisma.user.findMany({ where: { id: { in: [...new Set(facts.flatMap((f) => f.assignees))] } }, select: { id: true, firstName: true, lastName: true, avatarUrl: true } }),
      // who finished it: the latest status change on a done item (Boards keeps it in the activity log)
      this.prisma.activityLog.findMany({ where: { taskId: { in: facts.filter((f) => f.done).map((f) => f.id) }, entityType: 'TASK_CELL', action: 'UPDATED' }, orderBy: { createdAt: 'desc' }, take: 5000, select: { taskId: true, createdAt: true, metadata: true, user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } }),
      this.prisma.statusOption.findMany({ where: { column: { board: { workspaceId: { in: ws.map((w) => w.id) } } } }, select: { label: true, category: true, column: { select: { boardId: true } } } }),
    ]);
    const byTask = new Map(tasks.map((t) => [t.id, t]));
    const byUser = new Map(people.map((u) => [u.id, u]));
    const finished = new Map<number, { at: Date; by: (typeof acts)[number]['user'] }>();
    for (const a of acts) if (a.taskId && !finished.has(a.taskId) && (a.metadata as any)?.columnType === 'STATUS') finished.set(a.taskId, { at: a.createdAt, by: a.user });
    const catOf = new Map(cols.map((c) => [`${c.column.boardId}:${c.label}`, c.category]));
    return facts.map((f) => {
      const t = byTask.get(f.id);
      const fin = f.done ? finished.get(f.id) : undefined;
      const completedAt = f.done ? fin?.at ?? f.doneAt : null;
      const ch = t?.sourceChatChannel;
      return {
        source: 'boards' as const, id: f.id, uid: String(f.id), name: f.name, priority: null, createdAt: f.createdAt,
        dueDate: f.due ? new Date(`${f.due}T12:00:00Z`) : null, completedAt,
        status: f.status ? { name: f.status.label, color: f.status.color, category: catOf.get(`${f.place.id}:${f.status.label}`) ?? (f.done ? 'DONE' : 'ACTIVE') } : null,
        overdue: !f.done && !!f.due && f.due < ymd(new Date(), f._tz ?? 'UTC'),
        company: { key: f.companyKey, uid: ws.find((w) => `boards:${w.id}` === f.companyKey)?.uid ?? '', name: ws.find((w) => `boards:${w.id}` === f.companyKey)?.name ?? '' },
        where: t ? `${t.group.board.name} / ${t.group.name}` : f.where, listUid: '',
        channel: ch ? { uid: String(ch.id), name: ch.type === 'DIRECT' ? 'Direct message' : `#${ch.name ?? 'channel'}` } : null,
        assignees: f.assignees.filter((a) => a !== userId).map((a) => byUser.get(a)).filter(Boolean) as { id: number; firstName: string | null; lastName: string | null; avatarUrl: string | null }[],
        completedBy: fin?.by ?? null,
        hoursToDone: completedAt ? Math.max(0, Math.round((+completedAt - +f.createdAt) / 3_600_000)) : null,
      };
    });
  }

  /** Work chats (channels, group and direct messages) the Administrator is in, across their Work companies */
  async execChannels(userId: number) {
    const own = await this.require(userId);
    const rows = !own.work.length ? [] : await this.prisma.workChannel.findMany({
      where: { workspaceId: { in: own.work.map((w) => w.id) }, archivedAt: null, members: { some: { userId } } },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 300,
      select: {
        uid: true, name: true, kind: true, isPrivate: true, lastMessageAt: true, workspaceId: true, defaultListId: true,
        members: { select: { userId: true, lastReadAt: true, user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } },
        _count: { select: { sourceTasks: { where: { completedAt: null, archivedAt: null } } } },
      },
    });
    const boardsGroups = await this.execBoardsChannels(userId, own.boards);
    return [...own.work.map((w) => ({
      company: { key: `work:${w.id}`, uid: w.uid, name: w.name, id: w.id, source: 'work' as const },
      channels: rows.filter((c) => c.workspaceId === w.id).map((c) => {
        const me = c.members.find((m) => m.userId === userId);
        return {
          uid: c.uid, name: c.name, kind: c.kind, isPrivate: c.isPrivate, lastMessageAt: c.lastMessageAt, memberCount: c.members.length,
          people: c.kind === 'channel' ? [] : c.members.filter((m) => m.userId !== userId).map((m) => m.user),
          unread: !!c.lastMessageAt && (!me?.lastReadAt || c.lastMessageAt > me.lastReadAt), openTasks: c._count.sourceTasks,
        };
      }),
    })), ...boardsGroups];
  }

  /** Accounts & Invoices team chats (channels and direct messages) the Administrator is in */
  private async execBoardsChannels(userId: number, ws: { id: number; uid: string; name: string; timezone: string | null }[]) {
    if (!ws.length) return [];
    const rows = await this.prisma.chatChannel.findMany({
      where: { workspaceId: { in: ws.map((w) => w.id) }, members: { some: { userId } } },
      orderBy: { updatedAt: 'desc' },
      take: 300,
      select: {
        id: true, name: true, type: true, workspaceId: true, updatedAt: true,
        members: { select: { userId: true, lastReadAt: true, user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      },
    });
    // open items made from each chat (done = the board's status says so)
    const made = await this.prisma.task.findMany({ where: { sourceChatChannelId: { in: rows.map((r) => r.id) } }, select: { id: true, sourceChatChannelId: true } });
    const doneIds = new Set((await this.boardsFacts(ws)).filter((f) => f.done).map((f) => f.id));
    const openBy = new Map<number, number>();
    for (const t of made) if (!doneIds.has(t.id)) openBy.set(t.sourceChatChannelId!, (openBy.get(t.sourceChatChannelId!) ?? 0) + 1);
    return ws.map((w) => ({
      company: { key: `boards:${w.id}`, uid: w.uid, name: w.name, id: w.id, source: 'boards' as const },
      channels: rows.filter((c) => c.workspaceId === w.id).map((c) => {
        const me = c.members.find((m) => m.userId === userId);
        const last = c.messages[0]?.createdAt ?? null;
        const dm = c.type === 'DIRECT';
        return {
          uid: String(c.id), id: c.id, name: c.name, kind: dm ? 'dm' : 'channel', isPrivate: true, lastMessageAt: last, memberCount: c.members.length,
          people: dm ? c.members.filter((m) => m.userId !== userId).map((m) => m.user) : [],
          unread: !!last && (!me?.lastReadAt || last > me.lastReadAt), openTasks: openBy.get(c.id) ?? 0,
        };
      }),
    }));
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

  async tasks(userId: number, o: { source?: Source; company?: string; person?: number; state?: string; q?: string; limit?: number; place?: { type: string; id: number }; by?: number }) {
    const { own, facts: allFacts } = await this.scoped(userId, o.source ?? 'all', o.company);
    const inPlace = o.place ? await this.placeFilter(own, o.place) : null;
    const facts = allFacts.filter((f) => (!inPlace || inPlace(f)) && (!o.by || f.createdById === o.by));
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
    const [users, last] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: ids }, deletedAt: null }, select: USER_MINI }),
      this.lastActivity(ids, boardsWs.map((w) => w.id), workWs.map((w) => w.id)),
    ]);
    const name = new Map([...boardsWs.map((w) => [`boards:${w.id}`, w.name] as const), ...workWs.map((w) => [`work:${w.id}`, w.name] as const)]);
    const byUser = new Map<number, typeof facts>();
    for (const f of facts) for (const u of f.assignees) byUser.set(u, [...(byUser.get(u) ?? []), f]);
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
    const nameOf = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
    const companyRef = new Map(companies.map((c) => [c.key, { key: c.key, name: c.name, source: c.source }]));
    const people = users.map((u: Person) => {
      const list = byUser.get(u.id) ?? [];
      // tasks the CEO gave this person that are still open
      const fromCeo = list.filter((f) => !f.done && f.createdById === userId && u.id !== userId).length;
      return { user: u, stats: stats(list), fromCeo, companies: [...new Set(list.map((f) => f.companyKey))].map((k) => companyRef.get(k)!).filter(Boolean), memberOf: companies.filter((c) => (members.get(c.key) ?? []).some((m) => m.userId === u.id)).length };
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
      // everything the CEO gave out, across companies
      ceoTasks: stats(facts.filter((f) => f.createdById === userId)),
      // "Lead": the company's owners / admins other than the CEO
      companies: companies.map((c) => ({ ...c, leads: c.admins.filter((id) => id !== userId).map((id) => nameOf.get(id)).filter((n): n is string => !!n).slice(0, 3) })),
      people: people.slice(0, 40),
      updates,
      attention: { companies: companies.filter((c) => c.health !== 'healthy').map((c) => ({ key: c.key, name: c.name, source: c.source, overdue: c.stats.overdue })), overdue: overdueList },
      // EZ CRM rollup (only on the all-companies view; CRM is its own product, not tied to a boards/work company)
      crm: source === 'all' && !company ? await this.crmRollup(userId) : null,
    };
  }

  /** a CRM summary for the Executive Hub: contacts, companies, open pipeline and what was won this month */
  private async crmRollup(userId: number) {
    try {
      const isSuper = (await this.prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } }))?.systemRole === 'SUPER_ADMIN';
      const wsIds = isSuper
        ? (await this.prisma.crmWorkspace.findMany({ select: { id: true } })).map((w) => w.id)
        : (await this.prisma.crmMember.findMany({ where: { userId }, select: { workspaceId: true } })).map((m) => m.workspaceId);
      if (!wsIds.length) return null;
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const [contacts, companies, openDeals, won] = await Promise.all([
        this.prisma.crmContact.count({ where: { workspaceId: { in: wsIds } } }),
        this.prisma.crmCompany.count({ where: { workspaceId: { in: wsIds } } }),
        this.prisma.crmDeal.groupBy({ by: ['workspaceId'], where: { workspaceId: { in: wsIds }, wonAt: null, lostAt: null }, _count: { _all: true }, _sum: { amount: true } }),
        this.prisma.crmDeal.aggregate({ where: { workspaceId: { in: wsIds }, wonAt: { gte: monthStart } }, _count: { _all: true }, _sum: { amount: true } }),
      ]);
      const open = openDeals.reduce((a, x) => a + x._count._all, 0);
      const pipelineValue = openDeals.reduce((a, x) => a + Number(x._sum.amount ?? 0), 0);
      return { workspaces: wsIds.length, contacts, companies, openDeals: open, pipelineValue, wonThisMonth: { count: won._count._all, value: Number(won._sum.amount ?? 0) } };
    } catch {
      return null; // CRM tables not present yet
    }
  }
}
