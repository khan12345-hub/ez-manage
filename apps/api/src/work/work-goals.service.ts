import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { WorkAccessService } from './work-access.service';

const USER_MINI = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;
const KINDS = ['NUMBER', 'CURRENCY', 'TRUE_FALSE', 'TASKS'] as const;
type Kind = (typeof KINDS)[number];

/**
 * Work → Goals: a goal has targets. NUMBER / CURRENCY / TRUE_FALSE are updated by hand;
 * TASKS follows a list by itself (share of its tasks completed). Goal progress = the average.
 */
@Injectable()
export class WorkGoalsService {
  constructor(private readonly prisma: PrismaService, private readonly access: WorkAccessService) {}

  private async goalOf(id: number, userId: number, level: 'view' | 'edit') {
    const g = await this.prisma.workGoal.findUnique({ where: { id } });
    if (!g) throw new NotFoundException('Goal not found.');
    await this.access.requireWorkspace(g.workspaceId, userId, level);
    return g;
  }

  private async withProgress(goals: { id: number; workspaceId: number; ownerId: number; [k: string]: unknown }[]) {
    if (!goals.length) return [];
    const targets = await this.prisma.workGoalTarget.findMany({ where: { goalId: { in: goals.map((g) => g.id) } }, orderBy: { createdAt: 'asc' } });
    const listIds = [...new Set(targets.filter((t) => t.kind === 'TASKS' && t.listId).map((t) => t.listId!))];
    const [counts, lists, owners] = await Promise.all([
      listIds.length ? this.prisma.workTask.groupBy({ by: ['listId'], where: { listId: { in: listIds }, archivedAt: null, parentId: null }, _count: { _all: true } }) : [],
      listIds.length ? this.prisma.workList.findMany({ where: { id: { in: listIds } }, select: { id: true, uid: true, name: true } }) : [],
      this.prisma.user.findMany({ where: { id: { in: [...new Set(goals.map((g) => g.ownerId))] } }, select: USER_MINI }),
    ]);
    const doneCounts = listIds.length ? await this.prisma.workTask.groupBy({ by: ['listId'], where: { listId: { in: listIds }, archivedAt: null, parentId: null, completedAt: { not: null } }, _count: { _all: true } }) : [];
    const total = new Map((counts as any[]).map((c) => [c.listId, c._count._all]));
    const done = new Map((doneCounts as any[]).map((c) => [c.listId, c._count._all]));
    const listById = new Map((lists as any[]).map((l) => [l.id, l]));
    const ownerById = new Map(owners.map((o) => [o.id, o]));
    const shape = (t: (typeof targets)[number]) => {
      let progress = 0, current = t.current, target = t.targetVal;
      if (t.kind === 'TASKS') { target = total.get(t.listId!) ?? 0; current = done.get(t.listId!) ?? 0; progress = target ? current / target : 0; }
      else if (t.kind === 'TRUE_FALSE') progress = t.current >= 1 ? 1 : 0;
      else progress = t.targetVal === t.startVal ? (t.current >= t.targetVal ? 1 : 0) : (t.current - t.startVal) / (t.targetVal - t.startVal);
      return { ...t, current, targetVal: target, list: t.listId ? listById.get(t.listId) ?? null : null, progress: Math.round(Math.max(0, Math.min(1, progress)) * 100) };
    };
    return goals.map((g) => {
      const ts = targets.filter((t) => t.goalId === g.id).map(shape);
      return { ...g, owner: ownerById.get(g.ownerId) ?? null, targets: ts, progress: ts.length ? Math.round(ts.reduce((a, t) => a + t.progress, 0) / ts.length) : 0 };
    });
  }

  async list(workspaceId: number, userId: number) {
    await this.access.requireWorkspace(workspaceId, userId, 'view');
    const goals = await this.prisma.workGoal.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' } });
    return this.withProgress(goals);
  }

  private async checkOwner(workspaceId: number, ownerId: number) {
    const m = await this.prisma.workMember.findFirst({ where: { workspaceId, userId: ownerId }, select: { userId: true } });
    if (!m) throw new BadRequestException('The owner must be in this workspace.');
  }

  async create(workspaceId: number, userId: number, dto: { name?: string; description?: string; dueDate?: string | null; ownerId?: number; color?: string }) {
    await this.access.requireWorkspace(workspaceId, userId, 'edit');
    const name = (dto.name ?? '').trim();
    if (!name || name.length > 200) throw new BadRequestException('Name the goal (up to 200 characters).');
    const ownerId = dto.ownerId ? Number(dto.ownerId) : userId;
    await this.checkOwner(workspaceId, ownerId);
    if (dto.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dto.dueDate)) throw new BadRequestException('Due date like 2026-12-31.');
    const g = await this.prisma.workGoal.create({
      data: { workspaceId, name, description: dto.description?.trim() || null, dueDate: dto.dueDate ? new Date(`${dto.dueDate}T17:00:00Z`) : null, ownerId, createdById: userId, ...(dto.color && /^#[0-9a-f]{6}$/i.test(dto.color) ? { color: dto.color } : {}) },
    });
    return (await this.withProgress([g]))[0];
  }

  async update(id: number, userId: number, dto: { name?: string; description?: string | null; dueDate?: string | null; ownerId?: number; color?: string }) {
    const g = await this.goalOf(id, userId, 'edit');
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) { const n = dto.name.trim(); if (!n) throw new BadRequestException('Name the goal.'); data.name = n.slice(0, 200); }
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.dueDate !== undefined) { if (dto.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dto.dueDate)) throw new BadRequestException('Due date like 2026-12-31.'); data.dueDate = dto.dueDate ? new Date(`${dto.dueDate}T17:00:00Z`) : null; }
    if (dto.ownerId !== undefined) { await this.checkOwner(g.workspaceId, Number(dto.ownerId)); data.ownerId = Number(dto.ownerId); }
    if (dto.color && /^#[0-9a-f]{6}$/i.test(dto.color)) data.color = dto.color;
    const u = await this.prisma.workGoal.update({ where: { id }, data });
    return (await this.withProgress([u]))[0];
  }

  async remove(id: number, userId: number) {
    await this.goalOf(id, userId, 'edit');
    await this.prisma.workGoalTarget.deleteMany({ where: { goalId: id } });
    await this.prisma.workGoal.delete({ where: { id } });
    return { ok: true };
  }

  async addTarget(goalId: number, userId: number, dto: { name?: string; kind?: string; startVal?: number; targetVal?: number; unit?: string; listId?: number }) {
    const g = await this.goalOf(goalId, userId, 'edit');
    const name = (dto.name ?? '').trim();
    if (!name) throw new BadRequestException('Name the target.');
    const kind = String(dto.kind ?? '').toUpperCase() as Kind;
    if (!KINDS.includes(kind)) throw new BadRequestException('Pick a target type.');
    let listId: number | null = null;
    if (kind === 'TASKS') {
      const l = await this.prisma.workList.findFirst({ where: { id: Number(dto.listId), space: { workspaceId: g.workspaceId } }, select: { id: true } });
      if (!l) throw new BadRequestException('Pick a list in this workspace.');
      listId = l.id;
    }
    const startVal = kind === 'NUMBER' || kind === 'CURRENCY' ? Number(dto.startVal ?? 0) : 0;
    const targetVal = kind === 'NUMBER' || kind === 'CURRENCY' ? Number(dto.targetVal ?? 0) : 1;
    if (!Number.isFinite(startVal) || !Number.isFinite(targetVal)) throw new BadRequestException('Numbers only.');
    await this.prisma.workGoalTarget.create({ data: { goalId, name: name.slice(0, 200), kind, startVal, targetVal, current: startVal, unit: kind === 'CURRENCY' ? (dto.unit || '$').slice(0, 8) : dto.unit?.slice(0, 20) || null, listId } });
    return (await this.withProgress([g]))[0];
  }

  async updateTarget(id: number, userId: number, dto: { current?: number; name?: string; targetVal?: number; startVal?: number }) {
    const t = await this.prisma.workGoalTarget.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Target not found.');
    const g = await this.goalOf(t.goalId, userId, 'edit');
    const data: Record<string, unknown> = {};
    for (const k of ['current', 'targetVal', 'startVal'] as const) if (dto[k] !== undefined) { const v = Number(dto[k]); if (!Number.isFinite(v)) throw new BadRequestException('Numbers only.'); data[k] = v; }
    if (dto.name !== undefined) { const n = dto.name.trim(); if (!n) throw new BadRequestException('Name the target.'); data.name = n.slice(0, 200); }
    if (t.kind === 'TASKS' && (data.current !== undefined || data.targetVal !== undefined)) throw new BadRequestException('Task targets follow their list.');
    await this.prisma.workGoalTarget.update({ where: { id }, data });
    return (await this.withProgress([g]))[0];
  }

  async removeTarget(id: number, userId: number) {
    const t = await this.prisma.workGoalTarget.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Target not found.');
    const g = await this.goalOf(t.goalId, userId, 'edit');
    await this.prisma.workGoalTarget.delete({ where: { id } });
    return (await this.withProgress([g]))[0];
  }
}
