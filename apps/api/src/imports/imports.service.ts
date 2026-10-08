import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
// import { Prisma } from 'src/generated/prisma/client';
// import { PrismaService } from 'src/prisma/prisma.service';
import * as XLSX from 'xlsx';

import { LocalStorageService } from 'src/storage/local-storage.service';


import { PrismaService } from 'prisma/prisma.service';
import { BoardColumnType, BoardMemberRole, Prisma } from 'generated/prisma/client';
interface ImportedStatusOption {
  label: string;
  color: string;
}

interface ImportedColumn {
  index: number;
  name: string;
  type: BoardColumnType;
  isPrimary: boolean;
  statusOptions: ImportedStatusOption[];
}

interface ImportedTask {
  values: any[];
}

interface ImportedGroup {
  name: string;
  color: string;
  tasks: ImportedTask[];
}
@Injectable()
export class ImportsService {
  constructor(
    private readonly storageService: LocalStorageService,
    private readonly prisma: PrismaService,
  ) {}

  async uploadBoardImportFile(
    userId: number,
    workspaceId: number,
    visibility: 'PUBLIC' | 'PRIVATE' = 'PRIVATE',
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Excel file is required');
    }

    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];

    const allowedExtensions = ['.xlsx', '.xls'];

    const extension = file.originalname
      .substring(file.originalname.lastIndexOf('.'))
      .toLowerCase();

    if (
      !allowedMimeTypes.includes(file.mimetype) ||
      !allowedExtensions.includes(extension)
    ) {
      throw new BadRequestException(
        'Only Excel files (.xlsx and .xls) are allowed',
      );
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
      select: {
        id: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    /*
     * Parse Excel
     */
    const workbook = XLSX.read(file.buffer, {
      type: 'buffer',
      cellStyles: true,
      cellDates: true,
    });

    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      throw new BadRequestException('Excel file does not contain a worksheet');
    }

    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new BadRequestException('Unable to read Excel worksheet');
    }

    /*
     * Read board name from A1
     */
    const boardNameCell = worksheet['A1'];

    const boardName = String(boardNameCell?.v ?? '').trim();

    if (!boardName) {
      throw new BadRequestException(
        'Board name is missing from Excel file. Expected board name in cell A1.',
      );
    }

    /*
     * Convert worksheet to rows while preserving empty cells.
     */
    const range = XLSX.utils.decode_range(worksheet['!ref'] ?? 'A1:A1');

    const rows: any[][] = [];

    for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex++) {
      const row: any[] = [];

      for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex++) {
        const address = XLSX.utils.encode_cell({
          r: rowIndex,
          c: colIndex,
        });

        const cell = worksheet[address];

        row.push(cell?.v ?? '');
      }

      rows.push(row);
    }

    /*
     * Find the first actual column-header row.
     *
     * In your Excel:
     *
     * Row 1 -> Board name
     * Row 2 -> Description
     * Row 3 -> Empty
     * Row 4 -> Group name
     * Row 5 -> Column headers
     * Row 6+ -> Tasks
     */
    const firstHeaderIndex = this.findHeaderRow(rows);

    if (firstHeaderIndex === -1) {
      throw new BadRequestException(
        'Could not detect column headers in Excel file.',
      );
    }

    /*
     * Build import structure.
     */
    const parsed = this.parseExcelRows(rows, worksheet, firstHeaderIndex);

    if (parsed.columns.length === 0) {
      throw new BadRequestException(
        'No valid columns were found in Excel file.',
      );
    }

    /*
     * Read Sheet 2 (updates / comments) if it exists.
     * Row 0 = title, Row 1 = column headers, Row 2+ = comment data.
     */
    const commentsSheetName = workbook.SheetNames[1];
    const commentsRows: any[][] = [];
    if (commentsSheetName) {
      const commentsSheet = workbook.Sheets[commentsSheetName];
      if (commentsSheet) {
        const range2 = XLSX.utils.decode_range(
          commentsSheet['!ref'] ?? 'A1:A1',
        );
        for (let r = range2.s.r; r <= range2.e.r; r++) {
          const row: any[] = [];
          for (let c = range2.s.c; c <= range2.e.c; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            row.push(commentsSheet[addr]?.v ?? null);
          }
          commentsRows.push(row);
        }
      }
    }

    /* Index of the "Item ID" column in Sheet 1 — used to link comments to tasks */
    const itemIdColIndex = rows[firstHeaderIndex].findIndex(
      (v) => String(v ?? '').toLowerCase().includes('item id'),
    );

    /*
     * Create everything in one transaction.
     */
    return this.prisma.$transaction(
      async (tx) => {
        const existingBoard = await tx.board.findFirst({
          where: {
            workspaceId,
            name: boardName,
          },
          select: {
            id: true,
          },
        });

        if (existingBoard) {
          throw new BadRequestException(
            `A board named "${boardName}" already exists in this workspace.`,
          );
        }

        /*
         * Create board
         */
        const board = await tx.board.create({
          data: {
            name: boardName,
            workspaceId,
            visibility,
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
         * Create columns
         */
        const columns = await tx.boardColumn.createManyAndReturn({
          data: parsed.columns.map((column, index) => ({
            boardId: board.id,
            name: column.name,
            type: column.type,
            isPrimary: column.isPrimary,
            order: (index + 1) * 1000,
          })),
        });

        /*
         * Map imported column indexes to database columns.
         */
        const columnMap = new Map<number, (typeof columns)[number]>();

        for (const column of columns) {
          const sourceColumn = parsed.columns.find(
            (item) => item.name === column.name,
          );

          if (sourceColumn) {
            columnMap.set(sourceColumn.index, column);
          }
        }

        /*
         * Create status options.
         */
        for (const importedColumn of parsed.columns) {
          if (importedColumn.type !== BoardColumnType.STATUS) {
            continue;
          }

          const dbColumn = columnMap.get(importedColumn.index);

          if (!dbColumn) {
            continue;
          }

          const uniqueLabels: any[] = [
            ...new Set(
              importedColumn.statusOptions
                .map((option) => String(option.label).trim())
                .filter((label): label is string => Boolean(label)),
            ),
          ];

          await tx.statusOption.createMany({
            data: uniqueLabels.map((label, index) => {
              const sourceOption = importedColumn.statusOptions.find(
                (option) => String(option.label).trim() === label,
              );

              return {
                columnId: dbColumn.id,
                label,
                color: sourceOption?.color ?? '#94a3b8',
                order: (index + 1) * 1000,
              };
            }),
          });

        }

        /*
         * Create groups and tasks.
         */
        const itemIdToTaskId = new Map<string, number>();

        for (
          let groupIndex = 0;
          groupIndex < parsed.groups.length;
          groupIndex++
        ) {
          const importedGroup = parsed.groups[groupIndex];

          const group = await tx.group.create({
            data: {
              boardId: board.id,
              name: importedGroup.name,
              color: importedGroup.color,
              order: (groupIndex + 1) * 1000,
              createdById: userId,
            },
          });

          for (
            let taskIndex = 0;
            taskIndex < importedGroup.tasks.length;
            taskIndex++
          ) {
            const importedTask = importedGroup.tasks[taskIndex];

            const taskName =
              String(
                importedTask.values[parsed.primaryColumnIndex] ?? '',
              ).trim() || `Task ${taskIndex + 1}`;

            const task = await tx.task.create({
              data: {
                groupId: group.id,
                name: taskName,
                order: (taskIndex + 1) * 1000,
                createdById: userId,
              },
            });

            const cells = [] as any;

            for (const importedColumn of parsed.columns) {
              /*
               * Primary column is stored in Task.name.
               */
              if (importedColumn.isPrimary) {
                continue;
              }

              const dbColumn = columnMap.get(importedColumn.index);

              if (!dbColumn) {
                continue;
              }

              const rawValue = importedTask.values[importedColumn.index];

              if (
                rawValue === undefined ||
                rawValue === null ||
                String(rawValue).trim() === ''
              ) {
                continue;
              }

              let value: Prisma.InputJsonValue;

              if (importedColumn.type === BoardColumnType.STATUS) {
                const statusOption = importedColumn.statusOptions.find(
                  (option) =>
                    option.label.toLowerCase() ===
                    String(rawValue).trim().toLowerCase(),
                );

                value = statusOption
                  ? statusOption.label
                  : String(rawValue).trim();
              } else {
                value = this.normalizeExcelValue(rawValue);
              }

              cells.push({
                taskId: task.id,
                columnId: dbColumn.id,
                value,
              });
            }

            if (cells.length > 0) {
              await tx.taskCell.createMany({
                data: cells,
              });
            }

            /* Track Item ID → task DB id for comment linking */
            if (itemIdColIndex >= 0) {
              const rawItemId = String(
                importedTask.values[itemIdColIndex] ?? '',
              ).trim();
              if (rawItemId) itemIdToTaskId.set(rawItemId, task.id);
            }
          }
        }

        /* Import comments from Sheet 2 (updates sheet) */
        if (commentsRows.length > 2 && itemIdColIndex >= 0) {
          await this.importComments(tx, commentsRows, itemIdToTaskId, userId);
        }

        /*
         * Return complete board.
         */
        return tx.board.findUniqueOrThrow({
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
      },
      {
        timeout: 120000,
      },
    );
  }

  private findHeaderRow(rows: any[][]): number {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (!row) {
        continue;
      }

      const nonEmptyValues = row
        .map((value) => String(value ?? '').trim())
        .filter(Boolean);

      if (nonEmptyValues.length < 2) {
        continue;
      }

      const hasName = nonEmptyValues.some(
        (value) => value.toLowerCase() === 'name',
      );

      const hasAmount = nonEmptyValues.some(
        (value) => value.toLowerCase() === 'amount',
      );

      const hasStatus = nonEmptyValues.some((value) =>
        value.toLowerCase().includes('status'),
      );

      if (hasName && (hasAmount || hasStatus)) {
        return i;
      }
    }

    return -1;
  }

  private parseExcelRows(
    rows: any[][],
    worksheet: XLSX.WorkSheet,
    firstHeaderIndex: number,
  ) {
    const headerRow = rows[firstHeaderIndex];

    /*
     * Detect actual columns.
     *
     * Ignore completely empty headers.
     */
    const columns: any[] = [];

    for (let index = 0; index < headerRow.length; index++) {
      const name = String(headerRow[index] ?? '').trim();

      if (!name) {
        continue;
      }

      columns.push({
        index,
        name,
        type:
          name.toLowerCase() === 'name'
            ? BoardColumnType.TEXT
            : BoardColumnType.TEXT,
        isPrimary: name.toLowerCase() === 'name',
        statusOptions: [],
      });
    }

    /*
     * If "Name" doesn't exist,
     * first valid column becomes primary.
     */
    if (!columns.some((column) => column.isPrimary)) {
      columns[0].isPrimary = true;
    }

    const primaryColumnIndex =
      columns.find((column) => column.isPrimary)?.index ?? 0;

    const groups: any[] = [];

    let currentGroup: any = null;

    let currentColumns = columns;

    /*
     * Start reading after the first header row.
     */
    let rowIndex = firstHeaderIndex + 1;

    /*
     * Monday.com places the first group name one row ABOVE the first
     * column-header row. The main loop starts after that header row and
     * never sees this row, so we seed currentGroup here before the loop.
     */
    const rowBeforeFirstHeader = rows[firstHeaderIndex - 1];
    if (rowBeforeFirstHeader && this.isGroupRow(rowBeforeFirstHeader)) {
      currentGroup = {
        name: String(rowBeforeFirstHeader[0]).trim(),
        color: this.getCellColor(worksheet, firstHeaderIndex - 1, 0),
        tasks: [],
      };
      groups.push(currentGroup);
    }

    while (rowIndex < rows.length) {
      const row = rows[rowIndex];

      if (!row) {
        rowIndex++;
        continue;
      }

      const firstValue = String(row[0] ?? '').trim();

      /*
       * Detect next group.
       *
       * A group looks like:
       *
       * Payment Done
       * Name | Subitems | Amount | ...
       */
      if (
        this.isGroupRow(row) &&
        this.isNextHeaderRow(rows[rowIndex + 1])
      ) {
        currentGroup = {
          name: firstValue,
          color: this.getCellColor(worksheet, rowIndex, 0),
          tasks: [],
        };

        groups.push(currentGroup);

        /*
         * Read the group's actual header row.
         */
        const groupHeader = rows[rowIndex + 1];

        currentColumns = [];

        for (let index = 0; index < groupHeader.length; index++) {
          const name = String(groupHeader[index] ?? '').trim();

          if (!name) {
            continue;
          }

          currentColumns.push({
            index,
            name,
            type:
              name.toLowerCase() === 'name'
                ? BoardColumnType.TEXT
                : BoardColumnType.TEXT,
            isPrimary: name.toLowerCase() === 'name',
            statusOptions: [],
          });
        }

        if (!currentColumns.some((column) => column.isPrimary)) {
          currentColumns[0].isPrimary = true;
        }

        /*
         * Update global columns with any newly discovered columns.
         */
        for (const groupColumn of currentColumns) {
          const existingColumn = columns.find(
            (column) =>
              column.name.toLowerCase() === groupColumn.name.toLowerCase(),
          );

          if (!existingColumn) {
            columns.push(groupColumn);
          }
        }

        rowIndex += 2;
        continue;
      }

      /*
       * Skip rows before first group.
       */
      if (!currentGroup) {
        rowIndex++;
        continue;
      }

      /*
       * Skip repeated header rows.
       */
      if (this.isHeaderRow(row, currentColumns)) {
        rowIndex++;
        continue;
      }

      /*
       * Skip completely empty rows.
       */
      const hasValue = row.some(
        (value) =>
          value !== undefined && value !== null && String(value).trim() !== '',
      );

      if (!hasValue) {
        rowIndex++;
        continue;
      }

      /*
       * Add task.
       */
      currentGroup.tasks.push({
        values: row,
      });

      /*
       * Detect colored cells and convert columns to STATUS.
       */
      for (const column of currentColumns) {
        const value = row[column.index];

        if (
          value === undefined ||
          value === null ||
          String(value).trim() === ''
        ) {
          continue;
        }

        const color = this.getCellColor(worksheet, rowIndex, column.index);

        if (color) {
          const globalColumn = columns.find(
            (item) => item.name.toLowerCase() === column.name.toLowerCase(),
          );

          if (globalColumn) {
            globalColumn.type = BoardColumnType.STATUS;

            if (
              !globalColumn.statusOptions.some(
                (option) =>
                  option.label.toLowerCase() ===
                  String(value).trim().toLowerCase(),
              )
            ) {
              globalColumn.statusOptions.push({
                label: String(value).trim(),
                color,
              });
            }
          }
        }
      }

      rowIndex++;
    }

    /* Auto-promote categorical TEXT columns to STATUS with colours */
    this.promoteTextColumnsToStatus(columns, groups);

    return {
      columns,
      groups,
      primaryColumnIndex,
    };
  }

  /*
   * After all rows are parsed, promote TEXT columns that look categorical
   * (few unique values, no emails, not long text) to STATUS and assign
   * a colour from the palette to each unique value.
   *
   * Rules:
   *  - Columns already promoted to STATUS (via cell colours) are skipped.
   *  - Primary column is skipped.
   *  - Columns whose name contains "email" are skipped.
   *  - Columns with > 50 % of values containing "@" are skipped.
   *  - Columns with average value length > 40 are treated as free-text.
   *  - Columns with > 35 distinct values are treated as free-text.
   *  - The column-header string itself (slipped into data from repeated
   *    header rows) is stripped from the status options.
   */
  private promoteTextColumnsToStatus(columns: any[], groups: any[]): void {
    const PALETTE = [
      '#579BFC', '#00C875', '#FDAB3D', '#E2445C', '#9D99B9',
      '#FFD700', '#FF7575', '#00BFFF', '#20BF55', '#FF6B6B',
      '#4ECDC4', '#96E6A1', '#C4C4C4', '#FF9F43', '#A29BFE',
      '#F368E0', '#48DBFB', '#1DD1A1', '#FFC312', '#EE5A24',
    ];

    for (const column of columns) {
      /* Already a STATUS column or primary — skip */
      if (column.type === BoardColumnType.STATUS || column.isPrimary) continue;

      /* Columns that are clearly not categorical */
      const nameLower = column.name.toLowerCase();
      if (nameLower.includes('email')) continue;
      if (nameLower.includes('people') || nameLower.includes('person')) continue;
      if (nameLower.includes('comment') || nameLower.includes('description')) continue;
      if (nameLower.includes('file') || nameLower.includes('attachment')) continue;

      /* Collect all non-empty values across every group/task */
      const allValues: string[] = [];
      for (const group of groups) {
        for (const task of group.tasks) {
          const raw = String(task.values[column.index] ?? '').trim();
          if (raw) allValues.push(raw);
        }
      }

      if (allValues.length === 0) continue;

      /* Skip if values look like email addresses */
      const emailRatio = allValues.filter((v) => v.includes('@')).length / allValues.length;
      if (emailRatio > 0.3) continue;

      /* Skip if values look like long free-text */
      const avgLen = allValues.reduce((s, v) => s + v.length, 0) / allValues.length;
      if (avgLen > 40) continue;

      /* Build unique set — exclude the column header string itself */
      const uniqueLabels = [
        ...new Set(allValues.filter((v) => v.toLowerCase() !== nameLower)),
      ];

      /* Too many distinct values → treat as free-text */
      if (uniqueLabels.length === 0 || uniqueLabels.length > 35) continue;

      /* Promote to STATUS and assign palette colours */
      column.type = BoardColumnType.STATUS;
      let colourIdx = 0;
      for (const label of uniqueLabels) {
        if (!column.statusOptions.some((o: any) => o.label === label)) {
          column.statusOptions.push({
            label,
            color: PALETTE[colourIdx % PALETTE.length],
          });
          colourIdx++;
        }
      }
    }
  }

  private isNextHeaderRow(row: any[] | undefined): boolean {
    if (!row) {
      return false;
    }

    const values = row
      .map((value) =>
        String(value ?? '')
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);

    return (
      values.includes('name') &&
      (values.includes('amount') ||
        values.some((value) => value.includes('status')))
    );
  }

  private isHeaderRow(row: any[], columns: any[]): boolean {
    const values = row
      .map((value) =>
        String(value ?? '')
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);

    const columnNames = columns.map((column) => column.name.toLowerCase());

    const matchingHeaders = values.filter((value) =>
      columnNames.includes(value),
    );

    return matchingHeaders.length >= 2;
  }

  private isTaskRow(row: any[], columns: any[]): boolean {
    const primaryColumn = columns.find((column) => column.isPrimary);

    if (!primaryColumn) {
      return false;
    }

    const value = row[primaryColumn.index];

    return value !== undefined && value !== null && String(value).trim() !== '';
  }

  /*
   * A group-header row has exactly one non-empty cell and it is in column 0.
   * Monday.com exports group names this way: one cell, all others blank.
   */
  private isGroupRow(row: any[]): boolean {
    const nonEmpty = row.filter(
      (v) => v !== null && v !== '' && v !== undefined,
    );
    return nonEmpty.length === 1 && String(row[0] ?? '').trim() !== '';
  }

  private getCellColor(
    worksheet: XLSX.WorkSheet,
    rowIndex: number,
    columnIndex: number,
  ): string | null {
    const address = XLSX.utils.encode_cell({
      r: rowIndex,
      c: columnIndex,
    });

    const cell = worksheet[address];

    if (!cell?.s) {
      return null;
    }

    const fill = cell.s.fill;

    if (!fill) {
      return null;
    }

    const fgColor = fill.fgColor;

    if (!fgColor) {
      return null;
    }

    let color: string | undefined;

    if (fgColor.rgb) {
      color = fgColor.rgb;

      if (color?.length === 8) {
        color = color.substring(2);
      }
    }

    /*
     * Ignore white cells.
     */
    if (
      !color ||
      color.toUpperCase() === 'FFFFFF' ||
      color.toUpperCase() === 'FFFFFFFF'
    ) {
      return null;
    }

    return `#${color}`;
  }

  /*
   * Import comments from the Monday.com "updates" sheet into TaskComment.
   *
   * Sheet layout (0-indexed columns):
   *   0  Item ID       — links to Sheet 1 task
   *   2  Content Type  — "Update" for top-level posts
   *   3  Content Type  — "Reply" for replies
   *   4  User          — author name (free text, not a system user)
   *   5  Created At    — "31/October/2023  05:40:35 PM"
   *   6  Update Content — comment body
   *   8  Asset IDs     — comma-separated Monday.com asset IDs (we note but can't download)
   *   9  Post ID       — Monday.com post id (used to thread replies)
   *  10  Parent Post ID — non-empty only for replies
   */
  private async importComments(
    tx: any,
    commentsRows: any[][],
    itemIdToTaskId: Map<string, number>,
    userId: number,
  ): Promise<void> {
    // Rows 0 (title) and 1 (headers) are skipped
    const dataRows = commentsRows.slice(2).filter(
      (r) => r && r[0] !== null && String(r[0] ?? '').trim() !== '',
    );

    const updates = dataRows.filter((r) => String(r[2] ?? '') === 'Update');
    const replies  = dataRows.filter((r) => String(r[3] ?? '') === 'Reply');

    // Monday.com Post ID → DB TaskComment id  (needed for reply parentId)
    const postIdToCommentId = new Map<string, number>();

    const buildContent = (row: any[]): string => {
      const author   = String(row[4] ?? '').trim() || 'Unknown';
      const body     = String(row[6] ?? '').trim();
      const assetIds = String(row[8] ?? '').trim();
      const hasFiles = assetIds && assetIds !== '0';
      return `**${author}:** ${body}${hasFiles ? '\n\n📎 *Files attached in original Monday.com record (not downloadable)*' : ''}`;
    };

    for (const row of updates) {
      const itemId = String(row[0] ?? '').trim();
      const taskId = itemIdToTaskId.get(itemId);
      if (!taskId) continue;

      const content = String(row[6] ?? '').trim();
      if (!content) continue;

      const comment = await tx.taskComment.create({
        data: {
          taskId,
          userId,
          content: buildContent(row),
          createdAt: this.parseMonDayDate(String(row[5] ?? '')),
        },
      });

      const postId = String(row[9] ?? '').trim();
      if (postId) postIdToCommentId.set(postId, comment.id);
    }

    for (const row of replies) {
      const itemId = String(row[0] ?? '').trim();
      const taskId = itemIdToTaskId.get(itemId);
      if (!taskId) continue;

      const content = String(row[6] ?? '').trim();
      if (!content) continue;

      const parentPostId = String(row[10] ?? '').trim();
      const parentId = parentPostId
        ? (postIdToCommentId.get(parentPostId) ?? null)
        : null;

      const comment = await tx.taskComment.create({
        data: {
          taskId,
          userId,
          content: buildContent(row),
          parentId,
          createdAt: this.parseMonDayDate(String(row[5] ?? '')),
        },
      });

      const postId = String(row[9] ?? '').trim();
      if (postId) postIdToCommentId.set(postId, comment.id);
    }
  }

  /* Parse Monday.com date string: "31/October/2023  05:40:35 PM" */
  private parseMonDayDate(dateStr: string): Date {
    const match = dateStr.match(
      /(\d{1,2})\/(\w+)\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)/i,
    );
    if (!match) return new Date();
    const [, day, month, year, h, m, s, ampm] = match;
    const MONTHS = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
    ];
    const monthIdx = MONTHS.indexOf(month.toLowerCase());
    if (monthIdx === -1) return new Date();
    let hour = parseInt(h, 10);
    if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
    if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
    return new Date(
      parseInt(year, 10), monthIdx, parseInt(day, 10),
      hour, parseInt(m, 10), parseInt(s, 10),
    );
  }

  private normalizeExcelValue(value: any): Prisma.InputJsonValue {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    return String(value);
  }
}
