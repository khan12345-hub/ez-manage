import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { BoardSearchService } from './board-search.service';

interface GetBoardTasksParams {
  boardId: number;
  groupId?: number;
  limit?: number;
  cursor?: number;
  search?: string;
  person?: string;
}

@Injectable()
export class GetBoardTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardSearchService: BoardSearchService,
  ) {}

  async execute({
    boardId,
    groupId,
    limit = 50,
    cursor,
    search,
    person,
  }: GetBoardTasksParams) {
    const take = Math.min(limit, 1000);
    const trimSearch = search?.trim() || undefined;
    const trimPerson = person?.trim() || undefined;
    const hasFilters = Boolean(trimSearch) || Boolean(trimPerson);

    const whereBase: Prisma.TaskWhereInput = {
      parentId: null,
      group: { boardId },
      ...(groupId ? { groupId } : {}),
    };

    if (!hasFilters) {
      // Fast path: no filters — efficient DB-level cursor pagination
      const [tasks, total] = await Promise.all([
        this.prisma.task.findMany({
          where: whereBase,
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          take: take + 1,
          include: this.taskInclude(),
        }),
        this.prisma.task.count({ where: whereBase }),
      ]);

      const hasMore = tasks.length > take;
      const result = hasMore ? tasks.slice(0, take) : tasks;
      const nextCursor = hasMore ? result[result.length - 1]?.id ?? null : null;

      await this.enrichPersonCells(result);
      return { tasks: result, nextCursor, hasMore, total };
    }

    /*
     * Filtered path — two-stage:
     *
     * Stage 1: lightweight pre-queries (IDs only) that cover every matching
     *          surface: task name, subtask name, cell values, file names,
     *          comments, person cells.  Runs in parallel.
     *
     * Stage 2: load only the candidate tasks (bounded by take) with full
     *          includes, then apply JS refinement for edge cases (date
     *          formats, complex cell types).
     */
    const groupScope = groupId
      ? Prisma.sql`AND t."groupId" = ${groupId}`
      : Prisma.empty;

    const [commentIds, nameMatches, cellFileMatches, personMatches] = await Promise.all([
      // Comments that match the search term
      trimSearch
        ? this.fetchCommentMatchedIds(boardId, trimSearch)
        : Promise.resolve(new Set<number>()),

      // Task name or any direct subtask name (Prisma — uses indexes)
      trimSearch
        ? this.prisma.task.findMany({
            where: {
              parentId: null,
              group: { boardId },
              ...(groupId ? { groupId } : {}),
              OR: [
                { name: { contains: trimSearch, mode: 'insensitive' } },
                { subtasks: { some: { name: { contains: trimSearch, mode: 'insensitive' } } } },
              ],
            },
            select: { id: true },
          })
        : Promise.resolve(null as null),

      // Cell values (broad JSONB text cast) + attached file names
      // Returns root task IDs for both tasks and subtasks
      trimSearch
        ? this.prisma.$queryRaw<{ rootId: number }[]>`
            SELECT DISTINCT COALESCE(t."parentId", t.id)::int AS "rootId"
            FROM tasks t
            JOIN groups g ON t."groupId" = g.id
            LEFT JOIN task_cells tc ON tc."taskId" = t.id
            LEFT JOIN task_cell_files tcf ON tcf.cell_id = tc.id
            LEFT JOIN files f ON f.id = tcf.file_id
            WHERE g."boardId" = ${boardId}
            ${groupScope}
            AND (
              (tc.value IS NOT NULL AND tc.value::text ILIKE ${`%${trimSearch}%`})
              OR (f."fileName" ILIKE ${`%${trimSearch}%`})
            )
          `
        : Promise.resolve(null as null),

      // Person filter — JSONB @> for ID lists, text ILIKE for name search
      trimPerson
        ? this.resolvePersonCandidates(boardId, groupId, trimPerson)
        : Promise.resolve(null as null),
    ]);

    // Merge search sub-results into one set (UNION)
    let searchSet: Set<number> | null = null;
    if (trimSearch) {
      searchSet = new Set<number>();
      nameMatches!.forEach(t => searchSet!.add(t.id));
      cellFileMatches!.forEach(r => { if (r.rootId) searchSet!.add(r.rootId); });
      commentIds.forEach(id => searchSet!.add(id));
    }

    // INTERSECT search and person sets (AND semantics)
    let candidateIds: Set<number>;
    if (searchSet !== null && personMatches !== null) {
      const [smaller, larger] =
        searchSet.size <= personMatches.size
          ? [searchSet, personMatches]
          : [personMatches, searchSet];
      candidateIds = new Set([...smaller].filter(id => larger.has(id)));
    } else {
      candidateIds = searchSet ?? personMatches ?? new Set();
    }

    if (candidateIds.size === 0) {
      return { tasks: [], nextCursor: null, hasMore: false, total: 0 };
    }

    // Load only the candidate tasks — bounded by take even with filters
    const tasks = await this.prisma.task.findMany({
      where: { ...whereBase, id: { in: [...candidateIds] } },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: take + 1,
      include: this.taskInclude(),
    });

    // JS refinement: catches date-format matches and cell-type edge cases
    // that the broad JSONB text cast may over-include or miss
    const filteredTasks = this.boardSearchService.filterTasks(tasks, {
      search,
      person,
      commentMatchedTaskIds: commentIds,
    });

    const result = filteredTasks.slice(0, take);
    const hasMore = filteredTasks.length > take;
    const nextCursor = hasMore ? result[result.length - 1]?.id ?? null : null;

    await this.enrichPersonCells(result);

    return {
      tasks: result,
      nextCursor,
      hasMore,
      // candidateIds is a slight over-count (JS filter may remove false
      // positives from broad JSONB text cast), but is an accurate bound
      total: candidateIds.size,
    };
  }

  async getGroupTasks(
    boardId: number,
    groupId: number,
    search?: string,
    person?: string,
    limit = 50,
    offset = 0,
  ) {
    const trimSearch = search?.trim() || undefined;
    const trimPerson = person?.trim() || undefined;
    const hasFilters = Boolean(trimSearch) || Boolean(trimPerson);

    const whereBase: Prisma.TaskWhereInput = {
      groupId,
      parentId: null,
      group: { boardId },
    };

    if (!hasFilters) {
      // Fast path: push skip/take to DB (improved over previous all-then-slice)
      const tasks = await this.prisma.task.findMany({
        where: whereBase,
        orderBy: { order: 'asc' },
        skip: offset,
        take: limit + 1,
        select: this.groupTaskSelect(),
      });

      const hasMore = tasks.length > limit;
      const result = hasMore ? tasks.slice(0, limit) : tasks;
      return { tasks: result, hasMore, nextOffset: offset + result.length };
    }

    // Filtered path: pre-query candidate IDs in parallel
    const groupScope = Prisma.sql`AND t."groupId" = ${groupId}`;

    const [nameMatches, cellFileMatches, personMatches] = await Promise.all([
      trimSearch
        ? this.prisma.task.findMany({
            where: {
              groupId,
              parentId: null,
              group: { boardId },
              OR: [
                { name: { contains: trimSearch, mode: 'insensitive' } },
                { subtasks: { some: { name: { contains: trimSearch, mode: 'insensitive' } } } },
              ],
            },
            select: { id: true },
          })
        : Promise.resolve(null as null),

      trimSearch
        ? this.prisma.$queryRaw<{ rootId: number }[]>`
            SELECT DISTINCT COALESCE(t."parentId", t.id)::int AS "rootId"
            FROM tasks t
            JOIN groups g ON t."groupId" = g.id
            LEFT JOIN task_cells tc ON tc."taskId" = t.id
            LEFT JOIN task_cell_files tcf ON tcf.cell_id = tc.id
            LEFT JOIN files f ON f.id = tcf.file_id
            WHERE g."boardId" = ${boardId}
            ${groupScope}
            AND (
              (tc.value IS NOT NULL AND tc.value::text ILIKE ${`%${trimSearch}%`})
              OR (f."fileName" ILIKE ${`%${trimSearch}%`})
            )
          `
        : Promise.resolve(null as null),

      trimPerson
        ? this.resolvePersonCandidates(boardId, groupId, trimPerson)
        : Promise.resolve(null as null),
    ]);

    let searchSet: Set<number> | null = null;
    if (trimSearch) {
      searchSet = new Set<number>();
      nameMatches!.forEach(t => searchSet!.add(t.id));
      cellFileMatches!.forEach(r => { if (r.rootId) searchSet!.add(r.rootId); });
    }

    let candidateIds: Set<number>;
    if (searchSet !== null && personMatches !== null) {
      const [smaller, larger] =
        searchSet.size <= personMatches.size
          ? [searchSet, personMatches]
          : [personMatches, searchSet];
      candidateIds = new Set([...smaller].filter(id => larger.has(id)));
    } else {
      candidateIds = searchSet ?? personMatches ?? new Set();
    }

    if (candidateIds.size === 0) {
      return { tasks: [], hasMore: false, nextOffset: offset };
    }

    const tasks = await this.prisma.task.findMany({
      where: { ...whereBase, id: { in: [...candidateIds] } },
      orderBy: { order: 'asc' },
      select: this.groupTaskSelect(),
    });

    const filteredTasks = this.boardSearchService.filterTasks(tasks, { search, person });
    const paginatedTasks = filteredTasks.slice(offset, offset + limit);
    const hasMore = offset + paginatedTasks.length < filteredTasks.length;

    return { tasks: paginatedTasks, hasMore, nextOffset: offset + paginatedTasks.length };
  }

  // Resolve PERSON-cell candidate task IDs (JSONB @> for IDs, ILIKE text for names)
  private async resolvePersonCandidates(
    boardId: number,
    groupId: number | undefined,
    person: string,
  ): Promise<Set<number>> {
    const groupScope = groupId
      ? Prisma.sql`AND t."groupId" = ${groupId}`
      : Prisma.empty;

    const isIdList = /^[\d,]+$/.test(person);
    const ids = new Set<number>();

    if (isIdList) {
      const userIds = person.split(',').map(Number).filter(Boolean);
      if (userIds.length === 0) return ids;

      // Each userId gets an @> containment check; joined with OR
      const jsonConditions = Prisma.join(
        userIds.map(
          uid =>
            Prisma.sql`tc.value @> ${JSON.stringify({ users: [{ id: uid }] })}::jsonb`,
        ),
        ' OR ',
      );

      const matches = await this.prisma.$queryRaw<{ rootId: number }[]>`
        SELECT DISTINCT COALESCE(t."parentId", t.id)::int AS "rootId"
        FROM tasks t
        JOIN groups g ON t."groupId" = g.id
        JOIN task_cells tc ON tc."taskId" = t.id
        JOIN board_columns bc ON tc."columnId" = bc.id
        WHERE g."boardId" = ${boardId}
        ${groupScope}
        AND bc.type = 'PERSON'
        AND (${jsonConditions})
      `;

      matches.forEach(r => { if (r.rootId) ids.add(r.rootId); });
    } else {
      // Text person search: broad cast on PERSON cells only
      const matches = await this.prisma.$queryRaw<{ rootId: number }[]>`
        SELECT DISTINCT COALESCE(t."parentId", t.id)::int AS "rootId"
        FROM tasks t
        JOIN groups g ON t."groupId" = g.id
        JOIN task_cells tc ON tc."taskId" = t.id
        JOIN board_columns bc ON tc."columnId" = bc.id
        WHERE g."boardId" = ${boardId}
        ${groupScope}
        AND bc.type = 'PERSON'
        AND tc.value::text ILIKE ${`%${person}%`}
      `;

      matches.forEach(r => { if (r.rootId) ids.add(r.rootId); });
    }

    return ids;
  }

  private async fetchCommentMatchedIds(boardId: number, search: string): Promise<Set<number>> {
    const comments = await this.prisma.taskComment.findMany({
      where: {
        task: { group: { boardId } },
        content: { contains: search, mode: 'insensitive' },
      },
      select: { taskId: true },
    });
    return new Set(comments.map(c => c.taskId));
  }

  private taskInclude() {
    return {
      _count: {
        select: { comments: true, subtasks: true },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      },
      cells: {
        orderBy: { column: { order: 'asc' as const } },
        include: {
          column: {
            select: { id: true, type: true, isPrimary: true },
          },
          files: {
            select: {
              file: {
                select: {
                  id: true,
                  fileName: true,
                  url: true,
                  storageKey: true,
                  mimeType: true,
                  fileSize: true,
                  uploadedById: true,
                },
              },
            },
          },
        },
      },
      subtasks: {
        orderBy: { order: 'asc' as const },
        include: {
          cells: {
            orderBy: { column: { order: 'asc' as const } },
            include: {
              column: {
                select: { id: true, type: true, isPrimary: true },
              },
            },
          },
        },
      },
    };
  }

  private groupTaskSelect() {
    return {
      id: true,
      name: true,
      groupId: true,
      parentId: true,
      order: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      },
      _count: {
        select: { comments: true, subtasks: true },
      },
      cells: {
        include: {
          column: {
            select: {
              id: true,
              name: true,
              type: true,
              order: true,
              isPrimary: true,
              statusOptions: {
                where: { isArchived: false },
                orderBy: { order: 'asc' as const },
              },
            },
          },
          files: {
            select: {
              file: {
                select: {
                  id: true,
                  fileName: true,
                  url: true,
                  storageKey: true,
                  mimeType: true,
                  fileSize: true,
                  uploadedById: true,
                },
              },
            },
          },
        },
      },
      subtasks: {
        orderBy: { order: 'asc' as const },
        include: {
          cells: {
            include: {
              column: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  order: true,
                  isPrimary: true,
                  statusOptions: {
                    where: { isArchived: false },
                  },
                },
              },
              files: {
                select: {
                  file: {
                    select: {
                      id: true,
                      fileName: true,
                      url: true,
                      storageKey: true,
                      mimeType: true,
                      fileSize: true,
                      uploadedById: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
  }

  /**
   * Batch-fetch user details for all PERSON cell values across a task list.
   * Cell values are stored as { users: [{ id }] } — this injects firstName/lastName/avatarUrl
   * so the frontend PersonCell can render avatars without extra requests.
   */
  private async enrichPersonCells(tasks: any[]): Promise<void> {
    const ids = new Set<number>();

    const collect = (cells: any[]) => {
      for (const cell of cells ?? []) {
        if (cell?.column?.type !== 'PERSON') continue;
        const val = cell?.value as any;
        if (Array.isArray(val?.users)) {
          for (const u of val.users) {
            if (u?.id) ids.add(u.id);
          }
        }
      }
    };

    for (const task of tasks) {
      collect(task.cells ?? []);
      for (const sub of task.subtasks ?? []) collect(sub.cells ?? []);
    }

    if (ids.size === 0) return;

    const users = await this.prisma.user.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    const inject = (cells: any[]) => {
      for (const cell of cells ?? []) {
        if (cell?.column?.type !== 'PERSON') continue;
        const val = cell?.value as any;
        if (Array.isArray(val?.users)) {
          cell.value = {
            users: val.users.map((u: any) => ({ ...u, ...(userMap.get(u?.id) ?? {}) })),
          };
        }
      }
    };

    for (const task of tasks) {
      inject(task.cells ?? []);
      for (const sub of task.subtasks ?? []) inject(sub.cells ?? []);
    }
  }
}
