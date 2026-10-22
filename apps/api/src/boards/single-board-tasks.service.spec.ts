import { GetBoardTasksService } from './single-board-tasks.service';

// ── helpers ────────────────────────────────────────────────────────────────

const makeTask = (overrides: Partial<Record<string, any>> = {}) => ({
  id: 1,
  name: 'Task A',
  groupId: 10,
  parentId: null,
  order: 1000,
  createdAt: new Date(),
  updatedAt: new Date(),
  cells: [],
  subtasks: [],
  createdBy: { id: 99, firstName: 'Ali', lastName: 'Khan', avatarUrl: null },
  _count: { comments: 0, subtasks: 0 },
  ...overrides,
});

function makeService(overrides: Record<string, any> = {}) {
  const prisma = {
    task: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    taskComment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    ...overrides,
  };

  const boardSearchService = {
    filterTasks: jest.fn((tasks: any[]) => tasks),
  };

  const service = new GetBoardTasksService(prisma as any, boardSearchService as any);
  return { service, prisma, boardSearchService };
}

// ── execute() ──────────────────────────────────────────────────────────────

describe('GetBoardTasksService.execute', () => {
  describe('no filters (fast path)', () => {
    it('uses DB cursor pagination — does not call $queryRaw', async () => {
      const task = makeTask();
      const { service, prisma } = makeService({
        task: {
          findMany: jest.fn().mockResolvedValue([task]),
          count: jest.fn().mockResolvedValue(1),
        },
      });

      const result = await service.execute({ boardId: 1 });

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 51 }),
      );
      expect(result.tasks).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('sets hasMore and nextCursor correctly when page is full', async () => {
      // 51 rows returned → hasMore = true, 50 tasks returned
      const tasks = Array.from({ length: 51 }, (_, i) => makeTask({ id: i + 1, order: i + 1 }));
      const { service } = makeService({
        task: {
          findMany: jest.fn().mockResolvedValue(tasks),
          count: jest.fn().mockResolvedValue(100),
        },
      });

      const result = await service.execute({ boardId: 1, limit: 50 });

      expect(result.hasMore).toBe(true);
      expect(result.tasks).toHaveLength(50);
      expect(result.nextCursor).toBe(50); // last of 50 returned tasks has id=50
    });

    it('passes cursor to findMany when provided', async () => {
      const { service, prisma } = makeService({
        task: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
      });

      await service.execute({ boardId: 1, cursor: 42 });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 42 },
          skip: 1,
        }),
      );
    });
  });

  describe('search filter', () => {
    it('queries name matches and cell/file matches in parallel (no full table scan)', async () => {
      const task = makeTask({ id: 5 });

      const { service, prisma, boardSearchService } = makeService({
        task: {
          findMany: jest
            .fn()
            // First call: name pre-query returns candidate IDs
            .mockResolvedValueOnce([{ id: 5 }])
            // Second call: main load with id: { in: [5] }
            .mockResolvedValueOnce([task]),
          count: jest.fn().mockResolvedValue(1),
        },
        taskComment: { findMany: jest.fn().mockResolvedValue([]) },
        $queryRaw: jest.fn().mockResolvedValue([]), // cell/file pre-query
      });

      const result = await service.execute({ boardId: 1, search: 'hello' });

      // Pre-query: task name / subtask name
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: { contains: 'hello', mode: 'insensitive' } }),
            ]),
          }),
          select: { id: true },
        }),
      );

      // Main load only fetches candidate IDs — not ALL tasks
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: [5] } }),
          take: 51,
        }),
      );

      expect(result.tasks).toHaveLength(1);
    });

    it('returns empty result immediately when no candidates found', async () => {
      const { service, prisma } = makeService({
        task: { findMany: jest.fn().mockResolvedValue([]) },
        taskComment: { findMany: jest.fn().mockResolvedValue([]) },
        $queryRaw: jest.fn().mockResolvedValue([]),
      });

      const result = await service.execute({ boardId: 1, search: 'zzz-no-match' });

      // Should NOT call the main load query (second findMany) because candidateIds is empty
      expect(prisma.task.findMany).toHaveBeenCalledTimes(1); // only the name pre-query
      expect(result.tasks).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('includes comment-matched task IDs in candidates', async () => {
      const { service, prisma } = makeService({
        task: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce([]) // name pre-query: no name matches
            .mockResolvedValueOnce([makeTask({ id: 7 })]), // main load
          count: jest.fn().mockResolvedValue(1),
        },
        taskComment: {
          findMany: jest.fn().mockResolvedValue([{ taskId: 7 }]), // comment match
        },
        $queryRaw: jest.fn().mockResolvedValue([]),
      });

      const result = await service.execute({ boardId: 1, search: 'fix bug' });

      // Main load should include the comment-matched ID
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: [7] } }),
        }),
      );
      expect(result.tasks).toHaveLength(1);
    });

    it('pagination (take) is applied even when search is active', async () => {
      // Pre-query returns 200 candidate IDs
      const candidateIds = Array.from({ length: 200 }, (_, i) => ({ id: i + 1 }));
      const loadedTasks = Array.from({ length: 51 }, (_, i) =>
        makeTask({ id: i + 1, order: i + 1 }),
      );

      const { service, prisma } = makeService({
        task: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce(candidateIds) // name pre-query
            .mockResolvedValueOnce(loadedTasks), // main load (take: 51)
          count: jest.fn().mockResolvedValue(200),
        },
        taskComment: { findMany: jest.fn().mockResolvedValue([]) },
        $queryRaw: jest.fn().mockResolvedValue([]),
      });

      const result = await service.execute({ boardId: 1, search: 'bug', limit: 50 });

      // Main load must have a take limit
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 51 }),
      );
      expect(result.tasks).toHaveLength(50);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('person filter', () => {
    it('uses JSONB @> raw query for numeric user-ID list', async () => {
      const task = makeTask({ id: 3 });
      const { service, prisma } = makeService({
        task: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce([task]), // main load
          count: jest.fn().mockResolvedValue(1),
        },
        $queryRaw: jest.fn().mockResolvedValue([{ rootId: 3 }]), // person pre-query
      });

      await service.execute({ boardId: 1, person: '5,7' });

      // $queryRaw called for person candidates (JSONB @>)
      expect(prisma.$queryRaw).toHaveBeenCalled();

      // Main load restricted to candidate
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: [3] } }),
        }),
      );
    });

    it('returns empty when person filter finds no PERSON-cell matches', async () => {
      const { service, prisma } = makeService({
        task: { findMany: jest.fn() },
        $queryRaw: jest.fn().mockResolvedValue([]),
      });

      const result = await service.execute({ boardId: 1, person: '99' });

      expect(prisma.task.findMany).not.toHaveBeenCalled();
      expect(result.tasks).toHaveLength(0);
    });

    it('intersects search and person candidates (AND semantics)', async () => {
      // search matches IDs [1,2,3,4], person matches IDs [3,4,5,6]
      // result should be [3,4]
      const { service, prisma } = makeService({
        task: {
          findMany: jest
            .fn()
            // name pre-query for search
            .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }])
            // main load with intersection [3,4]
            .mockResolvedValueOnce([makeTask({ id: 3 }), makeTask({ id: 4 })]),
        },
        taskComment: { findMany: jest.fn().mockResolvedValue([]) },
        // person pre-query returns [3,4,5,6]
        $queryRaw: jest
          .fn()
          // cell/file pre-query for search returns nothing extra
          .mockResolvedValueOnce([])
          // person pre-query
          .mockResolvedValueOnce([
            { rootId: 3 },
            { rootId: 4 },
            { rootId: 5 },
            { rootId: 6 },
          ]),
      });

      const result = await service.execute({ boardId: 1, search: 'task', person: '5' });

      // Main load must only receive the intersected IDs
      const mainLoadCall = (prisma.task.findMany as jest.Mock).mock.calls.find(
        call => call[0]?.where?.id,
      );
      const loadedIds = mainLoadCall?.[0]?.where?.id?.in ?? [];
      expect(loadedIds.sort()).toEqual([3, 4]);
      expect(result.tasks).toHaveLength(2);
    });
  });

  describe('permissions', () => {
    it('always scopes to boardId — never returns tasks from other boards', async () => {
      const { service, prisma } = makeService({
        task: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
      });

      await service.execute({ boardId: 42 });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ group: { boardId: 42 } }),
        }),
      );
    });

    it('scopes to groupId when provided', async () => {
      const { service, prisma } = makeService({
        task: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
      });

      await service.execute({ boardId: 1, groupId: 99 });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ groupId: 99 }),
        }),
      );
    });
  });
});

// ── getGroupTasks() ────────────────────────────────────────────────────────

describe('GetBoardTasksService.getGroupTasks', () => {
  it('uses DB-level skip/take in the no-filter fast path', async () => {
    const { service, prisma } = makeService({
      task: { findMany: jest.fn().mockResolvedValue([]) },
    });

    await service.getGroupTasks(1, 10, undefined, undefined, 25, 50);

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 50, take: 26 }),
    );
  });

  it('applies search filter via pre-query and loads only candidates', async () => {
    const task = makeTask({ id: 2 });
    const { service, prisma } = makeService({
      task: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 2 }]) // name pre-query
          .mockResolvedValueOnce([task]),       // main load
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    });

    const result = await service.getGroupTasks(1, 10, 'fix', undefined, 50, 0);

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [2] } }),
      }),
    );
    expect(result.tasks).toHaveLength(1);
  });

  it('returns empty immediately when no group-task candidates found', async () => {
    const { service, prisma } = makeService({
      task: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    });

    const result = await service.getGroupTasks(1, 10, 'xyz', undefined, 50, 0);

    expect(prisma.task.findMany).toHaveBeenCalledTimes(1);
    expect(result.tasks).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });
});
