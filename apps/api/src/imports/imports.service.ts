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

          await tx.statusOption.createMany({
            data: uniqueLabels.map((label: string, index: number) => {
              const sourceOption = importedColumn.statusOptions.find(
                (option: { label: string; color?: string }) =>
                  option.label === label,
              );

              return {
                columnId: dbColumn.id,
                label: label,
                color: sourceOption?.color ?? '#94a3b8',
                order: (index + 1) * 1000,
              };
            }),
          });
        }

        /*
         * Create groups and tasks.
         */
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
          }
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
        firstValue &&
        !this.isTaskRow(row, currentColumns) &&
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

    return {
      columns,
      groups,
      primaryColumnIndex,
    };
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
