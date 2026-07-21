"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteTask } from "@/services/tasks.api";
import { toast } from "sonner";
import { useInviteModalStore } from "@/store/invite-modal";

interface Props {
  task: any;
}

export function TaskActions({ task }: Props) {
  const queryClient = useQueryClient();
  const { boardId } = useInviteModalStore();
  const deleteTaskMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id, boardId!),
    onSuccess: () => {
      toast.success("Task deleted");

      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },
    onError: () => {
      toast.error("Failed to delete task");
    },
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="
            invisible
            flex
            h-7
            w-7
            items-center
            justify-center
            rounded
            hover:bg-accent
            group-hover:visible
          "
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => deleteTaskMutation.mutate(task.id)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete task
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
