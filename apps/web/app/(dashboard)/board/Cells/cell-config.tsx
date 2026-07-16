import { ComponentType } from "react";
import { CellEditorProps } from "../EditableCells/EditableCell";
import { TextEditor } from "../EditableCells/TextEditor";
import { StatusEditor } from "./status/StatusEditor";
import { PersonEditor } from "../EditableCells/PersonEditor";
import { DateEditor } from "../EditableCells/DateEditor";
import { StatusCell } from "./status/StatusCell";
import { PersonCell } from "./PersonCell";
import { DateCell } from "./DateCell";

export interface CellConfig<T = any> {
  editor: ComponentType<CellEditorProps<any>>;
  render: (value: T) => React.ReactNode;

  getValue: (task: any, cell: any, column: any) => T;

  toCellValue: (value: T, previous: any) => any;
}

export const CELL_CONFIG: Record<string, CellConfig> = {
  TEXT: {
    editor: TextEditor,
    render: (value) => <span>{value}</span>,

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
  },

  PERSON: {
    editor: PersonEditor,
    render: (value) => <PersonCell cell={value} />,
    getValue: (_, cell) => cell?.value,
    toCellValue: (value) => value,
  },

  STATUS: {
    editor: StatusEditor,
    render: (value) => <StatusCell cell={value} />,
    getValue: (_, cell) => cell?.value,
    toCellValue: (value) => value,
  },

  DATE: {
    editor: DateEditor,
    render: (value) => <DateCell cell={value} />,
    getValue: (_, cell) => cell?.value,
    toCellValue: (value) => value,
  },
};