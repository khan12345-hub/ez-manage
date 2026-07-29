import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreateStatusOptionDto } from './dto/create-status-option.dto';
import { UpdateStatusOptionDto } from './dto/update-status-option.dto';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class StatusOptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(columnId: number) {
    const column = await this.prisma.boardColumn.findUnique({
      where: {
        id: columnId,
      },
      select: {
        id: true,
      },
    });

    if (!column) {
      throw new NotFoundException('Board column not found.');
    }

    return this.prisma.statusOption.findMany({
      where: {
        columnId,
      },
      orderBy: {
        order: 'asc',
      },
    });
  }

  async create(columnId: number, dto: CreateStatusOptionDto) {
    const column = await this.prisma.boardColumn.findUnique({
      where: {
        id: columnId,
      },
      select: {
        id: true,
        type: true,
      },
    });

    if (!column) {
      throw new NotFoundException('Board column not found.');
    }

    if (column.type !== 'STATUS') {
      throw new ConflictException(
        'Status options can only be created for status columns.',
      );
    }

    const existingStatus = await this.prisma.statusOption.findFirst({
      where: {
        columnId,
        label: dto.label.trim(),
      },
      select: {
        id: true,
      },
    });

    if (existingStatus) {
      throw new ConflictException(
        'A status with this label already exists in this column.',
      );
    }

    return this.prisma.statusOption.create({
      data: {
        columnId,
        label: dto.label.trim(),
        color: dto.color,
        // order: dto.order,
      },
    });
  }

  async update(columnId: number, statusId: number, dto: UpdateStatusOptionDto) {
    const statusOption = await this.prisma.statusOption.findFirst({
      where: {
        id: statusId,
        columnId,
      },
    });

    if (!statusOption) {
      throw new NotFoundException('Status option not found for this column.');
    }

    if (dto.label !== undefined) {
      const existingStatus = await this.prisma.statusOption.findFirst({
        where: {
          columnId,
          label: dto.label.trim(),
          NOT: {
            id: statusId,
          },
        },
        select: {
          id: true,
        },
      });

      if (existingStatus) {
        throw new ConflictException(
          'A status with this label already exists in this column.',
        );
      }
    }

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

  async remove(columnId: number, statusId: number) {
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
