import { PrismaService } from 'prisma/prisma.service';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TaskPosition } from './task-position.types';
import { ReorderTaskDto } from './dto/reorder-task.dto';

@Injectable()
export class TaskReorderService {
  constructor(private readonly prisma: PrismaService) {}

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

      // Prevent 3 levels: a task that has subtasks cannot become a subtask
      const childCount = await this.prisma.task.count({
        where: { parentId: task.id },
      });
      if (childCount > 0) {
        throw new BadRequestException(
          'A task that has subtasks cannot be made a subtask.',
        );
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
      let prevOrder = previousTask!.order;
      let nextOrder = nextTask!.order;
      // Repeated midpoint inserts eventually leave no room between the two
      // neighbours (equal/duplicate orders). Renumber the siblings first.
      if (nextOrder - prevOrder < 0.001) {
        const renumbered = await this.rebalanceSiblings(
          destinationGroup.id,
          destinationParentId,
          dto.taskId,
        );
        prevOrder = renumbered.get(previousTask!.id) ?? prevOrder;
        nextOrder = renumbered.get(nextTask!.id) ?? nextOrder;
      }
      newOrder = (prevOrder + nextOrder) / 2;
    }

    await this.prisma.$transaction([
      this.prisma.task.update({
        where: {
          id: dto.taskId,
        },
        data: {
          groupId: destinationGroup.id,
          parentId: destinationParentId,
          order: newOrder,
        },
      }),
      // Subtasks always live in their parent's group — move them along.
      this.prisma.task.updateMany({
        where: { parentId: dto.taskId },
        data: { groupId: destinationGroup.id },
      }),
    ]);

    return {
      message: 'Task reordered successfully.',
    };
  }

  async reorderSubtask(
    subtaskId: number,
    previousTaskId: number | null,
    nextTaskId: number | null,
  ) {

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

    
    if (subtask.parentId === null) {
      throw new BadRequestException('The selected task is not a subtask');
    }

    
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

    if (
      previousTask &&
      nextTask &&
      previousTask.parentId !== nextTask.parentId
    ) {
      throw new BadRequestException(
        'Previous and next tasks must belong to the same parent',
      );
    }

    let newOrder: number;

    if (previousTask && nextTask) {
      let prevOrder = previousTask.order;
      let nextOrder = nextTask.order;
      if (nextOrder - prevOrder < 0.001) {
        const renumbered = await this.rebalanceSiblings(
          subtask.groupId,
          subtask.parentId,
          subtaskId,
        );
        prevOrder = renumbered.get(previousTask.id) ?? prevOrder;
        nextOrder = renumbered.get(nextTask.id) ?? nextOrder;
      }
      newOrder = (prevOrder + nextOrder) / 2;
    } else if (previousTask) {
      newOrder = previousTask.order + 1000;
    } else if (nextTask) {
      newOrder = nextTask.order - 1000;
    } else {
      newOrder = subtask.order;
    }

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

  /**
   * Renumber all siblings (same group + parent), except the task being
   * moved, to 1000, 2000, … keeping their current order.
   * Returns the new order per task id.
   */
  private async rebalanceSiblings(
    groupId: number,
    parentId: number | null,
    excludeTaskId: number,
  ): Promise<Map<number, number>> {
    const siblings = await this.prisma.task.findMany({
      where: { groupId, parentId, id: { not: excludeTaskId } },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    const result = new Map<number, number>();
    await this.prisma.$transaction(
      siblings.map((s, i) => {
        const order = (i + 1) * 1000;
        result.set(s.id, order);
        return this.prisma.task.update({ where: { id: s.id }, data: { order } });
      }),
    );
    return result;
  }
}
