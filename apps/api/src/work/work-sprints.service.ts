import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { WorkAccessService } from './work-access.service';

const USER_MINI = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;
const DAY = 86_400_000;
const isDay = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Work → Sprints: a time box of tasks with story points. Tasks join a sprint through their
 * sprintId (set here or from the task); completing a sprint moves what is unfinished to the
 * next sprint (or back to the backlog). Burndown = what was still open at the end of each day.
 */
@Injectable()
export class WorkSprintsService {
  constructor(private readonly prisma: PrismaService, private readonly access: WorkAccessService) {}

  private async sprintOf(id: number, userId: number, level: 'view' | 'edit') {
    const s = await this.prisma.workSprint.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Sprint not found.');
    await this.access.requireWorkspace(s.workspaceId, userId, level);
    return s;
  }

  private taskWhere(sprintId: number) {
    return { sprintId, archivedAt: null, list: { archivedAt: null } } as const;
  }

  async list(workspaceId: number, userId: number) {
    await this.access.requireWorkspace(workspaceId, userId, 'view');
    const sprints = await this.prisma.workSprint.findMany({ where: { workspaceId }, orderBy: [{ startDate: 'desc' }] });
    const tasks = sprints.length ? await this.prisma.workTask.findMany({ where: { sprintId: { in: sprints.map((s) => s.id) }, archivedAt: null }, select: { sprintId: true, completedAt: true, points: true } }) : [];
    const order = { ACTIVE: 0, PLANNED: 1, DONE: 2 } as Record<string, number>;
    return sprints.map((s) => {
      const t = tasks.filter((x) => x.sprintId === s.id);
      const done = t.filter((x) => x.completedAt);
      return { ...s, tasks: t.length, done: done.length, points: t.reduce((a, x) => a + (x.points ?? 0), 0), donePoints: done.reduce((a, x) => a + (x.points ?? 0), 0) };
    }).sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || +b.startDate - +a.startDate);
  }

  async create(workspaceId: number, userId: number, dto: { name?: string; goal?: string; startDate?: string; endDate?: string; spaceId?: number }) {
    await this.access.requireWorkspace(workspaceId, userId, 'edit');
    const name = (dto.name ?? '').trim();
    if (!name || name.length > 120) throw new BadRequestException('Name the sprint (up to 120 characters).');
    if (!isDay(dto.startDate) || !isDay(dto.endDate)) throw new BadRequestException('Pick start and end dates.');
    if (dto.endDate! < dto.startDate!) throw new BadRequestException('The sprint must end after it starts.');
    return this.prisma.workSprint.create({
      data: { workspaceId, name, goal: dto.goal?.trim() || null, startDate: new Date(`${dto.startDate}T00:00:00Z`), endDate: new Date(`${dto.endDate}T23:59:59Z`), createdById: userId, spaceId: dto.spaceId ?? null },
    });
  }

  async update(id: number, userId: number, dto: { name?: string; goal?: string | null; startDate?: string; endDate?: string; status?: string }) {
    const s = await this.sprintOf(id, userId, 'edit');
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) { const n = dto.name.trim(); if (!n) throw new BadRequestException('Name the sprint.'); data.name = n.slice(0, 120); }
    if (dto.goal !== undefined) data.goal = dto.goal?.trim() || null;
    if (dto.startDate !== undefined) { if (!isDay(dto.startDate)) throw new BadRequestException('Bad start date.'); data.startDate = new Date(`${dto.startDate}T00:00:00Z`); }
    if (dto.endDate !== undefined) { if (!isDay(dto.endDate)) throw new BadRequestException('Bad end date.'); data.endDate = new Date(`${dto.endDate}T23:59:59Z`); }
    if (dto.status !== undefined) {
      if (!['PLANNED', 'ACTIVE'].includes(dto.status)) throw new BadRequestException('Use "Complete sprint" to finish it.');
      if (dto.status === 'ACTIVE') {
        const other = await this.prisma.workSprint.findFirst({ where: { workspaceId: s.workspaceId, status: 'ACTIVE', id: { not: id } }, select: { name: true } });
        if (other) throw new BadRequestException(`"${other.name}" is still running — complete it first.`);
      }
      data.status = dto.status;
    }
    return this.prisma.workSprint.update({ where: { id }, data });
  }

  /** finish: unfinished tasks go to `moveTo` (another open sprint) or back to the backlog */
  async complete(id: number, userId: number, moveTo: number | null) {
    const s = await this.sprintOf(id, userId, 'edit');
    if (s.status === 'DONE') throw new BadRequestException('This sprint is already complete.');
    if (moveTo) {
      const t = await this.prisma.workSprint.findFirst({ where: { id: moveTo, workspaceId: s.workspaceId, status: { not: 'DONE' } }, select: { id: true } });
      if (!t || moveTo === id) throw new BadRequestException('Move unfinished work to another open sprint.');
    }
    const moved = await this.prisma.workTask.updateMany({ where: { ...this.taskWhere(id), completedAt: null }, data: { sprintId: moveTo } });
    await this.prisma.workSprint.update({ where: { id }, data: { status: 'DONE', completedAt: new Date() } });
    return { ok: true, moved: moved.count };
  }

  async remove(id: number, userId: number) {
    await this.sprintOf(id, userId, 'edit');
    await this.prisma.workTask.updateMany({ where: { sprintId: id }, data: { sprintId: null } });
    await this.prisma.workSprint.delete({ where: { id } });
    return { ok: true };
  }

  /** put tasks in (or take them out of) a sprint — they must be in the same workspace */
  async setTasks(id: number, userId: number, add: number[], remove: number[]) {
    const s = await this.sprintOf(id, userId, 'edit');
    const ids = [...new Set(add.map(Number))].filter(Number.isInteger);
    if (ids.length) {
      const ok = await this.prisma.workTask.count({ where: { id: { in: ids }, list: { space: { workspaceId: s.workspaceId } } } });
      if (ok !== ids.length) throw new BadRequestException('Some tasks are not in this workspace.');
      await this.prisma.workTask.updateMany({ where: { id: { in: ids } }, data: { sprintId: id } });
    }
    const out = [...new Set(remove.map(Number))].filter(Number.isInteger);
    if (out.length) await this.prisma.workTask.updateMany({ where: { id: { in: out }, sprintId: id }, data: { sprintId: null } });
    return this.detail(id, userId);
  }

  async detail(id: number, userId: number) {
    const s = await this.sprintOf(id, userId, 'view');
    const tasks = await this.prisma.workTask.findMany({
      where: this.taskWhere(id),
      orderBy: [{ completedAt: 'asc' }, { order: 'asc' }],
      select: {
        id: true, uid: true, name: true, points: true, priority: true, dueDate: true, completedAt: true,
        status: { select: { id: true, name: true, color: true, category: true } },
        list: { select: { uid: true, name: true } },
        assignees: { select: { user: { select: USER_MINI } } },
      },
    });
    // burndown: open work left at the end of each day (tasks and points)
    const start = new Date(s.startDate); start.setUTCHours(0, 0, 0, 0);
    const days = Math.max(1, Math.round((+s.endDate - +start) / DAY));
    const total = tasks.length, totalPts = tasks.reduce((a, t) => a + (t.points ?? 0), 0);
    const burndown = Array.from({ length: days + 1 }, (_, i) => {
      const end = +start + (i + 1) * DAY - 1;
      const day = new Date(+start + i * DAY).toISOString().slice(0, 10);
      if (+start + i * DAY > Date.now()) return { day, tasks: null, points: null, ideal: total - (total * i) / days, idealPoints: totalPts - (totalPts * i) / days };
      const doneBy = tasks.filter((t) => t.completedAt && +t.completedAt <= end);
      return { day, tasks: total - doneBy.length, points: totalPts - doneBy.reduce((a, t) => a + (t.points ?? 0), 0), ideal: total - (total * i) / days, idealPoints: totalPts - (totalPts * i) / days };
    });
    return {
      ...s,
      tasks: tasks.map(({ assignees, ...t }) => ({ ...t, assignees: assignees.map((a) => a.user) })),
      stats: { tasks: total, done: tasks.filter((t) => t.completedAt).length, points: totalPts, donePoints: tasks.filter((t) => t.completedAt).reduce((a, t) => a + (t.points ?? 0), 0) },
      burndown,
    };
  }
}
