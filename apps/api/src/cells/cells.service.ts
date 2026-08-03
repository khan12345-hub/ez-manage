import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'prisma/prisma.service';

import { CreateCellDto } from './dto/create-cell.dto';
import { UpdateCellDto } from './dto/update-cell.dto';
import { BoardColumnType } from 'generated/prisma/enums';
import { LocalStorageService } from 'src/storage/local-storage.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TaskAssignedEvent } from 'src/notifications/events/task-assigned.event';

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
    const assignedBy = await this.prisma.user.findUnique({
      where: {
        id: params.assignedById,
      },

      select: {
        id: true,

        firstName: true,
        lastName: true,
      },
    });

    if (!assignedBy) {
      return;
    }
    const event = new TaskAssignedEvent({
      recipientId: params.recipientId,

      taskId: params.taskId,

      boardId: params.boardId,

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
  ) {}

  async create(createCellDto: CreateCellDto, boardId: number, userId: number) {
    // TODO:
    // Validate that the task belongs to boardId
    // Validate that the column belongs to boardId
    // Then create the cell.

    return 'This action adds a new cell';
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

            group: {
              select: {
                boardId: true,
              },
            },
          },
        },

        column: {
          select: {
            boardId: true,

            type: true,
          },
        },
      },
    });

    if (!cell) {
      throw new NotFoundException('Cell not found for the specified board.');
    }

    // Defense-in-depth check.
    if (
      cell.task.group.boardId !== boardId ||
      cell.column.boardId !== boardId
    ) {
      throw new NotFoundException('Cell not found for the specified board.');
    }

    /**
     * Capture the previous assignee before
     * updating the cell.
     */
    const previousAssigneeIds =
      cell.column.type === BoardColumnType.PERSON
        ? this.extractPersonIds(cell.value)
        : [];

    /**
     * Update the cell.
     */
    const updatedCell = await this.prisma.taskCell.update({
      where: {
        id: cellId,
      },

      data: {
        value: dto.value,
      },
    });

    /**
     * Handle task assignment notification.
     */
    if (cell.column.type === BoardColumnType.PERSON) {
      const newAssigneeIds = this.extractPersonIds(dto.value);

      console.log(
        '[Notification Debug] Previous assignees:',
        previousAssigneeIds,
      );

      console.log('[Notification Debug] New assignees:', newAssigneeIds);

      /**
       * Find users that are newly assigned.
       */
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
