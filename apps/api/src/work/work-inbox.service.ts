import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { NotificationType } from 'generated/prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { WorkFilesService } from './work-files.service';
import { WorkRemindersService } from './work-reminders.service';

export type InboxView = 'active' | 'later' | 'cleared' | 'all';
export type InboxBulkAction = 'clear' | 'unclear' | 'snooze' | 'unsnooze' | 'read' | 'unread';

const DAY = 86_400_000;

/**
 * Work Inbox (ClickUp-style). Returns Work notifications only, enriched with
 * each task's CURRENT status/name/due date, and creates "Task is overdue"
 * notifications for the user's own late tasks on demand (no scheduler needed).
 * Primary vs Other is decided on the client from the user's importance settings.
 */
@Injectable()
export class WorkInboxService {
  private readonly logger = new Logger(WorkInboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly files: WorkFilesService,
    private readonly reminders: WorkRemindersService,
  ) {}

  async list(userId: number, view: InboxView) {
    await this.ensureOverdue(userId).catch((e) => this.logger.warn(`overdue scan failed: ${e?.message ?? e}`));
    await this.reminders.fireDue(userId).catch((e) => this.logger.warn(`reminders failed: ${e?.message ?? e}`));
    const now = new Date();
    const base = { recipientId: userId, product: 'work' };
    const active = { clearedAt: null, OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] };
    const where =
      view === 'cleared' ? { ...base, clearedAt: { not: null } }
      : view === 'later' ? { ...base, clearedAt: null, snoozedUntil: { gt: now } }
      : view === 'all' ? base
      : { ...base, ...active };
    const [items, laterCount, clearedCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 400 }),
      this.prisma.notification.count({ where: { ...base, clearedAt: null, snoozedUntil: { gt: now } } }),
      this.prisma.notification.count({ where: { ...base, clearedAt: { not: null } } }),
    ]);

    // current state of each task mentioned (status may have changed since the event)
    const uids = [...new Set(items.map((n) => (n.metadata as any)?.taskUid).filter(Boolean))] as string[];
    const tasks = uids.length
      ? await this.prisma.workTask.findMany({
          where: { uid: { in: uids } },
          select: { uid: true, name: true, dueDate: true, completedAt: true, archivedAt: true, status: { select: { name: true, color: true, category: true } } },
        })
      : [];
    const byUid = new Map(tasks.map((t) => [t.uid, t]));
    return {
      items: items.filter((n) => !(n.metadata as any)?.inboxHidden).map((n) => {
        const t = byUid.get((n.metadata as any)?.taskUid);
        return { ...n, task: t ? { name: t.name, status: t.status, dueDate: t.dueDate, completedAt: t.completedAt, archived: !!t.archivedAt } : null };
      }),
      counts: { later: laterCount, cleared: clearedCount },
    };
  }

  /** Apply one action to many notifications (a grouped row = several events on one task). */
  async bulk(userId: number, ids: string[], action: InboxBulkAction, until?: string) {
    if (!ids.length) return { count: 0 };
    const now = new Date();
    const data =
      action === 'clear' ? { clearedAt: now, snoozedUntil: null, isRead: true, readAt: now }
      : action === 'unclear' ? { clearedAt: null }
      : action === 'snooze' ? { snoozedUntil: until ? new Date(until) : new Date(now.getTime() + DAY), clearedAt: null }
      : action === 'unsnooze' ? { snoozedUntil: null }
      : action === 'read' ? { isRead: true, readAt: now }
      : action === 'unread' ? { isRead: false, readAt: null }
      : null;
    if (!data) throw new BadRequestException('Unknown action.');
    if (action === 'snooze' && until && new Date(until).getTime() <= now.getTime()) throw new BadRequestException('Pick a time in the future.');
    // only the caller's own Work notifications
    const r = await this.prisma.notification.updateMany({ where: { id: { in: ids }, recipientId: userId, product: 'work' }, data });
    return { count: r.count };
  }

  /**
   * "Task is overdue" for tasks assigned to the user: one notification per task
   * per due date (moving the due date later can produce a new one).
   */
  private async ensureOverdue(userId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const late = await this.prisma.workTask.findMany({
      where: {
        archivedAt: null,
        completedAt: null,
        dueDate: { lt: today },
        assignees: { some: { userId } },
        list: { archivedAt: null, space: { archivedAt: null, workspace: { workMembers: { some: { userId } } } } },
      },
      select: { id: true, uid: true, name: true, dueDate: true },
      take: 100,
    });
    if (!late.length) return;
    const keys = late.map((t) => `${t.uid}:${t.dueDate!.toISOString().slice(0, 10)}`);
    const seen = await this.prisma.notification.findMany({
      where: { recipientId: userId, product: 'work', type: NotificationType.TASK_DUE_SOON, OR: keys.map((k) => ({ metadata: { path: ['overdueKey'], equals: k } })) },
      select: { metadata: true },
    });
    const have = new Set(seen.map((s) => (s.metadata as any)?.overdueKey));
    for (let i = 0; i < late.length; i++) {
      if (have.has(keys[i])) continue;
      const t = late[i]!;
      await this.files.notifySystem(t.id, [userId], NotificationType.TASK_DUE_SOON, 'Task is overdue', `"${t.name}" was due ${t.dueDate!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`, {
        event: 'overdue',
        overdueKey: keys[i],
        dueDate: t.dueDate!.toISOString(),
      });
    }
  }
}
