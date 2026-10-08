export type BoardColumnType =
  | "TEXT"
  | "LONG_TEXT"
  | "NUMBER"
  | "PRICE"
  | "DATE"
  | "STATUS"
  | "PERSON"
  | "CHECKBOX"
  | "DROPDOWN"
  | "LABEL"
  | "FILE"
  | "LINK"
  | "COMMENT"
  | "FILE_FEEDBACK"
  | "CREATION_LOG"
  | "EMAIL"
  | "TIME_TRACKING"
  | "SKIP";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" | "GUEST";
export type BoardRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

/** One person token found in PERSON-mapped columns that the user can choose to create. */
export interface UserToCreate {
  /** Raw token exactly as it appeared in the sheet (used as the display name). */
  rawName: string;
  firstName: string;
  lastName: string;
  email: string;
  workspaceRole: WorkspaceRole;
  boardRole: BoardRole;
  /** Whether this entry should be included in the import payload. */
  include: boolean;
}

export interface ExcelColumnMappingDto {
  sourceColumn: string;
  targetColumn: string;
  type: BoardColumnType;
}

/** One row from Sheet 2 (Monday.com "updates" sheet). */
export interface ImportedComment {
  itemId: string;
  contentType: "Update" | "Reply";
  user: string;
  createdAt: string;
  content: string;
  assetIds: string[];
  postId: string;
  parentPostId: string;
}

export interface ExcelImportData {
  boardName: string;
  visibility: "PUBLIC" | "PRIVATE";
  taskColumn: string;
  groupColumn?: string;
  columns: ExcelColumnMappingDto[];
  rows: Record<string, unknown>[];
  comments?: ImportedComment[];
  usersToCreate?: Pick<UserToCreate, "firstName" | "lastName" | "email" | "workspaceRole" | "boardRole">[];
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