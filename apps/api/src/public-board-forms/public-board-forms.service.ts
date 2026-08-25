import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "prisma/prisma.service";
import { BoardColumnType } from "generated/prisma/enums";
import { SubmitBoardFormDto } from "src/board-forms/dto/submit-board-form.dto";

const ORDER_GAP = 1000;

function normalizeDateValue(raw: unknown): string | null {
  if (!raw) return null;

  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw.toISOString();
  }

  const value = String(raw).trim();

  if (!value) return null;

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00.000Z`)
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeCellValue(
  type: BoardColumnType,
  raw: unknown,
  statusOptions: {
    id: number;
    label: string;
    color: string;
  }[],
): unknown {
  switch (type) {
    case BoardColumnType.TEXT:
      return {
        text: String(raw ?? ""),
      };

    case BoardColumnType.NUMBER: {
      const number = Number(raw);

      return {
        number: Number.isNaN(number) ? null : number,
      };
    }

    case BoardColumnType.CHECKBOX:
      return {
        checked:
          raw === true ||
          raw === "true" ||
          raw === 1 ||
          raw === "1",
      };

    case BoardColumnType.DATE: {
      const iso = normalizeDateValue(raw);

      return iso
        ? {
            date: iso,
          }
        : {};
    }

    case BoardColumnType.TIMELINE: {
      const timeline = raw as
        | {
            startDate?: string;
            endDate?: string;
          }
        | undefined;

      return {
        startDate: timeline?.startDate ?? null,
        endDate: timeline?.endDate ?? null,
      };
    }

    case BoardColumnType.STATUS: {
      const label = String(raw ?? "").trim();

      if (!label) {
        return {};
      }

      const option = statusOptions.find(
        (status) => status.label === label,
      );

      if (!option) {
        return {};
      }

      return {
        label: option.label,
        color: option.color,
      };
    }

    default:
      return raw ?? null;
  }
}

@Injectable()
export class PublicBoardFormsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return the public form definition for a board.
   */
  async findPublicByBoardId(boardId: number) {
    const form = await this.prisma.boardForm.findUnique({
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
            position: "asc",
          },
        },
      },
    });

    if (!form) {
      throw new NotFoundException("Form not found");
    }

    if (!form.isActive) {
      throw new NotFoundException("Form is not active");
    }

    return form;
  }

  /**
   * Submit a public board form.
   *
   * Creates the task and all of its cells in one transaction.
   *
   * Cell values are normalized before creation, so we don't need
   * to create empty cells and then update them individually.
   */
  async submit(boardId: number, dto: SubmitBoardFormDto) {
    /**
     * Load the form and board creator before opening the transaction.
     *
     * This keeps the transaction as short as possible.
     */
    const [form, board] = await Promise.all([
      this.prisma.boardForm.findUnique({
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
          },
        },
      }),

      this.prisma.board.findUnique({
        where: {
          id: boardId,
        },
        select: {
          createdById: true,
        },
      }),
    ]);

    if (!form) {
      throw new NotFoundException("Form not found");
    }

    if (!form.isActive) {
      throw new BadRequestException(
        "This form is currently inactive",
      );
    }

    if (!board) {
      throw new NotFoundException("Board not found");
    }

    /**
     * columnId -> form field
     */
    const fieldByColumnId = new Map(
      form.fields.map((field) => [
        field.columnId,
        field,
      ]),
    );

    /**
     * Validate submitted columns.
     */
    for (const value of dto.values) {
      if (!fieldByColumnId.has(value.columnId)) {
        throw new BadRequestException(
          `Column ${value.columnId} is not part of this form`,
        );
      }
    }

    /**
     * columnId -> submitted value
     *
     * This avoids repeatedly calling .find() while
     * creating cells.
     */
    const submittedValues = new Map(
      dto.values.map((value) => [
        value.columnId,
        value.value,
      ]),
    );

    return this.prisma.$transaction(async (tx) => {
      /**
       * Find the last root task in the target group.
       */
      const lastTask = await tx.task.findFirst({
        where: {
          groupId: form.groupId,
          parentId: null,
        },
        orderBy: {
          order: "desc",
        },
        select: {
          order: true,
        },
      });

      /**
       * Fetch all non-primary board columns.
       */
      const boardColumns = await tx.boardColumn.findMany({
        where: {
          boardId,
          isPrimary: false,
        },
        select: {
          id: true,
        },
        orderBy: {
          order: "asc",
        },
      });

      /**
       * Find the primary form field.
       *
       * Usually this is the Name column.
       */
      const primaryField = form.fields.find(
        (field) => field.column.isPrimary,
      );

      const primaryValue = primaryField
        ? submittedValues.get(primaryField.columnId)
        : undefined;

      /**
       * Determine task name.
       */
      const taskName =
        dto.taskName?.trim() ||
        String(primaryValue ?? "").trim() ||
        "Form submission";

      /**
       * Build cells in memory.
       *
       * Previously:
       *
       * create empty cells
       *       ↓
       * find every cell
       *       ↓
       * update every submitted cell
       *
       * Now:
       *
       * normalize values
       *       ↓
       * create cells once
       */
      const cells = boardColumns.map((column) => {
        const field = fieldByColumnId.get(column.id);

        /**
         * No form field for this column.
         * Create an empty cell.
         */
        if (!field) {
          return {
            column: {
              connect: {
                id: column.id,
              },
            },
          };
        }

        const rawValue = submittedValues.get(
          column.id,
        );

        /**
         * No submitted value.
         */
        if (rawValue === undefined) {
          return {
            column: {
              connect: {
                id: column.id,
              },
            },
          };
        }

        const normalized = normalizeCellValue(
          field.column.type as BoardColumnType,
          rawValue,
          field.column.statusOptions,
        );

        return {
          column: {
            connect: {
              id: column.id,
            },
          },
          value: normalized as any,
        };
      });

      /**
       * Create task + cells in one operation.
       */
      const task = await tx.task.create({
        data: {
          groupId: form.groupId,

          /**
           * Public submissions are anonymous.
           * Use board creator because createdById is required.
           */
          createdById: board.createdById,

          name: taskName,

          order: lastTask
            ? lastTask.order + ORDER_GAP
            : ORDER_GAP,

          cells: {
            create: cells,
          },
        },

        select: {
          id: true,
        },
      });

      return {
        taskId: task.id,
        message: "Form submitted successfully",
      };
    });
  }
}