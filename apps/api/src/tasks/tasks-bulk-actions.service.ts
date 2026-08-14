import { PrismaService } from 'prisma/prisma.service';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityAction, ActivityEntityType } from 'generated/prisma/client';
import { BulkDeleteTasksDto } from './dto/bulk-delete-tasks.dto';
import { BulkUpdateDto } from './dto/bulk-update-task.dto';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';

@Injectable()
export class TaskBulkActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

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

  async bulkUpdate(boardId: number, dto: BulkUpdateDto, userId: number) {
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
        cells: {
          where: {
            columnId: dto.columnId,
          },
          select: {
            id: true,
            taskId: true,
            columnId: true,
            value: true,
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
        accessControlEnabled: true,
        permissions: {
          where: {
            userId,
            canEdit: true,
          },
          select: {
            id: true,
            canEdit: true,
          },
        },
      },
    });

    if (!column) {
      throw new NotFoundException('Column not found.');
    }

    // Check column permission
    if (column.accessControlEnabled) {
      const hasPermission = column.permissions.length > 0;

      if (!hasPermission) {
        throw new ForbiddenException(
          `You do not have permission to edit the "${column.name}" column.`,
        );
      }
    }

    const updatedCount = await this.prisma.$transaction(async (tx) => {
      let count = 0;

      for (const task of tasks) {
        const cell = task.cells[0];

        const previousValue = cell?.value ?? null;

        let updatedCell;

        if (cell) {
          // Update existing cell
          updatedCell = await tx.taskCell.update({
            where: {
              id: cell.id,
            },
            data: {
              value: dto.value,
            },
            select: {
              id: true,
              taskId: true,
              columnId: true,
              value: true,
            },
          });
        } else {
          // Create cell if it doesn't exist
          updatedCell = await tx.taskCell.create({
            data: {
              taskId: task.id,
              columnId: dto.columnId,
              value: dto.value,
            },
            select: {
              id: true,
              taskId: true,
              columnId: true,
              value: true,
            },
          });
        }

        // Track bulk update exactly like a normal cell update
        await this.activityLogsService.log(
          {
            boardId,
            taskId: task.id,
            groupId: task.groupId,
            userId,
            entityType: ActivityEntityType.TASK_CELL,
            entityId: updatedCell.id,
            action: ActivityAction.UPDATED,
            metadata: {
              columnId: column.id,
              columnName: column.name,
              columnType: column.type,
              oldValue: previousValue,
              newValue: dto.value,
              taskName: task.name,
            },
          },
          tx,
        );

        count++;
      }

      return count;
    });

    return {
      success: true,
      updated: updatedCount,
    };
  }
}
