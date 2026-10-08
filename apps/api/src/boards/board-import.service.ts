import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'prisma/prisma.service';

import { BoardColumnType, BoardMemberRole } from 'generated/prisma/enums';

import { Prisma } from 'generated/prisma/client';

import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

import { ImportExcelBoardDto } from './dto/import-excel-board.dto';
import { FileImportService, FileImportJobData } from 'src/file-import/file-import.processor';
import { MailService } from 'src/mail/mail.service';
import { welcomeEmailTemplate } from 'src/mail/templates/welcome.template';

type ImportedRow = Record<string, unknown>;

type StatusOptionData = {
  label: string;
  color?: string;
};

type StatusOptionMap = Map<
  string,
  {
    id: number;
    label: string;
    color: string;
  }
>;

type GroupedRows = {
  name: string;
  color?: string;
  rows: ImportedRow[];
};

type SkippedItem = {
  rowIndex: number;
  taskName?: string;
  column?: string;
  reason: string;
};

@Injectable()
export class BoardImportService {
  private readonly logger = new Logger(BoardImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileImportService: FileImportService,
    private readonly mailService: MailService,
  ) {}

  // ── Public entry point: creates job & fires background import ───────────────

  async startImport(dto: ImportExcelBoardDto, userId: number): Promise<{ jobId: number }> {
    const job = await this.prisma.boardImportJob.create({
      data: { userId, boardName: dto.boardName, totalRows: dto.rows.length },
    });

    // Fire and forget — do NOT await
    void this.importExcelBoard(job.id, dto, userId).catch(async (err) => {
      await this.prisma.boardImportJob.update({
        where: { id: job.id },
        data: { status: 'failed', error: err?.message ?? 'Import failed' },
      }).catch(() => {});
    });

    return { jobId: job.id };
  }

  async getImportJob(jobId: number, userId: number) {
    return this.prisma.boardImportJob.findFirst({
      where: { id: jobId, userId },
      select: { id: true, boardName: true, status: true, totalRows: true, boardId: true, error: true, summary: true, createdAt: true },
    });
  }

  // ── Actual import (runs in background) ──────────────────────────────────────

  async importExcelBoard(jobId: number, dto: ImportExcelBoardDto, userId: number) {
    const pendingDownloads: FileImportJobData[] = [];
    const skippedItems: SkippedItem[] = [];

    // Counters accumulated across the import (mutated inside the tx closure).
    let totalTasksCreated = 0;
    let totalCommentsCreated = 0;
    let totalTimeEntriesCreated = 0;
    let totalUsersCreated = 0;

    // Pre-resolve Monday.com asset IDs before the DB transaction starts
    // (HTTP calls must not run inside a transaction).
    const assetUrlMap = await this.resolveMonDayAssets(dto.comments ?? []);

    // Pre-hash passwords for users to create outside the transaction.
    // bcrypt is CPU-bound and should not hold a DB connection open.
    // tempPassword is kept in memory only long enough to email, then discarded.
    const userCreationData = await Promise.all(
      (dto.usersToCreate ?? [])
        .filter((u) => u.email?.trim() && u.firstName?.trim())
        .map(async (u) => {
          const tempPassword = randomBytes(10).toString('hex');
          return {
            firstName: u.firstName.trim(),
            lastName: (u.lastName ?? '').trim(),
            email: u.email.toLowerCase().trim(),
            workspaceRole: u.workspaceRole ?? 'MEMBER',
            boardRole: u.boardRole ?? 'MEMBER',
            tempPassword,
            hashedPassword: await bcrypt.hash(tempPassword, 10),
          };
        }),
    );

    // Track which users were newly created (vs already existing) for welcome emails.
    const newlyCreatedEmails = new Set<string>();

    const result = await this.prisma.$transaction(
      async (tx) => {
        /*
         * ---------------------------------------------------------
         * 0. Create / resolve imported users
         *
         * Users are created here (inside the transaction) so the
         * whole import rolls back atomically if anything fails.
         * Passwords were pre-hashed above to keep bcrypt CPU work
         * outside the DB connection window.
         * ---------------------------------------------------------
         */

        // Map of normalized name/email → userId for all imported users.
        // Merged into personEmailToUserId after the person-lookup step.
        const importedUserMap = new Map<string, number>();

        // Users to add as board members after the board is created.
        const importedBoardMembers: { id: number; boardRole: string }[] = [];

        for (const u of userCreationData) {
          const existing = await tx.user.findFirst({
            where: { email: u.email, deletedAt: null },
            select: { id: true, firstName: true, lastName: true },
          });

          let targetUserId: number;
          let fName: string;
          let lName: string;

          if (existing) {
            targetUserId = existing.id;
            fName = existing.firstName;
            lName = existing.lastName;
          } else {
            totalUsersCreated++;
            newlyCreatedEmails.add(u.email);
            const created = await tx.user.create({
              data: {
                firstName: u.firstName,
                lastName: u.lastName,
                email: u.email,
                password: u.hashedPassword,
                systemRole: 'USER' as any,
                createdById: userId,
              },
              select: { id: true },
            });
            targetUserId = created.id;
            fName = u.firstName;
            lName = u.lastName;
          }

          // Upsert workspace membership (no-op if already a member).
          await (tx as any).workspaceMember.upsert({
            where: {
              workspaceId_userId: {
                workspaceId: dto.workspaceId,
                userId: targetUserId,
              },
            },
            create: {
              workspaceId: dto.workspaceId,
              userId: targetUserId,
              role: u.workspaceRole,
            },
            update: {},
          });

          importedBoardMembers.push({ id: targetUserId, boardRole: u.boardRole });

          // Register under email, full name, and first name for person resolution.
          importedUserMap.set(u.email, targetUserId);
          const fullName = `${fName} ${lName}`.toLowerCase().trim();
          const firstName = fName.toLowerCase().trim();
          importedUserMap.set(fullName, targetUserId);
          if (!importedUserMap.has(firstName)) {
            importedUserMap.set(firstName, targetUserId);
          }
        }

        /*
         * ---------------------------------------------------------
         * 1. Validate workspace
         * ---------------------------------------------------------
         */

        const workspace = await tx.workspace.findUnique({
          where: {
            id: dto.workspaceId,
          },
          select: {
            id: true,
          },
        });

        if (!workspace) {
          throw new NotFoundException('Workspace not found.');
        }

        /*
         * ---------------------------------------------------------
         * 2. Validate board name / duplicate board
         * ---------------------------------------------------------
         */

        const boardName = dto.boardName.trim();

        if (!boardName) {
          throw new ConflictException('Board name is required.');
        }

        const existingBoard = await tx.board.findFirst({
          where: {
            workspaceId: dto.workspaceId,
            name: boardName,
          },
          select: {
            id: true,
          },
        });

        if (existingBoard) {
          throw new ConflictException(
            'A board with this name already exists in this workspace.',
          );
        }

        /*
         * ---------------------------------------------------------
         * 3. Create board
         * ---------------------------------------------------------
         */

        const board = await tx.board.create({
          data: {
            name: boardName,
            workspaceId: dto.workspaceId,
            visibility: dto.visibility ?? 'PUBLIC',
            createdById: userId,

            members: {
              create: {
                userId,
                role: BoardMemberRole.OWNER,
              },
            },
          },
        });

        // Add users from usersToCreate as board members.
        for (const iu of importedBoardMembers) {
          await (tx as any).boardMember.upsert({
            where: { boardId_userId: { boardId: board.id, userId: iu.id } },
            create: {
              boardId: board.id,
              userId: iu.id,
              role: iu.boardRole,
              accessAllGroups: true,
            },
            update: {},
          });
        }

        /*
         * ---------------------------------------------------------
         * 4. Prepare column mappings
         *
         * __groupName / __groupColor are parser metadata and
         * must NEVER become board columns.
         *
         * The task column is the primary board column.
         * ---------------------------------------------------------
         */

        const mappings = dto.columns.filter((mapping) => {
          const sourceColumn = mapping.sourceColumn?.trim();

          if (!sourceColumn) {
            return false;
          }

          if (sourceColumn === '__groupName') {
            return false;
          }

          if (sourceColumn === '__groupColor') {
            return false;
          }

          if (
            this.normalizeKey(sourceColumn) ===
            this.normalizeKey(dto.taskColumn)
          ) {
            return false;
          }

          if (
            dto.groupColumn &&
            this.normalizeKey(sourceColumn) ===
              this.normalizeKey(dto.groupColumn)
          ) {
            return false;
          }

          return true;
        });

        // Separate comment mappings — these become TaskComments, not board columns
        // FILE_FEEDBACK mappings become FileComments only (not TaskComments, not board columns)
        // CREATION_LOG mappings set createdBy/createdAt on the task — no board column created
        // SKIP mappings are dropped entirely
        const commentMappings = mappings.filter(
          (m) => (m.type as string) === 'COMMENT',
        );
        const fileFeedbackMappings = mappings.filter(
          (m) => (m.type as string) === 'FILE_FEEDBACK',
        );
        const creationLogMappings = mappings.filter(
          (m) => (m.type as string) === 'CREATION_LOG',
        );
        const cellMappings = mappings.filter(
          (m) =>
            (m.type as string) !== 'COMMENT' &&
            (m.type as string) !== 'FILE_FEEDBACK' &&
            (m.type as string) !== 'CREATION_LOG' &&
            (m.type as string) !== 'SKIP',
        );

        /*
         * ---------------------------------------------------------
         * Find primary/task mapping
         * ---------------------------------------------------------
         */

        const primaryColumnMapping = dto.columns.find(
          (mapping) =>
            this.normalizeKey(mapping.sourceColumn) ===
            this.normalizeKey(dto.taskColumn),
        );

        const primaryColumnName =
          primaryColumnMapping?.targetColumn?.trim() ||
          dto.taskColumn.trim() ||
          'Name';

        /*
         * ---------------------------------------------------------
         * 5. Build column definitions
         * ---------------------------------------------------------
         */

        const columnDefinitions = [
          {
            name: primaryColumnName,
            type: BoardColumnType.TEXT,
            isPrimary: true,
          },

          ...cellMappings
            .filter((mapping) => {
              const targetName = mapping.targetColumn?.trim();

              return Boolean(targetName);
            })
            .map((mapping) => ({
              name: mapping.targetColumn.trim(),
              type: mapping.type,
              isPrimary: false,
            })),
        ];

        /*
         * ---------------------------------------------------------
         * Remove duplicate columns case-insensitively
         * ---------------------------------------------------------
         */

        const uniqueColumnDefinitions = columnDefinitions.filter(
          (column, index, array) => {
            const normalizedName = this.normalizeKey(column.name);

            return (
              array.findIndex(
                (item) => this.normalizeKey(item.name) === normalizedName,
              ) === index
            );
          },
        );

        /*
         * ---------------------------------------------------------
         * 6. Create board columns
         * ---------------------------------------------------------
         */

        const columns = await tx.boardColumn.createManyAndReturn({
          data: uniqueColumnDefinitions.map((column, index) => ({
            boardId: board.id,
            name: column.name,
            type: column.type as unknown as BoardColumnType,
            isPrimary: column.isPrimary,
            order: (index + 1) * 1000,
          })),
        });

        // Column used to attach URLs extracted from COMMENT column text.
        // Re-use the imported FILE column when available; otherwise create one.
        let urlFileColumn: { id: number } | null =
          columns.find((c) => c.type === (BoardColumnType.FILE as any)) ?? null;
        if (!urlFileColumn && commentMappings.length > 0) {
          urlFileColumn = await tx.boardColumn.create({
            data: {
              boardId: board.id,
              name: 'Files',
              type: BoardColumnType.FILE as any,
              isPrimary: false,
              order: (columns.length + 1) * 1000,
            },
            select: { id: true },
          });
        }

        /*
         * ---------------------------------------------------------
         * 7. Create status options
         * ---------------------------------------------------------
         */

        const statusOptionsByColumn = new Map<string, StatusOptionMap>();

        for (const mapping of cellMappings) {
          if (mapping.type !== BoardColumnType.STATUS) {
            continue;
          }

          const column = columns.find(
            (item) =>
              this.normalizeKey(item.name) ===
              this.normalizeKey(mapping.targetColumn),
          );

          if (!column) {
            continue;
          }

          const statusOptionsData = this.getUniqueStatusOptions(
            dto.rows,
            mapping.sourceColumn,
          );

          if (!statusOptionsData.length) {
            continue;
          }

          const statusOptions = await tx.statusOption.createManyAndReturn({
            data: statusOptionsData.map((option, index) => ({
              columnId: column.id,
              label: option.label,
              color: option.color || this.getStatusColor(index),
              order: (index + 1) * 1000,
            })),
          });

          const optionMap: StatusOptionMap = new Map();

          for (const option of statusOptions) {
            optionMap.set(this.normalizeKey(option.label), option);
          }

          statusOptionsByColumn.set(mapping.sourceColumn, optionMap);
        }

        /*
         * ---------------------------------------------------------
         * 7b. Build lookup map for PERSON columns
         *
         * Supports:
         *  - Email lookup  (e.g. john@company.com)
         *  - Full-name lookup (e.g. "Pankhuri Sharma" from Monday.com)
         *  - First-name-only lookup (e.g. "Radhika")
         *  - Comma-separated multi-person cells
         * ---------------------------------------------------------
         */

        const personEmailToUserId = new Map<string, number>();

        const personMappings = cellMappings.filter(
          (m) => m.type === BoardColumnType.PERSON,
        );

        if (personMappings.length > 0 || creationLogMappings.length > 0) {
          const allEmails = new Set<string>();
          const allDisplayNames = new Set<string>();

          for (const mapping of personMappings) {
            for (const row of dto.rows) {
              const raw = this.getFlexibleValue(row, mapping.sourceColumn);
              const display = this.extractDisplayValue(raw).toLowerCase().trim();
              if (!display) continue;

              // Support comma-separated multi-person cells
              const tokens = display.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
              for (const token of tokens) {
                if (token.includes('@')) {
                  allEmails.add(token);
                } else {
                  allDisplayNames.add(token);
                }
              }
            }
          }

          // Collect creator names from CREATION_LOG columns for user lookup
          for (const mapping of creationLogMappings) {
            for (const row of dto.rows) {
              const raw = this.getFlexibleValue(row, mapping.sourceColumn);
              const display = this.extractDisplayValue(raw).trim();
              if (!display) continue;
              const { nameStr } = this.parseCreationLog(display);
              if (nameStr) allDisplayNames.add(nameStr.toLowerCase());
            }
          }

          // 1. Email-based lookup
          if (allEmails.size > 0) {
            const emailUsers = await tx.user.findMany({
              where: { email: { in: Array.from(allEmails) }, deletedAt: null },
              select: { id: true, email: true },
            });
            for (const u of emailUsers) {
              personEmailToUserId.set(u.email.toLowerCase(), u.id);
            }
          }

          // 2. Name-based lookup (full name + first name)
          if (allDisplayNames.size > 0) {
            const workspaceUsers = await tx.user.findMany({
              where: { deletedAt: null },
              select: { id: true, firstName: true, lastName: true },
            });
            for (const u of workspaceUsers) {
              const fullName = `${u.firstName} ${u.lastName}`.toLowerCase().trim();
              const firstName = u.firstName.toLowerCase().trim();
              if (allDisplayNames.has(fullName)) {
                personEmailToUserId.set(fullName, u.id);
              }
              if (allDisplayNames.has(firstName)) {
                personEmailToUserId.set(firstName, u.id);
              }
            }
          }
        }

        // Merge users created/resolved from usersToCreate into the person map
        // so newly created users are immediately available for PERSON cell and
        // comment attribution resolution in the steps below.
        for (const [key, uid] of importedUserMap) {
          personEmailToUserId.set(key, uid);
        }

        /*
         * ---------------------------------------------------------
         * 8. Group imported rows
         * ---------------------------------------------------------
         */

        const groupedRows = this.groupImportedRows(dto.rows);

        let groupOrder = 1000;
        let globalRowCounter = 0;

        // Map Monday.com Item ID → DB task ID (needed for comment threading)
        const itemIdToTaskId = new Map<string, number>();
        // Detect which source column holds the Monday.com item ID
        const itemIdSourceCol = dto.columns.find((m) =>
          m.sourceColumn.toLowerCase().includes('item id'),
        )?.sourceColumn ?? null;

        /*
         * ---------------------------------------------------------
         * 9. Create groups
         * 10. Create tasks
         * 11. Create task cells
         * ---------------------------------------------------------
         */

        for (const groupData of groupedRows.values()) {
          /*
           * -------------------------------------------------------
           * Create group
           * -------------------------------------------------------
           */
          const group = await tx.group.create({
            data: {
              boardId: board.id,
              name: groupData.name || 'Imported Tasks',
              color: groupData.color || '#579BFC',
              order: groupOrder,
              createdById: userId,
            },
          });

          /*
           * -------------------------------------------------------
           * Resolve task names before creating tasks
           * -------------------------------------------------------
           */

          const allParsedRowsRaw = groupData.rows.map((row) => {
            const rowIdx = globalRowCounter++;
            const rawTaskValue = this.getFlexibleValue(row, dto.taskColumn);
            const taskName = this.getTaskName(rawTaskValue, row) || `Untitled ${rowIdx + 1}`;
            return { row, taskName, rowIdx };
          });

          const allParsedRows = allParsedRowsRaw as { row: ImportedRow; taskName: string; rowIdx: number }[];

          const validRows = allParsedRows.filter(
            (item) => !item.row['__isSubitem'],
          );

          const subitemRows = allParsedRows.filter(
            (item) => Boolean(item.row['__isSubitem']),
          );

          if (!validRows.length && !subitemRows.length) {
            groupOrder += 1000;
            continue;
          }

          /*
           * -------------------------------------------------------
           * Create regular tasks
           * -------------------------------------------------------
           */

          const tasks = validRows.length
            ? await tx.task.createManyAndReturn({
                data: validRows.map((item, index) => {
                  const base: { groupId: number; name: string; order: number; createdById: number; createdAt?: Date } = {
                    groupId: group.id,
                    name: item.taskName,
                    order: (index + 1) * 1000,
                    createdById: userId,
                  };
                  // Override creator/date from CREATION_LOG column when present
                  if (creationLogMappings.length > 0) {
                    for (const clm of creationLogMappings) {
                      const raw = this.getFlexibleValue(item.row, clm.sourceColumn);
                      const text = this.extractDisplayValue(raw).trim();
                      if (!text) continue;
                      const { nameStr, date } = this.parseCreationLog(text);
                      const creatorId = nameStr ? personEmailToUserId.get(nameStr.toLowerCase()) : undefined;
                      if (creatorId !== undefined) base.createdById = creatorId;
                      if (date) base.createdAt = date;
                      break; // use first CREATION_LOG mapping only
                    }
                  }
                  return base;
                }),
              })
            : [];
          totalTasksCreated += tasks.length;

          /*
           * -------------------------------------------------------
           * Create subitems (parentId → parent task)
           * -------------------------------------------------------
           */

          const taskNameToId = new Map<string, number>();
          for (const task of tasks) {
            taskNameToId.set(task.name.toLowerCase().trim(), task.id);
          }

          const subtasks = subitemRows.length
            ? await tx.task.createManyAndReturn({
                data: subitemRows.map((item, index) => {
                  const parentName = String(
                    item.row['__parentTaskName'] ?? '',
                  )
                    .toLowerCase()
                    .trim();
                  const parentId = taskNameToId.get(parentName) ?? undefined;
                  const base: { groupId: number; name: string; order: number; createdById: number; parentId?: number; createdAt?: Date } = {
                    groupId: group.id,
                    name: item.taskName,
                    order: (index + 1) * 1000,
                    createdById: userId,
                    parentId,
                  };
                  if (creationLogMappings.length > 0) {
                    for (const clm of creationLogMappings) {
                      const raw = this.getFlexibleValue(item.row, clm.sourceColumn);
                      const text = this.extractDisplayValue(raw).trim();
                      if (!text) continue;
                      const { nameStr, date } = this.parseCreationLog(text);
                      const creatorId = nameStr ? personEmailToUserId.get(nameStr.toLowerCase()) : undefined;
                      if (creatorId !== undefined) base.createdById = creatorId;
                      if (date) base.createdAt = date;
                      break;
                    }
                  }
                  return base;
                }),
              })
            : [];
          totalTasksCreated += subtasks.length;

          /*
           * -------------------------------------------------------
           * Build task cells
           *
           * IMPORTANT:
           *
           * TaskCell.value is JSON.
           *
           * TEXT / NUMBER:
           * {
           *   text: "..."
           * }
           *
           * STATUS:
           * {
           *   label: "...",
           *   color: "..."
           * }
           *
           * DATE:
           * {
           *   date: "..."
           * }
           *
           * CHECKBOX:
           * {
           *   checked: true
           * }
           * -------------------------------------------------------
           */

          const taskCells: {
            taskId: number;
            columnId: number;
            value: Prisma.InputJsonValue;
          }[] = [];

          const pendingFileCells: {
            taskId: number;
            columnId: number;
            url: string;
            rowIndex: number;
          }[] = [];

          const pendingTimeEntries: {
            taskId: number;
            userId: number;
            durationMs: number;
            note: string | null;
            startedAt?: Date;
          }[] = [];

          const allTasks = [...tasks, ...subtasks];
          const allValidRows = [...validRows, ...subitemRows];

          // Collect Item ID → task DB id for comment linking
          if (itemIdSourceCol) {
            for (let i = 0; i < allTasks.length; i++) {
              const rawId = String(
                this.getFlexibleValue(allValidRows[i]!.row, itemIdSourceCol) ?? '',
              ).trim();
              if (rawId) itemIdToTaskId.set(rawId, allTasks[i]!.id);
            }
          }

          for (let index = 0; index < allTasks.length; index++) {
            const task = allTasks[index];
            const row = allValidRows[index].row;

            for (const mapping of cellMappings) {
              /*
               * Never create a cell for the primary column.
               */

              if (
                this.normalizeKey(mapping.sourceColumn) ===
                this.normalizeKey(dto.taskColumn)
              ) {
                continue;
              }

              /*
               * Find target board column.
               */

              const column = columns.find(
                (item) =>
                  this.normalizeKey(item.name) ===
                  this.normalizeKey(mapping.targetColumn),
              );

              if (!column) {
                continue;
              }

              /*
               * Read value from imported row.
               */

              const rawValue = this.getFlexibleValue(row, mapping.sourceColumn);

              /*
               * Ignore empty values.
               */

              /*
               * Normalize imported value.
               */

              const isEmpty = this.isEmptyValue(rawValue);

              if (isEmpty) {
                if (column.type === BoardColumnType.TEXT) {
                  const emptyValue = JSON.stringify({
                    text: '',
                  });

                  taskCells.push({
                    taskId: task.id,
                    columnId: column.id,
                    value: emptyValue,
                  });

                  
                } else {
                  

                  /**
                   * If you want ALL column types to have a cell,
                   * uncomment this block and provide their defaults.
                   */
                }

                continue;
              }

              /*
               * FILE columns: store as TaskCellFile so they appear
               * in the file cell's file list, not as raw text.
               *
               * Monday.com exports multiple files in one cell as a
               * comma-separated list of URLs, e.g.:
               *   "https://…/file1.pdf, https://…/file2.pdf"
               * Split on ", " only when followed by http:// so we don't
               * accidentally split on commas inside a filename.
               */
              if (column.type === BoardColumnType.FILE) {
                const urlStr = this.extractDisplayValue(rawValue).trim();
                if (urlStr) {
                  const parts = urlStr
                    .split(/,\s+(?=https?:\/\/|\/\/)/)
                    .map((u) => u.trim())
                    .filter(Boolean);

                  for (const u of parts) {
                    if (/^https?:\/\//.test(u)) {
                      // Standard absolute URL
                      pendingFileCells.push({ taskId: task.id, columnId: column.id, url: u, rowIndex: index });
                    } else if (u.startsWith('//')) {
                      // Protocol-relative URL → normalize to https
                      pendingFileCells.push({ taskId: task.id, columnId: column.id, url: `https:${u}`, rowIndex: index });
                    } else {
                      // Not a valid URL — track as skipped
                      skippedItems.push({
                        rowIndex: allValidRows[index]!.rowIdx,
                        taskName: task.name,
                        column: column.name,
                        reason: `Invalid file URL skipped: "${u.length > 60 ? u.slice(0, 60) + '…' : u}"`,
                      });
                    }
                  }
                }
                continue;
              }

              /*
               * PERSON — supports comma-separated multi-person cells
               * and name-based lookup (Monday.com exports display names).
               */
              if (column.type === BoardColumnType.PERSON) {
                const rawDisplay = this.extractDisplayValue(rawValue).toLowerCase().trim();
                if (rawDisplay) {
                  const tokens = rawDisplay.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
                  const resolvedIds: number[] = [];
                  const notFound: string[] = [];

                  for (const token of tokens) {
                    const resolvedId = personEmailToUserId.get(token);
                    if (resolvedId !== undefined) {
                      resolvedIds.push(resolvedId);
                    } else {
                      notFound.push(token);
                    }
                  }

                  if (resolvedIds.length > 0) {
                    taskCells.push({
                      taskId: task.id,
                      columnId: column.id,
                      value: { users: resolvedIds.map((id) => ({ id })) },
                    });
                  }

                  for (const name of notFound) {
                    skippedItems.push({
                      rowIndex: allValidRows[index]!.rowIdx,
                      taskName: task.name,
                      column: column.name,
                      reason: `Person '${name}' not found in workspace — assignment skipped`,
                    });
                  }
                }
                continue;
              }

              /*
               * TIME_TRACKING — parse the raw value into a TimeEntry record.
               * We do NOT `continue` here: the value also falls through to the
               * normal cell path below so the board UI shows the display text.
               */
              if ((mapping.type as string) === 'TIME_TRACKING') {
                const durationMs = this.parseTimeDurationMs(rawValue);
                if (durationMs !== null && durationMs > 0) {
                  // Use the first resolvable person from PERSON columns as the
                  // user who tracked the time; fall back to the importing user.
                  let timeUserId = userId;
                  outer: for (const pm of personMappings) {
                    const rawPerson = this.getFlexibleValue(row, pm.sourceColumn);
                    const tokens = this.extractDisplayValue(rawPerson)
                      .toLowerCase()
                      .trim()
                      .split(/,\s*/);
                    for (const t of tokens) {
                      const resolved = personEmailToUserId.get(t.trim());
                      if (resolved !== undefined) { timeUserId = resolved; break outer; }
                    }
                  }
                  // Use the first DATE column on this row as startedAt if available.
                  let startedAt: Date | undefined;
                  for (const dm of cellMappings) {
                    if ((dm.type as string) !== 'DATE' && (dm.type as string) !== BoardColumnType.DATE) continue;
                    const rawDate = this.getFlexibleValue(row, dm.sourceColumn);
                    if (rawDate == null || rawDate === '') continue;
                    const d = new Date(String(rawDate));
                    if (!isNaN(d.getTime())) { startedAt = d; break; }
                  }

                  pendingTimeEntries.push({
                    taskId: task.id,
                    durationMs,
                    userId: timeUserId,
                    note: this.extractDisplayValue(rawValue).trim() || null,
                    startedAt,
                  });
                }
                // fall through — store display text in cell as well
              }

              const normalizedValue = this.normalizeCellValue(
                rawValue,
                mapping.type as unknown as BoardColumnType,
                mapping.sourceColumn,
                statusOptionsByColumn,
              );

              // if (normalizedValue === null || normalizedValue === '') {
              //   continue;
              // }

              /*
               * Build the same JSON structure used
               * by the frontend CELL_CONFIG.
               */

              const cellValue = this.buildCellValue(
                normalizedValue ?? '',
                mapping.type as unknown as BoardColumnType,
                mapping.sourceColumn,
                statusOptionsByColumn,
              );

              if (!cellValue) {
                continue;
              }

              taskCells.push({
                taskId: task.id,
                columnId: column.id,
                value: cellValue,
              });
            }
          }

          // Extract URLs embedded in COMMENT column text and attach them as files.
          if (urlFileColumn && commentMappings.length > 0) {
            for (let index = 0; index < allTasks.length; index++) {
              const task = allTasks[index];
              const row = allValidRows[index].row;
              for (const mapping of commentMappings) {
                const rawValue = this.getFlexibleValue(row, mapping.sourceColumn);
                const text = this.extractDisplayValue(rawValue).trim();
                if (!text) continue;
                for (const url of this.extractUrlsFromText(text)) {
                  pendingFileCells.push({
                    taskId: task.id,
                    columnId: urlFileColumn.id,
                    url,
                    rowIndex: index,
                  });
                }
              }
            }
          }

          /*
           * -------------------------------------------------------
           * Insert all cells for this group
           *
           * Prisma generates TaskCell.id here.
           * -------------------------------------------------------
           */

          if (taskCells.length) {
            await tx.taskCell.createMany({
              data: taskCells,
            });
          }

          /*
           * -------------------------------------------------------
           * Create TimeEntry records from TIME_TRACKING cells
           * -------------------------------------------------------
           */
          if (pendingTimeEntries.length) {
            await tx.timeEntry.createMany({
              data: pendingTimeEntries.map((te) => {
                const startedAt = te.startedAt ?? new Date();
                const endedAt = new Date(startedAt.getTime() + te.durationMs);
                return {
                  taskId: te.taskId,
                  userId: te.userId,
                  boardId: board.id,
                  durationMs: te.durationMs,
                  note: te.note,
                  startedAt,
                  endedAt,
                };
              }),
            });
            totalTimeEntriesCreated += pendingTimeEntries.length;
          }

          /*
           * -------------------------------------------------------
           * Create FILE cells from imported URLs
           *
           * Each URL becomes: TaskCell → File → TaskCellFile.
           * The FILE cell component reads from cell.files (via
           * TaskCellFile), not from TaskCell.value, so we store
           * {} as the cell value and attach the file separately.
           * -------------------------------------------------------
           */
          // Cache cells so multiple files in the same cell share one TaskCell row.
          const fileCellCache = new Map<string, number>();

          for (const pending of pendingFileCells) {
            const cacheKey = `${pending.taskId}-${pending.columnId}`;
            let cellId = fileCellCache.get(cacheKey);

            if (cellId === undefined) {
              // upsert: safe whether or not a non-FILE cell was already created
              const cell = await tx.taskCell.upsert({
                where: {
                  taskId_columnId: {
                    taskId: pending.taskId,
                    columnId: pending.columnId,
                  },
                },
                create: {
                  taskId: pending.taskId,
                  columnId: pending.columnId,
                  value: {},
                },
                update: {},
              });
              cellId = cell.id;
              fileCellCache.set(cacheKey, cellId);
            }

            const rawSegment = (pending.url.split('/').pop() ?? '').split('?')[0];
            let rawName: string;
            try {
              rawName = decodeURIComponent(rawSegment);
            } catch {
              rawName = rawSegment;
            }
            const fileName = rawName || 'Imported File';

            const file = await tx.file.create({
              data: {
                fileName,
                storageKey: pending.url,
                mimeType: 'application/octet-stream',
                fileSize: 0,
                url: pending.url,
                uploadedById: userId,
              },
            });

            await tx.taskCellFile.create({
              data: { cellId, fileId: file.id },
            });

            // FILE_FEEDBACK columns go ONLY to FileComments (never to task drawer)
            if (fileFeedbackMappings.length > 0) {
              const taskRow = allValidRows[pending.rowIndex]?.row;
              if (taskRow) {
                for (const mapping of fileFeedbackMappings) {
                  const rawValue = this.getFlexibleValue(taskRow, mapping.sourceColumn);
                  const text = this.extractDisplayValue(rawValue).trim();
                  if (!text) continue;

                  const commenter = this.extractCommenterName(mapping.sourceColumn);
                  const content = commenter ? `**${commenter}:** ${text}` : text;

                  await tx.fileComment.create({
                    data: { fileId: file.id, userId, content },
                  });
                }
              }
            }

            pendingDownloads.push({ fileId: file.id, url: pending.url });
          }

          /*
           * -------------------------------------------------------
           * Create task comments from COMMENT-type mappings
           * -------------------------------------------------------
           */
          if (commentMappings.length > 0) {
            const commentData: { taskId: number; userId: number; content: string }[] = [];

            for (let index = 0; index < allTasks.length; index++) {
              const task = allTasks[index];
              const row  = allValidRows[index].row;

              for (const mapping of commentMappings) {
                const rawValue = this.getFlexibleValue(row, mapping.sourceColumn);
                const text = this.extractDisplayValue(rawValue).trim();
                if (!text) continue;

                // Resolve commenter from column header (e.g. "Comments-Salman" → "Salman").
                // Try to find them in the person map; fall back to the importing user.
                const commenter = this.extractCommenterName(mapping.sourceColumn);
                const commenterKey = commenter.toLowerCase().trim();
                const authorId = commenterKey
                  ? (personEmailToUserId.get(commenterKey) ?? userId)
                  : userId;

                // If we couldn't resolve the author, embed their name in the content
                // so it isn't lost. If resolved, use a clean body.
                const content =
                  authorId === userId && commenter
                    ? `${commenter}: ${text}`
                    : text;

                commentData.push({ taskId: task.id, userId: authorId, content });
              }
            }

            if (commentData.length) {
              await tx.taskComment.createMany({ data: commentData });
              totalCommentsCreated += commentData.length;
            }
          }

          groupOrder += 1000;
        }

        /*
         * ---------------------------------------------------------
         * 12. Import Sheet 2 comments (Monday.com updates sheet)
         * ---------------------------------------------------------
         */
        if (dto.comments?.length && itemIdToTaskId.size > 0) {
          const { downloads: commentDownloads, commentsCreated: sheet2Comments } =
            await this.importMonDayComments(
              tx,
              dto.comments,
              itemIdToTaskId,
              userId,
              assetUrlMap,
              personEmailToUserId,
            );
          for (const dl of commentDownloads) pendingDownloads.push(dl);
          totalCommentsCreated += sheet2Comments;
        }

        /*
         * ---------------------------------------------------------
         * 13. Re-fetch complete board
         *
         * IMPORTANT:
         *
         * We deliberately query the database again after all
         * TaskCells have been inserted.
         *
         * This guarantees the returned task.cells contain:
         *
         * - id
         * - taskId
         * - columnId
         * - value
         *
         * which the frontend EditableCell requires.
         * ---------------------------------------------------------
         */

        const importedBoard = await tx.board.findUniqueOrThrow({
          where: {
            id: board.id,
          },

          include: {
            columns: {
              orderBy: {
                order: 'asc',
              },

              include: {
                statusOptions: {
                  where: {
                    isArchived: false,
                  },

                  orderBy: {
                    order: 'asc',
                  },
                },
              },
            },

            groups: {
              orderBy: {
                order: 'asc',
              },

              include: {
                tasks: {
                  orderBy: {
                    order: 'asc',
                  },

                  include: {
                    cells: {
                      include: {
                        column: {
                          include: {
                            statusOptions: {
                              where: {
                                isArchived: false,
                              },

                              orderBy: {
                                order: 'asc',
                              },
                            },
                          },
                        },
                      },

                      orderBy: {
                        column: {
                          order: 'asc',
                        },
                      },
                    },
                  },
                },
              },
            },

            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        });

        return importedBoard;
      },
      {
        timeout: 120000, // 2 minutes
        maxWait: 10000,
      },
    );

    /*
     * Fire file downloads AFTER the transaction commits.
     * enqueue() handles concurrency (max 5) and retries (3 attempts).
     */
    for (const dl of pendingDownloads) {
      this.fileImportService.enqueue(dl);
    }

    // Send welcome emails to newly created users (non-fatal — never blocks import)
    if (newlyCreatedEmails.size > 0) {
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      for (const u of userCreationData) {
        if (!newlyCreatedEmails.has(u.email)) continue;
        const { html, text } = welcomeEmailTemplate(u.firstName, u.email, u.tempPassword, frontendUrl);
        this.mailService.sendMail({
          to: u.email,
          subject: 'Welcome to EzManage – Your Account is Ready',
          html,
          text,
        }).catch(() => {});
      }
    }

    // Mark job as done with import summary counts
    if (jobId) {
      await this.prisma.boardImportJob.update({
        where: { id: jobId },
        data: {
          status: 'done',
          boardId: result.id,
          summary: {
            tasksCreated: totalTasksCreated,
            commentsCreated: totalCommentsCreated,
            timeEntriesCreated: totalTimeEntriesCreated,
            usersCreated: totalUsersCreated,
            filesQueued: pendingDownloads.length,
            skipped: skippedItems.length,
          },
        },
      }).catch(() => {});
    }

    return {
      board: result,
      importSummary: {
        totalRows: dto.rows.length,
        skipped: skippedItems.length,
        skippedItems,
      },
    };
  }

  /*
   * ============================================================================
   * VALUE HELPERS
   * ============================================================================
   */

  private normalizeKey(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase();
  }

  private isEmptyValue(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true;
    }

    if (typeof value === 'string') {
      return value.trim() === '';
    }

    return false;
  }

  private getFlexibleValue(row: ImportedRow, keyName: string): unknown {
    if (!row || !keyName) {
      return undefined;
    }

    /*
     * Exact lookup first.
     */

    if (Object.prototype.hasOwnProperty.call(row, keyName)) {
      return row[keyName];
    }

    const targetKey = this.normalizeKey(keyName);

    /*
     * Case-insensitive lookup.
     */

    for (const [key, value] of Object.entries(row)) {
      if (this.normalizeKey(key) === targetKey) {
        return value;
      }
    }

    /*
     * Whitespace normalization.
     */

    const compactTarget = targetKey.replace(/\s+/g, ' ');

    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = this.normalizeKey(key).replace(/\s+/g, ' ');

      if (normalizedKey === compactTarget) {
        return value;
      }
    }

    return undefined;
  }

  /*
   * ============================================================================
   * TASK NAME
   * ============================================================================
   */

  private getTaskName(
    rawValue: unknown,
    row?: ImportedRow,
    taskColumn?: string,
  ): string {
    /*
     * 1. Primary lookup:
     *    The frontend explicitly tells us which column
     *    contains the task name.
     */
    if (row && taskColumn) {
      const taskValue = this.getFlexibleValue(row, taskColumn);

      const extracted = this.extractDisplayValue(taskValue);

      if (extracted) {
        return extracted;
      }
    }

    /*
     * 2. Direct value fallback.
     */
    const directValue = this.extractDisplayValue(rawValue);

    if (directValue) {
      return directValue;
    }

    /*
     * 3. Fallback to common task/name columns.
     */
    if (row) {
      const preferredKeys = [
        'name',
        'task',
        'task name',
        'item',
        'item name',
        'title',
      ];

      for (const key of preferredKeys) {
        const value = this.getFlexibleValue(row, key);

        const extracted = this.extractDisplayValue(value);

        if (extracted) {
          return extracted;
        }
      }

      /*
       * 4. Last fallback:
       *    first non-metadata value.
       */
      for (const [key, value] of Object.entries(row)) {
        if (key.startsWith('__')) {
          continue;
        }

        const extracted = this.extractDisplayValue(value);

        if (extracted) {
          return extracted;
        }
      }
    }

    return '';
  }

  /*
   * ============================================================================
   * DISPLAY VALUE
   * ============================================================================
   */

  private extractDisplayValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      if (
        'label' in value &&
        value.label !== null &&
        value.label !== undefined
      ) {
        return String(value.label).trim();
      }

      return '';
    }

    return String(value).trim();
  }

  /**
   * Extracts a human-readable commenter name from a comment column header.
   *
   * "Comments-Salman"  → "Salman"
   * "Comment-Employee" → "Employee"
   * "Remarks-HR"       → "HR"
   * "Notes"            → ""   (generic — no prefix added)
   * "Comments"         → ""
   */
  private extractCommenterName(columnHeader: string): string {
    const GENERIC_WORDS = [
      'comments', 'comment', 'notes', 'note',
      'remarks', 'remark', 'feedback', 'description', 'desc',
    ];

    // Split on common separators: dash, underscore, space
    const parts = columnHeader.trim().split(/[-_\s]+/);

    // Remove every leading part that is a generic comment word (case-insensitive)
    const remaining = [...parts];
    while (remaining.length && GENERIC_WORDS.includes(remaining[0].toLowerCase())) {
      remaining.shift();
    }

    // What's left is the commenter name (re-join in case it was "Comments HR Team")
    return remaining.join(' ');
  }

  /** Extract all http/https URLs from a plain-text string. */
  private extractUrlsFromText(text: string): string[] {
    const matches = text.match(/https?:\/\/[^\s,)'"<>]+/g) ?? [];
    return matches.map((u) => u.replace(/[.,;:!?)]+$/, ''));
  }

  /**
   * Parses a Monday.com "Creation log" cell value such as
   * "Anmol Verma Mar 19, 2026 6:30 PM" → { nameStr: "Anmol Verma", date: Date }
   * or "AB Jul 23, 2026" → { nameStr: "AB", date: Date }
   */
  private parseCreationLog(text: string): { nameStr: string; date: Date | null } {
    const MONTHS = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
    const dateRegex = new RegExp(`(${MONTHS})\\s+\\d{1,2},?\\s+\\d{4}`, 'i');
    const match = text.match(dateRegex);

    if (!match) {
      return { nameStr: text.trim(), date: null };
    }

    const dateStart = text.indexOf(match[0]);
    const nameStr = text.slice(0, dateStart).trim();
    const dateStr = text.slice(dateStart).trim();

    let date: Date | null = null;
    try {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) date = parsed;
    } catch {
      // leave date as null
    }

    return { nameStr, date };
  }

  /*
   * ============================================================================
   * STATUS OPTIONS
   * ============================================================================
   */

  private getUniqueStatusOptions(
    rows: ImportedRow[],
    sourceColumn: string,
  ): StatusOptionData[] {
    const optionsMap = new Map<string, StatusOptionData>();

    for (const row of rows) {
      const rawValue = this.getFlexibleValue(row, sourceColumn);

      if (this.isEmptyValue(rawValue)) {
        continue;
      }

      let label = '';
      let color: string | undefined;

      if (
        typeof rawValue === 'object' &&
        rawValue !== null &&
        'label' in rawValue
      ) {
        label = String(rawValue.label ?? '').trim();

        if ('color' in rawValue && rawValue.color) {
          color = String(rawValue.color).trim();
        }
      } else {
        label = String(rawValue).trim();
      }

      if (!label) {
        continue;
      }

      const key = this.normalizeKey(label);

      if (!optionsMap.has(key)) {
        optionsMap.set(key, {
          label,
          color,
        });
      }
    }

    return Array.from(optionsMap.values());
  }

  /*
   * ============================================================================
   * CELL NORMALIZATION
   * ============================================================================
   */

  private normalizeCellValue(
    rawValue: unknown,
    columnType: BoardColumnType,
    sourceColumn: string,
    statusOptionsByColumn: Map<string, StatusOptionMap>,
  ): string | null {
    /*
     * FILE — skip URL text from exports like Monday.com
     */

    if (columnType === BoardColumnType.FILE) {
      return null;
    }

    /*
     * STATUS
     */

    if (columnType === BoardColumnType.STATUS) {
      const label = this.extractDisplayValue(rawValue);

      if (!label) {
        return null;
      }

      const columnOptions = statusOptionsByColumn.get(sourceColumn);

      if (!columnOptions) {
        return label;
      }

      const matchedOption = columnOptions.get(this.normalizeKey(label));

      return matchedOption?.label ?? label;
    }

    /*
     * NUMBER
     */

    if (columnType === BoardColumnType.NUMBER || columnType === BoardColumnType.PRICE) {
      return this.normalizeNumber(rawValue);
    }

    /*
     * DATE
     */

    if (columnType === BoardColumnType.DATE || (columnType as string) === 'PLAIN_DATE') {
      return this.normalizeDate(rawValue);
    }

    /*
     * CHECKBOX
     */

    if (columnType === BoardColumnType.CHECKBOX) {
      return this.normalizeBoolean(rawValue);
    }

    /*
     * Everything else.
     */

    return this.extractDisplayValue(rawValue) || null;
  }

  /*
   * ============================================================================
   * BUILD FRONTEND-COMPATIBLE CELL VALUE
   * ============================================================================
   */

  private buildCellValue(
    normalizedValue: string,
    columnType: BoardColumnType,
    sourceColumn: string,
    statusOptionsByColumn: Map<string, StatusOptionMap>,
  ): Prisma.InputJsonValue | null {
    if (!normalizedValue) {
      return null;
    }

    /*
     * TEXT
     *
     * Frontend:
     *
     * cell?.value?.text
     */

    if (columnType === BoardColumnType.TEXT || columnType === BoardColumnType.LONG_TEXT) {
      return {
        text: normalizedValue,
      };
    }

    /*
     * LINK
     *
     * Frontend:
     *
     * cell?.value?.url
     */

    if (columnType === BoardColumnType.LINK) {
      return {
        url: normalizedValue,
      };
    }

    /*
     * NUMBER
     *
     * NumberEditor currently reads:
     *
     * cell?.value?.text
     */

    if (columnType === BoardColumnType.NUMBER || columnType === BoardColumnType.PRICE) {
      return {
        text: normalizedValue,
      };
    }

    /*
     * EMAIL
     *
     * Frontend EmailEditor reads:
     *
     * cell?.value?.email
     * cell?.value?.label
     */

    if (columnType === BoardColumnType.EMAIL) {
      return {
        email: normalizedValue,
        label: '',
      };
    }

    /*
     * STATUS
     *
     * Frontend:
     *
     * value.label
     * value.color
     */

    if (columnType === BoardColumnType.STATUS) {
      const options = statusOptionsByColumn.get(sourceColumn);

      const matchedOption = options?.get(this.normalizeKey(normalizedValue));

      return {
        label: matchedOption?.label ?? normalizedValue,

        color: matchedOption?.color ?? this.getStatusColor(0),
      };
    }

    /*
     * DATE
     *
     * Frontend:
     *
     * value.date
     */

    if (columnType === BoardColumnType.DATE || (columnType as string) === 'PLAIN_DATE') {
      return {
        date: normalizedValue,
      };
    }

    /*
     * CHECKBOX
     *
     * Frontend:
     *
     * value.checked
     */

    if (columnType === BoardColumnType.CHECKBOX) {
      return {
        checked: normalizedValue === 'true',
      };
    }

    /*
     * FILE
     *
     * Monday.com exports file URLs as text, which can't be imported
     * as real uploaded files. Return null to create an empty FILE cell.
     */

    if (columnType === BoardColumnType.FILE) {
      return null;
    }

    /*
     * PERSON / DROPDOWN / LABEL / anything else
     *
     * Default to text so the imported value
     * isn't lost.
     */

    return {
      text: normalizedValue,
    };
  }

  /*
   * ============================================================================
   * BOOLEAN
   * ============================================================================
   */

  private normalizeBoolean(value: unknown): string {
    if (typeof value === 'boolean') {
      return String(value);
    }

    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();

    return String(
      ['true', 'yes', '1', 'checked', 'x', '✓'].includes(normalized),
    );
  }

  /*
   * ============================================================================
   * NUMBER
   * ============================================================================
   */

  private normalizeNumber(value: unknown): string {
    if (typeof value === 'number') {
      return String(value);
    }

    const normalized = String(value ?? '')
      .replace(/,/g, '')
      .trim();

    if (!normalized) {
      return '';
    }

    const parsed = Number(normalized);

    return Number.isNaN(parsed) ? normalized : String(parsed);
  }

  /*
   * ============================================================================
   * DATE
   * ============================================================================
   */

  private normalizeDate(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    const date = new Date(String(value));

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }

    return String(value).trim();
  }

  /*
   * ============================================================================
   * GROUPING
   * ============================================================================
   */

  private groupImportedRows(rows: ImportedRow[]): Map<string, GroupedRows> {
    const groupedMap = new Map<string, GroupedRows>();

    for (const row of rows) {
      const rawGroupName = row.__groupName;

      const groupName =
        String(rawGroupName ?? 'Imported Tasks').trim() || 'Imported Tasks';

      const rawGroupColor = row.__groupColor;
      const groupColor =
        rawGroupColor !== null &&
        rawGroupColor !== undefined &&
        String(rawGroupColor).trim()
          ? String(rawGroupColor).trim()
          : undefined;

      const groupKey = this.normalizeKey(groupName);

      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, {
          name: groupName,
          color: groupColor,
          rows: [],
        });
      }

      groupedMap.get(groupKey)!.rows.push(row);
    }

    return groupedMap;
  }

  /*
   * ============================================================================
   * STATUS COLORS
   * ============================================================================
   */

  private getStatusColor(index: number): string {
    const colors = [
      '#579BFC',
      '#00C875',
      '#FDAB3D',
      '#E2445C',
      '#A25DDC',
      '#66CCFF',
    ];

    return colors[index % colors.length];
  }

  /*
   * ============================================================================
   * GROUP COLORS
   * ============================================================================
   */

  private getGroupColor(order: number): string {
    const colors = [
      '#579BFC',
      '#00C875',
      '#FDAB3D',
      '#E2445C',
      '#A25DDC',
      '#66CCFF',
    ];

    const index = Math.floor(order / 1000) - 1;

    return colors[index % colors.length];
  }

  /*
   * ============================================================================
   * MONDAY.COM COMMENT IMPORT
   * ============================================================================
   */

  /**
   * Resolve Monday.com numeric asset IDs → public download URLs using the
   * GraphQL API.  Reads the token from the `MONDAY_API_TOKEN` system setting
   * (falls back to process.env).  Returns an empty map when no token is
   * configured or no asset IDs are present.
   */
  private async resolveMonDayAssets(
    comments: { assetIds: string[] }[],
  ): Promise<Map<string, { url: string; name: string }>> {
    const map = new Map<string, { url: string; name: string }>();

    const allIds = [...new Set(comments.flatMap((c) => c.assetIds))].filter(
      Boolean,
    );
    if (!allIds.length) return map;

    const dbSetting = await this.prisma.systemSetting
      .findUnique({ where: { key: 'MONDAY_API_TOKEN' } })
      .catch(() => null);
    const token = dbSetting?.value || process.env.MONDAY_API_TOKEN;
    if (!token) return map;

    try {
      const res = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
          'API-Version': '2024-01',
        },
        body: JSON.stringify({
          query: `{ assets(ids: [${allIds.join(',')}]) { id name public_url } }`,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        this.logger.warn(`Monday.com API responded ${res.status} during asset resolution`);
        return map;
      }

      const json = (await res.json()) as {
        data?: { assets?: { id: number; name: string; public_url: string }[] };
      };

      for (const asset of json.data?.assets ?? []) {
        if (asset.public_url) {
          map.set(String(asset.id), { url: asset.public_url, name: asset.name });
        }
      }
    } catch (err) {
      this.logger.warn(`Monday.com asset resolution failed: ${err}`);
    }

    return map;
  }

  /**
   * Create TaskComment records from Sheet 2 comment rows.
   * Also creates File + TaskCommentFile entries for attachments and returns
   * them so the caller can enqueue background downloads.
   */
  private async importMonDayComments(
    tx: any,
    comments: { itemId: string; contentType: string; user: string; createdAt: string; content: string; assetIds: string[]; postId: string; parentPostId: string }[],
    itemIdToTaskId: Map<string, number>,
    userId: number,
    assetUrlMap: Map<string, { url: string; name: string }>,
    personMap: Map<string, number>,
  ): Promise<{ downloads: { fileId: number; url: string }[]; commentsCreated: number }> {
    const pendingDownloads: { fileId: number; url: string }[] = [];
    let commentsCreated = 0;

    const MONTHS = [
      'january','february','march','april','may','june',
      'july','august','september','october','november','december',
    ];

    const parseDate = (raw: string): Date => {
      const m = raw.match(/(\d{1,2})\/(\w+)\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)/i);
      if (!m) return new Date();
      const [, d, mon, y, h, min, s, ampm] = m;
      const monthIdx = MONTHS.indexOf(mon.toLowerCase());
      if (monthIdx === -1) return new Date();
      let hour = parseInt(h, 10);
      if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
      return new Date(parseInt(y, 10), monthIdx, parseInt(d, 10), hour, parseInt(min, 10), parseInt(s, 10));
    };

    const updates = comments.filter((c) => c.contentType === 'Update');
    const replies  = comments.filter((c) => c.contentType === 'Reply');

    const postIdToCommentId = new Map<string, number>();

    // Resolve an author name from the person map.
    // Returns { authorId, content } — if resolved, content is the raw body;
    // if unresolved, content has the author name embedded so it isn't lost.
    const resolveAuthor = (c: { user: string; content: string; assetIds: string[] }): { authorId: number; content: string } => {
      const nameKey  = (c.user || '').toLowerCase().trim();
      const firstKey = nameKey.split(' ')[0] ?? '';
      const authorId = personMap.get(nameKey) ?? personMap.get(firstKey) ?? userId;

      const body = c.content || '';
      const hasFiles = c.assetIds.length > 0 && c.assetIds.some((id) => assetUrlMap.has(id));
      const note = c.assetIds.length > 0 && !hasFiles
        ? '\n\n📎 *Files attached (configure Monday.com API token in system settings to import)*'
        : '';

      // When we know who the author is, store a clean body.
      // When unknown, embed the name so the message is still traceable.
      const content = authorId !== userId
        ? `${body}${note}`
        : `**${c.user || 'Unknown'}:** ${body}${note}`;

      return { authorId, content };
    };

    for (const c of updates) {
      const taskId = itemIdToTaskId.get(c.itemId);
      if (!taskId || !c.content.trim()) continue;

      const { authorId, content } = resolveAuthor(c);

      const comment = await tx.taskComment.create({
        data: {
          taskId,
          userId: authorId,
          content,
          createdAt: parseDate(c.createdAt),
        },
      });
      commentsCreated++;

      if (c.postId) postIdToCommentId.set(c.postId, comment.id);

      // Attach files
      for (const assetId of c.assetIds) {
        const asset = assetUrlMap.get(assetId);
        if (!asset) continue;
        const file = await tx.file.create({
          data: {
            fileName: asset.name || `attachment-${assetId}`,
            storageKey: asset.url,
            mimeType: 'application/octet-stream',
            fileSize: 0,
            url: asset.url,
            uploadedById: userId,
          },
        });
        await tx.taskCommentFile.create({
          data: { commentId: comment.id, fileId: file.id },
        });
        pendingDownloads.push({ fileId: file.id, url: asset.url });
      }
    }

    for (const c of replies) {
      const taskId = itemIdToTaskId.get(c.itemId);
      if (!taskId || !c.content.trim()) continue;

      const parentId = c.parentPostId
        ? (postIdToCommentId.get(c.parentPostId) ?? null)
        : null;

      const { authorId, content } = resolveAuthor(c);

      const comment = await tx.taskComment.create({
        data: {
          taskId,
          userId: authorId,
          content,
          parentId,
          createdAt: parseDate(c.createdAt),
        },
      });
      commentsCreated++;

      if (c.postId) postIdToCommentId.set(c.postId, comment.id);

      for (const assetId of c.assetIds) {
        const asset = assetUrlMap.get(assetId);
        if (!asset) continue;
        const file = await tx.file.create({
          data: {
            fileName: asset.name || `attachment-${assetId}`,
            storageKey: asset.url,
            mimeType: 'application/octet-stream',
            fileSize: 0,
            url: asset.url,
            uploadedById: userId,
          },
        });
        await tx.taskCommentFile.create({
          data: { commentId: comment.id, fileId: file.id },
        });
        pendingDownloads.push({ fileId: file.id, url: asset.url });
      }
    }

    return { downloads: pendingDownloads, commentsCreated };
  }

  /*
   * ============================================================================
   * TIME DURATION PARSER
   * ============================================================================
   */

  /**
   * Convert a raw cell value into milliseconds.
   *
   * Handles:
   *   HH:MM:SS / H:MM:SS  →  "1:30:00"
   *   H:MM                →  "1:30"  (treated as hours:minutes)
   *   Worded              →  "1h 30m", "2h", "30m", "45s", "1h 30m 45s"
   *   Aliases             →  "1hr", "30min", "30 minutes", "1 hour"
   *   Raw integer         →  treated as seconds when < 86 400, else milliseconds
   *
   * Returns null when the value cannot be parsed or is zero.
   */
  private parseTimeDurationMs(value: unknown): number | null {
    if (value === null || value === undefined) return null;

    const raw = this.extractDisplayValue(value).trim();
    if (!raw) return null;

    // ── HH:MM:SS or H:MM:SS ──────────────────────────────────────────────────
    const hmsMatch = raw.match(/^(\d+):(\d{2}):(\d{2})$/);
    if (hmsMatch) {
      const ms =
        (Number(hmsMatch[1]) * 3600 +
          Number(hmsMatch[2]) * 60 +
          Number(hmsMatch[3])) *
        1000;
      return ms > 0 ? ms : null;
    }

    // ── H:MM (hours:minutes, no seconds) ─────────────────────────────────────
    const hmMatch = raw.match(/^(\d+):(\d{2})$/);
    if (hmMatch) {
      const ms = (Number(hmMatch[1]) * 3600 + Number(hmMatch[2]) * 60) * 1000;
      return ms > 0 ? ms : null;
    }

    // ── Worded components (each matched independently) ────────────────────────
    // e.g. "1h 30m", "2 hours 15 minutes", "45s", "1hr 30min"
    const hMatch = raw.match(/(\d+(?:\.\d+)?)\s*h(?:r|rs|our|ours)?(?:\b)/i);
    const mMatch = raw.match(/(\d+(?:\.\d+)?)\s*m(?:in|ins|inute|inutes)?(?:\b)/i);
    const sMatch = raw.match(/(\d+(?:\.\d+)?)\s*s(?:ec|ecs|econd|econds)?(?:\b)/i);
    if (hMatch ?? mMatch ?? sMatch) {
      const ms =
        parseFloat(hMatch?.[1] ?? '0') * 3_600_000 +
        parseFloat(mMatch?.[1] ?? '0') * 60_000 +
        parseFloat(sMatch?.[1] ?? '0') * 1_000;
      return ms > 0 ? ms : null;
    }

    // ── Raw integer ───────────────────────────────────────────────────────────
    // Monday.com sometimes exports raw seconds; other tools export milliseconds.
    // Heuristic: values < 86 400 are almost certainly seconds (≤ 24 h in seconds);
    // larger values are treated as milliseconds.
    if (/^\d+$/.test(raw)) {
      const n = Number(raw);
      if (n > 0) return n < 86_400 ? n * 1000 : n;
    }

    return null;
  }

  /*
   * ============================================================================
   * OPTIONAL / LEGACY HELPERS
   * ============================================================================
   */
}
