import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StatusOptionsService } from './status-options.service';
import { PrismaService } from 'prisma/prisma.service';
import { BoardAccessService } from 'src/boards/board-access.service';
import { BoardPermission } from '@repo/shared';

const COLUMN_ID = 1;
const BOARD_ID = 10;
const STATUS_ID = 100;
const USER_ID = 5;

describe('StatusOptionsService', () => {
  let service: StatusOptionsService;

  const prismaMock = {
    boardColumn: { findUnique: jest.fn() },
    statusOption: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    taskCell: { findMany: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };

  const boardAccessMock = {
    requirePermission: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatusOptionsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: BoardAccessService, useValue: boardAccessMock },
      ],
    }).compile();

    service = module.get<StatusOptionsService>(StatusOptionsService);
    jest.clearAllMocks();
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('throws NotFoundException when column does not exist', async () => {
      prismaMock.boardColumn.findUnique.mockResolvedValue(null);
      await expect(service.findAll(COLUMN_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user has no board access', async () => {
      prismaMock.boardColumn.findUnique.mockResolvedValue({ id: COLUMN_ID, boardId: BOARD_ID });
      boardAccessMock.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.findAll(COLUMN_ID, USER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('requires VIEW permission (not EDIT)', async () => {
      prismaMock.boardColumn.findUnique.mockResolvedValue({ id: COLUMN_ID, boardId: BOARD_ID });
      boardAccessMock.requirePermission.mockResolvedValue(true);
      prismaMock.statusOption.findMany.mockResolvedValue([]);
      await service.findAll(COLUMN_ID, USER_ID);
      expect(boardAccessMock.requirePermission).toHaveBeenCalledWith(BOARD_ID, USER_ID, BoardPermission.VIEW);
    });

    it('returns status options for authorized user', async () => {
      const options = [{ id: 1, label: 'Done', color: '#00ff00' }];
      prismaMock.boardColumn.findUnique.mockResolvedValue({ id: COLUMN_ID, boardId: BOARD_ID });
      boardAccessMock.requirePermission.mockResolvedValue(true);
      prismaMock.statusOption.findMany.mockResolvedValue(options);
      expect(await service.findAll(COLUMN_ID, USER_ID)).toEqual(options);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { label: 'In Progress', color: '#ffff00' };

    it('throws NotFoundException when column does not exist', async () => {
      prismaMock.boardColumn.findUnique.mockResolvedValue(null);
      await expect(service.create(COLUMN_ID, dto, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user lacks EDIT permission', async () => {
      prismaMock.boardColumn.findUnique.mockResolvedValue({ id: COLUMN_ID, type: 'STATUS', boardId: BOARD_ID });
      boardAccessMock.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.create(COLUMN_ID, dto, USER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('VIEW-only user cannot create (EDIT required)', async () => {
      prismaMock.boardColumn.findUnique.mockResolvedValue({ id: COLUMN_ID, type: 'STATUS', boardId: BOARD_ID });
      boardAccessMock.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.create(COLUMN_ID, dto, USER_ID)).rejects.toThrow(ForbiddenException);
      expect(boardAccessMock.requirePermission).toHaveBeenCalledWith(BOARD_ID, USER_ID, BoardPermission.EDIT);
    });

    it('creates status option for authorized user', async () => {
      const created = { id: STATUS_ID, label: 'In Progress', color: '#ffff00', columnId: COLUMN_ID };
      prismaMock.boardColumn.findUnique.mockResolvedValue({ id: COLUMN_ID, type: 'STATUS', boardId: BOARD_ID });
      boardAccessMock.requirePermission.mockResolvedValue(true);
      prismaMock.statusOption.create.mockResolvedValue(created);
      expect(await service.create(COLUMN_ID, dto, USER_ID)).toEqual(created);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    const dto = { label: 'Updated', color: '#0000ff' };

    it('throws NotFoundException when column does not exist', async () => {
      prismaMock.boardColumn.findUnique.mockResolvedValue(null);
      await expect(service.update(COLUMN_ID, STATUS_ID, USER_ID, dto)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException before probing status option (no info leak)', async () => {
      prismaMock.boardColumn.findUnique.mockResolvedValue({ boardId: BOARD_ID });
      boardAccessMock.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.update(COLUMN_ID, STATUS_ID, USER_ID, dto)).rejects.toThrow(ForbiddenException);
      expect(prismaMock.statusOption.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when statusId does not belong to columnId (cross-column injection)', async () => {
      prismaMock.boardColumn.findUnique.mockResolvedValue({ boardId: BOARD_ID });
      boardAccessMock.requirePermission.mockResolvedValue(true);
      prismaMock.statusOption.findFirst.mockResolvedValue(null);
      await expect(service.update(COLUMN_ID, STATUS_ID, USER_ID, dto)).rejects.toThrow(NotFoundException);
    });

    it('resolves boardId from DB — not from client input', async () => {
      prismaMock.boardColumn.findUnique.mockResolvedValue({ boardId: BOARD_ID });
      boardAccessMock.requirePermission.mockResolvedValue(true);
      prismaMock.statusOption.findFirst.mockResolvedValue({
        id: STATUS_ID, columnId: COLUMN_ID, label: 'Old', color: '#000',
      });
      const txMock = {
        statusOption: { update: jest.fn().mockResolvedValue({ id: STATUS_ID }) },
        taskCell: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      };
      prismaMock.$transaction.mockImplementation((fn) => fn(txMock));
      await service.update(COLUMN_ID, STATUS_ID, USER_ID, dto);
      expect(boardAccessMock.requirePermission).toHaveBeenCalledWith(BOARD_ID, USER_ID, BoardPermission.EDIT);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('throws NotFoundException when column does not exist', async () => {
      prismaMock.boardColumn.findUnique.mockResolvedValue(null);
      await expect(service.remove(COLUMN_ID, STATUS_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException before probing status option (no info leak)', async () => {
      prismaMock.boardColumn.findUnique.mockResolvedValue({ boardId: BOARD_ID });
      boardAccessMock.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.remove(COLUMN_ID, STATUS_ID, USER_ID)).rejects.toThrow(ForbiddenException);
      expect(prismaMock.statusOption.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when statusId does not belong to columnId (cross-column injection)', async () => {
      prismaMock.boardColumn.findUnique.mockResolvedValue({ boardId: BOARD_ID });
      boardAccessMock.requirePermission.mockResolvedValue(true);
      prismaMock.statusOption.findFirst.mockResolvedValue(null);
      await expect(service.remove(COLUMN_ID, STATUS_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('deletes option for authorized user', async () => {
      const deleted = { id: STATUS_ID };
      prismaMock.boardColumn.findUnique.mockResolvedValue({ boardId: BOARD_ID });
      boardAccessMock.requirePermission.mockResolvedValue(true);
      prismaMock.statusOption.findFirst.mockResolvedValue({ id: STATUS_ID });
      prismaMock.statusOption.delete.mockResolvedValue(deleted);
      expect(await service.remove(COLUMN_ID, STATUS_ID, USER_ID)).toEqual(deleted);
    });
  });

  // ─── getUniqueLabelValues ─────────────────────────────────────────────────

  describe('getUniqueLabelValues', () => {
    it('throws NotFoundException when column does not exist', async () => {
      prismaMock.boardColumn.findUnique.mockResolvedValue(null);
      await expect(service.getUniqueLabelValues(COLUMN_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user has no board access', async () => {
      prismaMock.boardColumn.findUnique.mockResolvedValue({ id: COLUMN_ID, boardId: BOARD_ID });
      boardAccessMock.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.getUniqueLabelValues(COLUMN_ID, USER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('requires VIEW permission', async () => {
      prismaMock.boardColumn.findUnique.mockResolvedValue({ id: COLUMN_ID, boardId: BOARD_ID });
      boardAccessMock.requirePermission.mockResolvedValue(true);
      prismaMock.taskCell.findMany.mockResolvedValue([]);
      await service.getUniqueLabelValues(COLUMN_ID, USER_ID);
      expect(boardAccessMock.requirePermission).toHaveBeenCalledWith(BOARD_ID, USER_ID, BoardPermission.VIEW);
    });

    it('returns sorted unique labels for authorized user', async () => {
      prismaMock.boardColumn.findUnique.mockResolvedValue({ id: COLUMN_ID, boardId: BOARD_ID });
      boardAccessMock.requirePermission.mockResolvedValue(true);
      prismaMock.taskCell.findMany.mockResolvedValue([
        { value: { text: 'Beta' } },
        { value: { text: 'Alpha' } },
        { value: { text: 'Beta' } },
      ]);
      expect(await service.getUniqueLabelValues(COLUMN_ID, USER_ID)).toEqual(['Alpha', 'Beta']);
    });
  });
});
