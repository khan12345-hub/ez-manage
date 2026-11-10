import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { WorkAccessService } from './work-access.service';

const USER_MINI = { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } as const;
const TASK_MINI = {
  id: true, uid: true, name: true, priority: true, dueDate: true, startDate: true, completedAt: true,
  status: { select: { name: true, color: true, category: true } },
  list: { select: { uid: true, name: true, space: { select: { name: true } } } },
  assignees: { select: { user: { select: USER_MINI } } },
} as const;
const shape = (t: any) => ({ ...t, assignees: t.assignees.map((a: any) => a.user) });

/**
 * People in Work (ClickUp "Teams" hub): profiles (title, manager, time zone, teams,
 * priorities, focused on, tasks, assigned comments, activity), org chart, teams, analytics.
 */
@Injectable()
export class WorkProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  /** tasks the viewer may see: spaces visible to them in this workspace */
  private async visibleTaskWhere(workspaceId: number, viewerId: number) {
    const ws = await this.access.requireWorkspace(workspaceId, viewerId, 'view');
    return { ws, where: { archivedAt: null, list: { archivedAt: null, space: { workspaceId, archivedAt: null, ...this.access.visibleSpaces(ws, viewerId) } } } };
  }

  private async member(workspaceId: number, userId: number) {
    const m = await this.prisma.workMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true, title: true, timezone: true, managerId: true, createdAt: true, user: { select: { ...USER_MINI, deletedAt: true, chatStatusEmoji: true, chatStatusText: true } } },
    });
    if (!m || m.user.deletedAt) throw new NotFoundException('This person is not in this Work workspace.');
    return m;
  }

  /** everyone (people cards, org chart, pickers) */
  async directory(workspaceId: number, viewerId: number) {
    await this.access.requireWorkspace(workspaceId, viewerId, 'view');
    const [members, teams] = await Promise.all([
      this.prisma.workMember.findMany({
        where: { workspaceId, user: { deletedAt: null } },
        select: { role: true, title: true, timezone: true, managerId: true, user: { select: USER_MINI } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.workTeam.findMany({
        where: { workspaceId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, color: true, createdAt: true, members: { select: { userId: true } } },
      }),
    ]);
    const ids = new Set(members.map((m) => m.user.id));
    return {
      people: members.map((m) => ({
        ...m,
        online: this.notifications.isOnline(m.user.id),
        teamIds: teams.filter((t) => t.members.some((x) => x.userId === m.user.id)).map((t) => t.id),
      })),
      teams: teams.map((t) => ({ id: t.id, name: t.name, color: t.color, createdAt: t.createdAt, memberIds: t.members.map((x) => x.userId).filter((id) => ids.has(id)) })),
    };
  }

  async profile(workspaceId: number, viewerId: number, userId: number) {
    const { where } = await this.visibleTaskWhere(workspaceId, viewerId);
    const m = await this.member(workspaceId, userId);
    const since = new Date(Date.now() - 24 * 3600e3);
    const [manager, reports, teams, openTasks, comments, priorities, entries] = await Promise.all([
      m.managerId ? this.prisma.workMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: m.managerId } }, select: { title: true, user: { select: USER_MINI } } }) : null,
      this.prisma.workMember.findMany({ where: { workspaceId, managerId: userId, user: { deletedAt: null } }, select: { title: true, user: { select: USER_MINI } } }),
      this.prisma.workTeam.findMany({ where: { workspaceId, members: { some: { userId } } }, select: { id: true, name: true, color: true } }),
      this.prisma.workTask.count({ where: { ...where, completedAt: null, assignees: { some: { userId } } } }),
      this.prisma.workComment.count({ where: { deletedAt: null, assigneeId: userId, resolvedAt: null, task: where } }),
      this.prisma.workProfilePriority.findMany({ where: { workspaceId, userId, task: where }, orderBy: { order: 'asc' }, select: { task: { select: TASK_MINI } } }),
      this.prisma.workTimeEntry.findMany({
        where: { userId, task: { list: { space: { workspaceId } } }, OR: [{ endedAt: null }, { endedAt: { gte: since } }] },
        select: { startedAt: true, endedAt: true, task: { select: { id: true, uid: true, name: true, status: { select: { color: true, category: true } } } } },
      }),
    ]);
    const visibleIds = new Set((await this.prisma.workTask.findMany({ where: { ...where, id: { in: entries.map((e) => e.task.id) } }, select: { id: true } })).map((t) => t.id));
    return {
      member: { role: m.role, title: m.title, timezone: m.timezone, since: m.createdAt, user: m.user, status: { emoji: m.user.chatStatusEmoji, text: m.user.chatStatusText } },
      online: this.notifications.isOnline(userId),
      manager,
      reports,
      teams,
      counts: { tasks: openTasks, comments },
      priorities: priorities.map((p) => shape(p.task)),
      focused: this.focus(entries, since, new Date(), visibleIds),
      canEdit: viewerId === userId || (await this.access.forWorkspace(workspaceId, viewerId)).canManage,
      canManage: (await this.access.forWorkspace(workspaceId, viewerId)).canManage,
    };
  }

  /** time per task inside [from, to]; tasks the viewer can't see become "Private task" */
  private focus(entries: { startedAt: Date; endedAt: Date | null; task: { id: number; uid: string; name: string; status: any } }[], from: Date, to: Date, visible: Set<number>) {
    const per = new Map<number, { task: any; seconds: number }>();
    for (const e of entries) {
      const a = Math.max(+e.startedAt, +from);
      const b = Math.min(+(e.endedAt ?? new Date()), +to);
      if (b <= a) continue;
      const cur = per.get(e.task.id) ?? { task: visible.has(e.task.id) ? e.task : { id: 0, uid: null, name: 'Private task', status: null }, seconds: 0 };
      cur.seconds += Math.round((b - a) / 1000);
      per.set(e.task.id, cur);
    }
    const total = [...per.values()].reduce((s, x) => s + x.seconds, 0);
    return [...per.values()].sort((x, y) => y.seconds - x.seconds).map((x) => ({ ...x, pct: total ? Math.round((x.seconds / total) * 100) : 0 }));
  }

  async tasks(workspaceId: number, viewerId: number, userId: number) {
    const { where } = await this.visibleTaskWhere(workspaceId, viewerId);
    await this.member(workspaceId, userId);
    const [mine, delegated] = await Promise.all([
      this.prisma.workTask.findMany({ where: { ...where, assignees: { some: { userId } } }, orderBy: [{ dueDate: 'asc' }, { id: 'desc' }], take: 400, select: TASK_MINI }),
      this.prisma.workTask.findMany({ where: { ...where, completedAt: null, createdById: userId, assignees: { some: {}, none: { userId } } }, orderBy: { createdAt: 'desc' }, take: 50, select: TASK_MINI }),
    ]);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    const open = mine.filter((t) => !t.completedAt);
    const isToday = (t: any) => (t.dueDate && t.dueDate >= start && t.dueDate < end) || (t.startDate && t.startDate < end && (!t.dueDate || t.dueDate >= start));
    return {
      today: open.filter(isToday).map(shape),
      overdue: open.filter((t) => t.dueDate && t.dueDate < start).map(shape),
      next: open.filter((t) => t.dueDate && t.dueDate >= end && !isToday(t)).map(shape),
      unscheduled: open.filter((t) => !t.dueDate && !t.startDate).map(shape),
      done: mine.filter((t) => t.completedAt).sort((a, b) => +b.completedAt! - +a.completedAt!).slice(0, 50).map(shape),
      delegated: delegated.map(shape),
    };
  }

  async comments(workspaceId: number, viewerId: number, userId: number, resolved: boolean) {
    const { where } = await this.visibleTaskWhere(workspaceId, viewerId);
    await this.member(workspaceId, userId);
    return this.prisma.workComment.findMany({
      where: { deletedAt: null, assigneeId: userId, resolvedAt: resolved ? { not: null } : null, task: where },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, content: true, createdAt: true, resolvedAt: true, taskId: true,
        user: { select: USER_MINI },
        _count: { select: { replies: { where: { deletedAt: null } } } },
        task: { select: { uid: true, name: true, list: { select: { uid: true, name: true, space: { select: { name: true } } } } } },
      },
    });
  }

  async activity(workspaceId: number, viewerId: number, userId: number) {
    const { where } = await this.visibleTaskWhere(workspaceId, viewerId);
    await this.member(workspaceId, userId);
    return this.prisma.workActivity.findMany({
      where: { userId, task: where },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: {
        id: true, action: true, fromValue: true, toValue: true, createdAt: true,
        user: { select: USER_MINI },
        task: { select: { uid: true, name: true, status: { select: { color: true, category: true } }, list: { select: { uid: true, name: true, space: { select: { name: true } } } } } },
      },
    });
  }

  async update(workspaceId: number, viewerId: number, userId: number, dto: { title?: string | null; timezone?: string | null; managerId?: number | null }) {
    const ws = await this.access.requireWorkspace(workspaceId, viewerId, 'view');
    await this.member(workspaceId, userId);
    const self = viewerId === userId;
    if (!self && !ws.canManage) throw new ForbiddenException('Only admins can change other people\'s profiles.');
    if (dto.managerId !== undefined && !ws.canManage) throw new ForbiddenException('Only admins can set who someone reports to.');
    if (dto.timezone) {
      try { new Intl.DateTimeFormat('en-US', { timeZone: dto.timezone }); } catch { throw new BadRequestException('Unknown time zone.'); }
    }
    if (dto.managerId) {
      if (dto.managerId === userId) throw new BadRequestException('Someone can\'t report to themselves.');
      await this.member(workspaceId, dto.managerId);
      // no loops: walk up from the new manager
      let cur: number | null = dto.managerId;
      for (let i = 0; cur && i < 200; i++) {
        if (cur === userId) throw new BadRequestException('That would make a reporting loop.');
        cur = (await this.prisma.workMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: cur } }, select: { managerId: true } }))?.managerId ?? null;
      }
    }
    await this.prisma.workMember.update({
      where: { workspaceId_userId: { workspaceId, userId } },
      data: {
        ...(dto.title !== undefined && { title: dto.title?.trim() || null }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone || null }),
        ...(dto.managerId !== undefined && { managerId: dto.managerId }),
      },
    });
    return this.profile(workspaceId, viewerId, userId);
  }

  async addPriority(workspaceId: number, viewerId: number, userId: number, taskId: number) {
    const ws = await this.access.requireWorkspace(workspaceId, viewerId, 'view');
    if (viewerId !== userId && !ws.canManage) throw new ForbiddenException('You can only set your own priorities.');
    const { access } = await this.access.requireTask(taskId, viewerId, 'view');
    if (access.workspaceId !== workspaceId) throw new BadRequestException('That task is in another workspace.');
    const last = await this.prisma.workProfilePriority.findFirst({ where: { userId, workspaceId }, orderBy: { order: 'desc' }, select: { order: true } });
    await this.prisma.workProfilePriority.upsert({ where: { userId_taskId: { userId, taskId } }, create: { workspaceId, userId, taskId, order: (last?.order ?? 0) + 1000 }, update: {} });
    return { ok: true };
  }

  async removePriority(workspaceId: number, viewerId: number, userId: number, taskId: number) {
    const ws = await this.access.requireWorkspace(workspaceId, viewerId, 'view');
    if (viewerId !== userId && !ws.canManage) throw new ForbiddenException('You can only change your own priorities.');
    await this.prisma.workProfilePriority.deleteMany({ where: { workspaceId, userId, taskId } });
    return { ok: true };
  }

  /* ── teams ── */

  private async teamMembers(workspaceId: number, ids: number[] = []) {
    const list = [...new Set(ids)];
    if (list.length && !(await this.access.areMembers(workspaceId, list))) throw new BadRequestException('Teams can only include Work members.');
    return list;
  }

  async createTeam(workspaceId: number, viewerId: number, dto: { name: string; color?: string; memberIds?: number[] }) {
    await this.access.requireWorkspace(workspaceId, viewerId, 'manage');
    const ids = await this.teamMembers(workspaceId, dto.memberIds);
    return this.prisma.workTeam.create({
      data: { workspaceId, name: dto.name.trim(), color: dto.color ?? '#047857', createdById: viewerId, members: { create: ids.map((userId) => ({ userId })) } },
      select: { id: true, name: true, color: true },
    });
  }

  async updateTeam(teamId: number, viewerId: number, dto: { name?: string; color?: string; memberIds?: number[] }) {
    const team = await this.prisma.workTeam.findUnique({ where: { id: teamId }, select: { workspaceId: true } });
    if (!team) throw new NotFoundException('Team not found.');
    await this.access.requireWorkspace(team.workspaceId, viewerId, 'manage');
    const ids = dto.memberIds ? await this.teamMembers(team.workspaceId, dto.memberIds) : null;
    await this.prisma.$transaction([
      this.prisma.workTeam.update({ where: { id: teamId }, data: { ...(dto.name && { name: dto.name.trim() }), ...(dto.color && { color: dto.color }) } }),
      ...(ids ? [this.prisma.workTeamMember.deleteMany({ where: { teamId } }), this.prisma.workTeamMember.createMany({ data: ids.map((userId) => ({ teamId, userId })) })] : []),
    ]);
    return { ok: true };
  }

  async deleteTeam(teamId: number, viewerId: number) {
    const team = await this.prisma.workTeam.findUnique({ where: { id: teamId }, select: { workspaceId: true } });
    if (!team) throw new NotFoundException('Team not found.');
    await this.access.requireWorkspace(team.workspaceId, viewerId, 'manage');
    await this.prisma.workTeam.delete({ where: { id: teamId } });
    return { ok: true };
  }

  /* ── analytics: who tracked time when, and on what ── */

  async analytics(workspaceId: number, viewerId: number, day?: string) {
    const { where } = await this.visibleTaskWhere(workspaceId, viewerId);
    const from = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T00:00:00`) : new Date(new Date().setHours(0, 0, 0, 0));
    const to = new Date(from);
    to.setDate(from.getDate() + 1);
    const [members, entries] = await Promise.all([
      this.prisma.workMember.findMany({ where: { workspaceId, user: { deletedAt: null } }, select: { title: true, user: { select: USER_MINI } } }),
      this.prisma.workTimeEntry.findMany({
        where: { task: { list: { space: { workspaceId } } }, startedAt: { lt: to }, OR: [{ endedAt: null }, { endedAt: { gt: from } }] },
        select: { userId: true, startedAt: true, endedAt: true, task: { select: { id: true, uid: true, name: true, status: { select: { color: true, category: true } } } } },
      }),
    ]);
    const visible = new Set((await this.prisma.workTask.findMany({ where: { ...where, id: { in: [...new Set(entries.map((e) => e.task.id))] } }, select: { id: true } })).map((t) => t.id));
    // how many people were tracking time in each hour
    const hours = Array.from({ length: 24 }, () => new Set<number>());
    for (const e of entries) {
      const a = Math.max(+e.startedAt, +from);
      const b = Math.min(+(e.endedAt ?? new Date()), +to);
      for (let h = 0; h < 24; h++) {
        const hs = +from + h * 3600e3;
        if (a < hs + 3600e3 && b > hs) hours[h]!.add(e.userId);
      }
    }
    const people = members.map((m) => {
      const mine = entries.filter((e) => e.userId === m.user.id);
      return { user: m.user, title: m.title, online: this.notifications.isOnline(m.user.id), active: mine.length > 0, focused: this.focus(mine, from, to, visible) };
    });
    return { day: from.toISOString().slice(0, 10), hours: hours.map((s) => s.size), people: people.sort((a, b) => Number(b.active) - Number(a.active) || Number(b.online) - Number(a.online)) };
  }
}
