import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class ColumnsService {
  constructor(
    private readonly prisma: PrismaService,
    // private readonly boardsAccessService: BoardAccessService,
  ) {}
  async create(dto: CreateColumnDto) {
    return this.prisma.$transaction(async (tx) => {
      const board = await tx.board.findUnique({
        where: {
          id: dto.boardId,
        },
      });

      if (!board) {
        throw new NotFoundException('Board not found');
      }

      const lastColumn = await tx.boardColumn.findFirst({
        where: {
          boardId: dto.boardId,
        },
        orderBy: {
          order: 'desc',
        },
      });

      const defaultName = dto.type.toLowerCase().replace('_', ' ');

      // Make the default name unique
      let name = defaultName;
      let count = 1;

      while (
        await tx.boardColumn.findFirst({
          where: {
            boardId: dto.boardId,
            name,
          },
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
          order: lastColumn ? lastColumn.order + 1 : 2,
        },
      });

      const tasks = await tx.task.findMany({
        where: {
          group: {
            boardId: dto.boardId,
          },
        },
        select: {
          id: true,
        },
      });

      if (tasks.length) {
        await tx.taskCell.createMany({
          data: tasks.map((task) => ({
            taskId: task.id,
            columnId: column.id,
          })),
        });
      }

      return column;
    });
  }

  findAll() {
    return `This action returns all columns`;
  }

  findOne(id: number) {
    return `This action returns a #${id} column`;
  }

  async update(columnId: number, dto: UpdateColumnDto) {
    return this.prisma.$transaction(async (tx) => {
      const column = await tx.boardColumn.findUnique({
        where: {
          id: columnId,
        },
      });

      if (!column) {
        throw new NotFoundException('Column not found');
      }

      const existing = await tx.boardColumn.findFirst({
        where: {
          boardId: column.boardId,
          name: dto.name,
          NOT: {
            id: columnId,
          },
        },
      });

      if (existing) {
        throw new BadRequestException(
          'A column with this name already exists.',
        );
      }
      

      return tx.boardColumn.update({
        where: {
          id: columnId,
        },
        data: {
          name: dto.name,
        },
      });
    });
  }

  async remove(columnId: number) {
    return this.prisma.$transaction(async (tx) => {
      const column = await tx.boardColumn.findUnique({
        where: {
          id: columnId,
        },
      });

      if (!column) {
        throw new NotFoundException('Column not found');
      }

      if (column.isPrimary) {
        throw new BadRequestException('This column cannot be deleted.');
      }


      // Remove task cells first if cascade isn't configured
      await tx.taskCell.deleteMany({
        where: {
          columnId,
        },
      });

      await tx.boardColumn.delete({
        where: {
          id: columnId,
        },
      });

      return {
        message: 'Column deleted successfully.',
      };
    });
  }
}
