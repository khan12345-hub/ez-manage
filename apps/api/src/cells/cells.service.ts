import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'prisma/prisma.service';

import { CreateCellDto } from './dto/create-cell.dto';
import { UpdateCellDto } from './dto/update-cell.dto';
import {
  ActivityAction,
  ActivityEntityType,
  BoardColumnType,
} from 'generated/prisma/enums';
import { LocalStorageService } from 'src/storage/local-storage.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TaskAssignedEvent } from 'src/notifications/events/task-assigned.event';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { AutomationEngineService } from 'src/automations/automation-engine.service';

@Injectable()
export class CellsService {
  private extractPersonIds(value: unknown): number[] {
    console.log(
      '[Notification Debug] Extracting person IDs from value:',
      JSON.stringify(value),
    );

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return [];
    }

    const person = value as Record<string, unknown>;

    if (!Array.isArray(person.users)) {
      return [];
    }

    const userIds = person.users
      .map((user) => {
        if (!user || typeof user !== 'object') {
          return null;
        }

        const userObject = user as Record<string, unknown>;

        const id = userObject.id;

        if (typeof id === 'number') {
          return id;
        }

        if (typeof id === 'string' && !isNaN(Number(id))) {
          return Number(id);
        }

        return null;
      })
      .filter((id): id is number => id !== null);

    console.log('[Notification Debug] Extracted person IDs:', userIds);

    return userIds;
  }

  private async handleTaskAssignment(params: {
    recipientId: number;
    taskId: number;
    boardId: number;
    taskName: string;
    assignedById: number;
  }) {
    const [assignedBy, board] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: params.assignedById },
        select: { id: true, firstName: true, lastName: true },
      }),
      this.prisma.board.findUnique({
        where: { id: params.boardId },
        select: { workspaceId: true },
      }),
    ]);

    if (!assignedBy) {
      return;
    }

    const event = new TaskAssignedEvent({
      recipientId: params.recipientId,
      taskId: params.taskId,
      boardId: params.boardId,
      workspaceId: board?.workspaceId ?? 0,
      taskName: params.taskName,
      assignedById: assignedBy.id,
      assignedByName: `${assignedBy.firstName} ${assignedBy.lastName}`,
    });

    console.log('[CellsService] Emitting TaskAssignedEvent:', event);
    this.eventEmitter.emit('task.assigned', event);
  }
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: LocalStorageService,
    private readonly eventEmitter: EventEmitter2,
    private readonly activityLogsService: ActivityLogsService,
    private readonly automationEngineService: AutomationEngineService,
  ) {}

  async create(createCellDto: CreateCellDto, boardId: number, _userId: number) {
    const { taskId, columnId } = createCellDto;

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, group: { boardId } },
    });
    if (!task) throw new NotFoundException('Task not found in this board.');

    const column = await this.prisma.boardColumn.findFirst({
      where: { id: columnId, boardId },
    });
    if (!column) throw new NotFoundException('Column not found in this board.');

    return this.prisma.taskCell.upsert({
      where: { taskId_columnId: { taskId, columnId } },
      create: { taskId, columnId },
      update: {},
    });
  }

  async uploadFiles(
    cellId: number,
    boardId: number,
    userId: number,
    files: Express.Multer.File[],
  ) {
    if (!files?.length) {
      return [];
    }

    const cell = await this.prisma.taskCell.findFirst({
      where: {
        id: cellId,

        task: {
          group: {
            boardId,
          },
        },
      },

      include: {
        column: {
          select: {
            id: true,
            type: true,
          },
        },
      },
    });

    if (!cell) {
      throw new NotFoundException('Cell not found.');
    }

    if (cell.column.type !== BoardColumnType.FILE) {
      throw new BadRequestException(
        'Files can only be uploaded to FILE columns.',
      );
    }

    const uploadedFiles = await Promise.all(
      files.map(async (uploadedFile) => {
        const uploaded = await this.storageService.upload(
          uploadedFile,
          'task-cells',
        );

        const createdFile = await this.prisma.file.create({
          data: {
            fileName: uploaded.fileName,

            mimeType: uploaded.mimeType,

            fileSize: uploaded.fileSize,

            storageKey: uploaded.storageKey,

            url: this.storageService.getUrl(uploaded.storageKey),

            uploadedById: userId,
          },
        });

        return this.prisma.taskCellFile.create({
          data: {
            cellId: cell.id,

            fileId: createdFile.id,
          },

          include: {
            file: true,
          },
        });
      }),
    );

    return uploadedFiles;
  }

  async findAll(boardId: number) {
    return this.prisma.taskCell.findMany({
      where: {
        task: {
          group: {
            boardId,
          },
        },
      },
      include: {
        column: {
          select: {
            id: true,
            name: true,
            type: true,
            order: true,
            boardId: true,
          },
        },
      },
    });
  }

  async findOne(cellId: number, boardId: number) {
    const cell = await this.prisma.taskCell.findFirst({
      where: {
        id: cellId,
        task: {
          group: {
            boardId,
          },
        },
      },
      include: {
        column: {
          select: {
            id: true,
            name: true,
            type: true,
            order: true,
            boardId: true,
          },
        },
        task: {
          select: {
            id: true,
            groupId: true,
          },
        },
      },
    });

    if (!cell) {
      throw new NotFoundException('Cell not found for the specified board.');
    }

    return cell;
  }
  private extractStatusId(value: unknown): number | null {
    if (!value) {
      return null;
    }

    if (typeof value === 'object' && value !== null && 'id' in value) {
      const id = (value as { id: unknown }).id;

      const parsedId = Number(id);

      return Number.isNaN(parsedId) ? null : parsedId;
    }

    return null;
  }
  async updateCell(
    cellId: number,
    dto: UpdateCellDto,
    userId: number,
    boardId: number,
  ) {
    const cell = await this.prisma.taskCell.findFirst({
      where: {
        id: cellId,
        task: {
          group: {
            boardId,
          },
        },
      },
      select: {
        id: true,
        taskId: true,
        columnId: true,
        value: true,
        task: {
          select: {
            id: true,
            name: true,
            groupId: true,
            group: {
              select: {
                boardId: true,
              },
            },
          },
        },
        column: {
          select: {
            id: true,
            boardId: true,
            type: true,
            name: true,
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
        },
      },
    });

    if (!cell) {
      throw new NotFoundException('Cell not found for the specified board.');
    }

    if (
      cell.task.group.boardId !== boardId ||
      cell.column.boardId !== boardId
    ) {
      throw new NotFoundException('Cell not found for the specified board.');
    }

    if (cell.column.accessControlEnabled) {
      const boardMember = await this.prisma.boardMember.findFirst({
        where: { boardId, userId },
        select: { role: true },
      });

      const isAdminOrOwner =
        boardMember?.role === 'OWNER' || boardMember?.role === 'ADMIN';

      const hasPermission =
        isAdminOrOwner || cell.column.permissions.length > 0;

      if (!hasPermission) {
        throw new ForbiddenException(
          `You do not have permission to edit the "${cell.column.name}" column.`,
        );
      }
    }

    const previousValue = cell.value;

    console.log({ cell });

    const columnType = cell.column.type;

    const previousAssigneeIds =
      columnType === BoardColumnType.PERSON
        ? this.extractPersonIds(previousValue)
        : [];

    const updatedCell = await this.prisma.taskCell.update({
      where: {
        id: cellId,
      },
      data: {
        value: dto.value,
      },
    });

    const activityLog = await this.activityLogsService.log({
      boardId,
      taskId: cell.taskId,
      groupId: cell.task.groupId,
      userId,
      entityType: ActivityEntityType.TASK_CELL,
      entityId: cell.id,
      action: ActivityAction.UPDATED,
      metadata: {
        columnId: cell.columnId,
        columnName: cell.column.name,
        columnType,
        oldValue: previousValue,
        newValue: dto.value,
        taskName: cell.task.name,
      },
    });

    console.log('[ActivityLog] Cell updated:', activityLog);

    //
    if (
      columnType === BoardColumnType.STATUS &&
      JSON.stringify(previousValue) !== JSON.stringify(dto.value)
    ) {
      const newStatusValue = dto.value as {
        label?: string;
        color?: string;
      };

      const statusOption = await this.prisma.statusOption.findFirst({
        where: {
          columnId: cell.columnId,
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

      console.log('[Automation] Resolved status:', {
        columnId: cell.columnId,
        value: newStatusValue,
        statusOption,
      });

      if (!statusOption) {
        console.warn('[Automation] Status option not found', {
          columnId: cell.columnId,
          value: newStatusValue,
        });
      } else {
        await this.automationEngineService.handleStatusChanged(
          cell.taskId,
          boardId,
          cell.columnId,
          statusOption.id,
        );
      }
    }

    if (columnType === BoardColumnType.PERSON) {
      const newAssigneeIds = this.extractPersonIds(dto.value);

      console.log(
        '[Notification Debug] Previous assignees:',
        previousAssigneeIds,
      );

      console.log('[Notification Debug] New assignees:', newAssigneeIds);

      const newlyAssignedUsers = newAssigneeIds.filter(
        (id) => !previousAssigneeIds.includes(id) && id !== userId,
      );

      console.log(
        '[Notification Debug] Newly assigned users:',
        newlyAssignedUsers,
      );

      for (const recipientId of newlyAssignedUsers) {
        await this.handleTaskAssignment({
          recipientId,
          taskId: cell.task.id,
          boardId,
          taskName: cell.task.name,
          assignedById: userId,
        });
      }
    }

    return updatedCell;
  }

  async remove(cellId: number, boardId: number) {
    const cell = await this.prisma.taskCell.findFirst({
      where: {
        id: cellId,
        task: {
          group: {
            boardId,
          },
        },
      },
    });

    if (!cell) {
      throw new NotFoundException('Cell not found for the specified board.');
    }

    await this.prisma.taskCell.delete({
      where: {
        id: cellId,
      },
    });

    return {
      message: 'Cell deleted successfully.',
    };
  }
  async removeFile(
    boardId: number,
    cellId: number,
    fileId: number,
    userId: number,
  ) {
    const file = await this.prisma.taskCellFile.findFirst({
      where: {
        cellId,
        fileId,

        cell: {
          task: {
            group: {
              boardId,
            },
          },
        },
      },
      include: {
        file: true,
      },
    });

    if (!file) {
      throw new NotFoundException('File not found for this cell');
    }

    const isOwner = file.file.uploadedById === userId;

    if (!isOwner) {
      throw new ForbiddenException('You can only delete files uploaded by you');
    }

    // Delete the database relation first
    await this.prisma.taskCellFile.delete({
      where: {
        id: fileId,
      },
    });

    // Delete the actual physical file
    try {
      await this.storageService.delete(file.file.storageKey);
    } catch (error) {
      console.error(
        `Failed to delete physical file: ${file.file.storageKey}`,
        error,
      );
    }

    return {
      message: 'File deleted successfully',
    };
  }
}
