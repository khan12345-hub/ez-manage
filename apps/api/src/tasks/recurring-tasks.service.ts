import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'prisma/prisma.service';
import { RecurrenceType } from 'generated/prisma/enums';

/** Column types whose values are per-instance and must not be copied. */
const NON_COPYABLE_TYPES = new Set([
  'FILE',
  'TIME_TRACKING',
  'CREATION_LOG',
  'FORMULA',
]);

/**
 * Calendar day of a moment in APP_TIMEZONE (e.g. "Asia/Karachi"), or in the
 * server's zone when unset. Returned as { y, m (1-12), d, dayNo } where dayNo
 * is a timezone-free day counter for easy differences.
 */
function calendarDay(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.APP_TIMEZONE || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const y = get('year');
  const m = get('month');
  const d = get('day');
  return { y, m, d, dayNo: Date.UTC(y, m - 1, d) / 86_400_000 };
}

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

@Injectable()
export class RecurringTasksService {
  private readonly logger = new Logger(RecurringTasksService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Runs at 00:05 every day. Creates new task instances for due recurring tasks. */
  @Cron('5 0 * * *', { timeZone: process.env.APP_TIMEZONE || undefined })
  async spawnRecurringTasks() {
    const now = new Date();
    const today = calendarDay(now);
    // Start of "today" as a Date, for the recurrenceEndDate filter.
    const todayStart = new Date(Date.UTC(today.y, today.m - 1, today.d));

    const templates = await this.prisma.task.findMany({
      where: {
        recurrenceType: { not: RecurrenceType.NONE },
        sourceTaskId: null,
        OR: [
          { recurrenceEndDate: null },
          { recurrenceEndDate: { gte: todayStart } },
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
        if (latest && calendarDay(new Date(latest.createdAt)).dayNo === today.dayNo) {
          continue;
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
          select: { id: true, type: true },
          orderBy: { order: 'asc' },
        });

        // Copy the template's values (status, person, text, …) into the new
        // instance; per-instance columns start empty.
        const templateValues = new Map(
          task.cells.map((c) => [c.columnId, c.value]),
        );

        await this.prisma.task.create({
          data: {
            groupId: task.groupId,
            createdById: task.createdById,
            name: task.name,
            order: lastSibling ? lastSibling.order + 1000 : 1000,
            sourceTaskId: task.id,
            cells: {
              create: columns.map((c) => {
                const value = templateValues.get(c.id);
                const copy =
                  !NON_COPYABLE_TYPES.has(c.type as string) &&
                  value !== null &&
                  value !== undefined;
                return {
                  column: { connect: { id: c.id } },
                  ...(copy ? { value: value as any } : {}),
                };
              }),
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
    today: ReturnType<typeof calendarDay>,
  ): boolean {
    const start = calendarDay(new Date(task.createdAt));
    const daysDiff = today.dayNo - start.dayNo;
    if (daysDiff <= 0) return false;

    const interval = task.recurrenceInterval || 1;

    // Anchor day clamped to the month's length, so a task started on the
    // 31st still recurs on the 30th / 28th of shorter months.
    const anchorDay = Math.min(start.d, daysInMonth(today.y, today.m));

    switch (task.recurrenceType) {
      case RecurrenceType.DAILY:
        return daysDiff % interval === 0;

      case RecurrenceType.WEEKLY:
        return daysDiff % (7 * interval) === 0;

      case RecurrenceType.MONTHLY: {
        const monthsDiff = (today.y - start.y) * 12 + (today.m - start.m);
        return monthsDiff > 0 && monthsDiff % interval === 0 && today.d === anchorDay;
      }

      case RecurrenceType.YEARLY: {
        const yearsDiff = today.y - start.y;
        return (
          yearsDiff > 0 &&
          yearsDiff % interval === 0 &&
          today.m === start.m &&
          today.d === anchorDay
        );
      }

      default:
        return false;
    }
  }
}
