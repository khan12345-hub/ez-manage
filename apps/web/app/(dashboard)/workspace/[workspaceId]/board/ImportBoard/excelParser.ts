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
  // taskName: string;
  [columnName: string]: string | StatusOption | null;
}

export interface ExcelBoardData {
  boardName: string;
  groups: ExcelGroup[];
  columns: ExcelColumn[];
  rows: ExcelRowItem[];
  taskColumn: any;
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
  column: number,
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
  column: number,
): string | null => {
  const address = XLSX.utils.encode_cell({ r: row, c: column });
  const cell = worksheet[address];
  if (!cell || !cell.s || !cell.s.font) return null;

  return normalizeColor(cell.s.font.color);
};

export const getCellValue = (
  worksheet: XLSX.WorkSheet,
  row: number,
  column: number,
): string => {
  const address = XLSX.utils.encode_cell({ r: row, c: column });
  const cell = worksheet[address];
  if (!cell) return "";

  const val = cell.w ?? cell.v ?? cell.f ?? "";
  return String(val).trim();
};

export const findBoardName = (
  worksheet: XLSX.WorkSheet,
  file: File,
): string => {
  const val = getCellValue(worksheet, 0, 0);
  return val || file.name.replace(/\.(xlsx|xls)$/i, "").trim();
};

export const findGroupRows = (worksheet: XLSX.WorkSheet): ExcelGroup[] => {
  const range = worksheet["!ref"]
    ? XLSX.utils.decode_range(worksheet["!ref"])
    : null;

  if (!range) {
    return [];
  }

  const groups: ExcelGroup[] = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    if (r <= 1) {
      continue;
    }

    for (let c = range.s.c; c <= range.e.c; c++) {
      const val = getCellValue(worksheet, r, c);

      if (!val) {
        continue;
      }

      const leftVal = c > range.s.c ? getCellValue(worksheet, r, c - 1) : "";

      // Group name must be the only value in
      // that area of the row.
      if (leftVal) {
        continue;
      }

      const rowBelowVal = getCellValue(worksheet, r + 1, c)
        .trim()
        .toLowerCase();

      if (rowBelowVal !== "name") {
        continue;
      }

      const textColor = getCellTextColor(worksheet, r, c);

      groups.push({
        name: val.trim(),
        color: textColor?.trim() || DEFAULT_GROUP_COLOR,
        rowIndex: r,
      });

      break;
    }
  }

  return groups;
};

// export async function extractExcelBoard(file: File): Promise<ExcelBoardData> {
//   const arrayBuffer = await file.arrayBuffer();

//   const workbook = XLSX.read(arrayBuffer, {
//     type: "array",
//     cellStyles: true,
//     cellDates: true,
//     cellNF: true,
//   });

//   const sheetName = workbook.SheetNames[0];
//   if (!sheetName) throw new Error("No worksheets found in file.");

//   const worksheet = workbook.Sheets[sheetName];
//   if (!worksheet) throw new Error("Unable to read worksheet.");

//   const range = worksheet["!ref"]
//     ? XLSX.utils.decode_range(worksheet["!ref"])
//     : null;
//   if (!range) throw new Error("Worksheet is empty.");

//   const boardName = findBoardName(worksheet, file);
//   const groups = findGroupRows(worksheet);

//   if (!groups.length) {
//     throw new Error(
//       "Could not detect any valid groups or column headers in the file.",
//     );
//   }

//   const masterHeaderRow =
//     groups[0]?.rowIndex != null ? groups[0].rowIndex + 1 : 0;
//   const fixedColumns: ExcelColumn[] = [];

//   // 1. Scan headers from gray row
//   for (let c = range.s.c; c <= range.e.c; c++) {
//     const colName = getCellValue(worksheet, masterHeaderRow, c);
//     if (colName) {
//       fixedColumns.push({ name: colName, index: c });
//     }
//   }

//   const parsedRows: ExcelRowItem[] = [];

//   // 2. Parse task rows
//   groups.forEach((group, index) => {
//     const headerRow = group.rowIndex + 1;
//     const nextGroup = groups[index + 1];
//     const sectionEndRow = nextGroup ? nextGroup.rowIndex - 1 : range.e.r;

//     for (let r = headerRow + 1; r <= sectionEndRow; r++) {
//       const rowItem: ExcelRowItem = {
//         __groupName: group.name,
//         __groupColor: group.color,
//       };
//       let rowHasData = false;

//       const sectionEndRow = nextGroup ? nextGroup.rowIndex - 1 : range.e.r;

//       console.log("[Excel Import] Processing group:", {
//         group: group.name,
//         groupRow: group.rowIndex,
//         headerRow,
//         sectionEndRow,
//       });

//       fixedColumns.forEach((col, colIdx) => {
//         let cellValue = getCellValue(worksheet, r, col.index);

//         // FALLBACK: If column 0 / primary column cell is empty, check column A index (range.s.c)
//         if (!cellValue && colIdx === 0) {
//           cellValue = getCellValue(worksheet, r, range.s.c);
//         }

//         const fillColor = getCellFillColor(worksheet, r, col.index);

//         if (cellValue) {
//           rowHasData = true;
//           if (fillColor) {
//             rowItem[col.name] = {
//               label: cellValue,
//               color: fillColor,
//             };
//           } else {
//             rowItem[col.name] = cellValue;
//           }
//         } else {
//           rowItem[col.name] = null;
//         }
//       });

//       if (rowHasData) {
//         parsedRows.push(rowItem);
//       }
//     }
//   });

//   // Remove duplicate column definitions if any exist
//   const uniqueColumns = fixedColumns.filter(
//     (col, idx, arr) => arr.findIndex((c) => c.name === col.name) === idx,
//   );

//   return {
//     boardName,
//     groups,
//     columns: uniqueColumns,
//     rows: parsedRows,
//   };
// }

// export async function extractExcelBoard(
//   file: File,
// ): Promise<ExcelBoardData> {
//   const arrayBuffer = await file.arrayBuffer();

//   const workbook = XLSX.read(arrayBuffer, {
//     type: "array",
//     cellStyles: true,
//     cellDates: true,
//     cellNF: true,
//   });

//   const sheetName = workbook.SheetNames[0];

//   if (!sheetName) {
//     throw new Error("No worksheets found in file.");
//   }

//   const worksheet = workbook.Sheets[sheetName];

//   if (!worksheet) {
//     throw new Error("Unable to read worksheet.");
//   }

//   const range = worksheet["!ref"]
//     ? XLSX.utils.decode_range(worksheet["!ref"])
//     : null;

//   if (!range) {
//     throw new Error("Worksheet is empty.");
//   }

//   const boardName = findBoardName(worksheet, file);
//   const groups = findGroupRows(worksheet);

//   if (!groups.length) {
//     throw new Error(
//       "Could not detect any valid groups or column headers in the file.",
//     );
//   }

//   const masterHeaderRow =
//     groups[0]?.rowIndex != null
//       ? groups[0].rowIndex + 1
//       : 0;

//   const fixedColumns: ExcelColumn[] = [];

//   // 1. Scan headers from gray row
//   for (let c = range.s.c; c <= range.e.c; c++) {
//     const colName = getCellValue(
//       worksheet,
//       masterHeaderRow,
//       c,
//     );

//     if (colName) {
//       fixedColumns.push({
//         name: colName,
//         index: c,
//       });
//     }
//   }

//   const parsedRows: ExcelRowItem[] = [];

//   // 2. Parse task rows
//   groups.forEach((group, index) => {
//     const headerRow = group.rowIndex + 1;

//     const nextGroup = groups[index + 1];

//     const sectionEndRow = nextGroup
//       ? nextGroup.rowIndex - 1
//       : range.e.r;

//     console.log("[Excel Import] Processing group:", {
//       group: group.name,
//       groupRow: group.rowIndex,
//       headerRow,
//       sectionEndRow,
//     });

//     for (
//       let r = headerRow + 1;
//       r <= sectionEndRow;
//       r++
//     ) {
//       const rowItem: ExcelRowItem = {
//         __groupName: group.name,
//         __groupColor: group.color,
//       };

//       let rowHasData = false;

//       fixedColumns.forEach((col, colIdx) => {
//         let cellValue = getCellValue(
//           worksheet,
//           r,
//           col.index,
//         );

//         if (colIdx === 0) {
//           cellValue = getCellValue(
//             worksheet,
//             r,
//             range.s.c,
//           );
//         }

//         const fillColor = getCellFillColor(
//           worksheet,
//           r,
//           col.index,
//         );

//         if (
//           cellValue !== null &&
//           cellValue !== undefined &&
//           String(cellValue).trim() !== ""
//         ) {
//           rowHasData = true;

//           if (fillColor) {
//             rowItem[col.name] = {
//               label: cellValue,
//               color: fillColor,
//             };
//           } else {
//             rowItem[col.name] = cellValue;
//           }
//         } else {
//           rowItem[col.name] = null;
//         }
//       });

//       if (rowHasData) {
//         parsedRows.push(rowItem);
//       }
//     }
//   });

//   // Remove duplicate column definitions if any exist
//   const uniqueColumns = fixedColumns.filter(
//     (col, idx, arr) =>
//       arr.findIndex(
//         (c) => c.name === col.name,
//       ) === idx,
//   );

//   console.log("[Excel Import] Final columns:", uniqueColumns);

//   console.log(
//     "[Excel Import] Final parsed rows:",
//     JSON.stringify(parsedRows, null, 2),
//   );

//   return {
//     boardName,
//     groups,
//     columns: uniqueColumns,
//     rows: parsedRows,
//     taskColumn: uniqueColumns[0]?.name ?? "",
//   };
// }

export async function extractExcelBoard(file: File): Promise<ExcelBoardData> {
  const arrayBuffer = await file.arrayBuffer();

  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    cellStyles: true,
    cellDates: true,
    cellNF: true,
  });

  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("No worksheets found in file.");
  }

  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error("Unable to read worksheet.");
  }

  const range = worksheet["!ref"]
    ? XLSX.utils.decode_range(worksheet["!ref"])
    : null;

  if (!range) {
    throw new Error("Worksheet is empty.");
  }

  const boardName = findBoardName(worksheet, file);

  const groups = findGroupRows(worksheet);

  if (!groups.length) {
    throw new Error(
      "Could not detect any valid groups or column headers in the file.",
    );
  }

  /*
   * =========================================================
   * 1. FIND MASTER HEADER ROW
   * =========================================================
   *
   * Excel structure:
   *
   * Row X     -> Group name
   * Row X + 1 -> Name | Status | Person | Date | ...
   * Row X + 2 -> Task 1
   * Row X + 3 -> Task 2
   *
   * Therefore the row immediately below the group is
   * always the header row.
   */
  const masterHeaderRow =
    groups.length > 0 && groups[0]?.rowIndex != null
      ? groups[0].rowIndex + 1
      : 0;

  console.log("[Excel Import] Master header row:", {
    rowIndex: masterHeaderRow,
    excelRow: masterHeaderRow + 1,
  });

  /*
   * =========================================================
   * 2. READ ALL COLUMN HEADERS
   * =========================================================
   */
  const fixedColumns: ExcelColumn[] = [];

  for (let c = range.s.c; c <= range.e.c; c++) {
    const colName = getCellValue(worksheet, masterHeaderRow, c);

    if (!colName) {
      continue;
    }

    fixedColumns.push({
      name: colName.trim(),
      index: c,
    });
  }

  console.log("[Excel Import] Fixed columns:", fixedColumns);

  if (!fixedColumns.length) {
    throw new Error("Could not find any column headers below the group.");
  }

  /*
   * =========================================================
   * 3. DETERMINE TASK COLUMN
   * =========================================================
   *
   * The FIRST column under the group is the primary column.
   *
   * Expected:
   *
   *       Group Name
   *       ↓
   *       Name | Status | Owner | Date
   *       ↓
   *       Task 1
   *       Task 2
   *
   * So "Name" should resolve to the first header column.
   *
   * We first look for "Name" explicitly.
   * If it doesn't exist, use the first header column.
   */
  const nameColumn = fixedColumns.find(
    (column) => column.name.trim().toLowerCase() === "name",
  );

  const taskColumnDefinition = nameColumn ?? fixedColumns[0];

  if (!taskColumnDefinition) {
    throw new Error("Could not determine the task/name column.");
  }

  const taskColumnName = taskColumnDefinition.name;
  const taskColumnIndex = taskColumnDefinition.index;

  console.log("[Excel Import] Task column detected:", {
    name: taskColumnName,
    index: taskColumnIndex,
    headerAddress: XLSX.utils.encode_cell({
      r: masterHeaderRow,
      c: taskColumnIndex,
    }),
  });

  /*
   * Verify the actual header cell.
   */
  console.log(
    "[Excel Import] Task column header value:",
    getCellValue(worksheet, masterHeaderRow, taskColumnIndex),
  );

  /*
   * =========================================================
   * 4. PARSE TASK ROWS GROUP BY GROUP
   * =========================================================
   */
  const parsedRows: ExcelRowItem[] = [];

  groups.forEach((group, groupIndex) => {
    const headerRow = group.rowIndex + 1;

    const nextGroup = groups[groupIndex + 1];

    /*
     * Everything between this group's header and the next
     * group belongs to this group.
     */
    const sectionEndRow = nextGroup ? nextGroup.rowIndex - 1 : range.e.r;

    console.log("[Excel Import] Processing group:", {
      group: group.name,
      groupRow: group.rowIndex,
      headerRow,
      taskStartRow: headerRow + 1,
      sectionEndRow,
      taskColumnName,
      taskColumnIndex,
    });

    /*
     * IMPORTANT:
     *
     * Start at headerRow + 1.
     *
     * This means:
     *
     * group row      -> ignored
     * header row     -> ignored
     * task row       -> parsed
     */
    for (let r = headerRow + 1; r <= sectionEndRow; r++) {
      /*
       * -----------------------------------------------------
       * READ TASK NAME DIRECTLY FROM "Name" COLUMN
       * -----------------------------------------------------
       */
      const taskName = getCellValue(worksheet, r, taskColumnIndex);

      console.log("[Excel Import] Task row:", {
        group: group.name,
        rowIndex: r,
        excelRow: r + 1,
        taskCell: XLSX.utils.encode_cell({
          r,
          c: taskColumnIndex,
        }),
        taskName,
      });

      /*
       * If the Name column is empty, this is not a task row.
       *
       * This is important because otherwise a status value
       * or some other column could accidentally cause an
       * empty task to be created.
       */
      if (!taskName) {
        console.log("[Excel Import] Skipping row because task name is empty:", {
          group: group.name,
          row: r + 1,
        });

        continue;
      }

      const rowItem: ExcelRowItem = {
        __groupName: group.name,
        __groupColor: group.color,
        // taskName,
        /*
         * THE ACTUAL TASK NAME
         */
        [taskColumnName]: taskName,
      };

      /*
       * -----------------------------------------------------
       * READ OTHER COLUMNS
       * -----------------------------------------------------
       */
      fixedColumns.forEach((column) => {
        /*
         * We already populated the task column above.
         */
        if (column.name.trim().toLowerCase() === "name") {
          return;
        }

        if (column.index === taskColumnIndex) {
          return;
        }

        const cellValue = getCellValue(worksheet, r, column.index);

        const fillColor = getCellFillColor(worksheet, r, column.index);

        if (cellValue) {
          /*
           * Preserve colored-cell information.
           *
           * Example:
           *
           * Status = "Working on it"
           * Color = "#FDAB3D"
           */
          if (fillColor) {
            rowItem[column.name] = {
              label: cellValue,
              color: fillColor,
            };
          } else {
            rowItem[column.name] = cellValue;
          }
        } else {
          rowItem[column.name] = null;
        }
      });

      /*
       * A valid task row has already been guaranteed by
       * taskName above.
       */
      parsedRows.push(rowItem);
    }
  });

  /*
   * =========================================================
   * 5. REMOVE DUPLICATE COLUMNS
   * =========================================================
   */
  const uniqueColumns = fixedColumns.filter(
    (column, index, array) =>
      array.findIndex(
        (c) => c.name.trim().toLowerCase() === column.name.trim().toLowerCase(),
      ) === index,
  );

  /*
   * =========================================================
   * 6. DEBUG FINAL RESULT
   * =========================================================
   */
  console.log("[Excel Import] FINAL TASK COLUMN:", {
    name: taskColumnName,
    index: taskColumnIndex,
  });

  console.log("[Excel Import] FINAL COLUMNS:", uniqueColumns);

  console.log(
    "[Excel Import] FINAL ROWS:",
    JSON.stringify(parsedRows, null, 2),
  );

  return {
    boardName,
    groups,
    columns: uniqueColumns,
    rows: parsedRows,
    taskColumn: taskColumnName,
  };
}
