import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreateBoardFormDto } from "./dto/create-board-form.dto";
import { UpdateBoardFormDto } from "./dto/update-board-form.dto";
import { SubmitBoardFormDto } from "./dto/submit-board-form.dto";
import { PrismaService } from "prisma/prisma.service";

@Injectable()
export class BoardFormsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get form by view.
   */
  async getByView(
    boardId: number,
    viewId: number,
  ) {
    const view = await this.prisma.boardView.findFirst({
      where: {
        id: viewId,
        boardId,
      },
    });

    if (!view) {
      throw new NotFoundException("Board view not found");
    }

    const form = await this.prisma.form.findUnique({
      where: {
        viewId,
      },
      include: {
        fields: {
          include: {
            column: true,
          },
          orderBy: {
            position: "asc",
          },
        },
      },
    });

    if (!form) {
      throw new NotFoundException(
        "Form not found for this view",
      );
    }

    return form;
  }

  /**
   * Create a form for a board view.
   */
  async create(
    boardId: number,
    viewId: number,
    dto: CreateBoardFormDto,
  ) {
    const view = await this.prisma.boardView.findFirst({
      where: {
        id: viewId,
        boardId,
      },
    });

    if (!view) {
      throw new NotFoundException("Board view not found");
    }

    if (view.type !== "FORM") {
      throw new BadRequestException(
        "A form can only be created for a FORM view",
      );
    }

    const existingForm = await this.prisma.form.findUnique({
      where: {
        viewId,
      },
    });

    if (existingForm) {
      throw new BadRequestException(
        "This view already has a form",
      );
    }

    await this.validateColumns(
      boardId,
      dto.fields.map((field) => field.columnId),
    );

    return this.prisma.$transaction(async (tx) => {
      const form = await tx.form.create({
        data: {
          viewId,
          title: dto.title,
          description: dto.description,
          submitLabel: dto.submitLabel,
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
              position: "asc",
            },
          },
        },
      });

      return form;
    });
  }

  /**
   * Update an existing form.
   */
  async update(
    boardId: number,
    viewId: number,
    dto: UpdateBoardFormDto,
  ) {
    const form = await this.prisma.form.findFirst({
      where: {
        viewId,
        view: {
          boardId,
        },
      },
    });

    if (!form) {
      throw new NotFoundException("Form not found");
    }

    if (dto.fields) {
      await this.validateColumns(
        boardId,
        dto.fields.map((field) => field.columnId),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.form.update({
        where: {
          id: form.id,
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

      /**
       * Replace fields only when fields were provided.
       */
      if (dto.fields) {
        await tx.formField.deleteMany({
          where: {
            formId: form.id,
          },
        });

        await tx.formField.createMany({
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

      return tx.form.findUnique({
        where: {
          id: form.id,
        },
        include: {
          fields: {
            include: {
              column: true,
            },
            orderBy: {
              position: "asc",
            },
          },
        },
      });
    });
  }

  /**
   * Delete a form.
   */
  async remove(
    boardId: number,
    viewId: number,
  ) {
    const form = await this.prisma.form.findFirst({
      where: {
        viewId,
        view: {
          boardId,
        },
      },
    });

    if (!form) {
      throw new NotFoundException("Form not found");
    }

    await this.prisma.form.delete({
      where: {
        id: form.id,
      },
    });

    return {
      message: "Form deleted successfully",
    };
  }

  /**
   * Validate that all columns belong to the board.
   */
  private async validateColumns(
    boardId: number,
    columnIds: number[],
  ) {
    const uniqueColumnIds = [
      ...new Set(columnIds),
    ];

    if (!uniqueColumnIds.length) {
      return;
    }

    const columns =
      await this.prisma.boardColumn.findMany({
        where: {
          boardId,
          id: {
            in: uniqueColumnIds,
          },
        },
        select: {
          id: true,
        },
      });

    if (columns.length !== uniqueColumnIds.length) {
      throw new BadRequestException(
        "One or more columns do not belong to this board",
      );
    }
  }
}