import { ComponentType, ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";

import { CellEditorProps } from "../EditableCells/EditableCell";

import { TextEditor } from "../EditableCells/TextEditor";
import { LongTextEditor } from "../EditableCells/LongTextEditor";
import { LinkEditor } from "../EditableCells/LinkEditor";
import { NumberEditor } from "../EditableCells/NumberEditor";
import { PersonEditor } from "../EditableCells/PersonEditor";
import { DateEditor } from "../EditableCells/DateEditor";
import { TimelineEditor } from "../EditableCells/TimelineEditor";
import { CheckboxEditor } from "../EditableCells/CheckboxEditor";
import { StatusEditor } from "./Status/StatusEditor";
import { FileCell } from "./File/FileCell";
import { LabelEditor } from "../EditableCells/LabelEditor";
import { DateCell } from "./DateCell";

import { updateTask } from "@/services/tasks.api";
import { updateCell, createCell } from "@/services/cells.api";
import PersonPicker from "./Person/PersonPicker";
import { PersonCell } from "./Person/PersonCell";
import { StatusCell } from "./Status/StatusCell";
import { CreationLogCell } from "./CreationLog/CreationLogCell";
import { TimeTrackingCell } from "./TimeTracking/TimeTrackingCell";
import { EmailEditor } from "../EditableCells/EmailEditor";
import { FormulaCell } from "./Formula/FormulaCell";

// Creates the cell if it doesn't exist yet (column added after tasks were created),
// then patches the value. Prevents silent save failures when cell.id is null.
async function ensureAndUpdate(
  boardId: number,
  task: any,
  column: any,
  cell: any,
  value: any,
): Promise<any> {
  const cellId = cell?.id ?? (await createCell(boardId, task.id, column.id)).id;
  return updateCell(boardId, cellId, value);
}

export interface CellConfig<T = any> {
  /**
   * Component used ONLY when the cell is being edited.
   */
  component: ComponentType<CellEditorProps<T>>;

  /**
   * Gets the actual value from the task/cell.
   */
  getValue: (task: any, cell: any, column: any) => T;

  /**
   * Cheap renderer used when the cell is NOT being edited.
   *
   * This is important for large boards because we don't
   * mount the expensive editor component for every cell.
   */
  renderValue?: (value: T) => ReactNode;

  /**
   * Persists the value to the backend.
   */
  save: (args: {
    task: any;
    cell: any;
    column: any;
    value: T;
    boardId?: number;
    queryClient?: QueryClient;
  }) => Promise<any>;
}

export const CELL_CONFIG: Record<string, CellConfig> = {
  TEXT: {
    component: TextEditor,

    getValue: (task, cell, column) => {
      return column.isPrimary ? (task.name ?? "") : (cell?.value?.text ?? "");
    },

    save: async ({ task, cell, column, value, boardId }) => {
      if (column.isPrimary) {
        return updateTask(boardId!, task.id, { name: value });
      }
      return ensureAndUpdate(boardId!, task, column, cell, { value: { text: value } });
    },
  },

  LONG_TEXT: {
    component: LongTextEditor,

    getValue: (_, cell) => cell?.value?.text ?? "",

    save: ({ task, cell, column, value, boardId }) =>
      ensureAndUpdate(boardId!, task, column, cell, { value: { text: value } }),
  },

  LINK: {
    component: LinkEditor,

    getValue: (_, cell) => cell?.value?.url ?? "",

    renderValue: (value: string) => {
      if (!value) return null;
      const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex min-w-0 items-center gap-1 truncate text-[13px] text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          title={value}
        >
          {value}
        </a>
      );
    },

    save: ({ task, cell, column, value, boardId }) =>
      ensureAndUpdate(boardId!, task, column, cell, { value: { url: value } }),
  },

  NUMBER: {
    component: NumberEditor,

    getValue: (_, cell) => cell?.value?.text ?? "",

    save: ({ task, cell, column, value, boardId }) =>
      ensureAndUpdate(boardId!, task, column, cell, { value: { text: value } }),
  },

  PRICE: {
    component: NumberEditor,

    getValue: (_, cell) => cell?.value?.text ?? "",

    renderValue: (value: string) => {
      if (!value && value !== "0") return null;
      const num = parseFloat(value);
      if (isNaN(num)) return value;
      return (
        <span className="font-mono tabular-nums">
          ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      );
    },

    save: ({ task, cell, column, value, boardId }) =>
      ensureAndUpdate(boardId!, task, column, cell, { value: { text: String(value ?? "") } }),
  },

  PERSON: {
    component: PersonEditor,

    getValue: (_, cell) => cell?.value ?? null,

    renderValue: (value) => <PersonCell cell={value} />,

    save: ({ task, cell, column, value, boardId }) =>
      ensureAndUpdate(boardId!, task, column, cell, { value: { users: value?.users ?? [] } }),
  },

  STATUS: {
    component: StatusEditor,

    getValue: (_, cell) => cell?.value ?? null,

    save: async ({ task, cell, column, value, boardId, queryClient }) => {
      const result = await ensureAndUpdate(boardId!, task, column, cell, {
        value: { label: value.label, color: value.color },
      });

      // Automation may have moved the task to a different group.
      // Refetch the board so the UI reflects the new position.
      if (boardId) {
        queryClient?.invalidateQueries({ queryKey: ["board", boardId] });
      }

      return result;
    },
  },

  DATE: {
    component: DateEditor,

    getValue: (_, cell) => cell?.value,

    renderValue: (value) => <DateCell cell={value} />,

    save: ({ task, cell, column, value, boardId }) =>
      ensureAndUpdate(boardId!, task, column, cell, { value: { date: value.date } }),
  },

  // Plain date — identical to DATE but never shows overdue red styling.
  // Use for informational dates like "Expense Date", "Invoice Date", etc.
  PLAIN_DATE: {
    component: DateEditor,

    getValue: (_, cell) => cell?.value,

    renderValue: (value) => <DateCell cell={value} plain />,

    save: ({ task, cell, column, value, boardId }) =>
      ensureAndUpdate(boardId!, task, column, cell, { value: { date: value.date } }),
  },

  TIMELINE: {
    component: TimelineEditor,

    getValue: (_, cell) => cell?.value,

    save: ({ task, cell, column, value, boardId }) =>
      ensureAndUpdate(boardId!, task, column, cell, {
        value: { startDate: new Date(value.startDate), endDate: new Date(value.endDate) },
      }),
  },

  CHECKBOX: {
    component: CheckboxEditor,

    getValue: (_, cell) => cell?.value?.checked ?? false,

    save: ({ task, cell, column, value, boardId }) =>
      ensureAndUpdate(boardId!, task, column, cell, { value: { checked: value } }),
  },

  FILE: {
    component: FileCell as any,

    getValue: (task, cell, column) => ({
      cellId: cell?.id as number | undefined,
      taskId: task?.id as number | undefined,
      columnId: column?.id as number | undefined,
      files: (cell?.files ?? []).map((f: any) => f?.file ?? f),
    }),

    save: async () => Promise.resolve(null),
  },

  CREATION_LOG: {
    component: CreationLogCell as any,

    getValue: (task) => ({
      user: task?.createdBy ?? null,
      date: task?.createdAt ?? null,
    }),

    save: async () => Promise.resolve(null),
  },

  TIME_TRACKING: {
    component: TimeTrackingCell as any,

    // taskId is all the component needs; it fetches entries itself via React Query
    getValue: (task) => task?.id ?? null,

    save: async () => Promise.resolve(null),
  },

  DROPDOWN: {
    component: TextEditor,
    getValue: (_, cell) => cell?.value?.text ?? "",
    save: ({ task, cell, column, value, boardId }) =>
      ensureAndUpdate(boardId!, task, column, cell, { value: { text: value } }),
  },

  LABEL: {
    component: LabelEditor,
    getValue: (_, cell) => cell?.value ?? { text: "", color: "" },
    save: ({ task, cell, column, value, boardId }) =>
      ensureAndUpdate(boardId!, task, column, cell, { value: { text: value?.text ?? "", color: value?.color ?? "" } }),
  },

  EMAIL: {
    component: EmailEditor,

    getValue: (_, cell) => cell?.value ?? { email: "", label: "" },

    renderValue: (value) => {
      const email = value?.email ?? "";
      const display = value?.label || email;
      if (!email) return null;
      return (
        <a
          href={`mailto:${email}`}
          onClick={(e) => e.stopPropagation()}
          title={email}
          className="flex min-w-0 items-center gap-1.5 truncate rounded-full bg-blue-50 px-2 py-0.5 text-[12px] font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
        >
          {display}
        </a>
      );
    },

    save: ({ task, cell, column, value, boardId }) =>
      ensureAndUpdate(boardId!, task, column, cell, { value }),
  },

  FORMULA: {
    component: FormulaCell as any,

    getValue: (task, _cell, column) => ({
      formula: column?.formula ?? "",
      cells: task?.cells ?? [],
    }),

    renderValue: (value) => <FormulaCell value={value} />,

    save: async () => Promise.resolve(null),
  },
};