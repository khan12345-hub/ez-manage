import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { SearchDto } from './dto/global-search.dto';
import { BoardSearchService } from 'src/boards/board-search.service';

@Injectable()
export class GlobalSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardSearchService: BoardSearchService,
  ) {}
  private async getAccessibleBoardIds(userId: number) {
    const boards = await this.prisma.boardMember.findMany({
      where: {
        userId,
      },
      select: {
        boardId: true,
      },
    });

    return boards.map((b) => b.boardId);
  }

  private async searchTasks(query: string, boardIds: number[], limit: number) {
    const boards = await this.boardSearchService.findBoardsWithTasks(boardIds);

    const matchedBoards: Array<(typeof boards)[number]> = [];
    let count = 0;

    for (const board of boards) {
      const matchedGroups: Array<(typeof board.groups)[number]> = [];

      for (const group of board.groups) {
        const matchedTasks = this.boardSearchService.filterTasks(group.tasks, {
          search: query,
        });

        if (!matchedTasks.length) continue;

        matchedGroups.push({
          ...group,
          tasks: matchedTasks,
        });

        count += matchedTasks.length;

        if (count >= limit) break;
      }

      if (matchedGroups.length) {
        matchedBoards.push({
          ...board,
          groups: matchedGroups,
        });
      }

      if (count >= limit) break;
    }

    console.log({matchedBoards})
    return matchedBoards;

  }
  private searchBoards(query: string, boardIds: number[], limit: number) {
    return this.prisma.board.findMany({
      where: {
        id: {
          in: boardIds,
        },

        name: {
          contains: query,
          mode: 'insensitive',
        },
      },

      take: limit,
    });
  }
  private searchGroups(query: string, boardIds: number[], limit: number) {
    return this.prisma.group.findMany({
      where: {
        boardId: {
          in: boardIds,
        },

        name: {
          contains: query,
          mode: 'insensitive',
        },
      },

      include: {
        board: true,
      },

      take: limit,
    });
  }

  private async searchUsers(query: string, boardIds: number[], limit: number) {
    const workspaceIds = await this.prisma.board.findMany({
      where: {
        id: {
          in: boardIds,
        },
      },

      select: {
        workspaceId: true,
      },
    });

    return this.prisma.user.findMany({
      where: {
        workspaceMemberships: {
          some: {
            workspaceId: {
              in: workspaceIds.map((w) => w.workspaceId),
            },
          },
        },

        OR: [
          {
            firstName: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            lastName: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            email: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },

      take: limit,

      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
      },
    });
  }
  private searchFiles(query: string, boardIds: number[], limit: number) {
    return this.prisma.file.findMany({
      where: {
        fileName: {
          contains: query,
          mode: 'insensitive',
        },

        OR: [
          {
            cells: {
              some: {
                cell: {
                  task: {
                    group: {
                      boardId: {
                        in: boardIds,
                      },
                    },
                  },
                },
              },
            },
          },

          {
            comments: {
              some: {
                comment: {
                  task: {
                    group: {
                      boardId: {
                        in: boardIds,
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },

      take: limit,
    });
  }
  async search(userId: number, dto: SearchDto) {
    const query = dto.q.trim();

    if (!query) {
      return {
        tasks: [],
        boards: [],
        groups: [],
        users: [],
        files: [],
      };
    }

    const boardIds = await this.getAccessibleBoardIds(userId);

    const limit = dto.limit ?? 5;

    switch (dto.type) {
      case 'tasks':
        return {
          boards: await this.searchTasks(query, boardIds, limit),
        };

      case 'boards':
        return {
          boards: await this.searchBoards(query, boardIds, limit),
        };

      case 'groups':
        return {
          groups: await this.searchGroups(query, boardIds, limit),
        };

      case 'users':
        return {
          users: await this.searchUsers(query, boardIds, limit),
        };

      case 'files':
        return {
          files: await this.searchFiles(query, boardIds, limit),
        };

      default:
        const [tasks, boards, groups, users, files] = await Promise.all([
          this.searchTasks(query, boardIds, limit),
          this.searchBoards(query, boardIds, limit),
          this.searchGroups(query, boardIds, limit),
          this.searchUsers(query, boardIds, limit),
          this.searchFiles(query, boardIds, limit),
        ]);

        return {
          tasks,
          boards,
          groups,
          users,
          files,
        };
    }
  }
}
