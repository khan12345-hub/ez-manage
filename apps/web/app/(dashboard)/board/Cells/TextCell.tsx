import { useState } from "react";

export default function TextCell({
  taskId,
  columnId,
  initialValue,
}: {
  taskId?: number;
  columnId?: number;
  initialValue?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);

//   const updateCell = useUpdateCell();

  const save = () => {
    setEditing(false);

    if (value === initialValue) return;

    // updateCell.mutate({
    //   taskId,
    //   columnId,
    //   value,
    // });
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();

          if (e.key === "Escape") {
            setValue(initialValue);
            setEditing(false);
          }
        }}
        className="h-full w-full bg-transparent px-2 outline-none"
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="h-full w-full cursor-text px-2 py-1"
    >
      {value || (
        <span className="text-muted-foreground">Empty</span>
      )}
    </div>
  );
}