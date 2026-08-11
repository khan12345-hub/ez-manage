"use client";

import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useInviteModalStore } from "@/store/invite-modal";
import { createTask } from "@/services/tasks.api";

interface Props {
  columns: any[];
  color: string;
  groupId: number;
  parentId?: number;
  focusToken?: number;
}

export function NewTaskRow({
  columns,
  color,
  groupId,
  parentId,
  focusToken = 0,
}: Props) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { boardId } = useInviteModalStore();
  const queryClient = useQueryClient();

  const isSubtask = !!parentId;

  useEffect(() => {
    if (!focusToken || !inputRef.current) return;

    inputRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    inputRef.current.focus();
  }, [focusToken]);

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      createTask(
        {
          name,
          groupId,
          parentId: parentId ?? null,
        },
        boardId,
      ),

    onSuccess: () => {
      setName("");

      toast.success(parentId ? "Subtask created" : "Task created");

      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },

    onError: () => {
      toast.error(
        parentId ? "Failed to create subtask" : "Failed to create task",
      );
    },
  });

  const submit = () => {
    const value = name.trim();

    if (!value || createMutation.isPending) {
      return;
    }

    createMutation.mutate(value);
  };

  return (
    <tr className="group hover:bg-muted/30">
      {/* Group color indicator */}
      <td
        className="sticky left-0 min-w-1 border opacity-50"
        style={{ backgroundColor: color }}
      />

      {/* Checkbox */}
      <th className="sticky left-2 h-12 flex justify-end items-center px-5 bg-white min-w-[150px]">
        <Checkbox />
      </th>

      {/* Task / Subtask name */}
      <td className="sticky left-[150px] z-20 bg-white border px-2 py-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Plus className="h-4 w-4" />

          <Input
            ref={inputRef}
            value={name}
            placeholder={isSubtask ? "Add subtask" : "Add task"}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            onBlur={submit}
            disabled={createMutation.isPending}
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
      </td>

      {/* Other columns */}
      {columns.slice(1).map((column: any) => (
        <td key={column.id} className="border" />
      ))}

      <td className="w-14 border" />
    </tr>
  );
}
