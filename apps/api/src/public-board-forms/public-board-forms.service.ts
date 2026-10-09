import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "prisma/prisma.service";
import { BoardColumnType, NotificationType } from "generated/prisma/enums";
import { SubmitBoardFormDto } from "src/board-forms/dto/submit-board-form.dto";
import { NotificationsService } from "src/notifications/notifications.service";
import { NotificationStreamService } from "src/notifications/notification-stream.service";

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

interface ResolvedUser {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl: string | null;
}

function normalizeCellValue(
  type: BoardColumnType,
  raw: unknown,
  statusOptions: {
    id: number;
    label: string;
    color: string;
  }[],
  userMap?: Map<number, ResolvedUser>,
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

    case BoardColumnType.PERSON: {
      /* Value submitted as { userId: number } from the member picker */
      const userId = Number((raw as any)?.userId ?? (raw as any)?.id ?? raw);
      if (!userId || Number.isNaN(userId)) return {};
      /* Include full user data so the board cell can render name + avatar */
      const user = userMap?.get(userId);
      return {
        users: [{
          id: userId,
          firstName: user?.firstName ?? null,
          lastName: user?.lastName ?? null,
          email: user?.email ?? null,
          avatarUrl: user?.avatarUrl ?? null,
        }],
      };
    }

    case BoardColumnType.LINK: {
      const url = String(raw ?? "").trim();
      if (!url) return {};
      return { url };
    }

    case BoardColumnType.LONG_TEXT:
      return { text: String(raw ?? "") };

    default:
      return {};
  }
}

const FORM_INCLUDE = {
  fields: {
    include: {
      column: {
        include: {
          statusOptions: true,
        },
      },
    },
    orderBy: { position: "asc" as const },
  },
} as const;

@Injectable()
export class PublicBoardFormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationStreamService: NotificationStreamService,
  ) {}

  /**
   * Resolve a URL identifier to a boardId.
   * Accepts either a numeric board ID (legacy links like /form/17)
   * or a UUID share token (new links like /form/550e8400-...).
   */
  private async resolveBoardId(identifier: string): Promise<number> {
    const numericId = parseInt(identifier, 10);
    if (!isNaN(numericId) && String(numericId) === identifier) {
      return numericId;
    }
    const form = await this.prisma.boardForm.findFirst({
      where: { shareToken: identifier },
      select: { boardId: true },
    });
    if (!form) {
      throw new NotFoundException("Form not found");
    }
    return form.boardId;
  }

  /**
   * Ensure a form has a shareToken, generating one lazily if missing
   * (handles rows created before the column was added).
   */
  private async ensureShareToken(formId: number, existing: string | null): Promise<string> {
    if (existing) return existing;
    const { randomUUID } = await import("crypto");
    const token = randomUUID();
    await this.prisma.boardForm.update({
      where: { id: formId },
      data: { shareToken: token },
    });
    return token;
  }

  /**
   * Return the public form definition by a URL identifier (boardId or shareToken).
   */
  async findPublicByIdentifier(identifier: string) {
    const boardId = await this.resolveBoardId(identifier);
    return this.findPublicByBoardId(boardId);
  }

  /**
   * Return board members by URL identifier (boardId or shareToken).
   */
  async getMembersByIdentifier(identifier: string) {
    const boardId = await this.resolveBoardId(identifier);
    return this.getBoardMembers(boardId);
  }

  /**
   * Submit a public form by URL identifier (boardId or shareToken).
   */
  async submitByIdentifier(identifier: string, dto: SubmitBoardFormDto) {
    const boardId = await this.resolveBoardId(identifier);
    return this.submit(boardId, dto);
  }

  /**
   * Return the list of board members for the member picker on public forms.
   * This is intentionally public — only non-sensitive fields are returned.
   */
  async getBoardMembers(boardId: number) {
    const members = await this.prisma.boardMember.findMany({
      where: { boardId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const apiBase = process.env.API_URL ?? '';
    return members.map((m) => {
      let avatarUrl = m.user.avatarUrl ?? null;
      if (avatarUrl && avatarUrl.startsWith('/')) {
        avatarUrl = `${apiBase}${avatarUrl}`;
      }
      return {
        id: m.user.id,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        email: m.user.email,
        avatarUrl,
        role: m.role,
      };
    });
  }

  /**
   * Return the public form definition for a board.
   */
  async findPublicByBoardId(boardId: number) {
    const form = await this.prisma.boardForm.findUnique({
      where: { boardId },
      include: FORM_INCLUDE,
    });

    if (!form) {
      throw new NotFoundException("Form not found");
    }

    if (!form.isActive) {
      throw new NotFoundException("Form is not active");
    }

    // Lazily generate shareToken for forms created before the column existed
    const shareToken = await this.ensureShareToken(form.id, form.shareToken);

    return { ...form, shareToken };
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
          workspaceId: true,
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

    /* ── Pre-fetch user data for PERSON submissions ── */
    const personUserIds = dto.values
      .filter((v) => {
        const field = fieldByColumnId.get(v.columnId);
        return field?.column.type === BoardColumnType.PERSON;
      })
      .map((v) => Number((v.value as any)?.userId ?? (v.value as any)?.id))
      .filter((id) => id > 0 && !Number.isNaN(id));

    const personUsers =
      personUserIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: personUserIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          })
        : [];

    const userMap = new Map<number, ResolvedUser>(
      personUsers.map((u) => [u.id, u]),
    );

    /* ── Collect FILE submissions for post-transaction processing ── */
    const fileSubmissions = dto.values.filter((v) => {
      const field = fieldByColumnId.get(v.columnId);
      return (
        field?.column.type === BoardColumnType.FILE &&
        (v.value as any)?.storageKey
      );
    });

    const { taskId, taskName, createdCells } = await this.prisma.$transaction(async (tx) => {
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
          userMap,
        );

        /* Only set value if normalization produced actual content */
        const hasValue =
          normalized !== null &&
          normalized !== undefined &&
          !(typeof normalized === 'object' && Object.keys(normalized as object).length === 0);

        return {
          column: {
            connect: {
              id: column.id,
            },
          },
          ...(hasValue ? { value: normalized as any } : {}),
        };
      });

      /**
       * Create task + cells in one operation.
       */
      const task = await tx.task.create({
        data: {
          groupId: form.groupId,
          createdById: board.createdById,
          name: taskName,
          order: lastTask ? lastTask.order + ORDER_GAP : ORDER_GAP,
          isFormSubmission: true,
          cells: { create: cells },
        },
        select: {
          id: true,
          cells: {
            select: { id: true, columnId: true },
          },
        },
      });

      return { taskId: task.id, taskName, createdCells: task.cells };
    });

    /* ── Create File + TaskCellFile records for FILE submissions ── */
    for (const sub of fileSubmissions) {
      const fileValue = sub.value as any;
      const cell = createdCells.find((c) => c.columnId === sub.columnId);
      if (!cell) continue;
      try {
        const file = await this.prisma.file.create({
          data: {
            fileName: fileValue.originalName ?? 'upload',
            mimeType: fileValue.mimeType ?? 'application/octet-stream',
            fileSize: fileValue.size ?? 0,
            storageKey: fileValue.storageKey,
            url: fileValue.url,
            uploadedById: board.createdById,
          },
        });
        await this.prisma.taskCellFile.create({
          data: { cellId: cell.id, fileId: file.id },
        });
      } catch {
        // Non-critical — the file was uploaded, just the DB record failed
      }
    }

    /**
     * Notify board admins/owners about the new form submission.
     * Runs after the transaction commits — failure must not break the response.
     */
    try {
      const boardAdmins = await this.prisma.boardMember.findMany({
        where: {
          boardId,
          role: { in: ["OWNER", "ADMIN"] },
        },
        select: { userId: true },
      });

      const recipientIds = boardAdmins.length > 0
        ? boardAdmins.map((m) => m.userId)
        : [board.createdById];

      for (const recipientId of recipientIds) {
        const notification = await this.notificationsService.notify({
          recipientId,
          type: NotificationType.FORM_SUBMITTED,
          title: "New form submission",
          message: `A new form was submitted: "${taskName}"`,
          entityType: "BOARD" as any,
          entityId: boardId,
          metadata: {
            boardId,
            workspaceId: board.workspaceId,
            taskId,
          },
          sendEmail: true,
        });

        this.notificationStreamService.emit(recipientId, notification);
      }
    } catch {
      // Notification failure must not break the form submission response
    }

    return {
      taskId,
      message: "Form submitted successfully",
    };
  }
}