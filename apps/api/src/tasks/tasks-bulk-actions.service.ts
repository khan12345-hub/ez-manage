import { PrismaService } from 'prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityAction, ActivityEntityType } from 'generated/prisma/client';
import { BulkDeleteTasksDto } from './dto/bulk-delete-tasks.dto';
import { BulkUpdateDto } from './dto/bulk-update-task.dto';


@Injectable()
export class TaskBulkActionsService {
  constructor(private readonly prisma: PrismaService) {}

  async bulkDelete(boardId: number, dto: BulkDeleteTasksDto, userId: number) {
    const tasks = await this.prisma.task.findMany({
      where: {
        id: {
          in: dto.taskIds,
        },
        group: {
          boardId,
        },
      },
      select: {
        id: true,
        name: true,
        groupId: true,
      },
    });

    if (!tasks.length) {
      throw new NotFoundException('Tasks not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.activityLog.createMany({
        data: tasks.map((task) => ({
          boardId,
          groupId: task.groupId,
          taskId: task.id,
          entityType: ActivityEntityType.TASK,
          entityId: task.id,
          action: ActivityAction.DELETED,
          userId,
          metadata: {
            taskName: task.name,
          },
        })),
      });

      await tx.task.deleteMany({
        where: {
          id: {
            in: tasks.map((t) => t.id),
          },
        },
      });
    });

    return {
      success: true,
      deleted: tasks.length,
    };
  }

  async bulkUpdate(
    boardId: number,
    dto: BulkUpdateDto,
    userId: number,
  ) {
    
    const tasks = await this.prisma.task.findMany({
      where: {
        id: {
          in: dto.taskIds,
        },
        group: {
          boardId,
        },
      },
      include: {
        cells: {
          where: {
            columnId: dto.columnId,
          },
        },
      },
    });

    const column = await this.prisma.boardColumn.findFirst({
      where: {
        id: dto.columnId,
        boardId,
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
    });

    if (!column) {
      throw new NotFoundException('Column not found.');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const task of tasks) {
        const cell = task.cells[0];
        const previousValue = cell?.value ?? null;

        if (cell) {
          await tx.taskCell.update({
            where: {
              id: cell.id,
            },
            data: {
              value: dto.value,
            },
          });
        } else {
          await tx.taskCell.create({
            data: {
              taskId: task.id,
              columnId: dto.columnId,
              value: dto.value,
            },
          });
        }

        await tx.activityLog.create({
          data: {
            boardId,
            groupId: task.groupId,
            taskId: task.id,
            entityType: ActivityEntityType.TASK,
            entityId: task.id,
            action: ActivityAction.UPDATED,
            userId,
            metadata: {
              columnId: column.id,
              columnName: column.name,
              columnType: column.type,
              oldValue: previousValue,
              newValue: dto.value,
              taskName: task.name,
            },
          },
        });
      }
    });

    return {
      success: true,
      updated: tasks.length,
    };
  }
}
