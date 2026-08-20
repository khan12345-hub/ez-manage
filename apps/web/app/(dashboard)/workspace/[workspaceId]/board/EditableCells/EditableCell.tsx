"use client";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useAuth } from "@/providers/AuthProvider";
import { useInviteModalStore } from "@/store/invite-modal";
import { Lock } from "lucide-react";
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
  disabled?: boolean;
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
  const { user } = useAuth();
  const canEdit =
    !column.accessControlEnabled ||
    column.permissions?.some(
      (permission: any) => permission.userId === user.id,
    );

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
    if (!canEdit) {
      return;
    }
    e.stopPropagation();

    if (!editable || editing) return;

    setEditing(true);
  };

  if (canEdit) {
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

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div className="z-20 flex items-center justify-center">
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
          {/* <Lock strokeWidth={0.75} className="h-7 w-7 text-muted-foreground" /> */}
        </div>
      </HoverCardTrigger>

      <HoverCardContent side="top" align="center" className="w-64">
        <div className="flex items-start gap-2">
          <Lock strokeWidth={1} className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

          <div className="space-y-1">
            <p className="text-sm font-medium">Protected column</p>

            <p className="text-xs text-muted-foreground">
              You don't have permission to edit this column.
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
