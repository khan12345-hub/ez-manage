import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCellDto } from './dto/create-cell.dto';
import { PrismaService } from 'prisma/prisma.service';
import { BoardAccessService } from 'src/boards/board-access.service';
import { UpdateCellDto } from './dto/update-cell.dto';

@Injectable()
export class CellsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardAccess: BoardAccessService,
  ) {}
  create(createCellDto: CreateCellDto) {
    return 'This action adds a new cell';
  }

  findAll() {
    return `This action returns all cells`;
  }

  findOne(id: number) {
    return `This action returns a #${id} cell`;
  }

  async updateCell(cellId: number, dto: UpdateCellDto, userId: number) {
    const cell = await this.prisma.taskCell.findUnique({
      where: {
        id: cellId,
      },
      include: {
        column: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!cell) {
      throw new NotFoundException('Cell not found.');
    }

    await this.boardAccess.requireViewer(cell.column.boardId, userId);

    return this.prisma.taskCell.update({
      where: {
        id: cellId,
      },
      data: {
        value: dto.value,
      },
    });
  }

  remove(id: number) {
    return `This action removes a #${id} cell`;
  }
}
