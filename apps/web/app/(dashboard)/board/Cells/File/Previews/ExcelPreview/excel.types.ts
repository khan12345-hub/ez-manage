import type React from "react";

export interface PreviewCell {
  value: React.ReactNode;
  style: React.CSSProperties;
  colSpan?: number;
  rowSpan?: number;
}

export interface PreviewRow {
  cells: PreviewCell[];
  height?: number;
}

export interface ExcelTableData {
  rows: PreviewRow[];
  columnWidths: number[];
}