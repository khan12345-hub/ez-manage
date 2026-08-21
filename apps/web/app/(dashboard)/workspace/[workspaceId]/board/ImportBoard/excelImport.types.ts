export type BoardColumnType =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "STATUS"
  | "PERSON"
  | "CHECKBOX"
  | "DROPDOWN"
  | "LABEL";

export interface ExcelColumnMappingDto {
  sourceColumn: string;
  targetColumn: string;
  type: BoardColumnType;
}

export interface ExcelImportData {
  boardName: string;
  visibility: "PUBLIC" | "PRIVATE";
  taskColumn: string;
  groupColumn?: string;
  columns: ExcelColumnMappingDto[];
  rows: Record<string, unknown>[];
}

export interface ExcelImportProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  onImport: (data: ExcelImportData) => void | Promise<void>;

  defaultBoardName?: string;
  defaultVisibility?: "PUBLIC" | "PRIVATE";

  disabled?: boolean;
  isImporting?: boolean;

  trigger?: React.ReactNode;

  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}