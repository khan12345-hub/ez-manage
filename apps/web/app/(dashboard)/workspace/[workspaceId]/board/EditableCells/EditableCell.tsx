"use client";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useAuth } from "@/providers/AuthProvider";
import { useInviteModalStore } from "@/store/invite-modal";
import { Lock } from "lucide-react";
import {
  ComponentType,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

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

  renderValue?: (value: T) => ReactNode;
}

/**
 * Compare primitive values + objects safely.
 */
function valuesEqual(a: any, b: any) {
  if (Object.is(a, b)) {
    return true;
  }

  if (a == null || b == null) {
    return false;
  }

  if (typeof a !== "object" || typeof b !== "object") {
    return false;
  }

  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
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
  renderValue,
}: EditableCellProps<T>) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState<T>(value);

  const inputRef = useRef<any>(null);

  /**
   * When we save, we temporarily protect the local value
   * from an old server value coming from the parent.
   */
  const optimisticValueRef = useRef<T | null>(null);

  const { boardId } = useInviteModalStore();
  const { user } = useAuth();

  const canEdit =
    !column?.accessControlEnabled ||
    column?.permissions?.some(
      (permission: any) => permission.userId === user?.id,
    );

  /* ---------------------------------------------------------------------- */
  /* SERVER → LOCAL SYNCHRONIZATION                                         */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    /*
     * No optimistic update pending.
     *
     * Safe to accept server value.
     */
    if (optimisticValueRef.current === null) {
      setLocalValue(value);
      return;
    }

    /*
     * The server has now caught up with our optimistic value.
     *
     * Example:
     *
     * optimistic = "Completed"
     * server     = "Completed"
     *
     * We can remove the protection.
     */
    if (valuesEqual(value, optimisticValueRef.current)) {
      optimisticValueRef.current = null;
      setLocalValue(value);
      return;
    }

    /*
     * Server is still returning the OLD value.
     *
     * DO NOT overwrite localValue.
     */
  }, [value]);

  /* ---------------------------------------------------------------------- */
  /* FOCUS                                                                   */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!editing) return;

    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus?.();
      inputRef.current?.select?.();
    });

    return () => cancelAnimationFrame(frame);
  }, [editing]);

  /* ---------------------------------------------------------------------- */
  /* CLICK                                                                    */
  /* ---------------------------------------------------------------------- */

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!editable || !canEdit || isDragging) {
        return;
      }

      e.stopPropagation();

      if (editing) {
        return;
      }

      setEditing(true);
    },
    [editable, canEdit, isDragging, editing],
  );

  /* ---------------------------------------------------------------------- */
  /* SAVE                                                                     */
  /* ---------------------------------------------------------------------- */

  const save = useCallback(
    (nextValue: T = localValue) => {
      /*
       * FIRST:
       *
       * Store the optimistic value.
       */
      optimisticValueRef.current = nextValue;

      /*
       * SECOND:
       *
       * Immediately update UI.
       */
      setLocalValue(nextValue);

      /*
       * THIRD:
       *
       * Close editor.
       */
      setEditing(false);

      /*
       * FOURTH:
       *
       * Persist to backend.
       */
      onSave(nextValue);
    },
    [localValue, onSave],
  );

  /* ---------------------------------------------------------------------- */
  /* CANCEL                                                                   */
  /* ---------------------------------------------------------------------- */

  const cancel = useCallback(() => {
    /*
     * Cancel any optimistic protection.
     */
    optimisticValueRef.current = null;

    /*
     * Restore server value.
     */
    setLocalValue(value);

    setEditing(false);
  }, [value]);

  /* ---------------------------------------------------------------------- */
  /* EDITOR                                                                   */
  /* ---------------------------------------------------------------------- */

  if (editing) {
    return (
      <div
        className="flex h-full w-full items-center px-2 hover:bg-muted/50"
        onClick={handleClick}
      >
        <div
          className="min-w-0 flex-1 h-full"
          onClick={(e) => {
            if (editing) {
              e.stopPropagation();
            }
          }}
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
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /* CHEAP DISPLAY                                                            */
  /* ---------------------------------------------------------------------- */

  const displayValue = renderValue
    ? renderValue(localValue)
    : localValue == null
      ? null
      : String(localValue);

  /* ---------------------------------------------------------------------- */
  /* EDITABLE CELL                                                            */
  /* ---------------------------------------------------------------------- */

  if (canEdit && editable) {
    return (
      <div
        className="flex h-full min-h-7 w-full cursor-text items-center hover:bg-muted/50"
        onClick={handleClick}
      >
        <div className="min-w-0 w-full truncate">{displayValue}</div>
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /* PROTECTED CELL                                                           */
  /* ---------------------------------------------------------------------- */

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div className="flex h-full min-h-7 w-full items-center">
          <div className="min-w-0 w-full truncate">{displayValue}</div>
        </div>
      </HoverCardTrigger>

      <HoverCardContent side="top" align="center" className="w-64">
        <div className="flex items-start gap-2">
          <Lock
            strokeWidth={1}
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
          />

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
