import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'generated/prisma';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class TimeTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async getEntries(boardId: number, taskId: number) {
    return this.prisma.timeEntry.findMany({
      where: { taskId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async startTimer(boardId: number, taskId: number, userId: number, note?: string) {
    // Only one active timer per user+task
    const existing = await this.prisma.timeEntry.findFirst({
      where: { taskId, userId, endedAt: null },
    });
    if (existing) {
      throw new BadRequestException('A timer is already running for this task');
    }

    return this.prisma.timeEntry.create({
      data: {
        taskId,
        userId,
        boardId,
        startedAt: new Date(),
        note: note ?? null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  async stopTimer(boardId: number, taskId: number, userId: number) {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { taskId, userId, endedAt: null },
    });
    if (!entry) throw new NotFoundException('No active timer found');

    const endedAt = new Date();
    const durationMs = endedAt.getTime() - entry.startedAt.getTime();

    return this.prisma.timeEntry.update({
      where: { id: entry.id },
      data: { endedAt, durationMs },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  async logManual(
    boardId: number,
    taskId: number,
    userId: number,
    durationMs: number,
    note?: string,
    startedAt?: Date,
  ) {
    if (durationMs <= 0) throw new BadRequestException('Duration must be positive');
    const start = startedAt ?? new Date();
    const end = new Date(start.getTime() + durationMs);

    return this.prisma.timeEntry.create({
      data: {
        taskId,
        userId,
        boardId,
        startedAt: start,
        endedAt: end,
        durationMs,
        note: note ?? null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  async deleteEntry(boardId: number, taskId: number, entryId: number, userId: number) {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id: entryId, taskId, boardId },
    });
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.userId !== userId)
      throw new BadRequestException('You can only delete your own time entries');

    await this.prisma.timeEntry.delete({ where: { id: entryId } });
    return { success: true };
  }

  async getActiveTimer(taskId: number, userId: number) {
    return this.prisma.timeEntry.findFirst({
      where: { taskId, userId, endedAt: null },
    });
  }

  async getMyActiveTimer(userId: number) {
    return this.prisma.timeEntry.findFirst({
      where: { userId, endedAt: null },
      include: {
        task: { select: { id: true, name: true, groupId: true } },
        board: { select: { id: true, name: true } },
      },
    });
  }

  async exportTimeReport(
    boardId: number,
    filters: { startDate?: string; endDate?: string; userId?: number },
  ): Promise<{ csv: string; filename: string }> {
    const where: Prisma.TimeEntryWhereInput = {
      boardId,
      endedAt: { not: null },
    };

    if (filters.startDate || filters.endDate) {
      const range: Prisma.DateTimeFilter = {};
      if (filters.startDate) range.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        range.lte = end;
      }
      where.startedAt = range;
    }

    if (filters.userId) where.userId = filters.userId;

    const entries = await this.prisma.timeEntry.findMany({
      where,
      include: {
        task: { select: { id: true, name: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const rows: string[] = ['Task,User,Date,Hours,Note'];

    for (const e of entries) {
      const hours = e.durationMs ? (e.durationMs / 3_600_000).toFixed(2) : '0.00';
      const date = e.startedAt.toISOString().split('T')[0];
      const user = `${e.user.firstName} ${e.user.lastName}`;
      rows.push(
        [esc(e.task?.name ?? ''), esc(user), esc(date), esc(hours), esc(e.note ?? '')].join(','),
      );
    }

    const today = new Date().toISOString().split('T')[0];
    return { csv: rows.join('\n'), filename: `time-report-${today}.csv` };
  }
}
