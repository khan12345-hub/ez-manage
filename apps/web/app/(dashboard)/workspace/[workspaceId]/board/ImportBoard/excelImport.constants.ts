import type { BoardColumnType } from "./excelImport.types";

export const COLUMN_TYPES: {
  value: BoardColumnType;
  label: string;
}[] = [
  {
    value: "TEXT",
    label: "Text",
  },
  {
    value: "LONG_TEXT",
    label: "📝 Long Text",
  },
  {
    value: "NUMBER",
    label: "Number",
  },
  {
    value: "DATE",
    label: "Date",
  },
  {
    value: "STATUS",
    label: "Status",
  },
  {
    value: "PERSON",
    label: "Person",
  },
  {
    value: "CHECKBOX",
    label: "Checkbox",
  },
  {
    value: "DROPDOWN",
    label: "Dropdown",
  },
  {
    value: "LABEL",
    label: "Label",
  },
  {
    value: "FILE",
    label: "File",
  },
  {
    value: "LINK",
    label: "🔗 Link",
  },
  {
    value: "COMMENT",
    label: "💬 Comment",
  },
  {
    value: "SKIP",
    label: "⊘ Skip",
  },
];

export const EXCEL_ACCEPT =
  ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";