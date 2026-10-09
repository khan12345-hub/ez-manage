import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'prisma/prisma.service';
import { RecurrenceType } from 'generated/prisma/enums';

@Injectable()
export class RecurringTasksService {
  private readonly logger = new Logger(RecurringTasksService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Runs at 00:05 every day. Creates new task instances for due recurring tasks. */
  @Cron('5 0 * * *')
  async spawnRecurringTasks() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const templates = await this.prisma.task.findMany({
      where: {
        recurrenceType: { not: RecurrenceType.NONE },
        sourceTaskId: null,
        OR: [
          { recurrenceEndDate: null },
          { recurrenceEndDate: { gte: today } },
        ],
      },
      include: {
        cells: { include: { column: { select: { id: true, type: true } } } },
        recurringCopies: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    let spawned = 0;

    for (const task of templates) {
      try {
        if (!this.isDueToday(task, today)) continue;

        // Skip if we already spawned one today
        const latest = task.recurringCopies[0];
        if (latest) {
          const latestDate = new Date(latest.createdAt);
          latestDate.setHours(0, 0, 0, 0);
          if (latestDate.getTime() === today.getTime()) continue;
        }

        const lastSibling = await this.prisma.task.findFirst({
          where: { groupId: task.groupId, parentId: null },
          orderBy: { order: 'desc' },
          select: { order: true },
        });

        const columns = await this.prisma.boardColumn.findMany({
          where: {
            board: { groups: { some: { id: task.groupId } } },
            isPrimary: false,
          },
          select: { id: true },
          orderBy: { order: 'asc' },
        });

        await this.prisma.task.create({
          data: {
            groupId: task.groupId,
            createdById: task.createdById,
            name: task.name,
            order: lastSibling ? lastSibling.order + 1000 : 1000,
            sourceTaskId: task.id,
            cells: {
              create: columns.map((c) => ({ column: { connect: { id: c.id } } })),
            },
          },
        });

        spawned++;
      } catch (err) {
        this.logger.error(`Failed to spawn recurring task ${task.id}`, err);
      }
    }

    if (spawned > 0) {
      this.logger.log(`Spawned ${spawned} recurring task(s)`);
    }
  }

  private isDueToday(
    task: { recurrenceType: RecurrenceType; recurrenceInterval: number; createdAt: Date },
    today: Date,
  ): boolean {
    const start = new Date(task.createdAt);
    start.setHours(0, 0, 0, 0);
    const daysDiff = Math.round((today.getTime() - start.getTime()) / 86400000);
    if (daysDiff <= 0) return false;

    const interval = task.recurrenceInterval || 1;

    switch (task.recurrenceType) {
      case RecurrenceType.DAILY:
        return daysDiff % interval === 0;
      case RecurrenceType.WEEKLY:
        return daysDiff % (7 * interval) === 0;
      case RecurrenceType.MONTHLY: {
        const startDay = start.getDate();
        return today.getDate() === startDay && (
          (today.getFullYear() - start.getFullYear()) * 12 +
          (today.getMonth() - start.getMonth())
        ) % interval === 0;
      }
      default:
        return false;
    }
  }
}
