import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BoardColumnType, NotificationType, NotificationEntityType, RecurrenceType } from 'generated/prisma/enums';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Runs every day at 8:00 AM server time
  @Cron('0 8 * * *')
  async sendDueDateReminders() {
    this.logger.log('[DueReminders] Starting due date reminder job...');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]; // "YYYY-MM-DD"

    // Find all DATE cells whose value.date matches tomorrow
    const dateCells = await this.prisma.taskCell.findMany({
      where: {
        column: { type: BoardColumnType.DATE },
      },
      include: {
        task: {
          include: {
            cells: {
              where: { column: { type: BoardColumnType.PERSON } },
              include: { column: true },
            },
            group: {
              include: {
                board: {
                  include: { workspace: true },
                },
              },
            },
          },
        },
        column: true,
      },
    });

    // Filter for cells due tomorrow
    const dueTomorrow = dateCells.filter((cell) => {
      if (!cell.value || typeof cell.value !== 'object') return false;
      const val = cell.value as Record<string, unknown>;
      const dateStr = typeof val.date === 'string' ? val.date.substring(0, 10) : null;
      return dateStr === tomorrowStr;
    });

    this.logger.log(`[DueReminders] Found ${dueTomorrow.length} tasks due tomorrow (${tomorrowStr})`);

    let sent = 0;

    for (const dateCell of dueTomorrow) {
      const task = dateCell.task;
      if (!task) continue;

      const board = task.group?.board;
      const workspace = board?.workspace;

      // Get assigned user IDs from PERSON cells
      const assigneeIds: number[] = [];
      for (const cell of task.cells) {
        if (!cell.value || typeof cell.value !== 'object') continue;
        const val = cell.value as Record<string, unknown>;
        if (!Array.isArray(val.users)) continue;
        for (const u of val.users) {
          if (u && typeof u === 'object' && 'id' in u) {
            const id = Number((u as Record<string, unknown>).id);
            if (!isNaN(id)) assigneeIds.push(id);
          }
        }
      }

      if (assigneeIds.length === 0) continue;

      for (const userId of assigneeIds) {
        const eventKey = `due-reminder-${task.id}-${tomorrowStr}-${userId}`;
        try {
          await this.notificationsService.notify({
            recipientId: userId,
            type: NotificationType.TASK_DUE_SOON,
            title: `Due tomorrow: ${task.name}`,
            message: `Task "${task.name}" is due tomorrow. Make sure it's completed on time.`,
            entityType: NotificationEntityType.TASK,
            entityId: task.id,
            metadata: {
              taskId: task.id,
              taskName: task.name,
              boardId: board?.id,
              boardName: board?.name,
              workspaceId: workspace?.id,
              workspaceName: workspace?.name,
              dueDate: tomorrowStr,
            },
            eventKey,
            sendEmail: true,
          });
          sent++;
        } catch (err) {
          this.logger.error(`[DueReminders] Failed to notify user ${userId} for task ${task.id}:`, err);
        }
      }
    }

    this.logger.log(`[DueReminders] Done. Sent ${sent} reminder notifications.`);
  }

  // Runs at 1:00 AM daily — creates next occurrence for recurring tasks due today
  @Cron('0 1 * * *')
  async createRecurringTaskOccurrences() {
    this.logger.log('[RecurringTasks] Starting recurring task job...');

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Find DATE cells that are due today AND belong to recurring tasks
    const dateCells = await this.prisma.taskCell.findMany({
      where: {
        column: { type: BoardColumnType.DATE },
        task: { recurrenceType: { not: RecurrenceType.NONE } },
      },
      include: {
        task: {
          include: {
            cells: { include: { column: true } },
            group: { include: { board: true } },
          },
        },
        column: true,
      },
    });

    const dueTodayRecurring = dateCells.filter((cell) => {
      if (!cell.value || typeof cell.value !== 'object') return false;
      const val = cell.value as Record<string, unknown>;
      return typeof val.date === 'string' && val.date.substring(0, 10) === todayStr;
    });

    this.logger.log(`[RecurringTasks] Found ${dueTodayRecurring.length} recurring tasks due today`);

    const startOfToday = new Date(today.setHours(0, 0, 0, 0));

    for (const dateCell of dueTodayRecurring) {
      const task = dateCell.task;
      if (!task) continue;

      // Skip if recurrence end date has passed
      if (task.recurrenceEndDate && new Date(task.recurrenceEndDate) < new Date()) continue;

      // Skip if a copy was already created today (prevent duplicates)
      const alreadyCreated = await this.prisma.task.findFirst({
        where: { sourceTaskId: task.id, createdAt: { gte: startOfToday } },
      });
      if (alreadyCreated) continue;

      // Calculate next due date
      const nextDue = new Date(todayStr);
      switch (task.recurrenceType) {
        case RecurrenceType.DAILY:
          nextDue.setDate(nextDue.getDate() + task.recurrenceInterval); break;
        case RecurrenceType.WEEKLY:
          nextDue.setDate(nextDue.getDate() + 7 * task.recurrenceInterval); break;
        case RecurrenceType.MONTHLY:
          nextDue.setMonth(nextDue.getMonth() + task.recurrenceInterval); break;
        case RecurrenceType.YEARLY:
          nextDue.setFullYear(nextDue.getFullYear() + task.recurrenceInterval); break;
      }
      const nextDueStr = nextDue.toISOString().split('T')[0];

      const board = task.group?.board;
      if (!board) continue;

      // Get all board columns for cell creation
      const columns = await this.prisma.boardColumn.findMany({
        where: { boardId: board.id, isPrimary: false },
        select: { id: true },
      });

      const lastTask = await this.prisma.task.findFirst({
        where: { groupId: task.groupId, parentId: null },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      // Create recurring copy
      const newTask = await this.prisma.task.create({
        data: {
          groupId: task.groupId,
          createdById: task.createdById,
          name: task.name,
          order: lastTask ? lastTask.order + 1000 : 1000,
          recurrenceType: task.recurrenceType,
          recurrenceInterval: task.recurrenceInterval,
          recurrenceEndDate: task.recurrenceEndDate,
          sourceTaskId: task.id,
          cells: {
            create: columns.map((col) => ({ column: { connect: { id: col.id } } })),
          },
        },
      });

      // Copy cell values from original — DATE cell gets next due date
      for (const cell of task.cells) {
        if (!cell.value) continue;
        const newValue = cell.column.type === BoardColumnType.DATE
          ? { date: nextDueStr }
          : cell.value;
        await this.prisma.taskCell.update({
          where: { taskId_columnId: { taskId: newTask.id, columnId: cell.columnId } },
          data: { value: newValue },
        });
      }

      this.logger.log(`[RecurringTasks] Created copy of task "${task.name}" (${task.id}) → task ${newTask.id} due ${nextDueStr}`);
    }

    this.logger.log('[RecurringTasks] Done.');
  }
}
