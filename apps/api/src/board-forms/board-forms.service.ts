import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  CreateBoardFormDto,
  CreateBoardFormFieldDto,
} from './dto/create-board-form.dto';

import { UpdateBoardFormDto } from './dto/update-board-form.dto';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class BoardFormsService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateBoard(boardId: number) {
    const board = await this.prisma.board.findUnique({
      where: {
        id: boardId,
      },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    return board;
  }

  private async validateColumns(
    boardId: number,
    fields: CreateBoardFormFieldDto[],
  ) {
    const columnIds = fields.map((field) => field.columnId);

    if (!columnIds.length) {
      return;
    }

    const uniqueColumnIds = [...new Set(columnIds)];

    const columns = await this.prisma.boardColumn.findMany({
      where: {
        id: {
          in: uniqueColumnIds,
        },
        boardId,
      },
      select: {
        id: true,
      },
    });

    const validColumnIds = new Set(columns.map((column) => column.id));

    const invalidColumnIds = uniqueColumnIds.filter(
      (columnId) => !validColumnIds.has(columnId),
    );

    if (invalidColumnIds.length > 0) {
      throw new BadRequestException(
        `The following columns do not belong to this board: ${invalidColumnIds.join(
          ', ',
        )}`,
      );
    }

    if (uniqueColumnIds.length !== columnIds.length) {
      throw new BadRequestException(
        'A column cannot be added to the form more than once',
      );
    }
  }

  async create(boardId: number, dto: CreateBoardFormDto) {
    console.log({ boardId });
    console.log({ dto });
    await this.validateBoard(boardId);
    await this.validateColumns(boardId, dto.fields);

    const existingForm = await this.prisma.boardForm.findUnique({
      where: {
        boardId,
      },
    });

    if (existingForm) {
      throw new BadRequestException('This board already has a form');
    }

    return this.prisma.$transaction(async (tx) => {
      const form = await tx.boardForm.create({
        data: {
          boardId,
          title: dto.title,
          description: dto.description,
          submitLabel: dto.submitLabel ?? 'Submit',
          isActive: dto.isActive ?? true,

          fields: {
            create: dto.fields.map((field, index) => ({
              columnId: field.columnId,
              label: field.label,
              description: field.description,
              position: field.position ?? index,
              required: field.required ?? false,
              hidden: field.hidden ?? false,
            })),
          },
        },

        include: {
          fields: {
            include: {
              column: true,
            },
            orderBy: {
              position: 'asc',
            },
          },
          board: true,
        },
      });

      return form;
    });
  }

  async findByBoardId(boardId: number) {
    await this.validateBoard(boardId);

    return this.prisma.boardForm.findUnique({
      where: {
        boardId,
      },
      include: {
        fields: {
          include: {
            column: true,
          },
          orderBy: {
            position: 'asc',
          },
        },
        board: true,
      },
    });
  }

  async update(boardId: number, dto: UpdateBoardFormDto) {
    const form = await this.prisma.boardForm.findUnique({
      where: {
        boardId,
      },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    if (dto.fields) {
      await this.validateColumns(boardId, dto.fields);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.boardForm.update({
        where: {
          boardId,
        },
        data: {
          ...(dto.title !== undefined && {
            title: dto.title,
          }),

          ...(dto.description !== undefined && {
            description: dto.description,
          }),

          ...(dto.submitLabel !== undefined && {
            submitLabel: dto.submitLabel,
          }),

          ...(dto.isActive !== undefined && {
            isActive: dto.isActive,
          }),
        },
      });

      if (dto.fields) {
        await tx.boardFormField.deleteMany({
          where: {
            formId: form.id,
          },
        });

        if (dto.fields.length > 0) {
          await tx.boardFormField.createMany({
            data: dto.fields.map((field, index) => ({
              formId: form.id,
              columnId: field.columnId,
              label: field.label,
              description: field.description,
              position: field.position ?? index,
              required: field.required ?? false,
              hidden: field.hidden ?? false,
            })),
          });
        }
      }

      return tx.boardForm.findUnique({
        where: {
          id: form.id,
        },
        include: {
          fields: {
            include: {
              column: true,
            },
            orderBy: {
              position: 'asc',
            },
          },
          board: true,
        },
      });
    });
  }

  async delete(boardId: number) {
    const form = await this.prisma.boardForm.findUnique({
      where: {
        boardId,
      },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    await this.prisma.boardForm.delete({
      where: {
        id: form.id,
      },
    });

    return {
      message: 'Form deleted successfully',
    };
  }
}
