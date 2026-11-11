import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationEntityType, NotificationType } from 'generated/prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { WorkAccessService } from './work-access.service';
import { WorkNotifyService } from './work-notify.service';

const USER_MINI = { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } as const;
const SELECT = {
  id: true, title: true, description: true, remindAt: true, firedAt: true, doneAt: true, createdAt: true,
  user: { select: USER_MINI }, assignee: { select: USER_MINI },
  task: { select: { uid: true, name: true, list: { select: { uid: true } } } },
} as const;

/**
 * Reminders (ClickUp "Reminder"): "remind me / someone at <time>". When the
 * time comes the reminder lands in that person's Work Inbox. Firing happens
 * on demand when the Inbox is read, so no scheduler is needed.
 */
@Injectable()
export class WorkRemindersService {
  private readonly logger = new Logger(WorkRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkAccessService,
    private readonly notifications: NotificationsService,
    private readonly workNotify: WorkNotifyService,
  ) {}

  async create(workspaceId: number, userId: number, dto: { title: string; description?: string; remindAt: string; assigneeId?: number; taskUid?: string; url?: string }) {
    await this.access.requireWorkspace(workspaceId, userId, 'view');
    const at = new Date(dto.remindAt);
    if (Number.isNaN(at.getTime())) throw new BadRequestException('Pick a valid time.');
    const assigneeId = dto.assigneeId ?? userId;
    if (assigneeId !== userId && !(await this.access.areMembers(workspaceId, [assigneeId]))) throw new BadRequestException('Reminders can only be set for Work members.');
    let taskId: number | null = null;
    if (dto.taskUid) {
      const t = await this.prisma.workTask.findFirst({ where: { uid: dto.taskUid, archivedAt: null }, select: { id: true } });
      if (!t) throw new BadRequestException('Task not found.');
      await this.access.requireTask(t.id, userId, 'view');
      taskId = t.id;
    }
    return this.prisma.workReminder.create({
      data: { workspaceId, userId, assigneeId, title: dto.title.trim(), description: dto.description?.trim() || null, remindAt: at, taskId, url: dto.url && dto.url.startsWith('/work/') ? dto.url : null },
      select: SELECT,
    });
  }

  /** Reminders for me (or that I set), open first. */
  async mine(workspaceId: number, userId: number, includeDone: boolean) {
    await this.access.requireWorkspace(workspaceId, userId, 'view');
    return this.prisma.workReminder.findMany({
      where: { workspaceId, OR: [{ assigneeId: userId }, { userId }], ...(includeDone ? {} : { doneAt: null }) },
      orderBy: [{ doneAt: { sort: 'asc', nulls: 'first' } }, { remindAt: 'asc' }],
      take: 200,
      select: SELECT,
    });
  }

  async update(id: number, userId: number, dto: { done?: boolean; remindAt?: string; title?: string }) {
    const r = await this.own(id, userId);
    const at = dto.remindAt ? new Date(dto.remindAt) : null;
    if (at && Number.isNaN(at.getTime())) throw new BadRequestException('Pick a valid time.');
    return this.prisma.workReminder.update({
      where: { id: r.id },
      data: {
        ...(dto.done !== undefined && { doneAt: dto.done ? new Date() : null }),
        ...(at && { remindAt: at, firedAt: null }), // rescheduling fires again
        ...(dto.title !== undefined && { title: dto.title.trim() }),
      },
      select: SELECT,
    });
  }

  async remove(id: number, userId: number) {
    const r = await this.own(id, userId);
    await this.prisma.workReminder.delete({ where: { id: r.id } });
    return { deleted: true };
  }

  /** Fire every due reminder for this person (called when their Inbox loads). */
  async fireDue(userId: number) {
    const due = await this.prisma.workReminder.findMany({
      where: { assigneeId: userId, firedAt: null, doneAt: null, remindAt: { lte: new Date() } },
      select: { id: true, title: true, description: true, url: true, workspaceId: true, userId: true, task: { select: { id: true, uid: true, name: true, list: { select: { uid: true, name: true } } } }, workspace: { select: { uid: true } }, user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
      take: 50,
    });
    for (const r of due) {
      // mark first so a parallel request can't fire it twice
      const claimed = await this.prisma.workReminder.updateMany({ where: { id: r.id, firedAt: null }, data: { firedAt: new Date() } });
      if (!claimed.count) continue;
      const by = r.userId === userId ? '' : `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim();
      await this.workNotify
        .send({
          recipientId: userId,
          type: NotificationType.TASK_DUE_SOON,
          title: r.title,
          message: r.description || (by ? `Reminder from ${by}` : 'Reminder'),
          taskId: r.task?.id ?? null,
          metadata: {
            product: 'work',
            event: 'reminder',
            reminderId: r.id,
            actorName: by,
            actorAvatar: r.userId === userId ? null : r.user.avatarUrl,
            ...(r.task ? { taskUid: r.task.uid, taskName: r.task.name, listUid: r.task.list.uid, listName: r.task.list.name, url: `/work/${r.workspace.uid}/list/${r.task.list.uid}?task=${r.task.uid}` } : { url: r.url ?? `/work/${r.workspace.uid}` }),
          },
          sendEmail: false,
        })
        .catch((e) => this.logger.warn(`reminder notify failed: ${e?.message ?? e}`));
    }
  }

  private async own(id: number, userId: number) {
    const r = await this.prisma.workReminder.findUnique({ where: { id }, select: { id: true, userId: true, assigneeId: true } });
    if (!r) throw new NotFoundException('Reminder not found.');
    if (r.userId !== userId && r.assigneeId !== userId) throw new ForbiddenException('Not your reminder.');
    return r;
  }
}
