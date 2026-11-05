import { NotFoundException } from '@nestjs/common';
import { TaskQueryService } from './task-search.service';

/**
 * TasksService was split into TaskCreate/Query/Mutation/Reorder services.
 * This spec covers the cross-board guard used by GET/PATCH/DELETE
 * /boards/:boardId/tasks/:id (a task id from another board must not resolve).
 */
describe('TaskQueryService.assertTaskInBoard', () => {
  function make(task: any, member: any = null) {
    const prisma = {
      task: { findFirst: jest.fn().mockResolvedValue(task) },
      boardMember: { findUnique: jest.fn().mockResolvedValue(member) },
    };
    return { service: new TaskQueryService(prisma as any), prisma };
  }

  it('passes when the task belongs to the board', async () => {
    const { service, prisma } = make({ id: 1, groupId: 10 });
    await expect(service.assertTaskInBoard(1, 5)).resolves.toBeUndefined();
    expect(prisma.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1, group: { boardId: 5 } } }),
    );
  });

  it('404s when the task is on another board', async () => {
    const { service } = make(null);
    await expect(service.assertTaskInBoard(1, 5)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s for a group-restricted member outside their groups', async () => {
    const { service } = make(
      { id: 1, groupId: 10 },
      { accessAllGroups: false, groupAccess: [{ groupId: 11 }] },
    );
    await expect(service.assertTaskInBoard(1, 5, 7)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('passes for a group-restricted member inside their groups', async () => {
    const { service } = make(
      { id: 1, groupId: 10 },
      { accessAllGroups: false, groupAccess: [{ groupId: 10 }] },
    );
    await expect(service.assertTaskInBoard(1, 5, 7)).resolves.toBeUndefined();
  });
});
