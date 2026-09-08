
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/error-message";

import { updateColumn } from "@/services/columns.api";
import { useInviteModalStore } from "@/store/invite-modal";

interface UseColumnRenameOptions {
  columnId?: number;
  columnName: string;
  onRenamed?: (name: string) => void;
}

export function useColumnRename({
  columnId,
  columnName,
  onRenamed,
}: UseColumnRenameOptions) {
  const queryClient = useQueryClient();
  const { boardId } = useInviteModalStore();

  const [name, setName] = useState(columnName);

  useEffect(() => {
    setName(columnName);
  }, [columnName]);

  const mutation = useMutation({
    mutationFn: (newName: string) => {
      if (!columnId) {
        throw new Error("Column ID is required");
      }

      return updateColumn(columnId, newName);
    },

    onSuccess: (_, newName) => {
      // toast.success("Column updated");

      // Keep FormField in sync
      onRenamed?.(newName);

      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },

    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to update column"));
      setName(columnName);
    },
  });

  const save = () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setName(columnName);
      return;
    }

    if (trimmedName === columnName) {
      return;
    }

    mutation.mutate(trimmedName);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
      return;
    }

    if (e.key === "Escape") {
      setName(columnName);
      e.currentTarget.blur();
    }
  };

  return {
    name,
    setName,
    save,
    handleKeyDown,
    isSaving: mutation.isPending,
  };
}

