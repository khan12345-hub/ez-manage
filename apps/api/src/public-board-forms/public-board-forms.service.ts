import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BoardColumnType } from 'generated/prisma/enums';
import { SubmitBoardFormDto } from 'src/board-forms/dto/submit-board-form.dto';

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
  statusOptions: { id: number; label: string; color: string }[],
): unknown {
  switch (type) {
    case BoardColumnType.TEXT:
      return { text: String(raw ?? '') };

    case BoardColumnType.NUMBER:
      return { number: Number(raw) };

    case BoardColumnType.CHECKBOX:
      return { checked: Boolean(raw) };

    case BoardColumnType.DATE: {
      const iso = normalizeDateValue(raw);
      return iso ? { date: iso } : {};
    }

    case BoardColumnType.TIMELINE: {
      const tl = raw as { startDate?: string; endDate?: string } | undefined;
      return {
        startDate: tl?.startDate ?? null,
        endDate: tl?.endDate ?? null,
      };
    }

    case BoardColumnType.STATUS: {
      // The frontend sends the StatusOption.label string as the value.
      // We look up the matching option to store { label, color } — the same
      // shape the board uses when a user picks a status manually.
      const label = String(raw ?? '');
      const option = statusOptions.find((o) => o.label === label);
      if (!option) return {};
      return { label: option.label, color: option.color };
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
   * Throws if the form does not exist or is inactive.
   */
  async findPublicByBoardId(boardId: number) {
    const form = await this.prisma.boardForm.findUnique({
      where: { boardId },
      include: {
        fields: {
          include: {
            column: {
              include: { statusOptions: true },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    if (!form.isActive) {
      throw new NotFoundException('Form is not active');
    }

    return form;
  }

  /**
   * Submit a public board form.
   *
   * Steps:
   *  1. Load and validate the form (active, belongs to board).
   *  2. Create a new Task in the form's target group.
   *  3. For every submitted value, find the matching TaskCell and update it
   *     with the normalised value for that column type.
   *
   * Everything runs inside a single transaction so a partial failure
   * leaves no orphaned task.
   */
  async submit(boardId: number, dto: SubmitBoardFormDto) {
    // 1. Load form + fields + column types
    const form = await this.prisma.boardForm.findUnique({
      where: { boardId },
      include: {
        fields: {
          include: {
            column: {
              include: { statusOptions: true },
            },
          },
        },
      },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    if (!form.isActive) {
      throw new BadRequestException('This form is currently inactive');
    }

    // Build a columnId → field map for quick lookup
    const fieldByColumnId = new Map(
      form.fields.map((f) => [f.columnId, f]),
    );

    // Validate that every submitted columnId actually belongs to this form
    for (const val of dto.values) {
      if (!fieldByColumnId.has(val.columnId)) {
        throw new BadRequestException(
          `Column ${val.columnId} is not part of this form`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 2. Find the last task in the group so we can append after it
      const lastTask = await tx.task.findFirst({
        where: { groupId: form.groupId, parentId: null },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      // Fetch all non-primary columns for the board so we can create cells
      const boardColumns = await tx.boardColumn.findMany({
        where: { boardId, isPrimary: false },
        select: { id: true },
        orderBy: { order: 'asc' },
      });

      const primaryField = form.fields.find((field) => field.column.isPrimary);
      const primaryValue = dto.values.find(
        (value) => value.columnId === primaryField?.columnId,
      )?.value;

      const taskName =
        dto.taskName?.trim() ||
        String(primaryValue ?? '').trim() ||
        'Form submission';

      // Create the task with empty cells for every column
      const task = await tx.task.create({
        data: {
          groupId: form.groupId,
          // Public submissions are anonymous — reuse the board creator as a
          // placeholder (tasks require a createdById FK).
          createdById: await tx.board
            .findUniqueOrThrow({ where: { id: boardId }, select: { createdById: true } })
            .then((b) => b.createdById),
          name: taskName,
          order: lastTask ? lastTask.order + ORDER_GAP : ORDER_GAP,
          cells: {
            create: boardColumns.map((col) => ({
              column: { connect: { id: col.id } },
            })),
          },
        },
        include: { cells: { include: { column: true } } },
      });

      // 3. Apply submitted values to their corresponding cells
      const updatePromises = dto.values
        .map((val) => {
          const field = fieldByColumnId.get(val.columnId);
          if (!field) return null;

          const cell = task.cells.find((c) => c.columnId === val.columnId);
          if (!cell) return null;

          const normalized = normalizeCellValue(
            field.column.type as BoardColumnType,
            val.value,
            field.column.statusOptions,
          );

          return tx.taskCell.update({
            where: { id: cell.id },
            data: { value: normalized as any },
          });
        })
        .filter(Boolean);

      await Promise.all(updatePromises);

      return {
        taskId: task.id,
        message: 'Form submitted successfully',
      };
    });
  }
}
