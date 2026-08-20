import { PrismaService } from 'prisma/prisma.service';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityAction,
  ActivityEntityType,
  BoardColumnType,
} from 'generated/prisma/client';
import { BulkDeleteTasksDto } from './dto/bulk-delete-tasks.dto';
import { BulkUpdateDto } from './dto/bulk-update-task.dto';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { AutomationEngineService } from 'src/automations/automation-engine.service';

@Injectable()
export class TaskBulkActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly automationEngineService: AutomationEngineService,
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

    /**
     * Keep track of status changes.
     *
     * We execute automations AFTER the transaction succeeds.
     */
    const statusChanges: {
      taskId: number;
      previousValue: unknown;
      newValue: unknown;
    }[] = [];

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

        // Track activity
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

        /**
         * Track status changes for automation.
         *
         * Do not trigger automation if the value didn't actually change.
         */
        if (
          column.type === BoardColumnType.STATUS &&
          JSON.stringify(previousValue) !== JSON.stringify(dto.value)
        ) {
          statusChanges.push({
            taskId: task.id,
            previousValue,
            newValue: dto.value,
          });
        }

        count++;
      }

      return count;
    });

    /**
     * Execute automations AFTER the transaction has committed.
     *
     * This prevents the automation from running if the bulk update
     * transaction fails.
     */
    if (column.type === BoardColumnType.STATUS && statusChanges.length > 0) {
      const newStatusValue = dto.value as {
        label?: string;
        color?: string;
      };

      const statusOption = await this.prisma.statusOption.findFirst({
        where: {
          columnId: column.id,
          label: newStatusValue.label,
          color: newStatusValue.color,
          isArchived: false,
        },
        select: {
          id: true,
          label: true,
          color: true,
        },
      });

      console.log('[Bulk Automation] Resolved status:', {
        columnId: column.id,
        value: newStatusValue,
        statusOption,
      });

      if (!statusOption) {
        console.warn('[Bulk Automation] Status option not found', {
          columnId: column.id,
          value: newStatusValue,
        });
      } else {
        for (const change of statusChanges) {
          await this.automationEngineService.handleStatusChanged(
            change.taskId,
            boardId,
            column.id,
            statusOption.id,
          );
        }
      }
    }

    return {
      success: true,
      updated: updatedCount,
    };
  }
}
