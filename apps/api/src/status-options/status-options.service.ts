import { suggestStatusCategory } from '../common/status-category';
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
import { Prisma } from 'generated/prisma/client';

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
    // Choosing an explicit status group changes overdue reporting (dashboard, CEO):
    // board OWNER/ADMIN only. Without one, the label-based default is used.
    if (dto.category !== undefined) {
      await this.boardAccess.requirePermission(column.boardId, userId, BoardPermission.MANAGE_SETTINGS);
    }

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
        category: dto.category ?? suggestStatusCategory(dto.label),
        // order: dto.order,
      },
    });
  }

  async update(columnId: number, statusId: number, userId: number, dto: UpdateStatusOptionDto) {
    const boardId = await this.resolveColumnBoard(columnId);
    await this.boardAccess.requirePermission(boardId, userId, BoardPermission.EDIT);
    if (dto.category !== undefined) {
      await this.boardAccess.requirePermission(boardId, userId, BoardPermission.MANAGE_SETTINGS);
    }

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
          // Category is explicit: renaming a status never silently changes
          // whether it counts as done.
          ...(dto.category !== undefined && {
            category: dto.category,
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

      // Is another option using the same old label? Then match by id/color
      // too, so we don't rewrite cells that belong to the other option.
      const labelShared =
        (await tx.statusOption.count({
          where: { columnId, label: statusOption.label, NOT: { id: statusId } },
        })) > 0;

      // Rewrite one stored item if it refers to this option. Handles
      // STATUS {label,color[,id]}, DROPDOWN/LABEL {text}, and arrays of them.
      const rewrite = (item: any): any => {
        if (!item || typeof item !== 'object') return item;
        if (item.id != null) {
          return item.id === statusId
            ? { ...item, label: newLabel, color: newColor }
            : item;
        }
        if (item.label !== undefined) {
          const matches =
            item.label === statusOption.label &&
            (!labelShared || item.color === statusOption.color);
          return matches ? { ...item, label: newLabel, color: newColor } : item;
        }
        if (typeof item.text === 'string' && !labelShared) {
          return item.text === statusOption.label ? { ...item, text: newLabel } : item;
        }
        return item;
      };

      for (const cell of cells) {
        const v = cell.value as any;
        const next = Array.isArray(v) ? v.map(rewrite) : rewrite(v);
        if (JSON.stringify(next) !== JSON.stringify(v)) {
          await tx.taskCell.update({
            where: { id: cell.id },
            data: { value: next },
          });
        }
      }

      return updatedStatus;
    }, { timeout: 60_000 });
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
        label: true,
        color: true,
      },
    });

    if (!statusOption) {
      throw new NotFoundException('Status option not found for this column.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Clear cells that still show the deleted option (they used to keep
      // displaying a status that no longer exists).
      const labelShared =
        (await tx.statusOption.count({
          where: { columnId, label: statusOption.label, NOT: { id: statusId } },
        })) > 0;

      const refersToDeleted = (item: any) =>
        !!item &&
        typeof item === 'object' &&
        (item.id != null
          ? item.id === statusId
          : item.label !== undefined
            ? item.label === statusOption.label &&
              (!labelShared || item.color === statusOption.color)
            : !labelShared && item.text === statusOption.label);

      const cells = await tx.taskCell.findMany({
        where: { columnId },
        select: { id: true, value: true },
      });
      for (const cell of cells) {
        const v = cell.value as any;
        if (Array.isArray(v)) {
          const kept = v.filter((i) => !refersToDeleted(i));
          if (kept.length !== v.length) {
            await tx.taskCell.update({
              where: { id: cell.id },
              data: { value: kept.length ? kept : Prisma.DbNull },
            });
          }
        } else if (refersToDeleted(v)) {
          await tx.taskCell.update({
            where: { id: cell.id },
            data: { value: Prisma.DbNull },
          });
        }
      }

      // Note: automation rules that use this option are removed by the
      // database cascade (AutomationRule → StatusOption onDelete: Cascade).
      return tx.statusOption.delete({
        where: {
          id: statusId,
        },
      });
    }, { timeout: 60_000 });
  }
}
