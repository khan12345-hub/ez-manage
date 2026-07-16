"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useInviteModalStore } from "@/store/invite-modal";
import { deleteColumn } from "@/services/columns.api";

interface Props {
  column: {
    id: number;
    isPrimary?: boolean;
  };
}

export function ColumnActions({ column }: Props) {
  const queryClient = useQueryClient();
  const { boardId } = useInviteModalStore();

  const deleteMutation = useMutation({
    mutationFn: () => deleteColumn(column.id),
    onSuccess: () => {
      toast.success("Column deleted");

      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },

    onError: () => {
      toast.error("Failed to delete column");
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 cursor-pointer opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          disabled={column.isPrimary || deleteMutation.isPending}
          className="text-destructive focus:text-destructive"
          onClick={() => deleteMutation.mutate()}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
