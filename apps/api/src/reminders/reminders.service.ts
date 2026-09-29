import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BoardColumnType, NotificationType, NotificationEntityType } from 'generated/prisma/enums';

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
}
