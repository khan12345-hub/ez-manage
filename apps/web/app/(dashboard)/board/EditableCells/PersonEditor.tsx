import PersonPicker, { PersonValue } from "../Cells/Person/PersonPicker";
import { CellEditorProps } from "./EditableCell";


export function PersonEditor({
  value,
  setValue,
  save,
}: CellEditorProps<PersonValue>) {
  return (
    <PersonPicker
      value={value}
      onChange={(user:any) => {
        setValue(user);
        save(user);
      }}
    />
  );
}