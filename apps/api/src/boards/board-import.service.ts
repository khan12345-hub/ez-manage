import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  BoardColumnType,
  BoardMemberRole,
} from '@repo/shared';
import { ImportExcelBoardDto } from './dto/import-excel-board.dto';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class BoardImportService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async importExcelBoard(
    dto: ImportExcelBoardDto,
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findUnique({
        where: {
          id: dto.workspaceId,
        },
        select: {
          id: true,
        },
      });

      if (!workspace) {
        throw new NotFoundException(
          'Workspace not found.',
        );
      }

      const existingBoard = await tx.board.findFirst({
        where: {
          workspaceId: dto.workspaceId,
          name: dto.boardName.trim(),
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

      const board = await tx.board.create({
        data: {
          name: dto.boardName.trim(),
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

      const columnDefinitions = [
        {
          name: dto.taskColumn,
          type: BoardColumnType.TEXT,
          isPrimary: true,
        },
        ...dto.columns
          .filter(
            (column) =>
              column.sourceColumn !== dto.taskColumn &&
              column.sourceColumn !== dto.groupColumn,
          )
          .map((column) => ({
            name: column.targetColumn,
            type: column.type,
            isPrimary: false,
          })),
      ];

      const columns = await tx.boardColumn.createManyAndReturn({
        data: columnDefinitions.map(
          (column, index) => ({
            boardId: board.id,
            name: column.name,
            type: column.type,
            isPrimary: column.isPrimary,
            order: (index + 1) * 1000,
          }),
        ),
      });

      const statusOptionsByColumn = new Map<
        string,
        Map<string, any>
      >();

      for (const mapping of dto.columns) {
        if (
          mapping.type !== BoardColumnType.STATUS
        ) {
          continue;
        }

        const column = columns.find(
          (item) =>
            item.name === mapping.targetColumn,
        );

        if (!column) {
          continue;
        }

        const uniqueValues =
          this.getUniqueColumnValues(
            dto.rows,
            mapping.sourceColumn,
          );

        if (!uniqueValues.length) {
          continue;
        }

        const statusOptions =
          await tx.statusOption.createManyAndReturn({
            data: uniqueValues.map(
              (label, index) => ({
                columnId: column.id,
                label,
                color: this.getStatusColor(index),
                order: (index + 1) * 1000,
              }),
            ),
          });

        const optionMap = new Map<string, any>();

        for (const option of statusOptions) {
          optionMap.set(
            option.label.trim().toLowerCase(),
            option,
          );
        }

        statusOptionsByColumn.set(
          mapping.sourceColumn,
          optionMap,
        );
      }

      const groupedRows = this.groupRows(
        dto.rows,
        dto.groupColumn,
      );

      let groupOrder = 1000;

      for (const [groupName, rows] of groupedRows) {
        const group = await tx.group.create({
          data: {
            boardId: board.id,
            name: groupName,
            color: this.getGroupColor(groupOrder),
            order: groupOrder,
            createdById: userId,
          },
        });

        const validRows = rows
          .map((row) => ({
            row,
            taskName: this.getTaskName(
              row[dto.taskColumn],
            ),
          }))
          .filter(
            (
              item,
            ): item is {
              row: Record<string, unknown>;
              taskName: string;
            } => Boolean(item.taskName),
          );

        if (!validRows.length) {
          groupOrder += 1000;
          continue;
        }

        const tasks =
          await tx.task.createManyAndReturn({
            data: validRows.map(
              (item, index) => ({
                groupId: group.id,
                name: item.taskName,
                order: (index + 1) * 1000,
                createdById: userId,
              }),
            ),
          });

        const taskCells: {
          taskId: number;
          columnId: number;
          value: string;
        }[] = [];

        for (
          let index = 0;
          index < tasks.length;
          index++
        ) {
          const task = tasks[index];
          const row = validRows[index].row;

          for (const mapping of dto.columns) {
            if (
              mapping.sourceColumn === dto.taskColumn ||
              mapping.sourceColumn === dto.groupColumn
            ) {
              continue;
            }

            const column = columns.find(
              (item) =>
                item.name === mapping.targetColumn,
            );

            if (!column) {
              continue;
            }

            const rawValue =
              row[mapping.sourceColumn];

            if (
              rawValue === null ||
              rawValue === undefined ||
              rawValue === ''
            ) {
              continue;
            }

            const value =
              this.normalizeCellValue(
                rawValue,
                mapping.type,
                mapping.sourceColumn,
                statusOptionsByColumn,
              );

            if (value === null) {
              continue;
            }

            taskCells.push({
              taskId: task.id,
              columnId: column.id,
              value,
            });
          }
        }

        if (taskCells.length) {
          await tx.taskCell.createMany({
            data: taskCells,
          });
        }

        groupOrder += 1000;
      }

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

  private groupRows(
    rows: Record<string, unknown>[],
    groupColumn?: string,
  ) {
    const grouped = new Map<
      string,
      Record<string, unknown>[]
    >();

    for (const row of rows) {
      const rawGroup = groupColumn
        ? row[groupColumn]
        : null;

      const groupName =
        rawGroup !== null &&
        rawGroup !== undefined &&
        String(rawGroup).trim()
          ? String(rawGroup).trim()
          : 'Imported Tasks';

      if (!grouped.has(groupName)) {
        grouped.set(groupName, []);
      }

      grouped.get(groupName)!.push(row);
    }

    return grouped;
  }

  private getTaskName(
    value: unknown,
  ): string | null {
    if (
      value === null ||
      value === undefined
    ) {
      return null;
    }

    const name = String(value).trim();

    return name || null;
  }

  private getUniqueColumnValues(
    rows: Record<string, unknown>[],
    columnName: string,
  ) {
    const values = new Set<string>();

    for (const row of rows) {
      const value = row[columnName];

      if (
        value === null ||
        value === undefined ||
        value === ''
      ) {
        continue;
      }

      values.add(String(value).trim());
    }

    return Array.from(values);
  }

  private normalizeCellValue(
    value: unknown,
    type: BoardColumnType,
    sourceColumn: string,
    statusOptionsByColumn: Map<
      string,
      Map<string, any>
    >,
  ): string | null {
    switch (type) {
      case BoardColumnType.STATUS: {
        const optionMap =
          statusOptionsByColumn.get(
            sourceColumn,
          );

        const option = optionMap?.get(
          String(value)
            .trim()
            .toLowerCase(),
        );

        return option
          ? String(option.id)
          : null;
      }

      case BoardColumnType.CHECKBOX:
        return this.normalizeBoolean(value);

      case BoardColumnType.NUMBER:
        return this.normalizeNumber(value);

      case BoardColumnType.DATE:
        return this.normalizeDate(value);

      default:
        return String(value);
    }
  }

  private normalizeBoolean(
    value: unknown,
  ): string {
    if (typeof value === 'boolean') {
      return String(value);
    }

    const normalized = String(value)
      .trim()
      .toLowerCase();

    return String(
      [
        'true',
        'yes',
        '1',
        'checked',
      ].includes(normalized),
    );
  }

  private normalizeNumber(
    value: unknown,
  ): string {
    if (typeof value === 'number') {
      return String(value);
    }

    const parsed = Number(
      String(value).replace(/,/g, ''),
    );

    return Number.isNaN(parsed)
      ? String(value)
      : String(parsed);
  }

  private normalizeDate(
    value: unknown,
  ): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    const date = new Date(String(value));

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }

    return String(value);
  }

  private getStatusColor(
    index: number,
  ): string {
    const colors = [
      '#579BFC',
      '#00C875',
      '#FDAB3D',
      '#E2445C',
      '#A25DDC',
      '#66CCFF',
    ];

    return colors[
      index % colors.length
    ];
  }

  private getGroupColor(
    order: number,
  ): string {
    const colors = [
      '#579BFC',
      '#00C875',
      '#FDAB3D',
      '#E2445C',
      '#A25DDC',
    ];

    const index =
      Math.floor(order / 1000) - 1;

    return colors[
      index % colors.length
    ];
  }
}

