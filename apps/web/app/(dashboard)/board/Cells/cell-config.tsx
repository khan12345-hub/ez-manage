import { ComponentType } from "react";
import { CellEditorProps } from "../EditableCells/EditableCell";
import { TextEditor } from "../EditableCells/TextEditor";
import { StatusEditor } from "./status/StatusEditor";
import { PersonEditor } from "../EditableCells/PersonEditor";
import { DateEditor } from "../EditableCells/DateEditor";
import { StatusCell } from "./status/StatusCell";
import { PersonCell } from "./PersonCell";
import { DateCell } from "./DateCell";
import { updateTask } from "@/services/tasks.api";
import { updateCell } from "@/services/cells.api";

export interface CellConfig<T = any> {
  editor: ComponentType<CellEditorProps<any>>;
  render: (value: T) => React.ReactNode;

  getValue: (task: any, cell: any, column: any) => T;

  toCellValue: (value: T, previous: any) => any;
  save: (args: { task: any; cell: any; column: any; value: T }) => Promise<any>;
}

export const CELL_CONFIG: Record<string, CellConfig> = {
  TEXT: {
    editor: TextEditor,
    render: (value) => <span className="text-red-600">{value}</span>,

    getValue: (task, cell, column) => {
      // Primary column is the task title
      if (column.isPrimary) {
        return task.name ?? "";
      }

      return cell?.value?.text ?? "";
    },

    toCellValue: (value) => ({
      text: value,
    }),
    save: ({ task, cell, column, value }) => {
      if (column.isPrimary) {
        return updateTask(task.id, {
          name: value,
        });
      }

      return updateCell(cell.id, {
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
    save: ({ cell, value }) => {
      return updateCell(cell.id, {
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
    save: ({ cell, value }) => {
      return updateCell(cell.id, {
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
    save: ({ cell, value }) => {
      return updateCell(cell.id, {
        value: {
          date: value.date,
        },
      });
    },
  },
};
