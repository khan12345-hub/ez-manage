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

import { updateTask } from "@/services/tasks.api";
import { updateCell } from "@/services/cells.api";
import { toast } from "sonner";
import PersonPicker from "./Person/PersonPicker";
import { PersonCell } from "./Person/PersonCell";
import { StatusCell } from "./Status/StatusCell";
import { CreationLogCell } from "./CreationLog/CreationLogCell";

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

  LONG_TEXT: {
    component: LongTextEditor,

    getValue: (_, cell) => cell?.value?.text ?? "",

    save: ({ cell, value, boardId }) => {
      if (!cell?.id) return Promise.resolve(null);
      return updateCell(boardId!, cell.id, { value: { text: value } });
    },
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

    save: ({ cell, value, boardId }) => {
      if (!cell?.id) return Promise.resolve(null);
      return updateCell(boardId!, cell.id, { value: { url: value } });
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

    save: ({ cell, value, boardId, queryClient }) => {
      if (!cell?.id) {
        return Promise.resolve(null);
      }

      return updateCell(boardId!, cell.id, {
        value: {
          label: value.label,
          color: value.color,
        },
      })
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
};