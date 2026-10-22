import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationType } from 'generated/prisma/enums';
import { BoardAccessService } from 'src/boards/board-access.service';
import { BoardPermission } from '@repo/shared';

@Injectable()
export class TimeTrackingService {
  private readonly logger = new Logger(TimeTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly boardAccess: BoardAccessService,
  ) {}

  // Throws NotFoundException for both "task not found" and "boardId mismatch"
  // so callers cannot probe task existence or cross-board task membership.
  private async resolveTaskBoardId(taskId: number, suppliedBoardId: number): Promise<number> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { group: { select: { boardId: true } } },
    });
    if (!task) throw new NotFoundException('Task not found.');
    const boardId = task.group.boardId;
    if (boardId !== suppliedBoardId) throw new NotFoundException('Task not found.');
    return boardId;
  }

  async getEntries(boardId: number, taskId: number, userId: number) {
    const resolvedBoardId = await this.resolveTaskBoardId(taskId, boardId);
    await this.boardAccess.requirePermission(resolvedBoardId, userId, BoardPermission.VIEW);
    return this.prisma.timeEntry.findMany({
      where: { taskId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async startTimer(boardId: number, taskId: number, userId: number, note?: string) {
    const resolvedBoardId = await this.resolveTaskBoardId(taskId, boardId);
    await this.boardAccess.requirePermission(resolvedBoardId, userId, BoardPermission.EDIT);

    const existing = await this.prisma.timeEntry.findFirst({
      where: { taskId, userId, endedAt: null },
    });
    if (existing) throw new BadRequestException('A timer is already running for this task');

    return this.prisma.timeEntry.create({
      data: {
        taskId,
        userId,
        boardId: resolvedBoardId,
        startedAt: new Date(),
        note: note ?? null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  async stopTimer(boardId: number, taskId: number, userId: number) {
    const resolvedBoardId = await this.resolveTaskBoardId(taskId, boardId);
    await this.boardAccess.requirePermission(resolvedBoardId, userId, BoardPermission.EDIT);

    const entry = await this.prisma.timeEntry.findFirst({
      where: { taskId, userId, endedAt: null },
    });
    if (!entry) throw new NotFoundException('No active timer found');

    const endedAt = new Date();
    const durationMs = endedAt.getTime() - entry.startedAt.getTime();

    const updated = await this.prisma.timeEntry.update({
      where: { id: entry.id },
      data: { endedAt, durationMs },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    this.checkBudgetAlert(resolvedBoardId, durationMs).catch((e: Error) =>
      this.logger.warn(`Budget alert check failed: ${e.message}`),
    );

    return updated;
  }

  async logManual(
    boardId: number,
    taskId: number,
    userId: number,
    durationMs: number,
    note?: string,
    startedAt?: Date,
  ) {
    const resolvedBoardId = await this.resolveTaskBoardId(taskId, boardId);
    await this.boardAccess.requirePermission(resolvedBoardId, userId, BoardPermission.EDIT);

    if (durationMs <= 0) throw new BadRequestException('Duration must be positive');
    const start = startedAt ?? new Date();
    const end = new Date(start.getTime() + durationMs);

    const entry = await this.prisma.timeEntry.create({
      data: {
        taskId,
        userId,
        boardId: resolvedBoardId,
        startedAt: start,
        endedAt: end,
        durationMs,
        note: note ?? null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    this.checkBudgetAlert(resolvedBoardId, durationMs).catch((e: Error) =>
      this.logger.warn(`Budget alert check failed: ${e.message}`),
    );

    return entry;
  }

  async deleteEntry(boardId: number, taskId: number, entryId: number, userId: number) {
    const resolvedBoardId = await this.resolveTaskBoardId(taskId, boardId);
    await this.boardAccess.requirePermission(resolvedBoardId, userId, BoardPermission.EDIT);

    // Entry lookup AFTER board check — prevents existence probing.
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id: entryId, taskId, boardId: resolvedBoardId },
    });
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.userId !== userId)
      throw new ForbiddenException('You can only delete your own time entries');

    await this.prisma.timeEntry.delete({ where: { id: entryId } });
    return { success: true };
  }

  async getActiveTimer(taskId: number, userId: number, boardId: number) {
    const resolvedBoardId = await this.resolveTaskBoardId(taskId, boardId);
    await this.boardAccess.requirePermission(resolvedBoardId, userId, BoardPermission.VIEW);
    return this.prisma.timeEntry.findFirst({
      where: { taskId, userId, endedAt: null },
    });
  }

  async getPersonalTimesheet(userId: number, workspaceId: number, weekStartStr: string) {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
      select: { id: true },
    });
    if (!membership) throw new ForbiddenException();

    const weekStart = new Date(weekStartStr);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const weekDates: string[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
      return d.toISOString().split('T')[0];
    });

    const boards = await this.prisma.board.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
    });
    const boardIds = boards.map((b) => b.id);

    if (!boardIds.length) {
      return { weekDates, rows: [], dayTotals: {}, weekTotalMs: 0, entries: [] };
    }

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: {
        userId,
        boardId: { in: boardIds },
        endedAt: { not: null },
        startedAt: { gte: weekStart, lt: weekEnd },
      },
      include: {
        task: {
          select: {
            id: true,
            name: true,
            group: {
              select: {
                id: true,
                name: true,
                board: { select: { id: true, name: true } },
              },
            },
            cells: {
              select: {
                value: true,
                column: { select: { type: true, statusOptions: true } },
              },
            },
          },
        },
      },
      orderBy: { startedAt: 'asc' },
    });

    const taskRows = new Map<number, { task: any; days: Record<string, number>; totalMs: number }>();
    const dayEntriesMap = new Map<string, any[]>();

    for (const entry of timeEntries) {
      if (!entry.durationMs) continue;
      const dateKey = entry.startedAt.toISOString().split('T')[0];
      const task = entry.task;

      if (!taskRows.has(task.id)) {
        let statusLabel: string | null = null;
        let statusColor: string | null = null;
        for (const c of task.cells) {
          if (c.column.type === 'STATUS' && c.value) {
            const cv = c.value as any;
            const opts = (c.column.statusOptions as any[]) ?? [];
            const optId = cv?.id ?? cv?.statusOptionId;
            if (optId) {
              const opt = opts.find((o: any) => o.id === optId);
              if (opt) { statusLabel = opt.label; statusColor = opt.color; }
            } else if (cv?.label) { statusLabel = cv.label; statusColor = cv.color ?? null; }
          }
        }
        taskRows.set(task.id, {
          task: {
            id: task.id, name: task.name,
            boardId: task.group.board.id, boardName: task.group.board.name,
            groupId: task.group.id, groupName: task.group.name, statusLabel, statusColor,
          },
          days: {},
          totalMs: 0,
        });
      }

      const row = taskRows.get(task.id)!;
      row.days[dateKey] = (row.days[dateKey] ?? 0) + entry.durationMs;
      row.totalMs += entry.durationMs;

      if (!dayEntriesMap.has(dateKey)) dayEntriesMap.set(dateKey, []);
      dayEntriesMap.get(dateKey)!.push({
        id: entry.id,
        taskId: task.id,
        taskName: task.name,
        boardId: task.group.board.id,
        boardName: task.group.board.name,
        groupId: task.group.id,
        groupName: task.group.name,
        startedAt: entry.startedAt.toISOString(),
        endedAt: entry.endedAt!.toISOString(),
        durationMs: entry.durationMs,
        note: entry.note,
      });
    }

    const dayTotals: Record<string, number> = {};
    for (const [date, items] of dayEntriesMap.entries()) {
      dayTotals[date] = items.reduce((s: number, e: any) => s + e.durationMs, 0);
    }
    const weekTotalMs = Object.values(dayTotals).reduce((s, v) => s + v, 0);

    const entries = weekDates
      .filter((d) => dayEntriesMap.has(d))
      .map((date) => ({
        date,
        dayTotalMs: dayTotals[date] ?? 0,
        items: dayEntriesMap.get(date) ?? [],
      }));

    return {
      weekDates,
      rows: [...taskRows.values()],
      dayTotals,
      weekTotalMs,
      entries,
    };
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

  async getBoardTimeSummary(boardId: number, userId: number) {
    await this.boardAccess.requirePermission(boardId, userId, BoardPermission.VIEW);

    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { budgetHours: true },
    });

    const agg = await this.prisma.timeEntry.aggregate({
      where: { boardId, endedAt: { not: null } },
      _sum: { durationMs: true },
    });

    const totalMs = agg._sum.durationMs ?? 0;
    const totalHours = totalMs / 3_600_000;
    const budgetHours = board?.budgetHours ?? null;
    const percentage = budgetHours ? Math.round((totalHours / budgetHours) * 100) : null;

    return { totalMs, totalHours, budgetHours, percentage };
  }

  private async checkBudgetAlert(boardId: number, addedMs: number) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: {
        name: true,
        budgetHours: true,
        createdById: true,
        members: {
          where: { role: { in: ['OWNER', 'ADMIN'] } },
          select: { userId: true },
        },
      },
    });

    if (!board?.budgetHours) return;

    const agg = await this.prisma.timeEntry.aggregate({
      where: { boardId, endedAt: { not: null } },
      _sum: { durationMs: true },
    });

    const totalMs = agg._sum.durationMs ?? 0;
    const prevMs = totalMs - addedMs;
    const budgetMs = board.budgetHours * 3_600_000;

    const thresholds = [
      { pct: 100, label: '100%' },
      { pct: 80,  label: '80%'  },
    ];

    let crossed: { pct: number; label: string } | null = null;
    for (const t of thresholds) {
      const limit = budgetMs * (t.pct / 100);
      if (totalMs >= limit && prevMs < limit) { crossed = t; break; }
    }
    if (!crossed) return;

    const usedH = (totalMs / 3_600_000).toFixed(1);
    const budgetH = board.budgetHours.toFixed(1);

    const recipientIds = new Set<number>([board.createdById]);
    board.members.forEach((m) => recipientIds.add(m.userId));

    await Promise.allSettled(
      [...recipientIds].map((id) =>
        this.notifications.notify({
          recipientId: id,
          type: NotificationType.CEO_TASK_REMINDER,
          title: `Budget Alert: ${board.name}`,
          message: `Board "${board.name}" has used ${usedH}h of ${budgetH}h budget (${crossed!.label} reached).`,
          sendEmail: true,
        }),
      ),
    );
  }

  async exportTimeReport(
    boardId: number,
    userId: number,
    filters: { startDate?: string; endDate?: string; userId?: number },
  ): Promise<{ csv: string; filename: string }> {
    await this.boardAccess.requirePermission(boardId, userId, BoardPermission.EXPORT_BOARD);

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
