import ExcelJS from "exceljs";
import type { ExcelTableData, PreviewCell, PreviewRow } from "./excel.types";

export function argbToHex(argb?: string) {
  if (!argb) return undefined;

  if (argb.length === 8) {
    return `#${argb.slice(2)}`;
  }

  if (argb.length === 6) {
    return `#${argb}`;
  }

  return undefined;
}

export function getCellValue(value: ExcelJS.CellValue): React.ReactNode {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    if ("text" in value) {
      return value.text;
    }

    if ("result" in value) {
      return getCellValue(value.result);
    }

    if ("richText" in value) {
      return value.richText.map((item) => item.text).join("");
    }

    if (value instanceof Date) {
      return value.toLocaleString();
    }

    return JSON.stringify(value);
  }

  return String(value);
}

export function getCellStyle(cell: ExcelJS.Cell): React.CSSProperties {
  const style: React.CSSProperties = {};

  // Font
  if (cell.font) {
    if (cell.font.bold) {
      style.fontWeight = "bold";
    }

    if (cell.font.italic) {
      style.fontStyle = "italic";
    }

    if (cell.font.underline) {
      style.textDecoration = "underline";
    }

    if (cell.font.size) {
      style.fontSize = `${cell.font.size}pt`;
    }

    if (cell.font.color?.argb) {
      style.color = argbToHex(cell.font.color.argb);
    }
  }

  // Background
  if (
    cell.fill?.type === "pattern" &&
    cell.fill.pattern === "solid" &&
    cell.fill.fgColor?.argb
  ) {
    style.backgroundColor = argbToHex(cell.fill.fgColor.argb);
  }

  // Alignment
  if (cell.alignment) {
    if (cell.alignment.horizontal) {
      style.textAlign = cell.alignment
        .horizontal as React.CSSProperties["textAlign"];
    }

    if (cell.alignment.vertical) {
      style.verticalAlign = cell.alignment
        .vertical as React.CSSProperties["verticalAlign"];
    }

    style.whiteSpace = cell.alignment.wrapText ? "normal" : "nowrap";
  }

  // Borders
  const border = cell.border;

  if (border?.top?.style) {
    style.borderTop = `1px solid ${
      argbToHex(border.top.color?.argb) ?? "#d1d5db"
    }`;
  }

  if (border?.bottom?.style) {
    style.borderBottom = `1px solid ${
      argbToHex(border.bottom.color?.argb) ?? "#d1d5db"
    }`;
  }

  if (border?.left?.style) {
    style.borderLeft = `1px solid ${
      argbToHex(border.left.color?.argb) ?? "#d1d5db"
    }`;
  }

  if (border?.right?.style) {
    style.borderRight = `1px solid ${
      argbToHex(border.right.color?.argb) ?? "#d1d5db"
    }`;
  }

  return style;
}

// --------------------------------------
// Merge types
// --------------------------------------

interface MergeRange {
  startRow: any;
  endRow: any;
  startCol: any;
  endCol: any;
}

// --------------------------------------
// Get merged ranges
// --------------------------------------

function getMergedRanges(
  worksheet: ExcelJS.Worksheet
): MergeRange[] {
  const ranges: MergeRange[] = [];

  const merges = worksheet.model.merges;

  if (!merges) {
    return ranges;
  }

  for (const range of merges) {
    const [start, end] =
      range.split(":");

    if (!start || !end) {
      continue;
    }

    const startCell =
      worksheet.getCell(start);

    const endCell =
      worksheet.getCell(end);

    ranges.push({
      startRow: startCell.row,
      endRow: endCell.row,
      startCol: startCell.col,
      endCol: endCell.col,
    });
  }

  return ranges;
}

// --------------------------------------
// Find merge containing a cell
// --------------------------------------

function findMerge(
  mergedRanges: MergeRange[],
  row: number,
  col: number,
): MergeRange | null {
  return (
    mergedRanges.find(
      (merge) =>
        row >= merge.startRow &&
        row <= merge.endRow &&
        col >= merge.startCol &&
        col <= merge.endCol,
    ) ?? null
  );
}

// --------------------------------------
// Check if cell is merge start
// --------------------------------------

function isMergeStart(merge: MergeRange, row: number, col: number) {
  return merge.startRow === row && merge.startCol === col;
}

// --------------------------------------
// Parse Excel
// --------------------------------------

export async function parseExcel(
  arrayBuffer: ArrayBuffer,
): Promise<ExcelTableData> {
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error("Excel file has no sheets");
  }

  const columnWidths = getColumnWidths(worksheet);

  // Get merged ranges once
  const mergedRanges = getMergedRanges(worksheet);

  const rows: PreviewRow[] = [];

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);

    const cells: PreviewCell[] = [];

    for (let colNumber = 1; colNumber <= worksheet.columnCount; colNumber++) {
      const cell = row.getCell(colNumber);

      const merge = findMerge(mergedRanges, rowNumber, colNumber);

      // Skip cells that are inside
      // a merged range.
      //
      // Only render the first/top-left
      // cell of the merged range.
      if (merge && !isMergeStart(merge, rowNumber, colNumber)) {
        continue;
      }

      cells.push({
        value: getCellValue(cell.value),

        style: getCellStyle(cell),

        colSpan: merge ? merge.endCol - merge.startCol + 1 : 1,

        rowSpan: merge ? merge.endRow - merge.startRow + 1 : 1,
      });
    }

    rows.push({
      cells,
      height: row.height,
    });
  }

  return {
    rows,
    columnWidths,
  };
}

// --------------------------------------
// Column widths
// --------------------------------------

function getColumnWidths(worksheet: ExcelJS.Worksheet) {
  const widths: number[] = [];

  for (let i = 1; i <= worksheet.columnCount; i++) {
    const column = worksheet.getColumn(i);

    widths.push((column.width ?? 10) * 7);
  }

  return widths;
}
