import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CellsService } from './cells.service';

const TS1 = new Date('2026-01-01T00:00:00.000Z');
const TS2 = new Date('2026-01-01T00:00:01.000Z');

const makeCell = (overrides: object = {}) => ({
  id: 10,
  taskId: 1,
  columnId: 20,
  value: { label: 'Done', color: '#00c875' },
  updatedAt: TS1,
  task: {
    id: 1,
    name: 'Task A',
    groupId: 5,
    createdById: 42,
    group: { boardId: 3 },
  },
  column: {
    id: 20,
    boardId: 3,
    type: 'STATUS',
    name: 'Status',
    accessControlEnabled: false,
    permissions: [],
  },
  ...overrides,
});

function makeService(prismaOverrides: object = {}) {
  const prisma = {
    // $executeRaw is used for the conditional update path (date_trunc comparison).
    $executeRaw: jest.fn().mockResolvedValue(1),
    taskCell: {
      findFirst: jest.fn().mockResolvedValue(makeCell()),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ ...makeCell(), updatedAt: TS2 }),
      update: jest.fn().mockResolvedValue(makeCell()),
      findMany: jest.fn().mockResolvedValue([]),
      ...((prismaOverrides as any).taskCell ?? {}),
    },
    statusOption: { findFirst: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    board: { findUnique: jest.fn().mockResolvedValue({ workspaceId: 7 }) },
    boardMember: { findFirst: jest.fn().mockResolvedValue(null) },
    ...prismaOverrides,
  };

  const storageService = {};
  const eventEmitter = { emit: jest.fn(), emitAsync: jest.fn() };
  const activityLogsService = { log: jest.fn().mockResolvedValue({ id: 99 }) };
  const automationEngineService = { handleStatusChanged: jest.fn().mockResolvedValue(undefined) };
  const notificationsService = { notify: jest.fn().mockResolvedValue(null) };
  const notificationStreamService = { emit: jest.fn() };

  // Constructor order: prisma, storageService, eventEmitter, activityLogsService,
  //                    automationEngineService, notificationsService, notificationStreamService
  const service = new CellsService(
    prisma as any,
    storageService as any,
    eventEmitter as any,
    activityLogsService as any,
    automationEngineService as any,
    notificationsService as any,
    notificationStreamService as any,
  );

  return { service, prisma, activityLogsService };
}

describe('CellsService.updateCell — concurrency guard', () => {
  it('skips version check when updatedAt is not supplied (backward compat)', async () => {
    const { service, prisma } = makeService();

    await service.updateCell(10, { value: 'X' }, 99, 3);

    expect(prisma.taskCell.update).toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('uses $executeRaw conditional update when client supplies updatedAt', async () => {
    const { service, prisma } = makeService();

    await service.updateCell(10, { value: 'X', updatedAt: TS1.toISOString() }, 99, 3);

    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.taskCell.update).not.toHaveBeenCalled();
  });

  it('throws ConflictException (409) when cell was modified concurrently', async () => {
    const { service } = makeService({
      $executeRaw: jest.fn().mockResolvedValue(0), // row timestamp has moved on
    });

    await expect(
      service.updateCell(10, { value: 'X', updatedAt: TS1.toISOString() }, 99, 3),
    ).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException when cell does not exist', async () => {
    const { service } = makeService({
      taskCell: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    await expect(
      service.updateCell(999, { value: 'X' }, 99, 3),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when column access control is enabled and user lacks permission', async () => {
    const { service } = makeService({
      taskCell: {
        findFirst: jest.fn().mockResolvedValue(
          makeCell({
            column: {
              id: 20,
              boardId: 3,
              type: 'TEXT',
              name: 'Restricted',
              accessControlEnabled: true,
              permissions: [], // no permissions for userId 99
            },
          }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
      },
      boardMember: {
        findFirst: jest.fn().mockResolvedValue({ role: 'MEMBER' }),
      },
    });

    await expect(
      service.updateCell(10, { value: 'X' }, 99, 3),
    ).rejects.toThrow(ForbiddenException);
  });

  it('activity log uses the pre-update value captured before the write', async () => {
    const { service, activityLogsService } = makeService();
    const previousValue = { label: 'Done', color: '#00c875' };

    await service.updateCell(10, { value: { label: 'In Progress', color: '#fdab3d' }, updatedAt: TS1.toISOString() }, 99, 3);

    expect(activityLogsService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ oldValue: previousValue }),
      }),
    );
  });

  it('two concurrent writes to the same cell: second writer gets 409', async () => {
    let callCount = 0;
    const { service } = makeService({
      $executeRaw: jest.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? 1 : 0);
      }),
      taskCell: {
        findFirst: jest.fn().mockResolvedValue(makeCell()),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...makeCell(), updatedAt: TS2 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    // First writer wins
    await service.updateCell(10, { value: 'Writer A', updatedAt: TS1.toISOString() }, 1, 3);

    // Second writer loses — same client timestamp but row has moved on
    await expect(
      service.updateCell(10, { value: 'Writer B', updatedAt: TS1.toISOString() }, 2, 3),
    ).rejects.toThrow(ConflictException);
  });

  it('updates to different cells (different fields) both succeed', async () => {
    const cell1 = makeCell({ id: 10, columnId: 20 });
    const cell2 = makeCell({ id: 11, columnId: 21, column: { ...makeCell().column, id: 21 } });

    const { service, prisma } = makeService({
      taskCell: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(cell1)
          .mockResolvedValueOnce(cell2),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...cell1, updatedAt: TS2 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    await service.updateCell(10, { value: 'V1', updatedAt: TS1.toISOString() }, 99, 3);
    await service.updateCell(11, { value: 'V2', updatedAt: TS1.toISOString() }, 99, 3);

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    // Both returned 1 (affected row), so neither threw
  });
});
