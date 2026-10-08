import type { BoardColumnType } from "./excelImport.types";

export const COLUMN_TYPES: {
  value: BoardColumnType;
  label: string;
  description: string;
}[] = [
  { value: "TEXT",          label: "Text",              description: "Short plain text — names, titles, labels" },
  { value: "LONG_TEXT",     label: "📝 Long Text",       description: "Multi-line notes, descriptions, remarks" },
  { value: "NUMBER",        label: "Number",             description: "Numeric values — counts, quantities, scores" },
  { value: "PRICE",         label: "💲 Price",            description: "Currency / money — shows $X.XX with sum in footer" },
  { value: "DATE",          label: "Date",               description: "Calendar dates — due dates, deadlines, schedules" },
  { value: "STATUS",        label: "Status",             description: "Workflow state with color — e.g. Done, In Progress" },
  { value: "PERSON",        label: "Person",             description: "Team member assignment — creates user if needed" },
  { value: "CHECKBOX",      label: "Checkbox",           description: "Yes/No, Done/Not done boolean values" },
  { value: "DROPDOWN",      label: "Dropdown",           description: "Single-select option from a fixed list" },
  { value: "LABEL",         label: "Label",              description: "Tags or category labels on a task" },
  { value: "FILE",          label: "File",               description: "Attachments — files are downloaded and stored" },
  { value: "EMAIL",         label: "✉️ Email",            description: "Email addresses — renders as a clickable mailto link" },
  { value: "TIME_TRACKING", label: "⏱️ Time Tracking",   description: "Logged duration — creates real time entry records" },
  { value: "LINK",          label: "🔗 Link",             description: "URLs — renders as a clickable hyperlink" },
  { value: "COMMENT",       label: "💬 Comment",          description: "Column text imported as task comments (not board cells)" },
  { value: "FILE_FEEDBACK", label: "🖼️ File Feedback",   description: "Notes attached directly to a file, not the task" },
  { value: "CREATION_LOG",  label: "📋 Creation Log",    description: "Created-by user + date — sets task creator info" },
  { value: "SKIP",          label: "⊘ Skip",             description: "Ignore this column — it won't be imported" },
];

export const EXCEL_ACCEPT =
  ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";