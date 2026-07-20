import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ReorderTaskDto } from './dto/reorder-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTaskDto: CreateTaskDto, userId: number) {
    const ORDER_GAP = 1000;

    return this.prisma.$transaction(async (tx) => {
      const group = await tx.group.findUnique({
        where: {
          id: createTaskDto.groupId,
        },
      });

      if (!group) {
        throw new NotFoundException('Group not found.');
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
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    return task;
  }

  async reorder(dto: ReorderTaskDto) {
    const task = await this.prisma.task.findUnique({
      where: {
        id: dto.taskId,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    const [previousTask, nextTask] = await Promise.all([
      dto.previousTaskId
        ? this.prisma.task.findUnique({
            where: {
              id: dto.previousTaskId,
            },
          })
        : Promise.resolve(null),

      dto.nextTaskId
        ? this.prisma.task.findUnique({
            where: {
              id: dto.nextTaskId,
            },
          })
        : Promise.resolve(null),
    ]);

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

  async update(taskId: number, dto: UpdateTaskDto) {
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