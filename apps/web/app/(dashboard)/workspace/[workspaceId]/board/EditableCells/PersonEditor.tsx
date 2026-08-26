"use client";

import PersonPicker, {
  PersonValue,
} from "../Cells/Person/PersonPicker";

import { CellEditorProps } from "./EditableCell";

export function PersonEditor({
  editing,
  inputRef,
  value,
  setValue,
  save,
  cancel,
}: CellEditorProps<PersonValue | null>) {
  return (
    <PersonPicker
      editing={editing}
      inputRef={inputRef}
      value={value}
      setValue={setValue}
      save={save}
      cancel={cancel}
    />
  );
}