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

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}
  create(createBoardDto: CreateBoardDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.board.findFirst({
        where: {
          workspaceId: createBoardDto.workspaceId,
          name: createBoardDto.name,
        },
      });

      if (existing) {
        throw new ConflictException('Board with this name already exists.');
      }

      const board = await tx.board.create({
        data: {
          name: createBoardDto.name,
          workspaceId: createBoardDto.workspaceId,
          visibility: createBoardDto.visibility ?? 'PRIVATE',
          createdById: userId,

          members: {
            create: {
              userId,
            },
          },
        },
      });

      const columns = await tx.boardColumn.createManyAndReturn({
        data: [
          {
            boardId: board.id,
            name: 'Task',
            type: 'TEXT',
            order: 1000,
          },
          {
            boardId: board.id,
            name: 'Status',
            type: 'STATUS',
            order: 2000,
          },
          {
            boardId: board.id,
            name: 'Person',
            type: 'PERSON',
            order: 3000,
          },
          {
            boardId: board.id,
            name: 'Due Date',
            type: 'DATE',
            order: 4000,
          },
        ],
      });

      const group = await tx.group.create({
        data: {
          boardId: board.id,
          name: 'New Group',
          color: '#4F46E5',
          order: 1000,
          createdById: userId,
        },
      });

      const tasks = await tx.task.createManyAndReturn({
        data: [
          {
            groupId: group.id,
            order: 1000,
            createdById: userId,
          },
          {
            groupId: group.id,
            order: 2000,
            createdById: userId,
          },
          {
            groupId: group.id,
            order: 3000,
            createdById: userId,
          },
        ],
      });

      const taskColumn = columns.find((c) => c.type === 'TEXT');

      await tx.taskCell.createMany({
        data: tasks.flatMap((task, index) =>
          columns.map((column) => ({
            taskId: task.id,
            columnId: column.id,
            value:
              column.type === 'TEXT'
                ? {
                    text: index === 0 ? 'New Task' : '',
                  }
                : column.type === 'STATUS'
                  ? {
                      label: 'Not Started',
                      color: 'gray',
                    }
                  : column.type === 'PERSON'
                    ? {}
                    : column.type === 'DATE'
                      ? {}
                      : {},
          })),
        ),
      });

      return tx.board.findUniqueOrThrow({
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
    });
  }

  async findAll(workspaceId: number, userId: number) {
    // const workspace = await this.prisma.workspaceMember.findFirst({
    //   where: {
    //     workspaceId,
    //     userId,
    //   },
    // });
    // if (!workspace) {
    //   throw new ForbiddenException();
    // }

    const workspace = await this.workspaceAccess.getWorkspaceMember(
      workspaceId,
      userId,
    );

    const boards = await this.prisma.board.findMany({
      where: {
        workspaceId,
        members: {
          some: {
            userId,
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
      role: workspace.role,
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

  update(id: number, updateBoardDto: UpdateBoardDto) {
    return this.prisma.board.update({
      where: { id },
      data: {
        name: updateBoardDto.name,
        visibility: updateBoardDto.visibility,
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
  }

  async remove(id: number) {
    // Delete all board members first
    await this.prisma.boardMember.deleteMany({
      where: { boardId: id },
    });

    // Delete all invitation boards
    await this.prisma.invitationBoard.deleteMany({
      where: { boardId: id },
    });

    // Finally delete the board
    return this.prisma.board.delete({
      where: { id },
    });
  }
}
