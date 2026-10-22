import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ColumnsService } from './columns.service';
import { PrismaService } from 'prisma/prisma.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { BoardAccessService } from 'src/boards/board-access.service';
import { BoardPermission } from '@repo/shared';

const makePrisma = () => {
  const p: any = {
    boardColumn: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    board: { findUnique: jest.fn() },
    task: { findMany: jest.fn() },
    taskCell: { createMany: jest.fn(), deleteMany: jest.fn() },
    $transaction: jest.fn(),
  };
  // Default: pass mock itself as the transaction client so tx.* calls hit the same mocks.
  p.$transaction.mockImplementation(async (fn: any) => fn(p));
  return p;
};

const makeBoardAccess = () => ({
  requirePermission: jest.fn().mockResolvedValue(true),
});

const makeActivityLogs = () => ({
  log: jest.fn().mockResolvedValue(undefined),
});

const COLUMN = { id: 1, boardId: 5, name: 'Status', type: 'STATUS', isPrimary: false, order: 1000 };
const PRIMARY_COLUMN = { ...COLUMN, id: 2, isPrimary: true };

describe('ColumnsService', () => {
  let service: ColumnsService;
  let prisma: ReturnType<typeof makePrisma>;
  let boardAccess: ReturnType<typeof makeBoardAccess>;
  let activityLogs: ReturnType<typeof makeActivityLogs>;

  beforeEach(async () => {
    prisma = makePrisma();
    boardAccess = makeBoardAccess();
    activityLogs = makeActivityLogs();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ColumnsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActivityLogsService, useValue: activityLogs },
        { provide: BoardAccessService, useValue: boardAccess },
      ],
    }).compile();

    service = module.get(ColumnsService);
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { boardId: 5, type: 'STATUS' as any };

    it('throws ForbiddenException when user lacks CREATE_COLUMN permission', async () => {
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.create(dto, 7)).rejects.toThrow(ForbiddenException);
    });

    it('enforces BoardPermission.CREATE_COLUMN', async () => {
      prisma.board.findUnique.mockResolvedValue({ id: 5 });
      prisma.boardColumn.findFirst.mockResolvedValue(null);
      prisma.boardColumn.create.mockResolvedValue(COLUMN);
      prisma.task.findMany.mockResolvedValue([]);
      await service.create(dto, 7);
      expect(boardAccess.requirePermission).toHaveBeenCalledWith(5, 7, BoardPermission.CREATE_COLUMN);
    });

    it('does not start transaction when board permission is denied', async () => {
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.create(dto, 7)).rejects.toThrow();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when board does not exist inside transaction', async () => {
      prisma.board.findUnique.mockResolvedValue(null);
      await expect(service.create(dto, 7)).rejects.toThrow(NotFoundException);
    });

    it('creates column and cells for all existing tasks on success', async () => {
      prisma.board.findUnique.mockResolvedValue({ id: 5 });
      prisma.boardColumn.findFirst.mockResolvedValue(null); // no last column, no name conflict
      prisma.boardColumn.create.mockResolvedValue(COLUMN);
      prisma.task.findMany.mockResolvedValue([{ id: 10 }, { id: 11 }]);
      prisma.taskCell.createMany.mockResolvedValue({ count: 2 });
      const result = await service.create(dto, 7);
      expect(result).toBe(COLUMN);
      expect(prisma.taskCell.createMany).toHaveBeenCalledWith({
        data: [{ taskId: 10, columnId: COLUMN.id }, { taskId: 11, columnId: COLUMN.id }],
      });
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws NotFoundException when column does not exist', async () => {
      prisma.boardColumn.findUnique.mockResolvedValue(null);
      await expect(service.update(1, { name: 'New' }, 7)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user lacks UPDATE_COLUMN permission', async () => {
      prisma.boardColumn.findUnique.mockResolvedValue(COLUMN);
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.update(1, { name: 'New' }, 7)).rejects.toThrow(ForbiddenException);
    });

    it('enforces BoardPermission.UPDATE_COLUMN against the column\'s actual boardId', async () => {
      prisma.boardColumn.findUnique.mockResolvedValue(COLUMN);
      prisma.boardColumn.findFirst.mockResolvedValue(null);
      prisma.boardColumn.update.mockResolvedValue({ ...COLUMN, name: 'New' });
      await service.update(1, { name: 'New' }, 7);
      expect(boardAccess.requirePermission).toHaveBeenCalledWith(5, 7, BoardPermission.UPDATE_COLUMN);
    });

    it('enforces permission before disclosing duplicate-name details (auth-before-logic)', async () => {
      prisma.boardColumn.findUnique.mockResolvedValue(COLUMN);
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.update(1, { name: 'Taken' }, 7)).rejects.toThrow(ForbiddenException);
      // Name-duplicate findFirst must NOT have been called yet
      expect(prisma.boardColumn.findFirst).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when name is already taken on the same board', async () => {
      prisma.boardColumn.findUnique.mockResolvedValue(COLUMN);
      prisma.boardColumn.findFirst.mockResolvedValue({ id: 99, name: 'Taken' }); // conflict
      await expect(service.update(1, { name: 'Taken' }, 7)).rejects.toThrow(BadRequestException);
    });

    it('updates column and returns the updated record on success', async () => {
      prisma.boardColumn.findUnique.mockResolvedValue(COLUMN);
      prisma.boardColumn.findFirst.mockResolvedValue(null); // no name conflict
      const updated = { ...COLUMN, name: 'Renamed' };
      prisma.boardColumn.update.mockResolvedValue(updated);
      const result = await service.update(1, { name: 'Renamed' }, 7);
      expect(result).toBe(updated);
    });
  });

  // ─── reorder ───────────────────────────────────────────────────────────────

  describe('reorder', () => {
    const baseDto = { boardId: 5, columnId: 1, previousColumnId: null, nextColumnId: null };

    it('throws ForbiddenException when user lacks UPDATE_COLUMN permission', async () => {
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.reorder(baseDto, 7)).rejects.toThrow(ForbiddenException);
    });

    it('enforces BoardPermission.UPDATE_COLUMN on the supplied boardId', async () => {
      prisma.boardColumn.findFirst.mockResolvedValue(COLUMN);
      prisma.boardColumn.update.mockResolvedValue({});
      await service.reorder(baseDto, 7);
      expect(boardAccess.requirePermission).toHaveBeenCalledWith(5, 7, BoardPermission.UPDATE_COLUMN);
    });

    it('enforces permission before any DB lookups (auth-before-lookup)', async () => {
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.reorder(baseDto, 7)).rejects.toThrow();
      expect(prisma.boardColumn.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when column does not belong to the board (cross-board rejection)', async () => {
      prisma.boardColumn.findFirst.mockResolvedValue(null); // column not found on board 5
      await expect(service.reorder({ boardId: 5, columnId: 99, previousColumnId: null, nextColumnId: null }, 7))
        .rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when column references itself as previousColumnId', async () => {
      await expect(service.reorder({ boardId: 5, columnId: 1, previousColumnId: 1, nextColumnId: null }, 7))
        .rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when column references itself as nextColumnId', async () => {
      await expect(service.reorder({ boardId: 5, columnId: 1, previousColumnId: null, nextColumnId: 1 }, 7))
        .rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when previousColumnId and nextColumnId are the same non-null value', async () => {
      await expect(service.reorder({ boardId: 5, columnId: 1, previousColumnId: 2, nextColumnId: 2 }, 7))
        .rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when reordering a primary column', async () => {
      prisma.boardColumn.findFirst.mockResolvedValue(PRIMARY_COLUMN);
      await expect(service.reorder(baseDto, 7)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for cross-board previousColumnId (explicit ID supplied but not on board)', async () => {
      // column found, but previousColumnId returns null (belongs to different board)
      prisma.boardColumn.findFirst
        .mockResolvedValueOnce(COLUMN)       // column itself
        .mockResolvedValueOnce(null)         // previousColumn from different board
        .mockResolvedValueOnce(null);        // nextColumn not supplied
      await expect(
        service.reorder({ boardId: 5, columnId: 1, previousColumnId: 99, nextColumnId: null }, 7),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for cross-board nextColumnId', async () => {
      prisma.boardColumn.findFirst
        .mockResolvedValueOnce(COLUMN)
        .mockResolvedValueOnce(null)   // previousColumn not supplied
        .mockResolvedValueOnce(null);  // nextColumnId belongs to different board
      await expect(
        service.reorder({ boardId: 5, columnId: 1, previousColumnId: null, nextColumnId: 88 }, 7),
      ).rejects.toThrow(NotFoundException);
    });

    it('positions as only movable column when no neighbours supplied', async () => {
      prisma.boardColumn.findFirst.mockResolvedValue(COLUMN);
      prisma.boardColumn.update.mockResolvedValue({});
      await service.reorder(baseDto, 7);
      expect(prisma.boardColumn.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ order: 1000 }) }),
      );
    });

    it('positions after previousColumn when only previousColumn supplied', async () => {
      const prev = { ...COLUMN, id: 3, order: 2000 };
      prisma.boardColumn.findFirst
        .mockResolvedValueOnce(COLUMN)  // the column to move
        .mockResolvedValueOnce(prev)    // previousColumn
        .mockResolvedValueOnce(null);   // nextColumn not supplied (Promise.resolve(null) branch)
      prisma.boardColumn.update.mockResolvedValue({});
      await service.reorder({ boardId: 5, columnId: 1, previousColumnId: 3, nextColumnId: null }, 7);
      expect(prisma.boardColumn.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ order: 3000 }) }),
      );
    });

    it('returns success message on valid reorder', async () => {
      prisma.boardColumn.findFirst.mockResolvedValue(COLUMN);
      prisma.boardColumn.update.mockResolvedValue({});
      const result = await service.reorder(baseDto, 7);
      expect(result).toEqual({ message: 'Columns reordered successfully' });
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('throws NotFoundException when column does not exist', async () => {
      prisma.boardColumn.findUnique.mockResolvedValue(null);
      await expect(service.remove(1, 7)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user lacks DELETE_COLUMN permission', async () => {
      prisma.boardColumn.findUnique.mockResolvedValue(COLUMN);
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.remove(1, 7)).rejects.toThrow(ForbiddenException);
    });

    it('enforces BoardPermission.DELETE_COLUMN against the column\'s actual boardId', async () => {
      prisma.boardColumn.findUnique.mockResolvedValue(COLUMN);
      prisma.taskCell.deleteMany.mockResolvedValue({});
      prisma.boardColumn.delete.mockResolvedValue({});
      await service.remove(1, 7);
      expect(boardAccess.requirePermission).toHaveBeenCalledWith(5, 7, BoardPermission.DELETE_COLUMN);
    });

    it('enforces permission before disclosing isPrimary status (auth-before-logic)', async () => {
      prisma.boardColumn.findUnique.mockResolvedValue(PRIMARY_COLUMN);
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      // Should throw ForbiddenException, NOT BadRequestException about primary column
      const err = await service.remove(2, 7).catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when attempting to delete a primary column (after auth passes)', async () => {
      prisma.boardColumn.findUnique.mockResolvedValue(PRIMARY_COLUMN);
      await expect(service.remove(2, 7)).rejects.toThrow(BadRequestException);
    });

    it('deletes task cells and the column, returns success message', async () => {
      prisma.boardColumn.findUnique.mockResolvedValue(COLUMN);
      prisma.taskCell.deleteMany.mockResolvedValue({});
      prisma.boardColumn.delete.mockResolvedValue({});
      const result = await service.remove(1, 7);
      expect(prisma.taskCell.deleteMany).toHaveBeenCalledWith({ where: { columnId: 1 } });
      expect(prisma.boardColumn.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual({ message: 'Column deleted successfully.' });
    });
  });
});
