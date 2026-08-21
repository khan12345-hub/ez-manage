// src/utils/excelParser.ts
import * as XLSX from "xlsx-js-style";

export interface ExcelColumn {
  name: string;
  index: number;
}

export interface ExcelGroup {
  name: string;
  color: string;
  rowIndex: number;
}

export interface StatusOption {
  label: string;
  color: string;
}

export interface ExcelRowItem {
  __groupName: string;
  __groupColor: string;
  [columnName: string]: string | StatusOption | null;
}

export interface ExcelBoardData {
  boardName: string;
  groups: ExcelGroup[];
  columns: ExcelColumn[];
  rows: ExcelRowItem[];
}

const DEFAULT_GROUP_COLOR = "#579BFC";

const normalizeColor = (colorObj: any): string | null => {
  if (!colorObj) return null;
  const raw = colorObj.rgb || colorObj.theme || colorObj.indexed;
  if (typeof raw === "string") {
    let hex = raw.replace(/^FF/i, "");
    if (hex.length === 6) return `#${hex}`;
  }
  return null;
};

export const getCellFillColor = (
  worksheet: XLSX.WorkSheet,
  row: number,
  column: number
): string | null => {
  const address = XLSX.utils.encode_cell({ r: row, c: column });
  const cell = worksheet[address];
  if (!cell || !cell.s) return null;

  const fill = cell.s.fill;
  if (!fill) return null;

  return normalizeColor(fill.fgColor) || normalizeColor(fill.bgColor);
};

export const getCellTextColor = (
  worksheet: XLSX.WorkSheet,
  row: number,
  column: number
): string | null => {
  const address = XLSX.utils.encode_cell({ r: row, c: column });
  const cell = worksheet[address];
  if (!cell || !cell.s || !cell.s.font) return null;

  return normalizeColor(cell.s.font.color);
};

export const getCellValue = (
  worksheet: XLSX.WorkSheet,
  row: number,
  column: number
): string => {
  const address = XLSX.utils.encode_cell({ r: row, c: column });
  const cell = worksheet[address];
  return cell && cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : "";
};

export const findBoardName = (worksheet: XLSX.WorkSheet, file: File): string => {
  const val = getCellValue(worksheet, 0, 0);
  return val || file.name.replace(/\.(xlsx|xls)$/i, "").trim();
};

export const findGroupRows = (worksheet: XLSX.WorkSheet): ExcelGroup[] => {
  const range = worksheet["!ref"] ? XLSX.utils.decode_range(worksheet["!ref"]) : null;
  if (!range) return [];

  const groups: ExcelGroup[] = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    if (r <= 1) continue;

    for (let c = range.s.c; c <= range.e.c; c++) {
      const val = getCellValue(worksheet, r, c);
      if (!val) continue;

      const leftVal = c > range.s.c ? getCellValue(worksheet, r, c - 1) : "";
      if (leftVal) continue;

      const rowBelowVal = getCellValue(worksheet, r + 1, c).toLowerCase();
      if (rowBelowVal === "name" || rowBelowVal.length > 0) {
        const color = getCellTextColor(worksheet, r, c) ?? DEFAULT_GROUP_COLOR;
        groups.push({ name: val, color, rowIndex: r });
        break;
      }
    }
  }

  return groups;
};

export async function extractExcelBoard(file: File): Promise<ExcelBoardData> {
  const arrayBuffer = await file.arrayBuffer();

  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    cellStyles: true,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("No worksheets found in file.");

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw new Error("Unable to read worksheet.");

  const range = worksheet["!ref"] ? XLSX.utils.decode_range(worksheet["!ref"]) : null;
  if (!range) throw new Error("Worksheet is empty.");

  const boardName = findBoardName(worksheet, file);
  const groups = findGroupRows(worksheet);

  const parsedRows: ExcelRowItem[] = [];
  const masterColumnsMap = new Map<string, number>();

  groups.forEach((group, index) => {
    const headerRow = group.rowIndex + 1;
    const nextGroup = groups[index + 1];
    const sectionEndRow = nextGroup ? nextGroup.rowIndex - 1 : range.e.r;

    // Scan headers in gray row
    const sectionColumns: ExcelColumn[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const headerName = getCellValue(worksheet, headerRow, c);
      if (headerName) {
        sectionColumns.push({ name: headerName, index: c });
        if (!masterColumnsMap.has(headerName)) {
          masterColumnsMap.set(headerName, c);
        }
      }
    }

    // Extract row data
    for (let r = headerRow + 1; r <= sectionEndRow; r++) {
      const rowItem: ExcelRowItem = {
        __groupName: group.name,
        __groupColor: group.color,
      };
      let rowHasData = false;

      sectionColumns.forEach((col) => {
        const cellValue = getCellValue(worksheet, r, col.index);
        const fillColor = getCellFillColor(worksheet, r, col.index);

        if (cellValue) {
          rowHasData = true;
          if (fillColor) {
            rowItem[col.name] = {
              label: cellValue,
              color: fillColor,
            };
          } else {
            rowItem[col.name] = cellValue;
          }
        } else {
          rowItem[col.name] = null;
        }
      });

      if (rowHasData) {
        parsedRows.push(rowItem);
      }
    }
  });

  const columns: ExcelColumn[] = Array.from(masterColumnsMap.entries()).map(
    ([name, index]) => ({ name, index })
  );

  return { boardName, groups, columns, rows: parsedRows };
}