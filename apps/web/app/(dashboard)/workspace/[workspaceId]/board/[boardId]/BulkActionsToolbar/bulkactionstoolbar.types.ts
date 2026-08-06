import { BoardColumnType } from "@/services/columns.api";


export interface StatusOption {
  id: number | string;
  label: string;
  color: string;
  order?: number;
}

export interface EditableColumn {
  id: number;
  name: string;
  type: BoardColumnType | string;

  // Used by StatusEditor
  statusOptions?: StatusOption[];

  // Keep any additional metadata available for the editor
  [key: string]: any;
}

export interface BulkEditorProps {
  column: EditableColumn;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}

export interface BulkActionsProps {
  isBusy?: boolean;
  isDeleting?: boolean;
  onDelete: () => void;
  onClear: () => void;
}

export interface BulkColumnSelectorProps {
  columns: EditableColumn[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export interface BulkEditToolbarProps {
  selectedCount: number;

  columns: EditableColumn[];

  onUpdate: (
    columnId: number,
    value: any,
  ) => void;

  onDelete: () => void;
  onClear: () => void;

  isUpdating?: boolean;
  isDeleting?: boolean;
}