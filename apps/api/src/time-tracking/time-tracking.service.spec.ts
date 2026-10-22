import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TimeTrackingService } from './time-tracking.service';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { BoardAccessService } from 'src/boards/board-access.service';
import { BoardPermission } from '@repo/shared';

const makePrisma = () => ({
  task: { findUnique: jest.fn() },
  timeEntry: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
  },
  board: { findUnique: jest.fn(), findMany: jest.fn() },
  workspaceMember: { findFirst: jest.fn() },
});

const makeBoardAccess = () => ({
  requirePermission: jest.fn().mockResolvedValue(true),
});

const makeNotifications = () => ({
  notify: jest.fn().mockResolvedValue(undefined),
});

// Task whose group.boardId matches the claimed boardId (1)
const TASK_IN_BOARD = { group: { boardId: 1 } };
// Task whose group.boardId does NOT match the claimed boardId
const TASK_WRONG_BOARD = { group: { boardId: 99 } };

const ENTRY = { id: 5, taskId: 10, boardId: 1, userId: 7, startedAt: new Date('2026-01-01'), endedAt: null, durationMs: null };
const COMPLETED_ENTRY = { ...ENTRY, endedAt: new Date('2026-01-01T01:00:00Z'), durationMs: 3_600_000 };

describe('TimeTrackingService', () => {
  let service: TimeTrackingService;
  let prisma: ReturnType<typeof makePrisma>;
  let boardAccess: ReturnType<typeof makeBoardAccess>;

  beforeEach(async () => {
    prisma = makePrisma();
    boardAccess = makeBoardAccess();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeTrackingService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: makeNotifications() },
        { provide: BoardAccessService, useValue: boardAccess },
      ],
    }).compile();

    service = module.get(TimeTrackingService);
  });

  // ─── resolveTaskBoardId (via getEntries as the public proxy) ────────────────

  describe('task board resolution', () => {
    it('throws NotFoundException when task does not exist', async () => {
      prisma.task.findUnique.mockResolvedValue(null);
      await expect(service.getEntries(1, 10, 7)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when task boardId does not match supplied boardId (fail-closed)', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_WRONG_BOARD);
      await expect(service.getEntries(1, 10, 7)).rejects.toThrow(NotFoundException);
    });

    it('does not throw ForbiddenException for mismatch — returns 404 to prevent cross-board probing', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_WRONG_BOARD);
      const err = await service.getEntries(1, 10, 7).catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundException);
    });
  });

  // ─── getEntries ─────────────────────────────────────────────────────────────

  describe('getEntries', () => {
    it('throws ForbiddenException when user lacks VIEW permission', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.getEntries(1, 10, 7)).rejects.toThrow(ForbiddenException);
    });

    it('enforces BoardPermission.VIEW', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      prisma.timeEntry.findMany.mockResolvedValue([]);
      await service.getEntries(1, 10, 7);
      expect(boardAccess.requirePermission).toHaveBeenCalledWith(1, 7, BoardPermission.VIEW);
    });

    it('resolves boardId from DB — not from caller', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      prisma.timeEntry.findMany.mockResolvedValue([]);
      await service.getEntries(1, 10, 7);
      const [boardId] = boardAccess.requirePermission.mock.calls[0];
      expect(boardId).toBe(1);
    });

    it('returns entries when permission granted', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      const entries = [{ id: 1 }];
      prisma.timeEntry.findMany.mockResolvedValue(entries);
      const result = await service.getEntries(1, 10, 7);
      expect(result).toBe(entries);
    });
  });

  // ─── startTimer ─────────────────────────────────────────────────────────────

  describe('startTimer', () => {
    it('throws NotFoundException for cross-board taskId/boardId mismatch', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_WRONG_BOARD);
      await expect(service.startTimer(1, 10, 7)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user lacks EDIT permission', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.startTimer(1, 10, 7)).rejects.toThrow(ForbiddenException);
    });

    it('enforces BoardPermission.EDIT', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      prisma.timeEntry.findFirst.mockResolvedValue(null);
      prisma.timeEntry.create.mockResolvedValue({ id: 1 });
      await service.startTimer(1, 10, 7);
      expect(boardAccess.requirePermission).toHaveBeenCalledWith(1, 7, BoardPermission.EDIT);
    });

    it('throws BadRequestException when a timer is already running for the task', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      prisma.timeEntry.findFirst.mockResolvedValue(ENTRY);
      await expect(service.startTimer(1, 10, 7)).rejects.toThrow(BadRequestException);
    });

    it('does not create timer when board access is denied', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.startTimer(1, 10, 7)).rejects.toThrow();
      expect(prisma.timeEntry.create).not.toHaveBeenCalled();
    });

    it('creates timer with resolvedBoardId (not raw client boardId) on success', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      prisma.timeEntry.findFirst.mockResolvedValue(null);
      prisma.timeEntry.create.mockResolvedValue({ id: 1 });
      await service.startTimer(1, 10, 7, 'working');
      expect(prisma.timeEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ boardId: 1, taskId: 10, userId: 7 }) }),
      );
    });
  });

  // ─── stopTimer ──────────────────────────────────────────────────────────────

  describe('stopTimer', () => {
    it('throws ForbiddenException when user lacks EDIT permission', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.stopTimer(1, 10, 7)).rejects.toThrow(ForbiddenException);
    });

    it('enforces BoardPermission.EDIT', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      prisma.timeEntry.findFirst.mockResolvedValue(ENTRY);
      prisma.timeEntry.update.mockResolvedValue({ ...ENTRY, endedAt: new Date(), durationMs: 1000 });
      await service.stopTimer(1, 10, 7);
      expect(boardAccess.requirePermission).toHaveBeenCalledWith(1, 7, BoardPermission.EDIT);
    });

    it('throws NotFoundException when no active timer exists for the user', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      prisma.timeEntry.findFirst.mockResolvedValue(null);
      await expect(service.stopTimer(1, 10, 7)).rejects.toThrow(NotFoundException);
    });

    it('stops only the authenticated user\'s own timer (ownership via DB query)', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      prisma.timeEntry.findFirst.mockResolvedValue(ENTRY);
      prisma.timeEntry.update.mockResolvedValue({ ...ENTRY, endedAt: new Date(), durationMs: 1000 });
      await service.stopTimer(1, 10, 7);
      expect(prisma.timeEntry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 7 }) }),
      );
    });

    it('returns updated entry on success', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      prisma.timeEntry.findFirst.mockResolvedValue(ENTRY);
      const updated = { ...ENTRY, endedAt: new Date(), durationMs: 5000 };
      prisma.timeEntry.update.mockResolvedValue(updated);
      const result = await service.stopTimer(1, 10, 7);
      expect(result).toBe(updated);
    });
  });

  // ─── logManual ──────────────────────────────────────────────────────────────

  describe('logManual', () => {
    it('throws ForbiddenException when user lacks EDIT permission', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.logManual(1, 10, 7, 3_600_000)).rejects.toThrow(ForbiddenException);
    });

    it('enforces BoardPermission.EDIT', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      prisma.timeEntry.create.mockResolvedValue({ id: 1 });
      await service.logManual(1, 10, 7, 3_600_000);
      expect(boardAccess.requirePermission).toHaveBeenCalledWith(1, 7, BoardPermission.EDIT);
    });

    it('throws BadRequestException when durationMs is zero or negative', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      await expect(service.logManual(1, 10, 7, 0)).rejects.toThrow(BadRequestException);
      await expect(service.logManual(1, 10, 7, -100)).rejects.toThrow(BadRequestException);
    });

    it('does not create entry when board access is denied', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.logManual(1, 10, 7, 3_600_000)).rejects.toThrow();
      expect(prisma.timeEntry.create).not.toHaveBeenCalled();
    });

    it('creates entry with resolvedBoardId on success', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      prisma.timeEntry.create.mockResolvedValue({ id: 2 });
      await service.logManual(1, 10, 7, 3_600_000, 'note');
      expect(prisma.timeEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ boardId: 1, taskId: 10, userId: 7, durationMs: 3_600_000 }) }),
      );
    });
  });

  // ─── deleteEntry ────────────────────────────────────────────────────────────

  describe('deleteEntry', () => {
    it('throws NotFoundException for cross-board taskId/boardId mismatch', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_WRONG_BOARD);
      await expect(service.deleteEntry(1, 10, 5, 7)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user lacks EDIT permission', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.deleteEntry(1, 10, 5, 7)).rejects.toThrow(ForbiddenException);
    });

    it('enforces board permission before looking up the entry (auth-before-lookup)', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.deleteEntry(1, 10, 5, 7)).rejects.toThrow();
      expect(prisma.timeEntry.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when entry does not exist', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      prisma.timeEntry.findFirst.mockResolvedValue(null);
      await expect(service.deleteEntry(1, 10, 99, 7)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when entryId belongs to a different task (cross-task probe)', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      // Entry exists but with taskId=20, not 10 — findFirst returns null because query includes taskId constraint
      prisma.timeEntry.findFirst.mockResolvedValue(null);
      await expect(service.deleteEntry(1, 10, 5, 7)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not the entry owner (ownership check)', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      prisma.timeEntry.findFirst.mockResolvedValue({ ...COMPLETED_ENTRY, userId: 99 });
      await expect(service.deleteEntry(1, 10, 5, 7)).rejects.toThrow(ForbiddenException);
    });

    it('deletes entry and returns { success: true } for the entry owner', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      prisma.timeEntry.findFirst.mockResolvedValue({ ...COMPLETED_ENTRY, userId: 7 });
      prisma.timeEntry.delete.mockResolvedValue({});
      const result = await service.deleteEntry(1, 10, 5, 7);
      expect(result).toEqual({ success: true });
    });
  });

  // ─── getActiveTimer ─────────────────────────────────────────────────────────

  describe('getActiveTimer', () => {
    it('throws NotFoundException for cross-board mismatch', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_WRONG_BOARD);
      await expect(service.getActiveTimer(10, 7, 1)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user lacks VIEW permission', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.getActiveTimer(10, 7, 1)).rejects.toThrow(ForbiddenException);
    });

    it('enforces BoardPermission.VIEW', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      prisma.timeEntry.findFirst.mockResolvedValue(null);
      await service.getActiveTimer(10, 7, 1);
      expect(boardAccess.requirePermission).toHaveBeenCalledWith(1, 7, BoardPermission.VIEW);
    });

    it('returns active timer entry for the authenticated user only', async () => {
      prisma.task.findUnique.mockResolvedValue(TASK_IN_BOARD);
      prisma.timeEntry.findFirst.mockResolvedValue(ENTRY);
      const result = await service.getActiveTimer(10, 7, 1);
      expect(result).toBe(ENTRY);
      expect(prisma.timeEntry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 7, taskId: 10 }) }),
      );
    });
  });

  // ─── getBoardTimeSummary ─────────────────────────────────────────────────────

  describe('getBoardTimeSummary', () => {
    it('throws ForbiddenException when user lacks VIEW permission', async () => {
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.getBoardTimeSummary(1, 7)).rejects.toThrow(ForbiddenException);
    });

    it('enforces BoardPermission.VIEW', async () => {
      prisma.board.findUnique.mockResolvedValue({ budgetHours: 100 });
      prisma.timeEntry.aggregate.mockResolvedValue({ _sum: { durationMs: 3_600_000 } });
      await service.getBoardTimeSummary(1, 7);
      expect(boardAccess.requirePermission).toHaveBeenCalledWith(1, 7, BoardPermission.VIEW);
    });

    it('returns summary with correct percentage calculation', async () => {
      prisma.board.findUnique.mockResolvedValue({ budgetHours: 10 });
      prisma.timeEntry.aggregate.mockResolvedValue({ _sum: { durationMs: 18_000_000 } }); // 5h
      const result = await service.getBoardTimeSummary(1, 7);
      expect(result.totalHours).toBe(5);
      expect(result.budgetHours).toBe(10);
      expect(result.percentage).toBe(50);
    });

    it('returns null percentage when board has no budget set', async () => {
      prisma.board.findUnique.mockResolvedValue({ budgetHours: null });
      prisma.timeEntry.aggregate.mockResolvedValue({ _sum: { durationMs: 0 } });
      const result = await service.getBoardTimeSummary(1, 7);
      expect(result.percentage).toBeNull();
    });
  });

  // ─── exportTimeReport ────────────────────────────────────────────────────────

  describe('exportTimeReport', () => {
    it('throws ForbiddenException when user lacks EXPORT_BOARD permission', async () => {
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.exportTimeReport(1, 7, {})).rejects.toThrow(ForbiddenException);
    });

    it('enforces BoardPermission.EXPORT_BOARD', async () => {
      prisma.timeEntry.findMany.mockResolvedValue([]);
      await service.exportTimeReport(1, 7, {});
      expect(boardAccess.requirePermission).toHaveBeenCalledWith(1, 7, BoardPermission.EXPORT_BOARD);
    });

    it('does not fetch entries when board access is denied', async () => {
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.exportTimeReport(1, 7, {})).rejects.toThrow();
      expect(prisma.timeEntry.findMany).not.toHaveBeenCalled();
    });

    it('returns CSV with header on empty board', async () => {
      prisma.timeEntry.findMany.mockResolvedValue([]);
      const result = await service.exportTimeReport(1, 7, {});
      expect(result.csv).toContain('Task,User,Date,Hours,Note');
      expect(result.filename).toMatch(/^time-report-\d{4}-\d{2}-\d{2}\.csv$/);
    });

    it('includes entry data in CSV output', async () => {
      prisma.timeEntry.findMany.mockResolvedValue([
        {
          id: 1,
          task: { id: 10, name: 'Build auth' },
          user: { id: 7, firstName: 'John', lastName: 'Doe' },
          startedAt: new Date('2026-10-20T09:00:00Z'),
          durationMs: 7_200_000,
          note: 'pair session',
        },
      ]);
      const result = await service.exportTimeReport(1, 7, {});
      expect(result.csv).toContain('Build auth');
      expect(result.csv).toContain('John Doe');
      expect(result.csv).toContain('2.00');
    });
  });

  // ─── getPersonalTimesheet ────────────────────────────────────────────────────

  describe('getPersonalTimesheet', () => {
    it('throws ForbiddenException when user is not a workspace member', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue(null);
      await expect(service.getPersonalTimesheet(7, 1, '2026-10-13')).rejects.toThrow(ForbiddenException);
    });

    it('returns empty result when workspace has no boards', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue({ id: 1 });
      prisma.board.findMany.mockResolvedValue([]);
      const result = await service.getPersonalTimesheet(7, 1, '2026-10-13');
      expect(result.rows).toHaveLength(0);
      expect(result.weekTotalMs).toBe(0);
    });

    it('scopes entries to the authenticated user only', async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue({ id: 1 });
      prisma.board.findMany.mockResolvedValue([{ id: 1, name: 'Board A' }]);
      prisma.timeEntry.findMany.mockResolvedValue([]);
      await service.getPersonalTimesheet(7, 1, '2026-10-13');
      expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 7 }) }),
      );
    });
  });
});
