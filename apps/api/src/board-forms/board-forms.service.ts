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
  private async validateStatusOptions(
    boardId: number,
    fields: CreateBoardFormFieldDto[],
  ) {
    const statusFields = fields.filter(
      (field) => field.statusOptions && field.statusOptions.length > 0,
    );

    if (!statusFields.length) {
      return;
    }

    const columnIds = statusFields.map((field) => field.columnId);

    const columns = await this.prisma.boardColumn.findMany({
      where: {
        id: {
          in: columnIds,
        },
        boardId,
      },
      include: {
        statusOptions: true,
      },
    });

    const columnsMap = new Map(columns.map((column) => [column.id, column]));

    for (const field of statusFields) {
      const column = columnsMap.get(field.columnId);

      if (!column) {
        throw new BadRequestException(
          `Column ${field.columnId} does not belong to this board`,
        );
      }

      const validOptionIds = new Set(
        column.statusOptions.map((option) => option.id),
      );

      const invalidOptionIds = field
        .statusOptions!.filter(
          (option) =>
            option.id !== undefined && !validOptionIds.has(Number(option.id)),
        )
        .map((option) => option.id);

      if (invalidOptionIds.length > 0) {
        throw new BadRequestException(
          `The following status options do not belong to column ${field.columnId}: ${invalidOptionIds.join(
            ', ',
          )}`,
        );
      }
    }
  }

  /**
   * Create board form.
   */
  async create(boardId: number, dto: CreateBoardFormDto) {
    console.log('CREATE BOARD FORM');
    console.log('boardId:', boardId);
    console.log('dto:', JSON.stringify(dto, null, 2));

    await this.validateBoard(boardId);

    await this.validateColumns(boardId, dto.fields);

    await this.validateStatusOptions(boardId, dto.fields);

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

          groupId: dto.groupId,

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
              column: {
                include: {
                  statusOptions: true,
                },
              },
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
            column: {
              include: {
                statusOptions: true,
              },
            },
          },
          orderBy: {
            position: 'asc',
          },
        },
        board: true,
      },
    });
  }

  /**
   * Update board form.
   */
  async update(boardId: number, dto: UpdateBoardFormDto) {
    await this.validateBoard(boardId);

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

      await this.validateStatusOptions(boardId, dto.fields);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.boardForm.update({
        where: {
          boardId,
        },

        data: {
          ...(dto.groupId !== undefined && {
            groupId: dto.groupId,
          }),

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

      /**
       * Replace form fields when fields are
       * supplied in the update payload.
       *
       * We DO NOT delete status options here
       * because they belong to the board column,
       * not the form field.
       */
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
              column: {
                include: {
                  statusOptions: true,
                },
              },
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

  /**
   * Delete board form.
   */
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
