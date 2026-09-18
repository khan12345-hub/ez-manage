import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'prisma/prisma.service';

import { BoardColumnType, BoardMemberRole } from 'generated/prisma/enums';

import { Prisma } from 'generated/prisma/client';

import { ImportExcelBoardDto } from './dto/import-excel-board.dto';
import { FileImportService, FileImportJobData } from 'src/file-import/file-import.processor';

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
      select: { id: true, boardName: true, status: true, totalRows: true, boardId: true, error: true, createdAt: true },
    });
  }

  // ── Actual import (runs in background) ──────────────────────────────────────

  async importExcelBoard(jobId: number, dto: ImportExcelBoardDto, userId: number) {
    const pendingDownloads: FileImportJobData[] = [];
    const skippedItems: SkippedItem[] = [];

    const result = await this.prisma.$transaction(
      async (tx) => {
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
        // SKIP mappings are dropped entirely
        const commentMappings = mappings.filter(
          (m) => (m.type as string) === 'COMMENT',
        );
        const cellMappings = mappings.filter(
          (m) => (m.type as string) !== 'COMMENT' && (m.type as string) !== 'SKIP',
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

        if (personMappings.length > 0) {
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

        /*
         * ---------------------------------------------------------
         * 8. Group imported rows
         * ---------------------------------------------------------
         */

        const groupedRows = this.groupImportedRows(dto.rows);

        let groupOrder = 1000;
        let globalRowCounter = 0;

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
            const taskName = this.getTaskName(rawTaskValue, row);
            return { row, taskName, rowIdx };
          });

          // Track rows dropped because no task name could be extracted
          for (const item of allParsedRowsRaw) {
            if (!item.taskName) {
              skippedItems.push({
                rowIndex: item.rowIdx,
                reason: 'No task name found — row skipped',
              });
            }
          }

          const allParsedRows = allParsedRowsRaw.filter(
            (item): item is { row: ImportedRow; taskName: string; rowIdx: number } =>
              Boolean(item.taskName),
          );

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
                data: validRows.map((item, index) => ({
                  groupId: group.id,
                  name: item.taskName,
                  order: (index + 1) * 1000,
                  createdById: userId,
                })),
              })
            : [];

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
                  return {
                    groupId: group.id,
                    name: item.taskName,
                    order: (index + 1) * 1000,
                    createdById: userId,
                    parentId,
                  };
                }),
              })
            : [];

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
          }[] = [];

          const allTasks = [...tasks, ...subtasks];
          const allValidRows = [...validRows, ...subitemRows];

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
                      pendingFileCells.push({ taskId: task.id, columnId: column.id, url: u });
                    } else if (u.startsWith('//')) {
                      // Protocol-relative URL → normalize to https
                      pendingFileCells.push({ taskId: task.id, columnId: column.id, url: `https:${u}` });
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

                // Each comment mapping column becomes a separate comment.
                // When there are multiple comment columns extract the commenter
                // name from the column header (e.g. "Comments-Salman" → "Salman:").
                const commenter = this.extractCommenterName(mapping.sourceColumn);
                const content = commenter ? `${commenter}: ${text}` : text;

                commentData.push({ taskId: task.id, userId, content });
              }
            }

            if (commentData.length) {
              await tx.taskComment.createMany({ data: commentData });
            }
          }

          groupOrder += 1000;
        }

        /*
         * ---------------------------------------------------------
         * 12. Re-fetch complete board
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

    // Mark job as done
    if (jobId) {
      await this.prisma.boardImportJob.update({
        where: { id: jobId },
        data: { status: 'done', boardId: result.id },
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

    if (columnType === BoardColumnType.NUMBER) {
      return this.normalizeNumber(rawValue);
    }

    /*
     * DATE
     */

    if (columnType === BoardColumnType.DATE) {
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

    if (columnType === BoardColumnType.NUMBER) {
      return {
        text: normalizedValue,
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

    if (columnType === BoardColumnType.DATE) {
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
   * OPTIONAL / LEGACY HELPERS
   * ============================================================================
   */
}
