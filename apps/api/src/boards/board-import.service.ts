import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'prisma/prisma.service';
import { BoardColumnType, BoardMemberRole } from 'generated/prisma/enums';

import { ImportExcelBoardDto } from './dto/import-excel-board.dto';

@Injectable()
export class BoardImportService {
  constructor(private readonly prisma: PrismaService) {}

async importExcelBoard(
  dto: ImportExcelBoardDto,
  userId: number,
) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Validate workspace
    const workspace = await tx.workspace.findUnique({
      where: { id: dto.workspaceId },
      select: { id: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    // 2. Prevent duplicate board
    const boardName = dto.boardName.trim();
    const existingBoard = await tx.board.findFirst({
      where: {
        workspaceId: dto.workspaceId,
        name: boardName,
      },
      select: { id: true },
    });

    if (existingBoard) {
      throw new ConflictException(
        'A board with this name already exists in this workspace.',
      );
    }

    // 3. Create board
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

    // 4. Create board columns
    // Filter out metadata columns
    const mappings = dto.columns.filter(
      (mapping) =>
        mapping.sourceColumn !== dto.taskColumn &&
        mapping.sourceColumn !== dto.groupColumn &&
        mapping.sourceColumn !== '__groupName' &&
        mapping.sourceColumn !== '__groupColor',
    );

    const primaryColumnMapping = dto.columns.find(
      (mapping) => mapping.sourceColumn === dto.taskColumn,
    );

    const primaryColumnName =
      primaryColumnMapping?.targetColumn?.trim() ||
      dto.taskColumn.trim();

    const columnDefinitions = [
      {
        name: primaryColumnName,
        type: BoardColumnType.TEXT,
        isPrimary: true,
      },
      ...mappings.map((mapping) => ({
        name: mapping.targetColumn.trim(),
        type: mapping.type,
        isPrimary: false,
      })),
    ];

    const uniqueColumnDefinitions = columnDefinitions.filter(
      (column, index, array) =>
        array.findIndex(
          (item) =>
            item.name.trim().toLowerCase() ===
            column.name.trim().toLowerCase(),
        ) === index,
    );

    const columns = await tx.boardColumn.createManyAndReturn({
      data: uniqueColumnDefinitions.map((column, index) => ({
        boardId: board.id,
        name: column.name,
        type: column.type,
        isPrimary: column.isPrimary,
        order: (index + 1) * 1000,
      })),
    });

    // 5. Create status options (Extracts labels + hex colors from parsed cells)
    const statusOptionsByColumn = new Map<string, Map<string, any>>();

    for (const mapping of mappings) {
      if (mapping.type !== BoardColumnType.STATUS) {
        continue;
      }

      const column = columns.find(
        (item) =>
          item.name.trim().toLowerCase() ===
          mapping.targetColumn.trim().toLowerCase(),
      );

      if (!column) continue;

      const statusOptionsData = this.getUniqueStatusOptions(
        dto.rows,
        mapping.sourceColumn,
      );

      if (!statusOptionsData.length) continue;

      const statusOptions = await tx.statusOption.createManyAndReturn({
        data: statusOptionsData.map((opt, index) => ({
          columnId: column.id,
          label: opt.label,
          color: opt.color || this.getStatusColor(index),
          order: (index + 1) * 1000,
        })),
      });

      const optionMap = new Map<string, any>();
      for (const option of statusOptions) {
        optionMap.set(option.label.trim().toLowerCase(), option);
      }

      statusOptionsByColumn.set(mapping.sourceColumn, optionMap);
    }

    // 6. Group Excel rows
    const groupedRows = this.groupImportedRows(dto.rows);
    let groupOrder = 1000;

    // 7. Create groups + tasks + cells
    for (const [groupKey, groupData] of groupedRows) {
      const group = await tx.group.create({
        data: {
          boardId: board.id,
          name: groupData.name || 'Imported Tasks',
          color: groupData.color || this.getGroupColor(groupOrder),
          order: groupOrder,
          createdById: userId,
        },
      });

      const validRows = groupData.rows
        .map((row) => ({
          row,
          taskName: this.getTaskName(this.getFlexibleValue(row, dto.taskColumn)),
        }))
        .filter(
          (item): item is { row: Record<string, unknown>; taskName: string } =>
            Boolean(item.taskName),
        );

      if (!validRows.length) {
        groupOrder += 1000;
        continue;
      }

      // Create tasks
      const tasks = await tx.task.createManyAndReturn({
        data: validRows.map((item, index) => ({
          groupId: group.id,
          name: item.taskName,
          order: (index + 1) * 1000,
          createdById: userId,
        })),
      });

      // Create task cells
      const taskCells: {
        taskId: number;
        columnId: number;
        value: string;
      }[] = [];

      for (let index = 0; index < tasks.length; index++) {
        const task = tasks[index];
        const row = validRows[index].row;

        for (const mapping of mappings) {
          const column = columns.find(
            (item) =>
              item.name.trim().toLowerCase() ===
              mapping.targetColumn.trim().toLowerCase(),
          );

          if (!column) continue;

          // Uses flexible key matching (handles exact or case-insensitive column lookup)
          const rawValue = this.getFlexibleValue(row, mapping.sourceColumn);

          if (rawValue === null || rawValue === undefined || rawValue === '') {
            continue;
          }

          const value = this.normalizeCellValue(
            rawValue,
            mapping.type,
            mapping.sourceColumn,
            statusOptionsByColumn,
          );

          if (value === null) continue;

          taskCells.push({
            taskId: task.id,
            columnId: column.id,
            value,
          });
        }
      }

      if (taskCells.length) {
        await tx.taskCell.createMany({ data: taskCells });
      }

      groupOrder += 1000;
    }

    // 8. Return complete board
    return tx.board.findUniqueOrThrow({
      where: { id: board.id },
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            statusOptions: {
              where: { isArchived: false },
              orderBy: { order: 'asc' },
            },
          },
        },
        groups: {
          orderBy: { order: 'asc' },
          include: {
            tasks: {
              orderBy: { order: 'asc' },
              include: {
                cells: {
                  include: {
                    column: {
                      include: {
                        statusOptions: {
                          where: { isArchived: false },
                          orderBy: { order: 'asc' },
                        },
                      },
                    },
                  },
                  orderBy: { column: { order: 'asc' } },
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
/**
 * Case-insensitive lookup so mapping never fails if sourceColumn string has spacing/casing differences.
 */
private getFlexibleValue(row: Record<string, any>, keyName: string): any {
  if (!row || !keyName) return undefined;
  if (keyName in row) return row[keyName];

  const targetKey = keyName.trim().toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.trim().toLowerCase() === targetKey) {
      return row[k];
    }
  }
  return undefined;
}

/**
 * Parses both raw strings and { label, color } status objects.
 */
private getUniqueStatusOptions(
  rows: Record<string, any>[],
  sourceColumn: string,
): Array<{ label: string; color?: string }> {
  const optionsMap = new Map<string, { label: string; color?: string }>();

  for (const row of rows) {
    const rawVal = this.getFlexibleValue(row, sourceColumn);
    if (!rawVal) continue;

    let label = '';
    let color: string | undefined = undefined;

    if (typeof rawVal === 'object' && rawVal !== null && 'label' in rawVal) {
      label = String(rawVal.label).trim();
      color = rawVal.color;
    } else {
      label = String(rawVal).trim();
    }

    if (label && !optionsMap.has(label.toLowerCase())) {
      optionsMap.set(label.toLowerCase(), { label, color });
    }
  }

  return Array.from(optionsMap.values());
}

/**
 * Normalizes values stored inside TaskCell.
 */
private normalizeCellValue(
  rawValue: any,
  columnType: BoardColumnType,
  sourceColumn: string,
  statusOptionsByColumn: Map<string, Map<string, any>>,
): string | null {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }

  let label = '';
  if (typeof rawValue === 'object' && rawValue !== null && 'label' in rawValue) {
    label = String(rawValue.label).trim();
  } else {
    label = String(rawValue).trim();
  }

  if (!label) return null;

  if (columnType === BoardColumnType.STATUS) {
    const columnOptions = statusOptionsByColumn.get(sourceColumn);
    if (!columnOptions) return label;

    const matchedOption = columnOptions.get(label.toLowerCase());
    return matchedOption ? matchedOption.label : label;
  }

  return label;
}
  /*
   * ============================================================
   * GROUP IMPORT
   * ============================================================
   *
   * Groups are determined from metadata generated by the
   * Excel parser:
   *
   * __groupName
   * __groupColor
   */



  private groupImportedRows(rows: Record<string, unknown>[]) {
    const grouped = new Map<
      string,
      {
        name: string;
        color: string | null;
        rows: Record<string, unknown>[];
      }
    >();

    for (const row of rows) {
      const rawGroupName = row.__groupName;

      const rawGroupColor = row.__groupColor;

      const groupName =
        rawGroupName !== null &&
        rawGroupName !== undefined &&
        String(rawGroupName).trim()
          ? String(rawGroupName).trim()
          : 'Imported Tasks';

      const groupColor =
        rawGroupColor !== null &&
        rawGroupColor !== undefined &&
        String(rawGroupColor).trim()
          ? String(rawGroupColor).trim()
          : null;

      const key = groupName.trim().toLowerCase();

      if (!grouped.has(key)) {
        grouped.set(key, {
          name: groupName,
          color: groupColor,
          rows: [],
        });
      }

      grouped.get(key)!.rows.push(row);
    }

    return grouped;
  }

  /*
   * ============================================================
   * TASK NAME
   * ============================================================
   */

  private getTaskName(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const name = String(value).trim();

    return name || null;
  }

  /*
   * ============================================================
   * UNIQUE STATUS VALUES
   * ============================================================
   */

  private getUniqueColumnValues(
    rows: Record<string, unknown>[],
    columnName: string,
  ): string[] {
    const values = new Set<string>();

    for (const row of rows) {
      const value = row[columnName];

      if (value === null || value === undefined || value === '') {
        continue;
      }

      const normalized = String(value).trim();

      if (normalized) {
        values.add(normalized);
      }
    }

    return Array.from(values);
  }

  /*
   * ============================================================
   * CELL NORMALIZATION
   * ============================================================
   */



  /*
   * ============================================================
   * BOOLEAN
   * ============================================================
   */

  private normalizeBoolean(value: unknown): string {
    if (typeof value === 'boolean') {
      return String(value);
    }

    const normalized = String(value).trim().toLowerCase();

    return String(['true', 'yes', '1', 'checked', 'x'].includes(normalized));
  }

  /*
   * ============================================================
   * NUMBER
   * ============================================================
   */

  private normalizeNumber(value: unknown): string {
    if (typeof value === 'number') {
      return String(value);
    }

    const normalized = String(value).replace(/,/g, '').trim();

    const parsed = Number(normalized);

    return Number.isNaN(parsed) ? normalized : String(parsed);
  }

  /*
   * ============================================================
   * DATE
   * ============================================================
   */

  private normalizeDate(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    const date = new Date(String(value));

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }

    return String(value);
  }

  /*
   * ============================================================
   * STATUS COLORS
   * ============================================================
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
   * ============================================================
   * FALLBACK GROUP COLORS
   * ============================================================
   *
   * Used only when Excel didn't provide a color.
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
}
