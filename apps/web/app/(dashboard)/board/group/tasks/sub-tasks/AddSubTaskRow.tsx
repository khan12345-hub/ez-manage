"use client";

import { KeyboardEvent, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createTask } from "@/services/tasks.api";
import { Input } from "@/components/ui/input";

interface Props {
  groupId: number;
  parentId: number;
  columns: any[];
  color: string;
}

export function AddSubtaskRow({
  groupId,
  parentId,
  columns,
  color,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  const createSubtaskMutation = useMutation({
    mutationFn: () =>
      createTask(
        name.trim(),
        groupId,
        parentId,
      ),

    onSuccess: () => {
      setName("");
      setIsEditing(false);

      queryClient.invalidateQueries({
        queryKey: ["board"],
      });
    },

    onError: () => {
      toast.error("Failed to create subtask");
    },
  });

  function openEditor() {
    setIsEditing(true);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }

  function cancel() {
    setName("");
    setIsEditing(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();

      if (!name.trim() || createSubtaskMutation.isPending) {
        return;
      }

      createSubtaskMutation.mutate();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }

  if (!isEditing) {
    return (
      <tr
        className="group/subtask-add cursor-pointer border-b bg-muted/20 hover:bg-muted/40"
        onClick={openEditor}
      >
        {/* Group color / hierarchy line */}
        <td
          className="w-1"
          style={{
            backgroundColor: color,
          }}
        />

        {/* Task controls / indentation */}
        <td className="sticky left-0 w-2">
          <div className="flex items-center gap-2 px-3">
            {/* Indentation */}
            <div className="w-7 shrink-0" />

            <div className="flex h-7 w-7 items-center justify-center rounded hover:bg-muted">
              <Plus className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </td>

        {/* Name column */}
        <td
          colSpan={columns.length}
          className="h-10"
        >
          <span className="text-sm text-muted-foreground group-hover/subtask-add:text-foreground">
            Add subitem
          </span>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b bg-muted/20">
      {/* Group color */}
      <td
        className="w-1"
        style={{
          backgroundColor: color,
        }}
      />

      {/* Controls */}
      <td className="sticky left-0 w-2">
        <div className="flex items-center gap-2 px-3">
          <div className="w-7 shrink-0" />

          <div className="flex h-7 w-7 items-center justify-center">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </td>

      {/* Input */}
      <td colSpan={columns.length} className="h-10 px-3">
        <Input
          ref={inputRef}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (!name.trim()) {
              cancel();
            }
          }}
          disabled={createSubtaskMutation.isPending}
          placeholder="Add subitem"
          className="h-8 max-w-sm bg-background"
        />
      </td>
    </tr>
  );
}