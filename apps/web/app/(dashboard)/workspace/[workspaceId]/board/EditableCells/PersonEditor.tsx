"use client";

import PersonPicker, {
  PersonValue,
} from "../Cells/Person/PersonPicker";

import { CellEditorProps } from "./EditableCell";

export function PersonEditor({
  editing,
  value,
  setValue,
  save,
}: CellEditorProps<PersonValue>) {
  return (
    <PersonPicker
      editing={editing}
      value={value}
      onChange={(user:any) => {
        setValue(user);
        save(user);
      }}
    />
  );
}