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
  __isSubitem?: boolean;
  __parentTaskName?: string;
  [columnName: string]: string | StatusOption | null | boolean | undefined;
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

  // Monday.com stores file URLs as hyperlinks: display text = filename, actual URL = cell.l.Target
  // Return the hyperlink URL when it's a valid http/https URL
  if (cell.l?.Target && /^https?:\/\//i.test(String(cell.l.Target))) {
    return String(cell.l.Target).trim();
  }

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
    // Only skip the very first row (board name). Row 1+ can be group headers.
    if (r === range.s.r) {
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

  // If no Monday.com-style groups detected, fall back to flat table parsing
  if (!groups.length) {
    return parseFlatTable(worksheet, range, file);
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
     * State for Monday.com subitem section detection.
     *
     * Monday.com exports subitems as:
     *   Row N:     "Subitems" | "Name" | "Owner" | "Status" ... (marker row)
     *   Row N+1:   (empty)    | Wireframe Creation | ...       (subitem row)
     *   Row N+2:   (empty)    | Prototype Testing  | ...       (subitem row)
     *   Row N+3:   Next Task  | ...                            (back to tasks)
     */
    let lastParentTaskName: string | null = null;
    let inSubitemSection = false;
    let subitemNameColIndex = -1;

    for (let r = headerRow + 1; r <= sectionEndRow; r++) {
      /*
       * -----------------------------------------------------
       * READ TASK NAME DIRECTLY FROM "Name" COLUMN
       * -----------------------------------------------------
       */
      const taskName = getCellValue(worksheet, r, taskColumnIndex);

      /*
       * Detect Monday.com subitem marker row:
       * The Name column contains the literal text "Subitems".
       */
      if (taskName.trim().toLowerCase() === "subitems") {
        inSubitemSection = true;
        // Find which column in this row is labeled "Name" — that's where subitem names live
        subitemNameColIndex = -1;
        for (const col of fixedColumns) {
          if (col.index === taskColumnIndex) continue;
          const markerVal = getCellValue(worksheet, r, col.index);
          if (markerVal.trim().toLowerCase() === "name") {
            subitemNameColIndex = col.index;
            break;
          }
        }
        // Fallback: use first non-taskColumn column
        if (subitemNameColIndex === -1) {
          const fallback = fixedColumns.find(
            (col) => col.index !== taskColumnIndex,
          );
          if (fallback) subitemNameColIndex = fallback.index;
        }
        continue; // Skip the marker row itself
      }

      /*
       * While inside a subitem section, empty Name column = subitem row.
       */
      if (inSubitemSection) {
        if (!taskName.trim()) {
          if (subitemNameColIndex >= 0 && lastParentTaskName) {
            const subitemName = getCellValue(
              worksheet,
              r,
              subitemNameColIndex,
            ).trim();
            if (subitemName) {
              parsedRows.push({
                __groupName: group.name,
                __groupColor: group.color,
                __isSubitem: true,
                __parentTaskName: lastParentTaskName,
                [taskColumnName]: subitemName,
              });
            }
          }
          continue;
        }
        // Non-empty Name column after a subitem section = back to regular tasks
        inSubitemSection = false;
        subitemNameColIndex = -1;
      }

      /*
       * If the Name column is empty, this is not a task row.
       */
      if (!taskName) {
        continue;
      }

      lastParentTaskName = taskName.trim();

      const rowItem: ExcelRowItem = {
        __groupName: group.name,
        __groupColor: group.color,
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

  // Groups were detected but zero task rows came out — likely a false-positive
  // group detection on a non-Monday.com file. Fall back to flat table.
  if (!parsedRows.length) {
    return parseFlatTable(worksheet, range, file);
  }

  return {
    boardName,
    groups,
    columns: uniqueColumns,
    rows: parsedRows,
    taskColumn: taskColumnName,
  };
}

/**
 * Flat-table fallback parser for standard Excel files that don't follow
 * the Monday.com group-header structure.
 *
 * Expects:
 *   Row N   → column headers (first row with ≥ 2 non-empty cells)
 *   Row N+1 → data rows
 *
 * All tasks land in one default group "Imported Tasks".
 */
function parseFlatTable(
  worksheet: XLSX.WorkSheet,
  range: XLSX.Range,
  file: File,
): ExcelBoardData {
  // Find the header row — first row that has at least 2 non-empty cells
  let headerRowIndex = range.s.r;
  for (let r = range.s.r; r <= Math.min(range.s.r + 10, range.e.r); r++) {
    let nonEmpty = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (getCellValue(worksheet, r, c)) nonEmpty++;
    }
    if (nonEmpty >= 2) {
      headerRowIndex = r;
      break;
    }
  }

  // Read column headers from that row
  const columns: ExcelColumn[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const name = getCellValue(worksheet, headerRowIndex, c);
    if (name) columns.push({ name: name.trim(), index: c });
  }

  if (!columns.length) {
    return {
      boardName: file.name.replace(/\.(xlsx|xls)$/i, "").trim(),
      groups: [],
      columns: [],
      rows: [],
      taskColumn: "",
    };
  }

  // Task column = first column (or first one named "name" / "task")
  const nameCol =
    columns.find((c) =>
      ["name", "task", "task name", "title", "item"].includes(
        c.name.toLowerCase(),
      ),
    ) ?? columns[0]!;

  const taskColumnName = nameCol.name;
  const taskColumnIndex = nameCol.index;

  // Parse data rows
  const rows: ExcelRowItem[] = [];
  for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
    const taskName = getCellValue(worksheet, r, taskColumnIndex);
    if (!taskName.trim()) continue; // skip blank rows

    const rowItem: ExcelRowItem = {
      __groupName: "Imported Tasks",
      __groupColor: "#579BFC",
      [taskColumnName]: taskName,
    };

    for (const col of columns) {
      if (col.index === taskColumnIndex) continue;
      const val = getCellValue(worksheet, r, col.index);
      const fill = getCellFillColor(worksheet, r, col.index);
      if (val) {
        rowItem[col.name] = fill ? { label: val, color: fill } : val;
      } else {
        rowItem[col.name] = null;
      }
    }

    rows.push(rowItem);
  }

  // Deduplicate columns
  const uniqueColumns = columns.filter(
    (col, idx, arr) =>
      arr.findIndex(
        (c) => c.name.toLowerCase() === col.name.toLowerCase(),
      ) === idx,
  );

  return {
    boardName: file.name.replace(/\.(xlsx|xls)$/i, "").trim(),
    groups: [],
    columns: uniqueColumns,
    rows,
    taskColumn: taskColumnName,
  };
}
