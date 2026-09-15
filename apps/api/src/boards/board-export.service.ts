import { Injectable, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';

import { PrismaService } from 'prisma/prisma.service';
import { BoardColumnType } from 'generated/prisma/enums';

@Injectable()
export class BoardExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportBoard(
    boardId: number,
    groupId?: number,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: {
        name: true,
        columns: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            type: true,
            isPrimary: true,
            statusOptions: {
              where: { isArchived: false },
              orderBy: { order: 'asc' },
              select: { label: true, color: true },
            },
          },
        },
        groups: {
          where: groupId ? { id: groupId } : { isArchived: false },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            color: true,
            tasks: {
              where: { parentId: null },
              orderBy: { order: 'asc' },
              select: {
                id: true,
                name: true,
                cells: {
                  select: {
                    columnId: true,
                    value: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    const extraCols = board.columns.filter((c) => !c.isPrimary);

    /* column names row: always "Name" first so the import parser detects groups */
    const headerRow = ['Name', ...extraCols.map((c) => c.name)];

    const wsData: any[][] = [];

    /* Row 0 — board name */
    wsData.push([board.name]);
    /* Row 1-2 — blank spacers */
    wsData.push([]);
    wsData.push([]);

    /* styles keyed by encoded cell address */
    const cellStyles: Record<string, object> = {};

    for (const group of board.groups) {
      /* Group name row */
      const groupRowIdx = wsData.length;
      wsData.push([group.name]);
      if (group.color) {
        cellStyles[XLSX.utils.encode_cell({ r: groupRowIdx, c: 0 })] = {
          fill: {
            patternType: 'solid',
            fgColor: { rgb: hexToRgb(group.color) },
          },
          font: { bold: true, color: { rgb: 'FFFFFF' } },
        };
      }

      /* Header row */
      wsData.push(headerRow);

      /* Task rows */
      for (const task of group.tasks) {
        const rowIdx = wsData.length;
        const cellMap = new Map(task.cells.map((c) => [c.columnId, c.value]));

        const rowData: any[] = [task.name]; /* primary = task name */

        for (let ci = 0; ci < extraCols.length; ci++) {
          const col = extraCols[ci];
          const raw = cellMap.get(col.id) as any;
          const colIdx = ci + 1; /* +1 because col 0 is Name */

          if (raw === null || raw === undefined) {
            rowData.push('');
            continue;
          }

          if (col.type === BoardColumnType.STATUS) {
            const label: string =
              typeof raw === 'string'
                ? raw
                : (raw as any)?.label ?? '';

            const color: string =
              (raw as any)?.color ??
              col.statusOptions.find(
                (o) => o.label.toLowerCase() === label.toLowerCase(),
              )?.color ??
              '';

            rowData.push(label);

            if (color) {
              cellStyles[XLSX.utils.encode_cell({ r: rowIdx, c: colIdx })] = {
                fill: {
                  patternType: 'solid',
                  fgColor: { rgb: hexToRgb(color) },
                },
              };
            }
          } else {
            rowData.push(resolveDisplayValue(raw, col.type as BoardColumnType));
          }
        }

        wsData.push(rowData);
      }
    }

    /* Build worksheet */
    const worksheet = XLSX.utils.aoa_to_sheet(wsData);

    /* Apply cell styles */
    for (const [addr, style] of Object.entries(cellStyles)) {
      if (!worksheet[addr]) {
        worksheet[addr] = { t: 's', v: '' };
      }
      (worksheet[addr] as any).s = style;
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Board');

    const u8 = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    }) as Uint8Array;
    const buffer = Buffer.from(u8);

    const exportName = groupId
      ? (board.groups[0]?.name ?? board.name)
      : board.name;
    const safeName = exportName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
    const filename = `${safeName || 'export'}.xlsx`;

    return { buffer, filename };
  }
}

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '').toUpperCase();
  if (clean.length === 6) return clean;
  if (clean.length === 8) return clean.slice(2); /* strip alpha */
  return '94A3B8'; /* fallback gray */
}

function resolveDisplayValue(raw: unknown, type: BoardColumnType): unknown {
  if (raw === null || raw === undefined) return '';

  const v = raw as any;

  switch (type) {
    case BoardColumnType.TEXT:
      return v?.text ?? (typeof v === 'string' ? v : '');

    case BoardColumnType.NUMBER:
      return v?.number ?? (typeof v === 'number' ? v : '');

    case BoardColumnType.CHECKBOX:
      return v?.checked ? 'Yes' : '';

    case BoardColumnType.DATE:
      if (!v?.date) return '';
      try {
        return new Date(v.date).toLocaleDateString('en-CA'); /* YYYY-MM-DD */
      } catch {
        return v.date;
      }

    case BoardColumnType.TIMELINE:
      if (v?.startDate && v?.endDate) return `${v.startDate} - ${v.endDate}`;
      return v?.startDate ?? v?.endDate ?? '';

    case BoardColumnType.PERSON:
      return '';

    default:
      return typeof v === 'string' ? v : '';
  }
}
