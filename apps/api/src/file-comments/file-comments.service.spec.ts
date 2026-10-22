import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FileCommentsService } from './file-comments.service';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { BoardAccessService } from 'src/boards/board-access.service';
import { BoardPermission } from '@repo/shared';

const makePrisma = () => ({
  file: {
    findUnique: jest.fn(),
  },
  fileComment: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
});

const makeNotifications = () => ({
  notify: jest.fn().mockResolvedValue(undefined),
});

const makeBoardAccess = () => ({
  requirePermission: jest.fn().mockResolvedValue(undefined),
});

const FILE_WITH_BOARD = {
  id: 10,
  fileName: 'photo.jpg',
  uploadedById: 99,
  cells: [
    {
      cell: {
        task: {
          group: { boardId: 5 },
        },
      },
    },
  ],
};

const FILE_NO_CELLS = {
  id: 10,
  fileName: 'photo.jpg',
  uploadedById: 99,
  cells: [],
};

describe('FileCommentsService', () => {
  let service: FileCommentsService;
  let prisma: ReturnType<typeof makePrisma>;
  let boardAccess: ReturnType<typeof makeBoardAccess>;

  beforeEach(async () => {
    prisma = makePrisma();
    boardAccess = makeBoardAccess();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileCommentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: makeNotifications() },
        { provide: BoardAccessService, useValue: boardAccess },
      ],
    }).compile();

    service = module.get(FileCommentsService);
  });

  // ─── resolveFileBoardId (via findAll as the public proxy) ───────────────────

  describe('board resolution', () => {
    it('throws NotFoundException when file does not exist', async () => {
      prisma.file.findUnique.mockResolvedValue(null);
      await expect(service.findAll(10, 1)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when file has no cell association (fail closed)', async () => {
      prisma.file.findUnique.mockResolvedValue({ cells: [] });
      await expect(service.findAll(10, 1)).rejects.toThrow(NotFoundException);
    });

    it('does not throw ForbiddenException for missing board — returns 404 to avoid probing', async () => {
      prisma.file.findUnique.mockResolvedValue({ cells: [] });
      await expect(service.findAll(10, 1)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('throws ForbiddenException when user lacks VIEW permission', async () => {
      prisma.file.findUnique.mockResolvedValue({ cells: [{ cell: { task: { group: { boardId: 5 } } } }] });
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.findAll(10, 1)).rejects.toThrow(ForbiddenException);
    });

    it('enforces BoardPermission.VIEW for read access', async () => {
      prisma.file.findUnique.mockResolvedValue({ cells: [{ cell: { task: { group: { boardId: 5 } } } }] });
      prisma.fileComment.findMany.mockResolvedValue([]);
      await service.findAll(10, 7);
      expect(boardAccess.requirePermission).toHaveBeenCalledWith(5, 7, BoardPermission.VIEW);
    });

    it('resolves boardId from the DB — not from caller input', async () => {
      prisma.file.findUnique.mockResolvedValue({ cells: [{ cell: { task: { group: { boardId: 5 } } } }] });
      prisma.fileComment.findMany.mockResolvedValue([]);
      await service.findAll(10, 7);
      const [boardId] = boardAccess.requirePermission.mock.calls[0];
      expect(boardId).toBe(5);
    });

    it('returns comments when user has VIEW permission', async () => {
      prisma.file.findUnique.mockResolvedValue({ cells: [{ cell: { task: { group: { boardId: 5 } } } }] });
      const comments = [{ id: 1, content: 'hi' }];
      prisma.fileComment.findMany.mockResolvedValue(comments);
      const result = await service.findAll(10, 7);
      expect(result).toBe(comments);
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('throws NotFoundException when file does not exist', async () => {
      prisma.file.findUnique.mockResolvedValue(null);
      await expect(service.create(10, 1, { content: 'hi' })).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when file has no cell association (fail closed)', async () => {
      prisma.file.findUnique.mockResolvedValue(FILE_NO_CELLS);
      await expect(service.create(10, 1, { content: 'hi' })).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user lacks EDIT permission', async () => {
      prisma.file.findUnique.mockResolvedValue(FILE_WITH_BOARD);
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.create(10, 1, { content: 'hi' })).rejects.toThrow(ForbiddenException);
    });

    it('enforces BoardPermission.EDIT for comment creation', async () => {
      prisma.file.findUnique.mockResolvedValue(FILE_WITH_BOARD);
      prisma.fileComment.create.mockResolvedValue({ id: 1, fileId: 10, userId: 1, content: 'hi' });
      await service.create(10, 1, { content: 'hi' });
      expect(boardAccess.requirePermission).toHaveBeenCalledWith(5, 1, BoardPermission.EDIT);
    });

    it('does not call prisma.fileComment.create when board access is denied', async () => {
      prisma.file.findUnique.mockResolvedValue(FILE_WITH_BOARD);
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.create(10, 1, { content: 'hi' })).rejects.toThrow();
      expect(prisma.fileComment.create).not.toHaveBeenCalled();
    });

    it('creates comment and returns it after authorization passes', async () => {
      prisma.file.findUnique.mockResolvedValue(FILE_WITH_BOARD);
      const comment = { id: 1, fileId: 10, userId: 1, content: 'hi' };
      prisma.fileComment.create.mockResolvedValue(comment);
      const result = await service.create(10, 1, { content: 'hi' });
      expect(result).toBe(comment);
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('throws NotFoundException when file does not exist', async () => {
      prisma.file.findUnique.mockResolvedValue(null);
      await expect(service.remove(10, 1, 7)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user lacks EDIT permission', async () => {
      prisma.file.findUnique.mockResolvedValue({ cells: [{ cell: { task: { group: { boardId: 5 } } } }] });
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.remove(10, 1, 7)).rejects.toThrow(ForbiddenException);
    });

    it('enforces BoardPermission.EDIT before looking up comment (auth-before-lookup)', async () => {
      prisma.file.findUnique.mockResolvedValue({ cells: [{ cell: { task: { group: { boardId: 5 } } } }] });
      boardAccess.requirePermission.mockRejectedValue(new ForbiddenException());
      await expect(service.remove(10, 1, 7)).rejects.toThrow();
      // Comment lookup must NOT have run — prevents comment existence probing
      expect(prisma.fileComment.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when comment does not exist', async () => {
      prisma.file.findUnique.mockResolvedValue({ cells: [{ cell: { task: { group: { boardId: 5 } } } }] });
      prisma.fileComment.findUnique.mockResolvedValue(null);
      await expect(service.remove(10, 99, 7)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when commentId belongs to a different file (cross-file probe)', async () => {
      prisma.file.findUnique.mockResolvedValue({ cells: [{ cell: { task: { group: { boardId: 5 } } } }] });
      // Comment exists but has fileId=20, not 10
      prisma.fileComment.findUnique.mockResolvedValue({ id: 99, fileId: 20, userId: 7 });
      await expect(service.remove(10, 99, 7)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not the comment author (ownership check)', async () => {
      prisma.file.findUnique.mockResolvedValue({ cells: [{ cell: { task: { group: { boardId: 5 } } } }] });
      prisma.fileComment.findUnique.mockResolvedValue({ id: 1, fileId: 10, userId: 99 });
      // userId 7 tries to delete comment owned by userId 99
      await expect(service.remove(10, 1, 7)).rejects.toThrow(ForbiddenException);
    });

    it('deletes comment and returns { ok: true } for the comment owner', async () => {
      prisma.file.findUnique.mockResolvedValue({ cells: [{ cell: { task: { group: { boardId: 5 } } } }] });
      prisma.fileComment.findUnique.mockResolvedValue({ id: 1, fileId: 10, userId: 7 });
      prisma.fileComment.delete.mockResolvedValue({});
      const result = await service.remove(10, 1, 7);
      expect(result).toEqual({ ok: true });
    });
  });
});
