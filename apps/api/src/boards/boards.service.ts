import {
  BadRequestException,
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
import { BoardSearchService } from './board-search.service';

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardSearchService: BoardSearchService,
  ) {}

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

      if (createBoardDto.templateId) {
        const template = await tx.boardTemplate.findUnique({
          where: {
            id: createBoardDto.templateId,
          },
          include: {
            groups: {
              orderBy: {
                position: 'asc',
              },
              include: {
                columns: {
                  orderBy: {
                    position: 'asc',
                  },
                },
              },
            },
          },
        });

        if (!template) {
          throw new NotFoundException('Board template not found.');
        }

        const templateColumns = template.groups.flatMap(
          (group) => group.columns,
        );

        const uniqueColumns = Array.from(
          new Map(
            templateColumns.map((column) => [column.id, column]),
          ).values(),
        );

        const columns = await tx.boardColumn.createManyAndReturn({
          data: uniqueColumns.map((column) => ({
            boardId: board.id,
            name: column.name,
            type: column.isPrimary ? BoardColumnType.TEXT : column.type,
            isPrimary: column.isPrimary,
            order: column.position,
          })),
        });

        const columnMap = new Map(
          columns.map((column) => [column.name, column]),
        );

        for (const templateColumn of uniqueColumns) {
          const boardColumn = columnMap.get(templateColumn.name);

          if (!boardColumn) {
            continue;
          }

          if (
            templateColumn.type === BoardColumnType.STATUS &&
            templateColumn.options
          ) {
            const options = templateColumn.options as {
              statusOptions?: Array<{
                id: string;
                label: string;
                color: string;
                order: number;
              }>;
            };

            if (options.statusOptions?.length) {
              await tx.statusOption.createMany({
                data: options.statusOptions.map((option) => ({
                  columnId: boardColumn.id,
                  label: option.label,
                  color: option.color,
                  order: option.order,
                })),
              });
            }
          }
        }

        for (const templateGroup of template.groups) {
          await tx.group.create({
            data: {
              boardId: board.id,
              name: templateGroup.name,
              color: templateGroup.color,
              order: templateGroup.position,
              createdById: userId,
            },
          });
        }
      } else {
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

  async findOne(id: number, userId?: number) {
    const board = await this.prisma.board.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        workspaceId: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,

        form: true,

        columns: {
          orderBy: {
            order: 'asc',
          },
          select: {
            id: true,
            name: true,
            type: true,
            order: true,
            isPrimary: true,
            accessControlEnabled: true,

            statusOptions: {
              where: {
                isArchived: false,
              },
              orderBy: {
                order: 'asc',
              },
              select: {
                id: true,
                label: true,
                color: true,
                order: true,
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

        members: {
          select: {
            id: true,
            role: true,
            userId: true,
            accessAllGroups: true,
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
          select: {
            id: true,
            name: true,
            color: true,
            order: true,
          },
        },
      },
    });

    if (!board) {
      throw new NotFoundException(`Board with ID ${id} not found.`);
    }

    let groups = board.groups;

    if (userId) {
      const boardMember = board.members.find((m) => m.userId === userId);
      if (boardMember && !(boardMember as any).accessAllGroups) {
        const allowedAccess = await this.prisma.boardMemberGroupAccess.findMany({
          where: { boardMemberId: boardMember.id },
          select: { groupId: true },
        });
        const allowedGroupIds = new Set(allowedAccess.map((a) => a.groupId));
        groups = groups.filter((g) => allowedGroupIds.has(g.id));
      }
    }

    return {
      ...board,
      groups,
      views: [
        {
          id: 'main',
          name: 'Main table',
          type: 'table',
        },
        ...(board.form
          ? [
              {
                id: 'form',
                name: 'Form',
                type: 'form',
              },
            ]
          : []),
      ],
    };
  }

  async getGroupList(boardId: number) {
    return this.prisma.group.findMany({
      where: { boardId },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, color: true },
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
}
