import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreateStatusOptionDto } from './dto/create-status-option.dto';
import { UpdateStatusOptionDto } from './dto/update-status-option.dto';
import { PrismaService } from 'prisma/prisma.service';
import { BoardAccessService } from 'src/boards/board-access.service';
import { BoardPermission } from '@repo/shared';

@Injectable()
export class StatusOptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardAccess: BoardAccessService,
  ) {}

  private async resolveColumnBoard(columnId: number): Promise<number> {
    const col = await this.prisma.boardColumn.findUnique({
      where: { id: columnId },
      select: { boardId: true },
    });
    if (!col) throw new NotFoundException('Board column not found.');
    return col.boardId;
  }

  async findAll(columnId: number, userId: number) {
    const column = await this.prisma.boardColumn.findUnique({
      where: {
        id: columnId,
      },
      select: {
        id: true,
        boardId: true,
      },
    });

    if (!column) {
      throw new NotFoundException('Board column not found.');
    }

    await this.boardAccess.requirePermission(column.boardId, userId, BoardPermission.VIEW);

    return this.prisma.statusOption.findMany({
      where: {
        columnId,
      },
      orderBy: {
        order: 'asc',
      },
    });
  }

  async create(columnId: number, dto: CreateStatusOptionDto, userId: number) {
    const column = await this.prisma.boardColumn.findUnique({
      where: {
        id: columnId,
      },
      select: {
        id: true,
        type: true,
        boardId: true,
      },
    });

    if (!column) {
      throw new NotFoundException('Board column not found.');
    }

    await this.boardAccess.requirePermission(column.boardId, userId, BoardPermission.EDIT);

    const OPTION_COLUMN_TYPES = ['STATUS', 'DROPDOWN', 'LABEL'];
    if (!OPTION_COLUMN_TYPES.includes(column.type)) {
      throw new ConflictException(
        'Status options can only be created for status, dropdown, or label columns.',
      );
    }

    // const existingStatus = await this.prisma.statusOption.findFirst({
    //   where: {
    //     columnId,
    //     label: dto.label.trim(),
    //   },
    //   select: {
    //     id: true,
    //   },
    // });

    // if (existingStatus) {
    //   throw new ConflictException(
    //     'A status with this label already exists in this column.',
    //   );
    // }

    return this.prisma.statusOption.create({
      data: {
        columnId,
        label: dto.label.trim(),
        color: dto.color,
        // order: dto.order,
      },
    });
  }

  async update(columnId: number, statusId: number, userId: number, dto: UpdateStatusOptionDto) {
    const boardId = await this.resolveColumnBoard(columnId);
    await this.boardAccess.requirePermission(boardId, userId, BoardPermission.EDIT);

    const statusOption = await this.prisma.statusOption.findFirst({
      where: {
        id: statusId,
        columnId,
      },
    });

    if (!statusOption) {
      throw new NotFoundException('Status option not found for this column.');
    }

    // if (dto.label !== undefined) {
    //   const existingStatus = await this.prisma.statusOption.findFirst({
    //     where: {
    //       columnId,
    //       label: dto.label.trim(),
    //       NOT: {
    //         id: statusId,
    //       },
    //     },
    //     select: {
    //       id: true,
    //     },
    //   });

    //   if (existingStatus) {
    //     throw new ConflictException(
    //       'A status with this label already exists in this column.',
    //     );
    //   }
    // }

    const newLabel =
      dto.label !== undefined ? dto.label.trim() : statusOption.label;

    const newColor = dto.color !== undefined ? dto.color : statusOption.color;

    return this.prisma.$transaction(async (tx) => {
      const updatedStatus = await tx.statusOption.update({
        where: {
          id: statusId,
        },
        data: {
          ...(dto.label !== undefined && {
            label: newLabel,
          }),
          ...(dto.color !== undefined && {
            color: newColor,
          }),
          // ...(dto.order !== undefined && {
          //   order: dto.order,
          // }),
        },
      });

      const cells = await tx.taskCell.findMany({
        where: {
          columnId,
        },
        select: {
          id: true,
          value: true,
        },
      });

      const cellsToUpdate = cells.filter((cell) => {
        const value = cell.value as {
          label?: string;
          color?: string;
        } | null;

        return (
          value?.label === statusOption.label &&
          value?.color === statusOption.color
        );
      });

      await Promise.all(
        cellsToUpdate.map((cell) =>
          tx.taskCell.update({
            where: {
              id: cell.id,
            },
            data: {
              value: {
                label: newLabel,
                color: newColor,
              },
            },
          }),
        ),
      );

      return updatedStatus;
    });
  }

  async getUniqueLabelValues(columnId: number, userId: number): Promise<string[]> {
    const column = await this.prisma.boardColumn.findUnique({
      where: { id: columnId },
      select: { id: true, boardId: true },
    });

    if (!column) throw new NotFoundException('Column not found');

    await this.boardAccess.requirePermission(column.boardId, userId, BoardPermission.VIEW);

    const cells = await this.prisma.taskCell.findMany({
      where: { columnId },
      select: { value: true },
    });

    const seen = new Set<string>();
    for (const cell of cells) {
      const v = cell.value as any;
      const items = Array.isArray(v) ? v : v ? [v] : [];
      for (const item of items) {
        const text = item?.text?.trim();
        // Skip empty, excessively long values, or values with too many commas
        // (these are likely concatenated lists, not valid single labels)
        if (!text || text.length > 120 || (text.match(/,/g) ?? []).length > 3) continue;
        seen.add(text);
      }
    }

    return Array.from(seen).sort();
  }

  async remove(columnId: number, statusId: number, userId: number) {
    const boardId = await this.resolveColumnBoard(columnId);
    await this.boardAccess.requirePermission(boardId, userId, BoardPermission.EDIT);

    const statusOption = await this.prisma.statusOption.findFirst({
      where: {
        id: statusId,
        columnId,
      },
      select: {
        id: true,
      },
    });

    if (!statusOption) {
      throw new NotFoundException('Status option not found for this column.');
    }

    return this.prisma.statusOption.delete({
      where: {
        id: statusId,
      },
    });
  }
}
