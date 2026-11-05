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
import { BulkMoveTasksDto } from './dto/bulk-move-tasks.dto';
import { BulkDuplicateTasksDto } from './dto/bulk-duplicate-tasks.dto';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { AutomationEngineService } from 'src/automations/automation-engine.service';
import { BoardAccessService } from 'src/boards/board-access.service';
import { BoardPermission } from '@repo/shared';

@Injectable()
export class TaskBulkActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly automationEngineService: AutomationEngineService,
    private readonly boardAccessService: BoardAccessService,
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
      // taskId is intentionally omitted: ActivityLog.task cascades on delete,
      // so linking the log to the task would delete the log with it.
      await tx.activityLog.createMany({
        data: tasks.map((task) => ({
          boardId,
          groupId: task.groupId,
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
        const statusKey = (v: any) =>
          v && typeof v === 'object' ? `${v.label ?? ''}|${v.color ?? ''}` : String(v ?? '');
        if (
          column.type === BoardColumnType.STATUS &&
          statusKey(previousValue) !== statusKey(dto.value)
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
    }, { timeout: 60_000 });

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

  async bulkMove(boardId: number, dto: BulkMoveTasksDto, userId: number) {
    const [sourceBoard, targetGroup] = await Promise.all([
      this.prisma.board.findUnique({
        where: { id: boardId },
        select: { workspaceId: true },
      }),
      this.prisma.group.findFirst({
        where: { id: dto.targetGroupId },
        select: {
          id: true,
          boardId: true,
          board: { select: { workspaceId: true } },
        },
      }),
    ]);

    if (!sourceBoard || !targetGroup) {
      throw new NotFoundException('Target group not found');
    }

    const crossBoard = targetGroup.boardId !== boardId;

    if (crossBoard) {
      if (targetGroup.board.workspaceId !== sourceBoard.workspaceId) {
        throw new ForbiddenException(
          'Tasks can only be moved to boards in the same workspace.',
        );
      }
      // Throws ForbiddenException if the user cannot add tasks there.
      await this.boardAccessService.requirePermission(
        targetGroup.boardId,
        userId,
        BoardPermission.CREATE_TASK,
      );
    }

    const selected = await this.prisma.task.findMany({
      where: {
        id: { in: dto.taskIds },
        group: { boardId },
      },
      select: { id: true, name: true, groupId: true, parentId: true },
      orderBy: { order: 'asc' },
    });

    if (!selected.length) {
      throw new NotFoundException('Tasks not found');
    }

    const selectedIds = new Set(selected.map((t) => t.id));
    // Subtasks whose parent is also selected travel with the parent.
    const roots = selected.filter(
      (t) => t.parentId === null || !selectedIds.has(t.parentId),
    );
    const rootIds = roots.map((t) => t.id);

    const children = await this.prisma.task.findMany({
      where: { parentId: { in: rootIds } },
      select: { id: true },
    });
    const allIds = [...rootIds, ...children.map((c) => c.id)];

    // Column mapping for cross-board moves: same name (case-insensitive) + same type.
    let columnMap = new Map<number, number>();
    if (crossBoard) {
      const [srcCols, dstCols] = await Promise.all([
        this.prisma.boardColumn.findMany({
          where: { boardId },
          select: { id: true, name: true, type: true },
        }),
        this.prisma.boardColumn.findMany({
          where: { boardId: targetGroup.boardId },
          select: { id: true, name: true, type: true },
        }),
      ]);
      const key = (c: { name: string; type: string }) =>
        `${c.name.trim().toLowerCase()}|${c.type}`;
      const dstByKey = new Map(dstCols.map((c) => [key(c), c.id]));
      columnMap = new Map(
        srcCols
          .filter((c) => dstByKey.has(key(c)))
          .map((c) => [c.id, dstByKey.get(key(c))!]),
      );
    }

    const maxAgg = await this.prisma.task.aggregate({
      where: { groupId: targetGroup.id, parentId: null },
      _max: { order: true },
    });
    let nextOrder = maxAgg._max.order ?? 0;

    await this.prisma.$transaction(
      async (tx) => {
        // Roots: append to the bottom of the target group, keep relative order.
        for (const t of roots) {
          nextOrder += 1000;
          await tx.task.update({
            where: { id: t.id },
            data: { groupId: targetGroup.id, parentId: null, order: nextOrder },
          });
        }

        // Their subtasks follow them into the target group.
        await tx.task.updateMany({
          where: { parentId: { in: rootIds } },
          data: { groupId: targetGroup.id },
        });

        if (crossBoard) {
          const cells = await tx.taskCell.findMany({
            where: { taskId: { in: allIds } },
            select: { id: true, columnId: true },
          });
          const toDelete: number[] = [];
          for (const cell of cells) {
            const target = columnMap.get(cell.columnId);
            if (target === undefined) {
              toDelete.push(cell.id);
            } else {
              await tx.taskCell.update({
                where: { id: cell.id },
                data: { columnId: target },
              });
            }
          }
          if (toDelete.length) {
            await tx.taskCell.deleteMany({ where: { id: { in: toDelete } } });
          }
        }

        await tx.activityLog.createMany({
          data: roots.map((t) => ({
            boardId,
            groupId: t.groupId,
            taskId: t.id,
            entityType: ActivityEntityType.TASK,
            entityId: t.id,
            action: ActivityAction.MOVED,
            userId,
            metadata: {
              taskName: t.name,
              fromGroupId: t.groupId,
              toGroupId: targetGroup.id,
              toBoardId: targetGroup.boardId,
            },
          })),
        });
      },
      { timeout: 60_000 },
    );

    return { success: true, moved: roots.length };
  }

  async bulkDuplicate(boardId: number, dto: BulkDuplicateTasksDto, userId: number) {
    // Cells are always copied; "with updates" also copies the comments
    // (same meaning as group duplicate).
    const commentSelect = dto.withUpdates
      ? {
          comments: {
            where: { parentId: null },
            orderBy: { createdAt: 'asc' as const },
            select: { content: true, userId: true },
          },
        }
      : {};

    const selected = await this.prisma.task.findMany({
      where: {
        id: { in: dto.taskIds },
        group: { boardId },
      },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        groupId: true,
        parentId: true,
        order: true,
        cells: { select: { columnId: true, value: true } },
        ...commentSelect,
        subtasks: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            order: true,
            cells: { select: { columnId: true, value: true } },
            ...commentSelect,
          },
        },
      },
    });

    if (!selected.length) {
      throw new NotFoundException('Tasks not found');
    }

    // A subtask whose parent is also selected is copied as part of the parent.
    const selectedIds = new Set(selected.map((t) => t.id));
    const tasks = selected.filter(
      (t) => t.parentId === null || !selectedIds.has(t.parentId),
    );

    // Find max order per (group, parent) so duplicates go to the bottom.
    const slotKey = (groupId: number, parentId: number | null) =>
      `${groupId}:${parentId ?? 'root'}`;
    const maxOrderMap = new Map<string, number>();
    for (const t of tasks) {
      const k = slotKey(t.groupId, t.parentId);
      if (maxOrderMap.has(k)) continue;
      const agg = await this.prisma.task.aggregate({
        where: { groupId: t.groupId, parentId: t.parentId },
        _max: { order: true },
      });
      maxOrderMap.set(k, agg._max.order ?? 0);
    }

    const copyExtras = async (
      tx: any,
      newTaskId: number,
      src: { cells: { columnId: number; value: any }[]; comments?: any[] },
    ) => {
      if (src.cells.length) {
        await tx.taskCell.createMany({
          data: src.cells.map((c) => ({
            taskId: newTaskId,
            columnId: c.columnId,
            value: c.value,
          })),
        });
      }
      if (dto.withUpdates && src.comments?.length) {
        await tx.taskComment.createMany({
          data: src.comments.map((c: any) => ({
            taskId: newTaskId,
            content: c.content,
            userId: c.userId,
          })),
        });
      }
    };

    // All-or-nothing: a failure part-way no longer leaves half a duplicate.
    const created = await this.prisma.$transaction(
      async (tx) => {
        const ids: number[] = [];
        for (const task of tasks as any[]) {
          const k = slotKey(task.groupId, task.parentId);
          const order = (maxOrderMap.get(k) ?? 0) + 1000;
          maxOrderMap.set(k, order);

          const newTask = await tx.task.create({
            data: {
              name: `${task.name} (copy)`,
              groupId: task.groupId,
              // A lone subtask is copied under the same parent;
              // a top-level task stays top-level.
              parentId: task.parentId ?? null,
              createdById: userId,
              order,
            },
            select: { id: true },
          });
          await copyExtras(tx, newTask.id, task);
          ids.push(newTask.id);

          // Copy subtasks under the NEW task (not the original).
          for (const sub of task.subtasks ?? []) {
            const newSub = await tx.task.create({
              data: {
                name: sub.name,
                groupId: task.groupId,
                parentId: newTask.id,
                createdById: userId,
                order: sub.order,
              },
              select: { id: true },
            });
            await copyExtras(tx, newSub.id, sub);
          }
        }
        return ids;
      },
      { timeout: 60_000 },
    );

    return { success: true, duplicated: created.length };
  }
}
