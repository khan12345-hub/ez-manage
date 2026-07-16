"use client";

import { ComponentType, useEffect, useRef, useState } from "react";

export interface CellEditorProps<T> {
  inputRef: React.RefObject<any>;
  value: T;
  setValue: React.Dispatch<React.SetStateAction<T>>;
  save: (value?: T) => void;
  cancel: () => void;
}

interface EditableCellProps {
  value: any;
  render: (value: any) => React.ReactNode;
  editor: ComponentType<CellEditorProps<any>>;
  onSave: (value: any) => void;
  editable?: boolean;
}

export function EditableCell<T>({
  value,
  render,
  editor: Editor,
  onSave,
  editable = true,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [displayValue, setDisplayValue] = useState(value);

  const inputRef = useRef<any>(null);

  useEffect(() => {
    setLocalValue((value ?? "") as T);
    setDisplayValue((value ?? "") as T);
  }, [value]);

  useEffect(() => {
    if (!editing) return;

    inputRef.current?.focus?.();
    // inputRef.current?.select?.();
  }, [editing]);

  // const save = () => {
  //   setDisplayValue(localValue);
  //   onSave(localValue);
  //   setEditing(false);
  // };

  const save = (nextValue = localValue) => {
    setDisplayValue(nextValue);
    onSave(nextValue);
    setEditing(false);
  };

  const cancel = () => {
    setLocalValue(value);
    setEditing(false);
  };

  if (editing || editable) {
    return (
      <Editor
        inputRef={inputRef}
        value={localValue}
        setValue={setLocalValue}
        save={save}
        cancel={cancel}
      />
    );
  }
  return (
    <>
      <div
        className="flex h-full w-40 text-center items-center px-2 hover:bg-muted/50"
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
      >
        {render(displayValue)}
      </div>
    </>
  );
}
