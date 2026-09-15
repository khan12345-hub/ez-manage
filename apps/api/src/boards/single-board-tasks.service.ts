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
    const take = Math.min(limit, 100);

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

    const tasks = await this.prisma.task.findMany({
      where: {
        parentId: null,

        group: {
          boardId,
        },

        ...(groupId
          ? {
              groupId,
            }
          : {}),
      },

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
    });

    /*
     * No filters:
     * Keep the efficient database-level cursor pagination.
     */
    if (!hasFilters) {
      const hasMore = tasks.length > take;

      const result = hasMore ? tasks.slice(0, take) : tasks;

      const nextCursor = hasMore
        ? (result[result.length - 1]?.id ?? null)
        : null;

      return {
        tasks: result,
        nextCursor,
        hasMore,
      };
    }

    /*
     * Filters active:
     * Use the original search implementation.
     */
    const filteredTasks = this.boardSearchService.filterTasks(tasks, {
      search,
      person,
    });

    const result = filteredTasks.slice(0, take);

    const hasMore = filteredTasks.length > take;

    const nextCursor = hasMore
      ? (result[result.length - 1]?.id ?? null)
      : null;

    return {
      tasks: result,
      nextCursor,
      hasMore,
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