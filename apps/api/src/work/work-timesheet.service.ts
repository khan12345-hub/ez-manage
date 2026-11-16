import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { WorkAccessService } from './work-access.service';

const USER_MINI = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;
const DAY = 86_400_000;

/**
 * Work → Timesheets: a week of tracked time (the same time entries the task timer and
 * "add time" write), per task for one person, or per person for the whole team (admins).
 * Days are the viewer's own days: the client sends its timezone offset.
 */
@Injectable()
export class WorkTimesheetService {
  constructor(private readonly prisma: PrismaService, private readonly access: WorkAccessService) {}

  private week(start: string, tzOffset: number) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new BadRequestException('Week must start like 2026-11-16.');
    if (!Number.isInteger(tzOffset) || Math.abs(tzOffset) > 14 * 60) throw new BadRequestException('Bad timezone offset.');
    // local midnight of `start` as a UTC instant (getTimezoneOffset sign: UTC - local, in minutes)
    const from = new Date(Date.parse(`${start}T00:00:00Z`) + tzOffset * 60_000);
    const days = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(`${start}T00:00:00Z`) + i * DAY).toISOString().slice(0, 10));
    return { from, to: new Date(+from + 7 * DAY), days };
  }

  /** seconds of an entry that fall on each of the 7 local days (a running timer counts up to now) */
  private spread(e: { startedAt: Date; endedAt: Date | null; duration: number | null }, from: Date) {
    const out = new Array(7).fill(0) as number[];
    const s = +e.startedAt;
    const end = e.endedAt ? +e.endedAt : e.duration != null ? s + e.duration * 1000 : Date.now();
    for (let i = 0; i < 7; i++) {
      const a = +from + i * DAY, b = a + DAY;
      const overlap = Math.min(end, b) - Math.max(s, a);
      if (overlap > 0) out[i] = Math.round(overlap / 1000);
    }
    return out;
  }

  async mine(workspaceId: number, viewerId: number, start: string, tzOffset: number, userId?: number) {
    const a = await this.access.requireWorkspace(workspaceId, viewerId, 'view');
    const who = userId ?? viewerId;
    if (who !== viewerId && !a.canManage) throw new ForbiddenException('Only admins can see other people\'s timesheets.');
    const { from, to, days } = this.week(start, tzOffset);
    const entries = await this.prisma.workTimeEntry.findMany({
      where: { userId: who, startedAt: { lt: to }, OR: [{ endedAt: null }, { endedAt: { gt: from } }], task: { list: { space: { workspaceId } } } },
      select: { id: true, startedAt: true, endedAt: true, duration: true, billable: true, note: true, task: { select: { id: true, uid: true, name: true, list: { select: { uid: true, name: true } } } } },
      orderBy: { startedAt: 'asc' },
    });
    const rows = new Map<number, { task: { id: number; uid: string; name: string; listName: string; listUid: string }; seconds: number[]; billable: number }>();
    for (const e of entries) {
      const per = this.spread(e, from);
      const r = rows.get(e.task.id) ?? { task: { id: e.task.id, uid: e.task.uid, name: e.task.name, listName: e.task.list.name, listUid: e.task.list.uid }, seconds: new Array(7).fill(0), billable: 0 };
      per.forEach((v, i) => (r.seconds[i] += v));
      if (e.billable) r.billable += per.reduce((x, y) => x + y, 0);
      rows.set(e.task.id, r);
    }
    const list = [...rows.values()].map((r) => ({ ...r, total: r.seconds.reduce((x, y) => x + y, 0) })).filter((r) => r.total > 0).sort((x, y) => y.total - x.total);
    const totals = days.map((_, i) => list.reduce((s, r) => s + r.seconds[i], 0));
    const user = await this.prisma.user.findUnique({ where: { id: who }, select: USER_MINI });
    return { user, days, rows: list, totals, total: totals.reduce((x, y) => x + y, 0), billable: list.reduce((s, r) => s + r.billable, 0), canManage: a.canManage };
  }

  /** admins: everyone in the workspace, hours per day */
  async team(workspaceId: number, viewerId: number, start: string, tzOffset: number) {
    const a = await this.access.requireWorkspace(workspaceId, viewerId, 'view');
    if (!a.canManage) throw new ForbiddenException('Only admins can see the team timesheet.');
    const { from, to, days } = this.week(start, tzOffset);
    const [members, entries] = await Promise.all([
      this.prisma.workMember.findMany({ where: { workspaceId, user: { deletedAt: null } }, select: { user: { select: USER_MINI } }, orderBy: { createdAt: 'asc' } }),
      this.prisma.workTimeEntry.findMany({
        where: { startedAt: { lt: to }, OR: [{ endedAt: null }, { endedAt: { gt: from } }], task: { list: { space: { workspaceId } } } },
        select: { userId: true, startedAt: true, endedAt: true, duration: true, billable: true },
      }),
    ]);
    const per = new Map<number, number[]>();
    const bill = new Map<number, number>();
    for (const e of entries) {
      const s = this.spread(e, from);
      const cur = per.get(e.userId) ?? new Array(7).fill(0);
      s.forEach((v, i) => (cur[i] += v));
      per.set(e.userId, cur);
      if (e.billable) bill.set(e.userId, (bill.get(e.userId) ?? 0) + s.reduce((x, y) => x + y, 0));
    }
    const people = members.map((m) => { const s = per.get(m.user.id) ?? new Array(7).fill(0); return { user: m.user, seconds: s, total: s.reduce((x: number, y: number) => x + y, 0), billable: bill.get(m.user.id) ?? 0 }; })
      .sort((x, y) => y.total - x.total);
    const totals = days.map((_, i) => people.reduce((s, p) => s + p.seconds[i], 0));
    return { days, people, totals, total: totals.reduce((x, y) => x + y, 0) };
  }
}
