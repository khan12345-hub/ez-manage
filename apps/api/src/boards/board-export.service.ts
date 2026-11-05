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
              orderBy: [{ order: 'asc' }, { id: 'asc' }],
              select: {
                id: true,
                name: true,
                cells: {
                  select: {
                    columnId: true,
                    value: true,
                  },
                },
                subtasks: {
                  orderBy: [{ order: 'asc' }, { id: 'asc' }],
                  select: {
                    id: true,
                    name: true,
                    cells: { select: { columnId: true, value: true } },
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

    /* Resolve PERSON cell user ids → display names in one query */
    const personColIds = new Set(
      extraCols.filter((c) => c.type === BoardColumnType.PERSON).map((c) => c.id),
    );
    const userIds = new Set<number>();
    for (const g of board.groups) {
      for (const t of g.tasks) {
        for (const row of [t, ...t.subtasks]) {
          for (const c of row.cells) {
            if (!personColIds.has(c.columnId)) continue;
            for (const u of ((c.value as any)?.users ?? []) as any[]) {
              if (typeof u?.id === 'number') userIds.add(u.id);
            }
          }
        }
      }
    }
    const users = userIds.size
      ? await this.prisma.user.findMany({
          where: { id: { in: [...userIds] } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const userNames = new Map(
      users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]),
    );

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

      /* Task rows (each parent followed by its subtasks, prefixed "↳ ") */
      const rows = group.tasks.flatMap((t) => [
        { name: t.name, cells: t.cells },
        ...t.subtasks.map((s) => ({ name: `↳ ${s.name}`, cells: s.cells })),
      ]);
      for (const task of rows) {
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
            rowData.push(
              resolveDisplayValue(raw, col.type as BoardColumnType, userNames),
            );
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

/**
 * Stored date → "YYYY-MM-DD".
 * Plain "YYYY-MM-DD" values are returned as-is (never re-parsed, so the
 * server's timezone cannot shift them). Legacy ISO timestamps use the UTC day.
 */
function formatDateValue(d: unknown): string {
  if (d === null || d === undefined || d === '') return '';
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? s : dt.toISOString().slice(0, 10);
}

/** Generic fallback for shapes like {text}, {label}, {url}, {email}, arrays. */
function genericText(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'Yes' : '';
  if (Array.isArray(v)) return v.map(genericText).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    return String(
      v.text ?? v.label ?? v.name ?? v.url ?? v.email ?? v.number ?? v.value ?? '',
    );
  }
  return '';
}

function resolveDisplayValue(
  raw: unknown,
  type: BoardColumnType,
  userNames: Map<number, string>,
): unknown {
  if (raw === null || raw === undefined) return '';

  const v = raw as any;

  switch (type) {
    case BoardColumnType.TEXT:
    case BoardColumnType.LONG_TEXT:
    case BoardColumnType.DROPDOWN:
      return genericText(v);

    case BoardColumnType.NUMBER:
    case BoardColumnType.PRICE: {
      // The UI stores numbers as { text: "12" }.
      const n = v?.number ?? v?.text ?? v;
      const num = Number(n);
      return n === '' || n === null || n === undefined || isNaN(num)
        ? genericText(n)
        : num;
    }

    case BoardColumnType.CHECKBOX:
      return v?.checked ? 'Yes' : '';

    case BoardColumnType.DATE:
    case BoardColumnType.PLAIN_DATE:
      return formatDateValue(v?.date ?? v);

    case BoardColumnType.TIMELINE: {
      const s = formatDateValue(v?.startDate);
      const e = formatDateValue(v?.endDate);
      if (s && e) return `${s} - ${e}`;
      return s || e;
    }

    case BoardColumnType.PERSON: {
      const list: any[] = Array.isArray(v?.users) ? v.users : [];
      return list
        .map(
          (u) =>
            userNames.get(u?.id) ??
            [u?.firstName, u?.lastName].filter(Boolean).join(' '),
        )
        .filter(Boolean)
        .join(', ');
    }

    case BoardColumnType.LINK:
      return v?.text || v?.url || genericText(v);

    case BoardColumnType.EMAIL:
      return v?.email || genericText(v);

    case BoardColumnType.LABEL:
      return genericText(v);

    default:
      return genericText(v);
  }
}
