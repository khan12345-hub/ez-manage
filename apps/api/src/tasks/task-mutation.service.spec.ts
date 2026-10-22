import { ConflictException, NotFoundException } from '@nestjs/common';
import { TaskMutationService } from './task-mutation.service';

const TS1 = new Date('2026-01-01T00:00:00.000Z');
const TS2 = new Date('2026-01-01T00:00:01.000Z');

const makeTask = (overrides: object = {}) => ({
  id: 1,
  name: 'Task A',
  groupId: 10,
  updatedAt: TS1,
  ...overrides,
});

function makeService(prismaOverrides: object = {}) {
  const prisma = {
    task: {
      findUnique: jest.fn().mockResolvedValue(makeTask()),
      findUniqueOrThrow: jest.fn().mockResolvedValue(makeTask({ updatedAt: TS2 })),
      update: jest.fn().mockResolvedValue(makeTask()),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      ...((prismaOverrides as any).task ?? {}),
    },
    ...prismaOverrides,
  };

  const activityLogsService = { log: jest.fn().mockResolvedValue(undefined) };

  const service = new TaskMutationService(prisma as any, activityLogsService as any);
  return { service, prisma, activityLogsService };
}

describe('TaskMutationService.update — concurrency guard', () => {
  it('skips version check when updatedAt is not supplied (backward compat)', async () => {
    const { service, prisma } = makeService();

    await service.update(1, { name: 'New' }, 99, 5);

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: { name: 'New' } }),
    );
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
  });

  it('uses conditional updateMany when client supplies updatedAt', async () => {
    const { service, prisma } = makeService();

    await service.update(1, { name: 'New', updatedAt: TS1.toISOString() }, 99, 5);

    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: { id: 1, updatedAt: TS1 },
      data: { name: 'New' },
    });
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('throws ConflictException (409) when task was modified concurrently', async () => {
    const { service } = makeService({
      task: {
        findUnique: jest.fn().mockResolvedValue(makeTask()),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }), // row has newer updatedAt
      },
    });

    await expect(
      service.update(1, { name: 'Stale', updatedAt: TS1.toISOString() }, 99, 5),
    ).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException when task does not exist', async () => {
    const { service } = makeService({
      task: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.update(99, { name: 'X' }, 1, 5)).rejects.toThrow(NotFoundException);
  });

  it('logs activity using the pre-update snapshot (not stale data)', async () => {
    const { service, activityLogsService } = makeService();

    await service.update(1, { name: 'Changed', updatedAt: TS1.toISOString() }, 99, 5);

    expect(activityLogsService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ oldName: 'Task A', newName: 'Changed' }),
      }),
    );
  });

  it('two concurrent writes: second writer gets 409 (stale-write rejection)', async () => {
    // Simulate writer A and writer B both reading at TS1.
    // Writer A's updateMany succeeds (count=1). Writer B then tries with the same
    // TS1 but the row now has TS2 → count=0 → ConflictException.
    let callCount = 0;
    const { service } = makeService({
      task: {
        findUnique: jest.fn().mockResolvedValue(makeTask()),
        findUniqueOrThrow: jest.fn().mockResolvedValue(makeTask({ updatedAt: TS2 })),
        updateMany: jest.fn().mockImplementation(() => {
          callCount++;
          return Promise.resolve({ count: callCount === 1 ? 1 : 0 });
        }),
      },
    });

    // Writer A succeeds
    await service.update(1, { name: 'A wins', updatedAt: TS1.toISOString() }, 1, 5);

    // Writer B loses (stale)
    await expect(
      service.update(1, { name: 'B loses', updatedAt: TS1.toISOString() }, 2, 5),
    ).rejects.toThrow(ConflictException);
  });

  it('updates to different tasks (different fields) both succeed independently', async () => {
    const task1 = makeTask({ id: 1, name: 'Task 1', updatedAt: TS1 });
    const task2 = makeTask({ id: 2, name: 'Task 2', updatedAt: TS1 });

    const { service, prisma } = makeService({
      task: {
        findUnique: jest.fn()
          .mockResolvedValueOnce(task1)
          .mockResolvedValueOnce(task2),
        findUniqueOrThrow: jest.fn()
          .mockResolvedValueOnce({ ...task1, updatedAt: TS2 })
          .mockResolvedValueOnce({ ...task2, updatedAt: TS2 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    });

    await service.update(1, { name: 'T1 updated', updatedAt: TS1.toISOString() }, 99, 5);
    await service.update(2, { name: 'T2 updated', updatedAt: TS1.toISOString() }, 99, 5);

    // Both tasks updated independently — each triggered one conditional updateMany
    expect(prisma.task.updateMany).toHaveBeenCalledTimes(2);
  });
});
