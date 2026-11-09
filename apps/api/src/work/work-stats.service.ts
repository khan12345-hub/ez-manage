import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { WorkAccessService } from './work-access.service';
import { ATTACHMENT_SELECT } from './work-files.service';

const USER_MINI = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;
const byUid = (idOrUid: string) => {
  const n = Number(idOrUid);
  return Number.isInteger(n) && String(n) === idOrUid ? { id: n } : { uid: idOrUid };
};
export type StatsKind = 'list' | 'folder' | 'space';

/**
 * Numbers behind the Overview cards and the Dashboard (ClickUp):
 * status / assignee breakdowns, due & completed this week, latest activity,
 * time tracked and the files ("Resources") in a list, folder or space.
 */
@Injectable()
export class WorkStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkAccessService,
  ) {}

  private async scope(kind: StatsKind, idOrUid: string) {
    if (kind === 'list') {
      const l = await this.prisma.workList.findFirst({ where: { ...byUid(idOrUid), archivedAt: null }, select: { id: true, name: true, spaceId: true } });
      if (!l) throw new NotFoundException('List not found.');
      return { spaceId: l.spaceId, listIds: [l.id], name: l.name };
    }
    if (kind === 'folder') {
      const f = await this.prisma.workFolder.findFirst({ where: { ...byUid(idOrUid), archivedAt: null }, select: { id: true, name: true, spaceId: true, lists: { where: { archivedAt: null }, select: { id: true } } } });
      if (!f) throw new NotFoundException('Folder not found.');
      return { spaceId: f.spaceId, listIds: f.lists.map((l) => l.id), name: f.name };
    }
    if (kind === 'space') {
      const s = await this.prisma.space.findFirst({ where: { ...byUid(idOrUid), archivedAt: null }, select: { id: true, name: true } });
      if (!s) throw new NotFoundException('Space not found.');
      const lists = await this.prisma.workList.findMany({ where: { spaceId: s.id, archivedAt: null, OR: [{ folderId: null }, { folder: { archivedAt: null } }] }, select: { id: true } });
      return { spaceId: s.id, listIds: lists.map((l) => l.id), name: s.name };
    }
    throw new BadRequestException('Unknown location.');
  }

  async get(kind: StatsKind, idOrUid: string, userId: number) {
    const sc = await this.scope(kind, idOrUid);
    await this.access.requireSpace(sc.spaceId, userId, 'view');
    const inScope = { archivedAt: null, OR: [{ listId: { in: sc.listIds } }, { extraLists: { some: { listId: { in: sc.listIds } } } }] };
    const tasks = await this.prisma.workTask.findMany({
      where: { ...inScope, parentId: null },
      select: {
        id: true, uid: true, name: true, priority: true, dueDate: true, startDate: true, completedAt: true,
        list: { select: { uid: true, name: true } },
        status: { select: { id: true, name: true, color: true, category: true } },
        assignees: { select: { user: { select: USER_MINI } } },
      },
    });

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Monday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const isDone = (t: (typeof tasks)[number]) => !!t.completedAt || t.status?.category === 'DONE';

    // status breakdown (by name: the same status can exist per list)
    const statusMap = new Map<string, { name: string; color: string; category: string; count: number }>();
    for (const t of tasks) {
      const k = t.status ? `${t.status.name.toLowerCase()}|${t.status.category}` : 'none';
      const cur = statusMap.get(k) ?? { name: t.status?.name ?? 'No status', color: t.status?.color ?? '#9ca3af', category: t.status?.category ?? 'NOT_STARTED', count: 0 };
      cur.count++;
      statusMap.set(k, cur);
    }
    const order = { NOT_STARTED: 0, ACTIVE: 1, DONE: 2 } as Record<string, number>;
    const byStatus = [...statusMap.values()].sort((a, b) => (order[a.category] ?? 1) - (order[b.category] ?? 1) || b.count - a.count);

    // assignees
    const people = new Map<number, { user: { id: number; firstName: string; lastName: string; avatarUrl: string | null }; total: number; open: number; done: number }>();
    let unassigned = 0;
    for (const t of tasks) {
      if (!t.assignees.length) unassigned += isDone(t) ? 0 : 1;
      for (const a of t.assignees) {
        const p = people.get(a.user.id) ?? { user: a.user, total: 0, open: 0, done: 0 };
        p.total++;
        if (isDone(t)) p.done++;
        else p.open++;
        people.set(a.user.id, p);
      }
    }
    const byAssignee = [...people.values()].sort((a, b) => b.total - a.total);

    const slim = (t: (typeof tasks)[number]) => ({
      id: t.id, uid: t.uid, name: t.name, priority: t.priority, dueDate: t.dueDate, completedAt: t.completedAt,
      list: t.list, status: t.status, assignees: t.assignees.map((a) => a.user),
    });
    const completedThisWeek = tasks.filter((t) => t.completedAt && t.completedAt >= weekStart).sort((a, b) => +b.completedAt! - +a.completedAt!).slice(0, 30).map(slim);
    const dueThisWeek = tasks
      .filter((t) => !isDone(t) && t.dueDate && t.dueDate < weekEnd)
      .sort((a, b) => +a.dueDate! - +b.dueDate!)
      .slice(0, 50)
      .map((t) => ({ ...slim(t), overdue: t.dueDate! < now }));

    const ids = tasks.map((t) => t.id);
    const [activity, time, files] = ids.length
      ? await Promise.all([
          this.prisma.workActivity.findMany({
            where: { taskId: { in: ids } },
            orderBy: { createdAt: 'desc' },
            take: 30,
            select: { id: true, action: true, fromValue: true, toValue: true, createdAt: true, user: { select: USER_MINI }, task: { select: { uid: true, name: true, list: { select: { name: true } } } } },
          }),
          this.prisma.workTimeEntry.groupBy({ by: ['userId'], where: { taskId: { in: ids }, duration: { not: null } }, _sum: { duration: true } }),
          this.prisma.workAttachment.findMany({ where: { taskId: { in: ids } }, orderBy: { createdAt: 'desc' }, take: 12, select: { ...ATTACHMENT_SELECT, task: { select: { uid: true, name: true } } } }),
        ])
      : [[], [], []];
    const timeUsers = time.length ? await this.prisma.user.findMany({ where: { id: { in: time.map((t) => t.userId) } }, select: USER_MINI }) : [];
    const timeByUser = time
      .map((t) => ({ user: timeUsers.find((u) => u.id === t.userId)!, seconds: t._sum.duration ?? 0 }))
      .filter((t) => t.user)
      .sort((a, b) => b.seconds - a.seconds);

    const done = tasks.filter(isDone).length;
    return {
      kind,
      name: sc.name,
      totals: {
        total: tasks.length,
        done,
        open: tasks.length - done,
        inProgress: tasks.filter((t) => !isDone(t) && t.status?.category === 'ACTIVE').length,
        unassigned,
        overdue: tasks.filter((t) => !isDone(t) && t.dueDate && t.dueDate < now).length,
      },
      byStatus,
      byAssignee,
      completedThisWeek,
      dueThisWeek,
      activity,
      timeByUser,
      files,
    };
  }
}
