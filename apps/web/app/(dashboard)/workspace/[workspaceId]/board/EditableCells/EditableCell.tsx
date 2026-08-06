"use client";

import { useInviteModalStore } from "@/store/invite-modal";
import { ComponentType, useEffect, useRef, useState } from "react";

export interface CellEditorProps<T> {
  editing: boolean;

  inputRef: React.RefObject<any>;

  value: T;

  setValue: React.Dispatch<React.SetStateAction<T>>;

  save: (value?: T) => void;

  cancel: () => void;

  column?: any;

  task?: any;

  cell?: any;

  boardId?: number;

  isPrimary?: boolean;

  isDragging?: boolean;
}

interface EditableCellProps<T = any> {
  value: T;

  component: ComponentType<CellEditorProps<T>>;

  onSave: (value: T) => void;

  column?: any;
  task?: any;
  cell?: any;

  editable?: boolean;
  isDragging?: boolean;
}

export function EditableCell<T>({
  value,
  component: Component,
  onSave,
  editable = true,
  column,
  task,
  cell,
  isDragging,
}: EditableCellProps<T>) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  const inputRef = useRef<any>(null);

  const { boardId } = useInviteModalStore();

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (!editing) return;

    requestAnimationFrame(() => {
      inputRef.current?.focus?.();
      inputRef.current?.select?.();
    });
  }, [editing]);

  const save = (nextValue = localValue) => {
    onSave(nextValue);
    setEditing(false);
  };

  const cancel = () => {
    setLocalValue(value);
    setEditing(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!editable || editing) return;

    setEditing(true);
  };

  return (
    <div
      className="flex h-full w-full items-center px-2 hover:bg-muted/50"
      onClick={handleClick}
    >
      <Component
        editing={editing}
        inputRef={inputRef}
        value={localValue}
        setValue={setLocalValue}
        save={save}
        cancel={cancel}
        column={column}
        task={task}
        cell={cell}
        boardId={boardId}
        isPrimary={column?.isPrimary}
        isDragging={isDragging}
      />
    </div>
  );
}