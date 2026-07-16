import { BoardMember } from "@/services/boards.api";
import PersonPicker from "../Cells/person/PersonPicker";
import { CellEditorProps } from "./EditableCell";

interface PersonEditorProps extends CellEditorProps<BoardMember | null> {
  boardId: number;
}

export function PersonEditor({
  value,
  setValue,
  save,
  boardId,
}: PersonEditorProps) {
  return (
    <PersonPicker
      boardId={boardId}
      value={value}
      onChange={(user:any) => {
        setValue(user);
        save(user);
      }}
    />
  );
}