import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ReorderTaskDto } from './dto/reorder-task.dto';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityAction, ActivityEntityType } from 'generated/prisma/client';

type TaskPosition = {
  id: number;
  groupId: number;
  order: number;
  parentId: number | null;
};
@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async create(createTaskDto: CreateTaskDto, userId: number, boardId: number) {
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

      if (group.boardId !== boardId) {
        throw new BadRequestException('Group does not belong to this board.');
      }

      let parentId: number | null = null;

      if (createTaskDto.parentId) {
        const parentTask = await tx.task.findUnique({
          where: {
            id: createTaskDto.parentId,
          },
          select: {
            id: true,
            groupId: true,
            parentId: true,
          },
        });

        if (!parentTask) {
          throw new NotFoundException('Parent task not found.');
        }

        if (parentTask.groupId !== createTaskDto.groupId) {
          throw new BadRequestException(
            'Parent task must belong to the same group.',
          );
        }

        if (parentTask.parentId !== null) {
          throw new BadRequestException(
            'A subtask cannot have another subtask.',
          );
        }

        parentId = parentTask.id;
      }

      const lastTask = await tx.task.findFirst({
        where: {
          groupId: createTaskDto.groupId,
          parentId,
        },
        orderBy: {
          order: 'desc',
        },
        select: {
          order: true,
        },
      });

      const columns = await tx.boardColumn.findMany({
        where: {
          boardId,
          isPrimary: false,
        },
        select: {
          id: true,
        },
        orderBy: {
          order: 'asc',
        },
      });

      const task = await tx.task.create({
        data: {
          groupId: createTaskDto.groupId,
          createdById: userId,
          name: createTaskDto.name,
          parentId,
          order: lastTask ? lastTask.order + ORDER_GAP : ORDER_GAP,

          cells: {
            create: columns.map((column) => ({
              column: {
                connect: {
                  id: column.id,
                },
              },
            })),
          },
        },
        include: {
          cells: true,
        },
      });

      const activityLog = await this.activityLogsService.log(
        {
          boardId,
          groupId: task.groupId,
          taskId: task.id,
          userId,
          entityType: ActivityEntityType.TASK,
          entityId: task.id,
          action: ActivityAction.CREATED,
          metadata: {
            taskName: task.name,
            groupId: task.groupId,
          },
        },
        tx,
      );

      console.log({
        'Activity is being created': activityLog,
      });

      return task;
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

  async reorder(dto: ReorderTaskDto, boardId: number) {
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

    if (task.group.boardId !== boardId) {
      throw new BadRequestException('Task does not belong to this board.');
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
      throw new NotFoundException('Destination group not found.');
    }

    if (destinationGroup.boardId !== boardId) {
      throw new BadRequestException(
        'Destination group does not belong to this board.',
      );
    }

    const destinationParentId = dto.destinationParentId ?? null;

    // Validate destination parent
    if (destinationParentId !== null) {
      const parentTask = await this.prisma.task.findUnique({
        where: {
          id: destinationParentId,
        },
        select: {
          id: true,
          groupId: true,
          parentId: true,
          group: {
            select: {
              boardId: true,
            },
          },
        },
      });

      if (!parentTask) {
        throw new NotFoundException('Destination parent task not found.');
      }

      if (parentTask.groupId !== destinationGroup.id) {
        throw new BadRequestException(
          'Parent task must belong to the destination group.',
        );
      }

      if (parentTask.group.boardId !== boardId) {
        throw new BadRequestException(
          'Parent task does not belong to this board.',
        );
      }

      // Prevent sub-subtasks
      if (parentTask.parentId !== null) {
        throw new BadRequestException('A subtask cannot have another subtask.');
      }

      // Prevent task from becoming its own parent
      if (parentTask.id === task.id) {
        throw new BadRequestException('A task cannot be its own parent.');
      }
    }

    const [previousTask, nextTask] = await Promise.all([
      dto.previousTaskId
        ? this.prisma.task.findUnique({
            where: {
              id: dto.previousTaskId,
            },
            select: {
              id: true,
              groupId: true,
              parentId: true,
              order: true,
            },
          })
        : null,

      dto.nextTaskId
        ? this.prisma.task.findUnique({
            where: {
              id: dto.nextTaskId,
            },
            select: {
              id: true,
              groupId: true,
              parentId: true,
              order: true,
            },
          })
        : null,
    ]);

    if (previousTask) {
      if (
        previousTask.groupId !== destinationGroup.id ||
        previousTask.parentId !== destinationParentId
      ) {
        throw new BadRequestException('Previous task is not a valid sibling.');
      }
    }

    if (nextTask) {
      if (
        nextTask.groupId !== destinationGroup.id ||
        nextTask.parentId !== destinationParentId
      ) {
        throw new BadRequestException('Next task is not a valid sibling.');
      }
    }

    let newOrder: number;

    if (!previousTask && !nextTask) {
      newOrder = 1000;
    } else if (!previousTask && nextTask) {
      newOrder = nextTask.order - 1000;
    } else if (previousTask && !nextTask) {
      newOrder = previousTask.order + 1000;
    } else {
      newOrder = (previousTask!.order + nextTask!.order) / 2;
    }

    await this.prisma.task.update({
      where: {
        id: dto.taskId,
      },
      data: {
        groupId: destinationGroup.id,
        parentId: destinationParentId,
        order: newOrder,
      },
    });

    return {
      message: 'Task reordered successfully.',
    };
  }

  async reorderSubtask(
    subtaskId: number,
    previousTaskId: number | null,
    nextTaskId: number | null,
  ) {
    /*
     * ============================================================
     * 1. Find the subtask being moved
     * ============================================================
     */

    const subtask = await this.prisma.task.findUnique({
      where: {
        id: subtaskId,
      },
      select: {
        id: true,
        groupId: true,
        order: true,
        parentId: true,
      },
    });

    if (!subtask) {
      throw new NotFoundException('Subtask not found');
    }

    /*
     * A task without parentId is a top-level task.
     * This endpoint is specifically for subtasks.
     */

    if (subtask.parentId === null) {
      throw new BadRequestException('The selected task is not a subtask');
    }

    /*
     * ============================================================
     * 2. Get previous sibling
     * ============================================================
     *
     * IMPORTANT:
     * We explicitly check:
     *
     * - Same group
     * - Same parent
     *
     * This prevents a subtask from being moved outside
     * its current parent task.
     */

    let previousTask: TaskPosition | null = null;

    if (previousTaskId !== null) {
      previousTask = await this.prisma.task.findFirst({
        where: {
          id: previousTaskId,
          groupId: subtask.groupId,
          parentId: subtask.parentId,
        },
        select: {
          id: true,
          groupId: true,
          order: true,
          parentId: true,
        },
      });

      if (!previousTask) {
        throw new BadRequestException(
          'Previous task must be a sibling of the subtask',
        );
      }
    }

    /*
     * ============================================================
     * 3. Get next sibling
     * ============================================================
     */

    let nextTask: TaskPosition | null = null;

    if (nextTaskId !== null) {
      nextTask = await this.prisma.task.findFirst({
        where: {
          id: nextTaskId,
          groupId: subtask.groupId,
          parentId: subtask.parentId,
        },
        select: {
          id: true,
          groupId: true,
          order: true,
          parentId: true,
        },
      });

      if (!nextTask) {
        throw new BadRequestException(
          'Next task must be a sibling of the subtask',
        );
      }
    }

    /*
     * ============================================================
     * 4. Prevent invalid neighbor combinations
     * ============================================================
     *
     * The previous and next tasks must also belong to
     * the same parent.
     */

    if (
      previousTask &&
      nextTask &&
      previousTask.parentId !== nextTask.parentId
    ) {
      throw new BadRequestException(
        'Previous and next tasks must belong to the same parent',
      );
    }

    /*
     * ============================================================
     * 5. Calculate new order
     * ============================================================
     *
     * Cases:
     *
     * previous + next:
     *     midpoint
     *
     * previous only:
     *     place after previous
     *
     * next only:
     *     place before next
     *
     * neither:
     *     only subtask / fallback
     */

    let newOrder: number;

    if (previousTask && nextTask) {
      newOrder = (previousTask.order + nextTask.order) / 2;
    } else if (previousTask) {
      newOrder = previousTask.order + 1000;
    } else if (nextTask) {
      newOrder = nextTask.order - 1000;
    } else {
      /*
       * There are no neighbors.
       *
       * Keep the subtask inside its current parent.
       * We simply keep its current order.
       */

      newOrder = subtask.order;
    }

    /*
     * ============================================================
     * 6. Update the subtask
     * ============================================================
     *
     * Notice that we NEVER update:
     *
     * - groupId
     * - parentId
     *
     * Therefore the subtask cannot escape its parent.
     */

    const updatedSubtask = await this.prisma.task.update({
      where: {
        id: subtaskId,
      },
      data: {
        order: newOrder,
      },
      select: {
        id: true,
        groupId: true,
        parentId: true,
        order: true,
        name: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedSubtask;
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
      include: {
        subtasks: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    // if (task.subtasks.length > 0) {
    //   throw new BadRequestException(
    //     'Cannot delete a task that has subtasks. Please delete the subtasks first.',
    //   );
    // }

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
