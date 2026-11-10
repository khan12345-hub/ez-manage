import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from 'prisma/prisma.service';
import { WorkAccessService } from './work-access.service';
import { WorkDetailService } from './work-detail.service';
import { WorkNotifyService } from './work-notify.service';
import { WorkService } from './work.service';

export const TRIGGERS = ['task_created', 'status_changed', 'assignee_added', 'priority_changed', 'due_date_changed', 'comment_added', 'task_moved'] as const;
export const ACTIONS = ['set_status', 'set_priority', 'add_assignees', 'remove_assignees', 'set_due_date', 'add_tag', 'add_comment', 'create_subtask', 'move_to_list', 'archive', 'notify'] as const;
const PRIORITIES = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];

type Trigger = { type: (typeof TRIGGERS)[number]; from?: string | null; to?: string | null; userId?: number | null };
type Condition = { field: 'priority' | 'assignee' | 'tag'; op: 'is' | 'is_not'; value: string | number };
type Action = { type: (typeof ACTIONS)[number]; status?: string; priority?: string | null; userIds?: number[]; days?: number; tagId?: number; text?: string; name?: string; listId?: number; message?: string };

import { WORK_TASK_EVENT, type WorkTaskEvent } from './work-events';
export { WORK_TASK_EVENT, type WorkTaskEvent };

/**
 * Automations (ClickUp): rules on a space / folder / list. Actions run as the rule's
 * creator and never re-trigger automations (no loops). Every run is recorded.
 */
@Injectable()
export class WorkAutomationsService {
  private readonly logger = new Logger(WorkAutomationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkAccessService,
    private readonly work: WorkService,
    private readonly detail: WorkDetailService,
    private readonly workNotify: WorkNotifyService,
  ) {}

  /* ── CRUD ── */

  private async location(spaceId: number, userId: number, folderId?: number | null, listId?: number | null) {
    const a = await this.access.requireSpace(spaceId, userId, 'edit');
    if (folderId) {
      const f = await this.prisma.workFolder.findFirst({ where: { id: folderId, spaceId, archivedAt: null }, select: { id: true } });
      if (!f) throw new BadRequestException('That folder is not in this space.');
    }
    if (listId) {
      const l = await this.prisma.workList.findFirst({ where: { id: listId, spaceId, archivedAt: null }, select: { id: true, folderId: true } });
      if (!l) throw new BadRequestException('That list is not in this space.');
      if (folderId && l.folderId !== folderId) throw new BadRequestException('That list is not in this folder.');
    }
    return a;
  }

  private async validate(workspaceId: number, spaceId: number, trigger: any, conditions: any, actions: any) {
    if (!trigger || !TRIGGERS.includes(trigger.type)) throw new BadRequestException('Pick a trigger.');
    if (!Array.isArray(actions) || !actions.length || actions.length > 10) throw new BadRequestException('Add 1 to 10 actions.');
    const people = new Set<number>();
    for (const a of actions as Action[]) {
      if (!ACTIONS.includes(a?.type)) throw new BadRequestException(`Unknown action: ${a?.type}`);
      if (a.type === 'set_status' && !a.status?.trim()) throw new BadRequestException('Choose a status.');
      if (a.type === 'set_priority' && a.priority !== null && !PRIORITIES.includes(a.priority ?? '')) throw new BadRequestException('Choose a priority.');
      if ((a.type === 'add_assignees' || a.type === 'remove_assignees' || a.type === 'notify') && !a.userIds?.length) throw new BadRequestException('Choose people.');
      (a.userIds ?? []).forEach((u) => people.add(u));
      if (a.type === 'set_due_date' && (!Number.isInteger(a.days) || Math.abs(a.days!) > 365)) throw new BadRequestException('Due date: a number of days (−365 to 365).');
      if (a.type === 'add_comment' && !a.text?.trim()) throw new BadRequestException('Write the comment.');
      if (a.type === 'create_subtask' && !a.name?.trim()) throw new BadRequestException('Name the subtask.');
      if (a.type === 'add_tag') {
        const t = await this.prisma.workTag.findFirst({ where: { id: a.tagId ?? 0, spaceId }, select: { id: true } });
        if (!t) throw new BadRequestException('Tags must belong to this space.');
      }
      if (a.type === 'move_to_list') {
        const l = await this.prisma.workList.findFirst({ where: { id: a.listId ?? 0, archivedAt: null, space: { workspaceId } }, select: { id: true } });
        if (!l) throw new BadRequestException('Choose a list in this workspace.');
      }
    }
    if (trigger.userId) people.add(trigger.userId);
    for (const c of (conditions ?? []) as Condition[]) {
      if (!['priority', 'assignee', 'tag'].includes(c?.field) || !['is', 'is_not'].includes(c?.op)) throw new BadRequestException('Invalid condition.');
      if (c.field === 'assignee') people.add(Number(c.value));
    }
    if (people.size && !(await this.access.areMembers(workspaceId, [...people]))) throw new BadRequestException('Automations can only involve Work members.');
  }

  async list(spaceId: number, userId: number, folderId?: number, listId?: number) {
    await this.access.requireSpace(spaceId, userId, 'view');
    // this location's rules plus the ones inherited from its folder / space
    const rows = await this.prisma.workAutomation.findMany({
      where: {
        spaceId,
        OR: [
          { folderId: null, listId: null },
          ...(folderId ? [{ folderId, listId: null }] : []),
          ...(listId ? [{ listId }] : []),
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, spaceId: true, folderId: true, listId: true, trigger: true, conditions: true, actions: true, enabled: true, runCount: true, lastRunAt: true, createdAt: true, createdBy: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });
    return rows.map((r) => ({ ...r, inherited: listId ? r.listId !== listId : folderId ? r.folderId !== folderId : false }));
  }

  async create(spaceId: number, userId: number, dto: { name?: string; folderId?: number; listId?: number; trigger: any; conditions?: any; actions: any }) {
    const a = await this.location(spaceId, userId, dto.folderId, dto.listId);
    await this.validate(a.workspaceId, spaceId, dto.trigger, dto.conditions, dto.actions);
    return this.prisma.workAutomation.create({
      data: {
        workspaceId: a.workspaceId, spaceId, folderId: dto.folderId ?? null, listId: dto.listId ?? null,
        name: (dto.name?.trim() || this.describe(dto.trigger, dto.actions)).slice(0, 200),
        trigger: dto.trigger, conditions: dto.conditions ?? [], actions: dto.actions, createdById: userId,
      },
    });
  }

  private async own(id: number, userId: number) {
    const r = await this.prisma.workAutomation.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Automation not found.');
    const a = await this.access.requireSpace(r.spaceId, userId, 'edit');
    if (r.createdById !== userId && !a.canManage) throw new ForbiddenException('Only its creator or an admin can change this automation.');
    return { r, a };
  }

  async update(id: number, userId: number, dto: { name?: string; enabled?: boolean; trigger?: any; conditions?: any; actions?: any }) {
    const { r, a } = await this.own(id, userId);
    if (dto.trigger || dto.actions || dto.conditions) await this.validate(a.workspaceId, r.spaceId, dto.trigger ?? r.trigger, dto.conditions ?? r.conditions, dto.actions ?? r.actions);
    return this.prisma.workAutomation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim().slice(0, 200) || r.name }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        ...(dto.trigger && { trigger: dto.trigger }),
        ...(dto.conditions && { conditions: dto.conditions }),
        ...(dto.actions && { actions: dto.actions }),
      },
    });
  }

  async remove(id: number, userId: number) {
    await this.own(id, userId);
    await this.prisma.workAutomation.delete({ where: { id } });
    return { deleted: true };
  }

  async runs(id: number, userId: number) {
    const r = await this.prisma.workAutomation.findUnique({ where: { id }, select: { spaceId: true } });
    if (!r) throw new NotFoundException('Automation not found.');
    await this.access.requireSpace(r.spaceId, userId, 'view');
    return this.prisma.workAutomationRun.findMany({ where: { automationId: id }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  /** "When status changes to Complete → archive task" */
  private describe(trigger: Trigger, actions: Action[]) {
    const t: Record<string, string> = {
      task_created: 'When a task is created', status_changed: `When status changes${trigger.to ? ` to ${trigger.to}` : ''}`, assignee_added: 'When an assignee is added',
      priority_changed: `When priority changes${trigger.to ? ` to ${trigger.to.toLowerCase()}` : ''}`, due_date_changed: 'When the due date changes', comment_added: 'When a comment is added', task_moved: 'When a task is moved here',
    };
    const a: Record<string, string> = {
      set_status: 'change status', set_priority: 'set priority', add_assignees: 'add assignees', remove_assignees: 'remove assignees', set_due_date: 'set due date',
      add_tag: 'add a tag', add_comment: 'add a comment', create_subtask: 'create a subtask', move_to_list: 'move to a list', archive: 'archive the task', notify: 'notify people',
    };
    return `${t[trigger.type] ?? 'When'} → ${actions.map((x) => a[x.type] ?? x.type).join(', ')}`;
  }

  /* ── engine ── */

  @OnEvent(WORK_TASK_EVENT, { async: true, promisify: true })
  async onTaskEvent(e: WorkTaskEvent) {
    try {
      await this.fire(e);
    } catch (err: any) {
      this.logger.warn(`automation failed: ${err?.message ?? err}`);
    }
  }

  async fire(e: WorkTaskEvent) {
    const task = await this.prisma.workTask.findFirst({
      where: { id: e.taskId, archivedAt: null },
      select: { id: true, name: true, priority: true, listId: true, list: { select: { id: true, folderId: true, spaceId: true } }, assignees: { select: { userId: true } }, tags: { select: { tagId: true } } },
    });
    if (!task) return;
    const rules = await this.prisma.workAutomation.findMany({
      where: {
        enabled: true,
        spaceId: task.list.spaceId,
        OR: [{ folderId: null, listId: null }, ...(task.list.folderId ? [{ folderId: task.list.folderId, listId: null }] : []), { listId: task.list.id }],
      },
      orderBy: { createdAt: 'asc' },
    });
    for (const rule of rules) {
      const trig = rule.trigger as unknown as Trigger;
      if (trig.type !== e.type || !this.matches(trig, e)) continue;
      if (!this.passes((rule.conditions ?? []) as unknown as Condition[], task)) continue;
      let ok = true;
      let message = '';
      try {
        message = await this.run(rule, rule.actions as unknown as Action[], task.id);
      } catch (err: any) {
        ok = false;
        message = err?.response?.message?.toString?.() ?? err?.message ?? 'failed';
      }
      await this.prisma.$transaction([
        this.prisma.workAutomationRun.create({ data: { automationId: rule.id, taskId: task.id, ok, message: message.slice(0, 500) } }),
        this.prisma.workAutomation.update({ where: { id: rule.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } }),
      ]);
      if (ok) await this.detail.log(task.id, rule.createdById, 'automation', null, rule.name).catch(() => null);
    }
  }

  private matches(t: Trigger, e: WorkTaskEvent) {
    const same = (a?: string | null, b?: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
    if (t.type === 'status_changed' || t.type === 'priority_changed') {
      if (t.from && !same(t.from, e.from)) return false;
      if (t.to && !same(t.to, e.to)) return false;
    }
    if (t.type === 'assignee_added' && t.userId && !(e.userIds ?? []).includes(t.userId)) return false;
    return true;
  }

  private passes(conds: Condition[], task: { priority: string | null; assignees: { userId: number }[]; tags: { tagId: number }[] }) {
    return conds.every((c) => {
      const hit =
        c.field === 'priority' ? (task.priority ?? 'NONE') === String(c.value)
        : c.field === 'assignee' ? task.assignees.some((a) => a.userId === Number(c.value))
        : task.tags.some((t) => t.tagId === Number(c.value));
      return c.op === 'is' ? hit : !hit;
    });
  }

  /** run the actions as the rule's creator; nothing here re-triggers automations */
  private async run(rule: { id: number; createdById: number; name: string }, actions: Action[], taskId: number) {
    const as = rule.createdById;
    const opts = { fromAutomation: true };
    const done: string[] = [];
    for (const a of actions) {
      const t = await this.prisma.workTask.findFirst({ where: { id: taskId, archivedAt: null }, select: { id: true, name: true, listId: true, list: { select: { id: true, folderId: true, spaceId: true } }, assignees: { select: { userId: true } }, tags: { select: { tagId: true } } } });
      if (!t) break;
      switch (a.type) {
        case 'set_status': {
          const sts = await this.work.effectiveStatuses(t.list);
          const st = sts.find((s) => s.name.trim().toLowerCase() === a.status!.trim().toLowerCase());
          if (!st) throw new BadRequestException(`No status "${a.status}" in this list.`);
          await this.work.updateTask(t.id, as, { statusId: st.id }, opts);
          break;
        }
        case 'set_priority':
          await this.work.updateTask(t.id, as, { priority: (a.priority ?? null) as any }, opts);
          break;
        case 'add_assignees':
          await this.work.updateTask(t.id, as, { assigneeIds: [...new Set([...t.assignees.map((x) => x.userId), ...a.userIds!])] }, opts);
          break;
        case 'remove_assignees':
          await this.work.updateTask(t.id, as, { assigneeIds: t.assignees.map((x) => x.userId).filter((u) => !a.userIds!.includes(u)) }, opts);
          break;
        case 'set_due_date': {
          const d = new Date();
          d.setDate(d.getDate() + (a.days ?? 0));
          d.setHours(17, 0, 0, 0);
          await this.work.updateTask(t.id, as, { dueDate: d.toISOString() }, opts);
          break;
        }
        case 'add_tag':
          await this.work.updateTask(t.id, as, { tagIds: [...new Set([...t.tags.map((x) => x.tagId), a.tagId!])] }, opts);
          break;
        case 'add_comment':
          await this.work.createComment(t.id, as, { content: a.text!.trim() } as any, opts);
          break;
        case 'create_subtask':
          await this.work.createTask(t.listId, as, { name: a.name!.trim(), parentId: t.id } as any, opts);
          break;
        case 'move_to_list':
          if (a.listId !== t.listId) await this.work.updateTask(t.id, as, { listId: a.listId }, opts);
          break;
        case 'archive':
          await this.work.archiveTask(t.id, as);
          break;
        case 'notify':
          for (const u of a.userIds ?? []) {
            await this.workNotify.send({
              recipientId: u, type: 'AUTOMATION', title: rule.name, message: a.message?.trim() || `Automation ran on "${t.name}"`, taskId: t.id,
              metadata: { event: 'automation', automationId: rule.id, taskName: t.name },
            });
          }
          break;
      }
      done.push(a.type);
    }
    return done.join(', ');
  }
}
