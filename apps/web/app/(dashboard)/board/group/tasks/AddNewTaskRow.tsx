"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";

import { useInviteModalStore } from "@/store/invite-modal";
import { createTask } from "@/services/tasks.api";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  columns: any[];
  color: string;
  groupId: number;
}

export function NewTaskRow({ columns, color, groupId }: Props) {
  const [name, setName] = useState("");

  const { boardId } = useInviteModalStore();
  const queryClient = useQueryClient();

  const createTaskMutation = useMutation({
    mutationFn: (name: string) => createTask(name, groupId),
    onSuccess: () => {
      setName("");

      toast.success("Task created");

      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },
    onError: () => {
      toast.error("Failed to create task");
    },
  });

  const submit = () => {
    const value = name.trim();

    if (!value || createTaskMutation.isPending) return;

    createTaskMutation.mutate(name);
  };

  return (
    <tr className="group hover:bg-muted/30">
      <td
        className="w-1 sticky left-0 border opacity-50"
        style={{ backgroundColor: color }}
      />
      <th>
        <Checkbox />
      </th>
      <td className="sticky left-0 border px-2 py-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Plus className="h-4 w-4" />
          <Input
            value={name}
            placeholder="Add task"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            onBlur={submit}
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
      </td>

      {columns.slice(1).map((column: any) => (
        <td key={column.id} className="border" />
      ))}

      <td className="w-14 border" />
    </tr>
  );
}
