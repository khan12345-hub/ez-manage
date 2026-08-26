import { ComponentType, ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";

import { CellEditorProps } from "../EditableCells/EditableCell";

import { TextEditor } from "../EditableCells/TextEditor";
import { NumberEditor } from "../EditableCells/NumberEditor";
import { PersonEditor } from "../EditableCells/PersonEditor";
import { DateEditor } from "../EditableCells/DateEditor";
import { TimelineEditor } from "../EditableCells/TimelineEditor";
import { CheckboxEditor } from "../EditableCells/CheckboxEditor";
import { StatusEditor } from "./Status/StatusEditor";
import { FileCell } from "./File/FileCell";

import { updateTask } from "@/services/tasks.api";
import { updateCell } from "@/services/cells.api";
import { toast } from "sonner";
import PersonPicker from "./Person/PersonPicker";
import { PersonCell } from "./Person/PersonCell";

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
      const value = column.isPrimary
        ? (task.name ?? "")
        : (cell?.value?.text ?? "");

      console.log("[TEXT getValue]", {
        taskId: task?.id,
        cellId: cell?.id,
        columnId: column?.id,
        isPrimary: column?.isPrimary,
        value,
      });

      return value;
    },

    save: async ({ task, cell, column, value, boardId }) => {
      console.log("[TEXT save CALLED]", {
        taskId: task?.id,
        cellId: cell?.id,
        columnId: column?.id,
        isPrimary: column?.isPrimary,
        value,
        boardId,
      });

      if (column.isPrimary) {
        console.log("[TEXT] calling updateTask");

        return updateTask(boardId!, task.id, {
          name: value,
        });
      }

      if (!cell?.id) {
        console.log("[TEXT] NO CELL ID");
        return null;
      }

      console.log("[TEXT] calling updateCell");

      return updateCell(boardId!, cell.id, {
        value: {
          text: value,
        },
      });
    },
  },

  NUMBER: {
    component: NumberEditor,

    getValue: (_, cell) => cell?.value?.text ?? "",

    save: ({ cell, value, boardId }) => {
      if (!cell?.id) {
        return Promise.resolve(null);
      }

      return updateCell(boardId, cell.id, {
        value: {
          text: value,
        },
      });
    },
  },

  PERSON: {
    component: PersonEditor,

    getValue: (_, cell) => cell?.value ?? null,

    renderValue: (value) => <PersonCell cell={value} />,

    save: ({ cell, value, boardId }) => {
      if (!cell?.id) {
        return Promise.resolve(null);
      }

      return updateCell(boardId!, cell.id, {
        value: {
          users: value?.users ?? [],
        },
      });
    },
  },

  STATUS: {
    component: StatusEditor,

    getValue: (_, cell) => cell?.value ?? null,

    renderValue: (value) => {
      if (!value?.label) {
        return null;
      }

      return (
        <span
          className="block max-w-full truncate rounded-md px-2 py-1 text-xs font-medium"
          style={{
            backgroundColor: value.color ? `${value.color}20` : undefined,
            color: value.color || undefined,
          }}
        >
          {value.label}
        </span>
      );
    },

    save: ({ cell, value, boardId, queryClient }) => {
      if (!cell?.id) {
        return Promise.resolve(null);
      }

      return updateCell(boardId!, cell.id, {
        value: {
          label: value.label,
          color: value.color,
        },
      }).then((result) => {
        queryClient?.invalidateQueries({
          queryKey: ["board", boardId],
        });

        return result;
      });
    },
  },

  DATE: {
    component: DateEditor,

    getValue: (_, cell) => cell?.value,

    save: ({ cell, value, boardId }) => {
      if (!cell?.id) {
        return Promise.resolve(null);
      }

      return updateCell(boardId, cell.id, {
        value: {
          date: value.date,
        },
      });
    },
  },

  TIMELINE: {
    component: TimelineEditor,

    getValue: (_, cell) => cell?.value,

    save: ({ cell, value, boardId }) => {
      if (!cell?.id) {
        return Promise.resolve(null);
      }

      return updateCell(boardId, cell.id, {
        value: {
          startDate: new Date(value.startDate),
          endDate: new Date(value.endDate),
        },
      });
    },
  },

  CHECKBOX: {
    component: CheckboxEditor,

    getValue: (_, cell) => cell?.value?.checked ?? false,

    save: ({ cell, value, boardId }) => {
      if (!cell?.id) {
        return Promise.resolve(null);
      }

      return updateCell(boardId, cell.id, {
        value: {
          checked: value,
        },
      });
    },
  },

  FILE: {
    component: FileCell as any,

    getValue: (_, cell) => ({
      cellId: cell?.id,
      files: cell?.files ?? [],
    }),

    save: async () => Promise.resolve(null),
  },
};
