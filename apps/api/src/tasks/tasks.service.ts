import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from 'prisma/prisma.service';

import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ReorderTaskDto } from './dto/reorder-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createTaskDto: CreateTaskDto,
    userId: number,
    boardId: number,
  ) {
    const ORDER_GAP = 1000;

    return this.prisma.$transaction(async (tx) => {
      const group = await tx.group.findUnique({
        where: {
          id: createTaskDto.groupId,
        },
        select: {
          id: true,
          boardId: true,
        },
      });

      if (!group) {
        throw new NotFoundException('Group not found.');
      }

      // Make sure the group belongs to the requested board
      if (group.boardId !== boardId) {
        throw new BadRequestException(
          'Group does not belong to this board.',
        );
      }

      const lastTask = await tx.task.findFirst({
        where: {
          groupId: createTaskDto.groupId,
        },
        orderBy: {
          order: 'desc',
        },
      });

      return tx.task.create({
        data: {
          groupId: createTaskDto.groupId,
          createdById: userId,
          name: createTaskDto.name,
          order: lastTask
            ? lastTask.order + ORDER_GAP
            : ORDER_GAP,
        },
      });
    });
  }

async findOne(taskId: number) {
  const task = await this.prisma.task.findUnique({
    where: {
      id: taskId,
    },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          boardId: true,
        },
      },

      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
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
            },
          },
        },
        orderBy: {
          column: {
            order: 'asc',
          },
        },
      },

      comments: {
        orderBy: {
          createdAt: 'asc',
        },

        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },

          files: true,
        },
      },
    },
  });

  if (!task) {
    throw new NotFoundException('Task not found.');
  }

  return task;
}

  async reorder(
    dto: ReorderTaskDto,
    boardId: number,
  ) {
    const task = await this.prisma.task.findUnique({
      where: {
        id: dto.taskId,
      },
      include: {
        group: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    // Make sure the task belongs to the requested board
    if (task.group.boardId !== boardId) {
      throw new BadRequestException(
        'Task does not belong to this board.',
      );
    }

    const destinationGroup = await this.prisma.group.findUnique({
      where: {
        id: dto.destinationGroupId,
      },
      select: {
        id: true,
        boardId: true,
      },
    });

    if (!destinationGroup) {
      throw new NotFoundException(
        'Destination group not found.',
      );
    }

    // Make sure the destination group belongs to the same board
    if (destinationGroup.boardId !== boardId) {
      throw new BadRequestException(
        'Destination group does not belong to this board.',
      );
    }

    const [previousTask, nextTask] = await Promise.all([
      dto.previousTaskId
        ? this.prisma.task.findUnique({
            where: {
              id: dto.previousTaskId,
            },
            include: {
              group: {
                select: {
                  boardId: true,
                },
              },
            },
          })
        : Promise.resolve(null),

      dto.nextTaskId
        ? this.prisma.task.findUnique({
            where: {
              id: dto.nextTaskId,
            },
            include: {
              group: {
                select: {
                  boardId: true,
                },
              },
            },
          })
        : Promise.resolve(null),
    ]);

    if (
      previousTask &&
      previousTask.group.boardId !== boardId
    ) {
      throw new BadRequestException(
        'Previous task does not belong to this board.',
      );
    }

    if (
      nextTask &&
      nextTask.group.boardId !== boardId
    ) {
      throw new BadRequestException(
        'Next task does not belong to this board.',
      );
    }

    let newOrder: number;

    // Empty group
    if (!previousTask && !nextTask) {
      newOrder = 1000;
    }

    // First task
    else if (!previousTask && nextTask) {
      newOrder = nextTask.order - 1000;
    }

    // Last task
    else if (previousTask && !nextTask) {
      newOrder = previousTask.order + 1000;
    }

    // Between two tasks
    else {
      newOrder =
        (previousTask!.order + nextTask!.order) / 2;
    }

    await this.prisma.task.update({
      where: {
        id: dto.taskId,
      },
      data: {
        groupId: dto.destinationGroupId,
        order: newOrder,
      },
    });

    return {
      message: 'Task reordered successfully.',
    };
  }

  async update(
    taskId: number,
    dto: UpdateTaskDto,
  ) {
    const task = await this.prisma.task.findUnique({
      where: {
        id: taskId,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    return this.prisma.task.update({
      where: {
        id: taskId,
      },
      data: dto,
    });
  }

  async remove(taskId: number) {
    const task = await this.prisma.task.findUnique({
      where: {
        id: taskId,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    await this.prisma.task.delete({
      where: {
        id: taskId,
      },
    });

    return {
      message: 'Task deleted successfully.',
    };
  }
}