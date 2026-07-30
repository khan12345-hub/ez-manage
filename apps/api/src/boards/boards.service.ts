import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'prisma/prisma.service';

import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';

import {
  BoardColumnType,
  BoardMemberRole,
  WorkspaceMemberRole,
} from 'generated/prisma/enums';

import { getDefaultCellValue } from './defaults/default-cell-value.template';

import {
  DEFAULT_COLUMNS,
  DEFAULT_GROUPS,
  DEFAULT_STATUS_OPTIONS,
} from './defaults/default-board.template';

@Injectable()
export class BoardsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createBoardDto: CreateBoardDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const existingBoard = await tx.board.findFirst({
        where: {
          workspaceId: createBoardDto.workspaceId,
          name: createBoardDto.name.trim(),
        },
        select: {
          id: true,
        },
      });

      if (existingBoard) {
        throw new ConflictException(
          'A board with this name already exists in this workspace.',
        );
      }

      const board = await tx.board.create({
        data: {
          name: createBoardDto.name.trim(),
          workspaceId: createBoardDto.workspaceId,
          visibility: createBoardDto.visibility ?? 'PUBLIC',
          createdById: userId,

          members: {
            create: {
              userId,
              role: BoardMemberRole.OWNER,
            },
          },
        },
      });

      const user = await tx.user.findUniqueOrThrow({
        where: {
          id: userId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      });

      const columns = await tx.boardColumn.createManyAndReturn({
        data: DEFAULT_COLUMNS.map((column, index) => ({
          boardId: board.id,
          name: column.name,
          type: column.type,
          isPrimary: column.isPrimary,
          order: (index + 1) * 1000,
        })),
      });

      const statusColumn = columns.find(
        (column) => column.type === BoardColumnType.STATUS,
      );

      if (!statusColumn) {
        throw new InternalServerErrorException(
          'Default status column was not created.',
        );
      }

      const statusOptions = await tx.statusOption.createManyAndReturn({
        data: DEFAULT_STATUS_OPTIONS.map((status) => ({
          columnId: statusColumn.id,
          label: status.label,
          color: status.color,
          order: status.order,
        })),
      });

      for (const groupTemplate of DEFAULT_GROUPS) {
        const group = await tx.group.create({
          data: {
            boardId: board.id,
            name: groupTemplate.name,
            color: groupTemplate.color,
            order: groupTemplate.order * 1000,
            createdById: userId,
          },
        });

        const tasks = await tx.task.createManyAndReturn({
          data: groupTemplate.tasks.map((task, index) => ({
            groupId: group.id,
            name: task.title,
            order: (index + 1) * 1000,
            createdById: userId,
          })),
        });

        await tx.taskCell.createMany({
          data: tasks.flatMap((task, index) =>
            columns
              .filter((column) => !column.isPrimary)
              .map((column) => ({
                taskId: task.id,
                columnId: column.id,
                value: getDefaultCellValue(
                  column.type,
                  groupTemplate.tasks[index],
                  user,
                  statusOptions,
                ),
              })),
          ),
        });
      }

      return tx.board.findUniqueOrThrow({
        where: {
          id: board.id,
        },

        include: {
          columns: {
            orderBy: {
              order: 'asc',
            },

            include: {
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

          groups: {
            orderBy: {
              order: 'asc',
            },

            include: {
              tasks: {
                orderBy: {
                  order: 'asc',
                },

                include: {
                  cells: {
                    include: {
                      column: {
                        include: {
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
                    },

                    orderBy: {
                      column: {
                        order: 'asc',
                      },
                    },
                  },
                },
              },
            },
          },

          members: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });
    });
  }

  async findAll(workspaceId: number, userId: number) {
    const workspaceMember = await this.prisma.workspaceMember.findUniqueOrThrow(
      {
        where: {
          workspaceId_userId: {
            workspaceId,
            userId,
          },
        },

        select: {
          role: true,
        },
      },
    );

    const isWorkspaceAdmin =
      workspaceMember.role === WorkspaceMemberRole.OWNER ||
      workspaceMember.role === WorkspaceMemberRole.ADMIN;

    const boards = await this.prisma.board.findMany({
      where: {
        workspaceId,

        ...(isWorkspaceAdmin
          ? {}
          : {
              members: {
                some: {
                  userId,
                },
              },
            }),
      },

      include: {
        members: {
          where: {
            userId,
          },

          select: {
            role: true,
          },
        },
      },

      orderBy: {
        createdAt: 'asc',
      },
    });

    return boards.map((board) => ({
      id: board.id,
      name: board.name,
      visibility: board.visibility,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,

      role:
        board.members[0]?.role ??
        (isWorkspaceAdmin ? BoardMemberRole.OWNER : null),
    }));
  }

  async findOne(id: number, search?: string) {
    const board = await this.prisma.board.findUnique({
      where: {
        id,
      },

      include: {
        columns: {
          orderBy: {
            order: 'asc',
          },

          include: {
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

        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },

        groups: {
          orderBy: {
            order: 'asc',
          },

          include: {
            tasks: {
              where: {
                parentId: null,
              },

              orderBy: {
                order: 'asc',
              },

              include: {
                _count: {
                  select: {
                    comments: true,
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
                      include: {
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
                            mimeType: true,
                            fileSize: true,
                            storageKey: true,
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
                          include: {
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
                                mimeType: true,
                                fileSize: true,
                                storageKey: true,
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
            },
          },
        },
      },
    });

    if (!board) {
      throw new NotFoundException(`Board with ID ${id} not found.`);
    }

    const searchTerm = search?.trim().toLowerCase();

    const groups = board.groups
      .map((group) => {
        const tasks = group.tasks
          .filter((task) => {
            if (!searchTerm) {
              return true;
            }

            return this.taskMatchesSearch(task, searchTerm);
          })
          .map((task) => ({
            ...task,

            cells: (task.cells ?? []).map((cell) => ({
              ...cell,

              files: (cell.files ?? []).map(({ file }) => file),
            })),

            subtasks: (task.subtasks ?? []).map((subtask) => ({
              ...subtask,

              cells: (subtask.cells ?? []).map((cell) => ({
                ...cell,

                files: (cell.files ?? []).map(({ file }) => file),
              })),
            })),
          }));

        const groupNameMatches =
          searchTerm && group.name?.trim().toLowerCase().includes(searchTerm);

        if (searchTerm && !groupNameMatches && tasks.length === 0) {
          return null;
        }

        return {
          ...group,

          tasks: groupNameMatches
            ? group.tasks.map((task) => ({
                ...task,

                cells: (task.cells ?? []).map((cell) => ({
                  ...cell,

                  files: (cell.files ?? []).map(({ file }) => file),
                })),

                subtasks: (task.subtasks ?? []).map((subtask) => ({
                  ...subtask,

                  cells: (subtask.cells ?? []).map((cell) => ({
                    ...cell,

                    files: (cell.files ?? []).map(({ file }) => file),
                  })),
                })),
              }))
            : tasks,
        };
      })
      .filter(Boolean);

    return {
      ...board,
      groups,
    };
  }

  private taskMatchesSearch(task: any, search: string): boolean {
    const taskNameMatches = task.name?.trim().toLowerCase().includes(search);

    if (taskNameMatches) {
      return true;
    }

    return task.cells.some((cell) => {
      const columnType = cell.column.type;

      if (columnType === BoardColumnType.STATUS) {
        const statusValue = cell.value as {
          label?: string;
          color?: string;
        } | null;

        return (
          statusValue?.label?.trim().toLowerCase().includes(search) ?? false
        );
      }

      if (columnType === BoardColumnType.PERSON) {
        const personValue = cell.value as {
          users?: {
            id?: number;
            role?: string;
            email?: string;
            firstName?: string;
            lastName?: string;
            avatarUrl?: string | null;
          }[];
        } | null;

        if (!personValue?.users?.length) {
          return false;
        }

        return personValue.users.some((person) => {
          const firstName = person.firstName?.trim().toLowerCase() ?? '';

          const lastName = person.lastName?.trim().toLowerCase() ?? '';

          const email = person.email?.trim().toLowerCase() ?? '';

          const fullName = `${firstName} ${lastName}`.trim();

          return (
            firstName.includes(search) ||
            lastName.includes(search) ||
            fullName.includes(search) ||
            email.includes(search)
          );
        });
      }

      return false;
    });
  }

  async update(id: number, updateBoardDto: UpdateBoardDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const board = await tx.board.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          name: true,
          workspaceId: true,
        },
      });

      if (!board) {
        throw new NotFoundException('Board not found.');
      }

      // Prevent duplicate board names
      // within the same workspace
      if (updateBoardDto.name && updateBoardDto.name.trim() !== board.name) {
        const existing = await tx.board.findFirst({
          where: {
            workspaceId: board.workspaceId,

            name: updateBoardDto.name.trim(),

            NOT: {
              id,
            },
          },
        });

        if (existing) {
          throw new ConflictException(
            'A board with this name already exists in this workspace.',
          );
        }
      }

      return tx.board.update({
        where: {
          id,
        },

        data: {
          ...(updateBoardDto.name !== undefined && {
            name: updateBoardDto.name.trim(),
          }),

          ...(updateBoardDto.visibility !== undefined && {
            visibility: updateBoardDto.visibility,
          }),

          updatedById: userId,
        },

        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });
    });
  }

  async remove(id: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const board = await tx.board.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          workspaceId: true,
        },
      });

      if (!board) {
        throw new NotFoundException('Board not found.');
      }

      // Delete related records if
      // cascade is not configured
      await tx.boardMember.deleteMany({
        where: {
          boardId: id,
        },
      });

      await tx.invitationBoard.deleteMany({
        where: {
          boardId: id,
        },
      });

      return tx.board.delete({
        where: {
          id,
        },
      });
    });
  }

  async findMembers(boardId: number, userId: number, search?: string) {
    const members = await this.prisma.boardMember.findMany({
      where: {
        boardId,

        ...(search?.trim()
          ? {
              user: {
                OR: [
                  {
                    firstName: {
                      contains: search.trim(),
                      mode: 'insensitive',
                    },
                  },

                  {
                    lastName: {
                      contains: search.trim(),
                      mode: 'insensitive',
                    },
                  },

                  {
                    email: {
                      contains: search.trim(),
                      mode: 'insensitive',
                    },
                  },
                ],
              },
            }
          : {}),
      },

      select: {
        role: true,

        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },

      orderBy: {
        user: {
          firstName: 'asc',
        },
      },
    });

    return members.map((member) => ({
      id: member.user.id,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      email: member.user.email,
      avatarUrl: member.user.avatarUrl,
      role: member.role,
    }));
  }

  async searchBoardTasks(boardId: number, query: string, userId: number) {
    const search = query.trim().toLowerCase();

    if (!search) {
      return [];
    }

    const board = await this.prisma.board.findFirst({
      where: {
        id: boardId,
        OR: [
          {
            createdById: userId,
          },
          {
            members: {
              some: {
                userId,
              },
            },
          },
          {
            workspace: {
              members: {
                some: {
                  userId,
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

    if (!board) {
      throw new NotFoundException('Board not found.');
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        group: {
          boardId,
        },
      },
      orderBy: {
        order: 'asc',
      },
      include: {
        group: true,

        cells: {
          include: {
            column: {
              include: {
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
          },
          orderBy: {
            column: {
              order: 'asc',
            },
          },
        },
      },
    });

    return tasks.filter((task) => {
      const taskNameMatches = task.name?.trim().toLowerCase().includes(search);

      if (taskNameMatches) {
        return true;
      }

      return task.cells.some((cell) => {
        const columnType = cell.column.type;

        if (columnType === BoardColumnType.STATUS) {
          const statusValue = cell.value as {
            label?: string;
            color?: string;
          } | null;

          if (!statusValue?.label) {
            return false;
          }

          return statusValue.label.trim().toLowerCase().includes(search);
        }

        if (columnType === BoardColumnType.PERSON) {
          const personValue = cell.value as {
            users?: {
              id?: number;
              role?: string;
              email?: string;
              firstName?: string;
              lastName?: string;
              avatarUrl?: string | null;
            }[];
          } | null;

          if (!personValue?.users?.length) {
            return false;
          }

          return personValue.users.some((person) => {
            const firstName = person.firstName?.trim().toLowerCase() ?? '';
            const lastName = person.lastName?.trim().toLowerCase() ?? '';
            const email = person.email?.trim().toLowerCase() ?? '';

            return (
              firstName.includes(search) ||
              lastName.includes(search) ||
              email.includes(search)
            );
          });
        }

        return false;
      });
    });
  }
}
