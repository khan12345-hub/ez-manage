import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'prisma/prisma.service';
import {
  BoardColumnType,
  BoardMemberRole,
} from 'generated/prisma/enums';

import { ImportExcelBoardDto } from './dto/import-excel-board.dto';

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

@Injectable()
export class BoardImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importExcelBoard(dto: ImportExcelBoardDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
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

        if (sourceColumn === dto.taskColumn) {
          return false;
        }

        if (sourceColumn === dto.groupColumn) {
          return false;
        }

        return true;
      });

      /*
       * Find primary/task mapping.
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

        ...mappings
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
       * Remove duplicate columns case-insensitively.
       */

      const uniqueColumnDefinitions =
        columnDefinitions.filter((column, index, array) => {
          const normalizedName = this.normalizeKey(column.name);

          return (
            array.findIndex(
              (item) =>
                this.normalizeKey(item.name) === normalizedName,
            ) === index
          );
        });

      /*
       * ---------------------------------------------------------
       * 6. Create board columns
       * ---------------------------------------------------------
       */

      const columns = await tx.boardColumn.createManyAndReturn({
        data: uniqueColumnDefinitions.map((column, index) => ({
          boardId: board.id,
          name: column.name,
          type: column.type,
          isPrimary: column.isPrimary,
          order: (index + 1) * 1000,
        })),
      });

      /*
       * ---------------------------------------------------------
       * 7. Create status options
       *
       * Parser may return:
       *
       * {
       *   label: "Done",
       *   color: "#00C875"
       * }
       *
       * or simply:
       *
       * "Done"
       * ---------------------------------------------------------
       */

      const statusOptionsByColumn = new Map<
        string,
        StatusOptionMap
      >();

      for (const mapping of mappings) {
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

        const statusOptions =
          await tx.statusOption.createManyAndReturn({
            data: statusOptionsData.map((option, index) => ({
              columnId: column.id,
              label: option.label,
              color:
                option.color ||
                this.getStatusColor(index),
              order: (index + 1) * 1000,
            })),
          });

        const optionMap: StatusOptionMap = new Map();

        for (const option of statusOptions) {
          optionMap.set(
            this.normalizeKey(option.label),
            option,
          );
        }

        statusOptionsByColumn.set(
          mapping.sourceColumn,
          optionMap,
        );
      }

      /*
       * ---------------------------------------------------------
       * 8. Group imported rows
       *
       * The custom Excel parser puts:
       *
       * __groupName
       * __groupColor
       *
       * into each row.
       * ---------------------------------------------------------
       */

      const groupedRows = this.groupImportedRows(dto.rows);

      let groupOrder = 1000;

      /*
       * ---------------------------------------------------------
       * 9. Create groups
       * 10. Create tasks
       * 11. Create task cells
       * ---------------------------------------------------------
       */

      for (const groupData of groupedRows.values()) {
        const group = await tx.group.create({
          data: {
            boardId: board.id,
            name: groupData.name || 'Imported Tasks',
            color:
              groupData.color ||
              this.getGroupColor(groupOrder),
            order: groupOrder,
            createdById: userId,
          },
        });

        /*
         * Resolve task names before creating tasks.
         */

        const validRows = groupData.rows
          .map((row) => {
            const rawTaskValue = this.getFlexibleValue(
              row,
              dto.taskColumn,
            );

            const taskName = this.getTaskName(
              rawTaskValue,
              row,
            );

            return {
              row,
              taskName,
            };
          })
          .filter(
            (
              item,
            ): item is {
              row: ImportedRow;
              taskName: string;
            } => Boolean(item.taskName),
          );

        if (!validRows.length) {
          groupOrder += 1000;
          continue;
        }

        /*
         * -------------------------------------------------------
         * Create tasks
         * -------------------------------------------------------
         */

        const tasks = await tx.task.createManyAndReturn({
          data: validRows.map((item, index) => ({
            groupId: group.id,
            name: item.taskName,
            order: (index + 1) * 1000,
            createdById: userId,
          })),
        });

        /*
         * -------------------------------------------------------
         * Build task cells
         * -------------------------------------------------------
         */

        const taskCells: {
          taskId: number;
          columnId: number;
          value: string;
        }[] = [];

        for (let index = 0; index < tasks.length; index++) {
          const task = tasks[index];
          const row = validRows[index].row;

          for (const mapping of mappings) {
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

            const rawValue = this.getFlexibleValue(
              row,
              mapping.sourceColumn,
            );

            /*
             * Ignore empty values.
             */

            if (this.isEmptyValue(rawValue)) {
              continue;
            }

            /*
             * Convert value to TaskCell string.
             */

            const normalizedValue =
              this.normalizeCellValue(
                rawValue,
                mapping.type,
                mapping.sourceColumn,
                statusOptionsByColumn,
              );

            if (
              normalizedValue === null ||
              normalizedValue === ''
            ) {
              continue;
            }

            taskCells.push({
              taskId: task.id,
              columnId: column.id,
              value: normalizedValue,
            });
          }
        }

        /*
         * -------------------------------------------------------
         * Insert all cells for this group
         * -------------------------------------------------------
         */

        if (taskCells.length) {
          await tx.taskCell.createMany({
            data: taskCells,
          });
        }

        groupOrder += 1000;
      }

      /*
       * ---------------------------------------------------------
       * 12. Return complete board
       * ---------------------------------------------------------
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
    });
  }

  /*
   * ============================================================================
   * VALUE HELPERS
   * ============================================================================
   */

  /**
   * Normalize object keys for reliable comparison.
   *
   * Examples:
   *
   * "Task Name" -> "task name"
   * " task name " -> "task name"
   * "TASK_NAME" -> "task_name"
   */
  private normalizeKey(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase();
  }

  /**
   * Check whether an imported Excel value is empty.
   */
  private isEmptyValue(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true;
    }

    if (typeof value === 'string') {
      return value.trim() === '';
    }

    return false;
  }

  /**
   * Case-insensitive + whitespace-tolerant row lookup.
   *
   * This is important because the parser and DTO can have
   * slightly different header formatting.
   */
  private getFlexibleValue(
    row: ImportedRow,
    keyName: string,
  ): unknown {
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
     * Also support whitespace normalization.
     *
     * "Task  Name"
     * "Task Name"
     *
     * become equivalent.
     */

    const compactTarget = targetKey.replace(/\s+/g, ' ');

    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = this.normalizeKey(key).replace(
        /\s+/g,
        ' ',
      );

      if (normalizedKey === compactTarget) {
        return value;
      }
    }

    return undefined;
  }

  /**
   * Extract task name.
   */
  private getTaskName(
    rawValue: unknown,
    row?: ImportedRow,
  ): string {
    /*
     * Primary lookup.
     */

    const directValue = this.extractDisplayValue(rawValue);

    if (directValue) {
      return directValue;
    }

    /*
     * Fallback to common task/name columns.
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
       * Last fallback:
       * first non-metadata value.
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

  /**
   * Convert parser values into a display string.
   *
   * Handles:
   *
   * "Done"
   *
   * {
   *   label: "Done",
   *   color: "#00C875"
   * }
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

      /*
       * Avoid storing "[object Object]" in cells.
       */

      return '';
    }

    return String(value).trim();
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
    const optionsMap = new Map<
      string,
      StatusOptionData
    >();

    for (const row of rows) {
      const rawValue = this.getFlexibleValue(
        row,
        sourceColumn,
      );

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
        label = String(
          rawValue.label ?? '',
        ).trim();

        if (
          'color' in rawValue &&
          rawValue.color
        ) {
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
    statusOptionsByColumn: Map<
      string,
      StatusOptionMap
    >,
  ): string | null {
    if (this.isEmptyValue(rawValue)) {
      return null;
    }

    /*
     * STATUS
     */

    if (columnType === BoardColumnType.STATUS) {
      const label =
        this.extractDisplayValue(rawValue);

      if (!label) {
        return null;
      }

      const columnOptions =
        statusOptionsByColumn.get(sourceColumn);

      if (!columnOptions) {
        return label;
      }

      const matchedOption =
        columnOptions.get(
          this.normalizeKey(label),
        );

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
      [
        'true',
        'yes',
        '1',
        'checked',
        'x',
        '✓',
      ].includes(normalized),
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

    return Number.isNaN(parsed)
      ? normalized
      : String(parsed);
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

  private groupImportedRows(
    rows: ImportedRow[],
  ): Map<string, GroupedRows> {
    const groupedMap = new Map<
      string,
      GroupedRows
    >();

    for (const row of rows) {
      const rawGroupName = row.__groupName;

      const groupName =
        String(
          rawGroupName ?? 'Imported Tasks',
        ).trim() || 'Imported Tasks';

      const rawGroupColor = row.__groupColor;

      const groupColor =
        rawGroupColor !== null &&
        rawGroupColor !== undefined &&
        String(rawGroupColor).trim()
          ? String(rawGroupColor).trim()
          : undefined;

      const groupKey =
        this.normalizeKey(groupName);

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

    const index =
      Math.floor(order / 1000) - 1;

    return colors[index % colors.length];
  }

  /*
   * ============================================================================
   * OPTIONAL / LEGACY HELPERS
   * ============================================================================
   */

  private getUniqueColumnValues(
    rows: ImportedRow[],
    columnName: string,
  ): string[] {
    const values = new Set<string>();

    for (const row of rows) {
      const value = this.getFlexibleValue(
        row,
        columnName,
      );

      if (this.isEmptyValue(value)) {
        continue;
      }

      const normalized =
        this.extractDisplayValue(value);

      if (normalized) {
        values.add(normalized);
      }
    }

    return Array.from(values);
  }
}