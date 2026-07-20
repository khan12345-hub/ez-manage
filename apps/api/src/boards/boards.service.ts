import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { PrismaService } from 'prisma/prisma.service';
import { WorkspaceAccessService } from 'src/workspace/workspace-access.service';
import { BoardAccessService } from './board-access.service';
import { getDefaultCellValue } from './defaults/default-cell-value.template';
import {
  DEFAULT_COLUMNS,
  DEFAULT_GROUPS,
} from './defaults/default-board.template';
import { BoardRole } from 'generated/prisma/enums';

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccess: WorkspaceAccessService,
    private readonly boardAccess: BoardAccessService,
  ) {}
  create(createBoardDto: CreateBoardDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const board = await tx.board.create({
        data: {
          name: createBoardDto.name,
          workspaceId: createBoardDto.workspaceId,
          visibility: createBoardDto.visibility ?? 'PUBLIC',
          createdById: userId,
          members: {
            create: {
              userId,
              role: BoardRole.OWNER,
            },
          },
        },
      });

      const user = await this.prisma.user.findUniqueOrThrow({
        where: {
          id: userId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      });

      // Create default columns
      const columns = await tx.boardColumn.createManyAndReturn({
        data: DEFAULT_COLUMNS.map((column, index) => ({
          boardId: board.id,
          name: column.name,
          type: column.type,
          isPrimary: column.isPrimary,
          order: (index + 1) * 1000,
        })),
      });

      // Create groups, tasks and cells
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
            name: task.title, // <-- Store task title here
            order: (index + 1) * 1000,
            createdById: userId,
          })),
        });

        await tx.taskCell.createMany({
          data: tasks.flatMap((task, index) =>
            columns
              .filter((column) => !column.isPrimary) // or column.kind !== ColumnKind.TASK_NAME
              .map((column) => ({
                taskId: task.id,
                columnId: column.id,
                value: getDefaultCellValue(
                  column.type,
                  groupTemplate.tasks[index],
                  user,
                ),
              })),
          ),
        });
      }
      const member = await tx.boardMember.findFirst({
        where: {
          boardId: board.id,
          userId,
        },
      });

      
      const userBoards = tx.board.findUniqueOrThrow({
        where: {
          id: board.id,
        },
        include: {
          columns: {
            orderBy: {
              order: 'asc',
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
                      column: true,
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

      return userBoards
    });
  }

  async findAll(workspaceId: number, userId: number) {
;

    const boards = await this.prisma.board.findMany({
    where: {
      workspaceId,
      members: {
        some: {
          userId,
        },
      },
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
  });

    if (!boards) {
      throw new ForbiddenException();
    }
    
    return boards.map((board) => ({
      id: board.id,
      name: board.name,
      role: board.members[0]?.role,
    }));
  }

  async findOne(id: number) {
    try {
      const board = await this.prisma.board.findUnique({
        where: { id },
        include: {
          columns: {
            orderBy: {
              order: 'asc',
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
        },
      });

      if (!board) {
        throw new NotFoundException(`Board with ID ${id} not found.`);
      }

      return board;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'An error occurred while retrieving the board.',
      );
    }
  }
  async update(id: number, updateBoardDto: UpdateBoardDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const board = await tx.board.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          workspaceId: true,
        },
      });

      if (!board) {
        throw new NotFoundException('Board not found.');
      }

      await this.boardAccess.requireEditor(board.id, userId);

      // Prevent duplicate board names within the same workspace
      if (updateBoardDto.name && updateBoardDto.name !== board.name) {
        const existing = await tx.board.findFirst({
          where: {
            workspaceId: board.workspaceId,
            name: updateBoardDto.name,
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
        where: { id },
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
        where: { id },
        select: {
          id: true,
          workspaceId: true,
        },
      });

      if (!board) {
        throw new NotFoundException('Board not found.');
      }

      await this.boardAccess.requireEditor(board.id, userId);

      // Delete related data if not using Cascade
      await tx.boardMember.deleteMany({
        where: { boardId: id },
      });

      await tx.invitationBoard.deleteMany({
        where: { boardId: id },
      });

      return tx.board.delete({
        where: { id },
      });
    });
  }

  async findMembers(boardId: number, userId: number, search?: string) {
    await this.boardAccess.requireViewer(boardId, userId);

    return this.prisma.boardMember
      .findMany({
        where: {
          boardId,
          ...(search
            ? {
                user: {
                  OR: [
                    {
                      firstName: {
                        contains: search,
                        mode: 'insensitive',
                      },
                    },
                    {
                      lastName: {
                        contains: search,
                        mode: 'insensitive',
                      },
                    },
                    {
                      email: {
                        contains: search,
                        mode: 'insensitive',
                      },
                    },
                  ],
                },
              }
            : {}),
        },
        select: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true, // change to avatar if that's your field
            },
          },
        },
        orderBy: {
          user: {
            firstName: 'asc',
          },
        },
      })
      .then((members) =>
        members.map((member) => ({
          id: member.user.id,
          firstName: member.user.firstName,
          lastName: member.user.lastName,
          email: member.user.email,
          avatarUrl: member.user.avatarUrl,
        })),
      );
  }
}
