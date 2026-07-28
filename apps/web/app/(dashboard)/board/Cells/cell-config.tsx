import { ComponentType } from "react";
import { CellEditorProps } from "../EditableCells/EditableCell";
import { TextEditor } from "../EditableCells/TextEditor";
import { StatusEditor } from "./Status/StatusEditor";
import { PersonEditor } from "../EditableCells/PersonEditor";
import { DateEditor } from "../EditableCells/DateEditor";
import { StatusCell } from "./Status/StatusCell";
import { PersonCell } from "./Person/PersonCell";
import { DateCell } from "./DateCell";
import { updateTask } from "@/services/tasks.api";
import { updateCell } from "@/services/cells.api";
import { TimelineEditor } from "../EditableCells/TimelineEditor";
import { TimelineCell } from "./TimelineCell";
import { CheckboxCell } from "./CheckboxCell";
import { CheckboxEditor } from "../EditableCells/CheckboxEditor";
import { FileCell } from "./File/FileCell";
import { NumberEditor } from "../EditableCells/NumberEditor";

export interface CellConfig<T = any> {
  editor: ComponentType<CellEditorProps<any>>;

  render: (args: {
    value: T;
    task: any;
    cellId: any;
    column: any;
    files: any[];
  }) => React.ReactNode;

  getValue: (task: any, cell: any, column: any) => T;

  toCellValue: (value: T, previous: any) => any;

  save: (args: {
    task: any;
    cell: any;
    column: any;
    value: T;
    boardId: number | undefined;
  }) => Promise<any>;
}

export const CELL_CONFIG: Record<string, CellConfig> = {
  TEXT: {
    editor: TextEditor,

    render: (value) => (
      <span className="text-red-600">{value.value}</span>
    ),

    getValue: (task, cell, column) => {
      if (column.isPrimary) {
        return task.name ?? "";
      }

      return cell?.value?.text ?? "";
    },

    toCellValue: (value) => ({
      text: value,
    }),

    save: ({ task, cell, column, value, boardId }) => {
      if (column.isPrimary) {
        return updateTask(boardId!, task.id, {
          name: value,
        });
      }

      if (!cell?.id) {
        return Promise.resolve(null);
      }
      console.log({boardId})
      return updateCell(boardId, cell.id, {
        value: {
          text: value,
        },
      });
    },
  },

  NUMBER: {
    editor: NumberEditor,

    render: (value) => (
      <span className="text-red-600">{value.value}</span>
    ),

    getValue: (cell) => {
      return cell?.value?.text ?? "";
    },

    toCellValue: (value) => ({
      text: value,
    }),

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
    editor: PersonEditor,

    render: (value) => <PersonCell cell={value} />,

    getValue: (_, cell) => cell?.value,

    toCellValue: (value) => value,

    save: ({ cell, value, boardId }) => {
      if (!cell?.id) {
        return Promise.resolve(null);
      }

      return updateCell(boardId, cell.id, {
        value: {
          users: [...value.users],
        },
      });
    },
  },

  STATUS: {
    editor: StatusEditor,

    render: (value) => <StatusCell cell={value} />,

    getValue: (_, cell) => cell?.value,

    toCellValue: (value) => value,

    save: ({ cell, value, boardId }) => {
      if (!cell?.id) {
        return Promise.resolve(null);
      }

      return updateCell(boardId, cell.id, {
        value: {
          label: value.label,
          color: value.color,
        },
      });
    },
  },

  DATE: {
    editor: DateEditor,

    render: (value) => <DateCell cell={value} />,

    getValue: (_, cell) => cell?.value,

    toCellValue: (value) => value,

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
    editor: TimelineEditor,

    render: (value) => <TimelineCell cell={value} />,

    getValue: (_, cell) => cell?.value,

    toCellValue: (value) => value,

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
    editor: CheckboxEditor,

    render: (value) => (
      <CheckboxCell checked={value.value} />
    ),

    getValue: (_, cell) => cell?.value?.checked ?? false,

    toCellValue: (value) => ({
      checked: value,
    }),

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
    editor: FileCell as any,

    render: (value) => <FileCell value={value} />,

    getValue: (_, cell) => ({
      cellId: cell?.id,
      files: cell?.files ?? [],
    }),

    toCellValue: () => null,

    save: async () => {
      return null;
    },
  },
};