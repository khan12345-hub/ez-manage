import { Injectable, NotFoundException } from '@nestjs/common';
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

    const board = await this.prisma.board.findUnique({
      where: {
        id: boardId,
      },
      select: {
        id: true,
      },
    });

    if (!board) {
      throw new NotFoundException(`Board with ID ${boardId} not found.`);
    }

    /*
     * When search/person filters are active, we need to fetch enough
     * records to determine the correct paginated result.
     *
     * We cannot simply fetch 50 and then filter because matching
     * records may exist after those 50 records.
     */
    const hasFilters =
      Boolean(search?.trim()) || Boolean(person?.trim());

    const whereBase = {
      parentId: null,
      group: { boardId },
      ...(groupId ? { groupId } : {}),
    };

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({ where: whereBase,

      orderBy: {
        order: 'asc',
      },

      ...(cursor
        ? {
            cursor: {
              id: cursor,
            },
            skip: 1,
          }
        : {}),

      /*
       * Without filters, normal cursor pagination.
       *
       * With filters, fetch all candidates because filtering happens
       * against nested cells/subtasks/files.
       */
      ...(hasFilters
        ? {}
        : {
            take: take + 1,
          }),

      include: {
        _count: {
          select: {
            comments: true,
            subtasks: true,
          },
        },

        createdBy: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },

        cells: {
          orderBy: {
            column: {
              order: 'asc',
            },
          },

          include: {
            column: {
              select: {
                id: true,
                name: true,
                type: true,
                order: true,
                isPrimary: true,

                statusOptions: {
                  where: {
                    isArchived: false,
                  },

                  orderBy: {
                    order: 'asc',
                  },
                },

                permissions: {
                  select: {
                    userId: true,
                    canEdit: true,
                    columnId: true,
                  },
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
          orderBy: {
            order: 'asc',
          },

          include: {
            cells: {
              orderBy: {
                column: {
                  order: 'asc',
                },
              },

              include: {
                column: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                    order: true,
                    isPrimary: true,

                    statusOptions: {
                      where: {
                        isArchived: false,
                      },

                      orderBy: {
                        order: 'asc',
                      },
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
      },
    }),
      this.prisma.task.count({ where: whereBase }),
    ]);

    /*
     * No filters:
     * Keep the efficient database-level cursor pagination.
     */
    if (!hasFilters) {
      const hasMore = tasks.length > take;
      const result = hasMore ? tasks.slice(0, take) : tasks;
      const nextCursor = hasMore ? (result[result.length - 1]?.id ?? null) : null;

      await this.enrichPersonCells(result);

      return { tasks: result, nextCursor, hasMore, total };
    }

    /*
     * Filters active:
     * Use the original search implementation.
     */
    const filteredTasks = this.boardSearchService.filterTasks(tasks, { search, person });
    const result = filteredTasks.slice(0, take);
    const hasMore = filteredTasks.length > take;
    const nextCursor = hasMore ? (result[result.length - 1]?.id ?? null) : null;

    await this.enrichPersonCells(result);

    return { tasks: result, nextCursor, hasMore, total: filteredTasks.length };
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
    const userMap = new Map(users.map((u) => [u.id, u]));

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

  async getGroupTasks(
    boardId: number,
    groupId: number,
    search?: string,
    person?: string,
    limit = 50,
    offset = 0,
  ) {
    const tasks = await this.prisma.task.findMany({
      where: {
        groupId,
        parentId: null,

        group: {
          boardId,
        },
      },

      orderBy: {
        order: 'asc',
      },

      select: {
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
          select: {
            comments: true,
            subtasks: true,
          },
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
                  where: {
                    isArchived: false,
                  },

                  orderBy: {
                    order: 'asc',
                  },
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
          orderBy: {
            order: 'asc',
          },

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
                      where: {
                        isArchived: false,
                      },
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
      },
    });

    const filteredTasks = this.boardSearchService.filterTasks(tasks, {
      search,
      person,
    });

    const paginatedTasks = filteredTasks.slice(
      offset,
      offset + limit,
    );

    const hasMore =
      offset + paginatedTasks.length < filteredTasks.length;

    return {
      tasks: paginatedTasks,
      hasMore,
      nextOffset: offset + paginatedTasks.length,
    };
  }
}