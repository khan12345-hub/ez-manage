import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';
import { ReorderColumnDto } from './dto/reorder-column.dto';
import { PrismaService } from 'prisma/prisma.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityAction, ActivityEntityType } from 'generated/prisma/enums';
import { BoardAccessService } from 'src/boards/board-access.service';
import { BoardPermission } from '@repo/shared';

@Injectable()
export class ColumnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly boardAccess: BoardAccessService,
  ) {}

  async create(dto: CreateColumnDto, userId: number) {
    // Permission check BEFORE transaction — requirePermission also validates board existence.
    await this.boardAccess.requirePermission(dto.boardId, userId, BoardPermission.CREATE_COLUMN);

    const ORDER_GAP = 1000;
    return this.prisma.$transaction(async (tx) => {
      const board = await tx.board.findUnique({
        where: { id: dto.boardId },
      });

      if (!board) {
        throw new NotFoundException('Board not found');
      }

      const lastColumn = await tx.boardColumn.findFirst({
        where: { boardId: dto.boardId },
        orderBy: { order: 'desc' },
      });

      const defaultName = dto.type.toLowerCase().replace('_', ' ');

      let name = defaultName;
      let count = 1;

      while (
        await tx.boardColumn.findFirst({
          where: { boardId: dto.boardId, name },
        })
      ) {
        count++;
        name = `${defaultName} ${count}`;
      }

      const column = await tx.boardColumn.create({
        data: {
          boardId: dto.boardId,
          name,
          type: dto.type,
          order: lastColumn ? lastColumn.order + ORDER_GAP : ORDER_GAP,
        },
      });

      const tasks = await tx.task.findMany({
        where: { group: { boardId: dto.boardId } },
        select: { id: true },
      });

      if (tasks.length) {
        await tx.taskCell.createMany({
          data: tasks.map((task) => ({
            taskId: task.id,
            columnId: column.id,
          })),
        });
      }

      await this.activityLogsService.log({
        boardId: dto.boardId,
        userId,
        entityType: ActivityEntityType.COLUMN,
        entityId: column.id,
        action: ActivityAction.CREATED,
        metadata: { columnName: column.name, columnType: column.type },
      }, tx);

      return column;
    });
  }

  findAll() {
    return `This action returns all columns`;
  }

  findOne(id: number) {
    return `This action returns a #${id} column`;
  }

  async update(columnId: number, dto: UpdateColumnDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const column = await tx.boardColumn.findUnique({
        where: { id: columnId },
      });

      if (!column) {
        throw new NotFoundException('Column not found');
      }

      // Permission check AFTER column fetch (boardId needed) but BEFORE any
      // further resource details are disclosed (name duplicate check etc.).
      await this.boardAccess.requirePermission(column.boardId, userId, BoardPermission.UPDATE_COLUMN);

      if (dto.name !== undefined) {
        const existing = await tx.boardColumn.findFirst({
          where: {
            boardId: column.boardId,
            name: dto.name,
            NOT: { id: columnId },
          },
        });

        if (existing) {
          throw new BadRequestException('A column with this name already exists.');
        }
      }

      const updated = await tx.boardColumn.update({
        where: { id: columnId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.formula !== undefined && { formula: dto.formula }),
        },
      });

      await this.activityLogsService.log({
        boardId: column.boardId,
        userId,
        entityType: ActivityEntityType.COLUMN,
        entityId: columnId,
        action: ActivityAction.UPDATED,
        metadata: {
          ...(dto.name !== undefined && { oldName: column.name, newName: dto.name }),
          ...(dto.type !== undefined && { oldType: column.type, newType: dto.type }),
        },
      }, tx);

      return updated;
    });
  }

  async reorder(dto: ReorderColumnDto, userId: number) {
    // Permission check first — boardId comes from client DTO and is validated by
    // requirePermission (NotFoundException if board doesn't exist).
    await this.boardAccess.requirePermission(dto.boardId, userId, BoardPermission.UPDATE_COLUMN);

    // Duplicate-ID guard: column cannot reference itself as a neighbour.
    if (dto.columnId === dto.previousColumnId || dto.columnId === dto.nextColumnId) {
      throw new BadRequestException('Column cannot reference itself in reorder.');
    }
    if (
      dto.previousColumnId != null &&
      dto.nextColumnId != null &&
      dto.previousColumnId === dto.nextColumnId
    ) {
      throw new BadRequestException('Previous and next columns cannot be the same.');
    }

    const column = await this.prisma.boardColumn.findFirst({
      where: { id: dto.columnId, boardId: dto.boardId },
    });

    if (!column) {
      throw new NotFoundException('Column not found');
    }

    if (column.isPrimary) {
      throw new BadRequestException('Primary column cannot be reordered');
    }

    const [previousColumn, nextColumn] = await Promise.all([
      dto.previousColumnId != null
        ? this.prisma.boardColumn.findFirst({
            where: { id: dto.previousColumnId, boardId: dto.boardId },
          })
        : Promise.resolve(null),

      dto.nextColumnId != null
        ? this.prisma.boardColumn.findFirst({
            where: { id: dto.nextColumnId, boardId: dto.boardId },
          })
        : Promise.resolve(null),
    ]);

    // Reject cross-board or non-existent neighbour IDs when they were explicitly supplied.
    if (dto.previousColumnId != null && !previousColumn) {
      throw new NotFoundException('Previous column not found.');
    }
    if (dto.nextColumnId != null && !nextColumn) {
      throw new NotFoundException('Next column not found.');
    }

    if (previousColumn?.isPrimary || nextColumn?.isPrimary) {
      throw new BadRequestException('Primary column cannot be used for reordering');
    }

    let newOrder: number;

    if (!previousColumn && !nextColumn) {
      newOrder = 1000;
    } else if (!previousColumn && nextColumn) {
      newOrder = nextColumn.order - 1000;
    } else if (previousColumn && !nextColumn) {
      newOrder = previousColumn.order + 1000;
    } else {
      newOrder = (previousColumn!.order + nextColumn!.order) / 2;
    }

    await this.prisma.boardColumn.update({
      where: { id: dto.columnId },
      data: { order: newOrder },
    });

    return { message: 'Columns reordered successfully' };
  }

  async remove(columnId: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const column = await tx.boardColumn.findUnique({
        where: { id: columnId },
      });

      if (!column) {
        throw new NotFoundException('Column not found');
      }

      // Permission check AFTER column fetch (boardId needed) but BEFORE disclosing
      // column details such as isPrimary status.
      await this.boardAccess.requirePermission(column.boardId, userId, BoardPermission.DELETE_COLUMN);

      if (column.isPrimary) {
        throw new BadRequestException('This column cannot be deleted.');
      }

      await this.activityLogsService.log({
        boardId: column.boardId,
        userId,
        entityType: ActivityEntityType.COLUMN,
        entityId: columnId,
        action: ActivityAction.DELETED,
        metadata: { columnName: column.name, columnType: column.type },
      }, tx);

      await tx.taskCell.deleteMany({ where: { columnId } });

      await tx.boardColumn.delete({ where: { id: columnId } });

      return { message: 'Column deleted successfully.' };
    });
  }
}
