import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'prisma/prisma.service';

import { CreateCellDto } from './dto/create-cell.dto';
import { UpdateCellDto } from './dto/update-cell.dto';

@Injectable()
export class CellsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    createCellDto: CreateCellDto,
    boardId: number,
    userId: number,
  ) {
    // TODO:
    // Validate that the task belongs to boardId
    // Validate that the column belongs to boardId
    // Then create the cell.

    return 'This action adds a new cell';
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

  async findOne(
    cellId: number,
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
      throw new NotFoundException(
        'Cell not found for the specified board.',
      );
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
          },
        },
      },
    });

    if (!cell) {
      throw new NotFoundException(
        'Cell not found for the specified board.',
      );
    }

    // Defense-in-depth check:
    // Make sure the task and column both belong
    // to the same board from the URL.
    if (
      cell.task.group.boardId !== boardId ||
      cell.column.boardId !== boardId
    ) {
      throw new NotFoundException(
        'Cell not found for the specified board.',
      );
    }

    return this.prisma.taskCell.update({
      where: {
        id: cellId,
      },
      data: {
        value: dto.value,
      },
    });
  }

  async remove(
    cellId: number,
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
    });

    if (!cell) {
      throw new NotFoundException(
        'Cell not found for the specified board.',
      );
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
}