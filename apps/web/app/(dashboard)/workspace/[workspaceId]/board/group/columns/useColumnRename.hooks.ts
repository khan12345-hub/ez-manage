
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
    mutationFn: ({ newName }: { newName: string; originalName: string }) => {
      if (!columnId) {
        throw new Error("Column ID is required");
      }

      return updateColumn(columnId, newName);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },

    onError: (error: unknown, { originalName }) => {
      toast.error(getErrorMessage(error, "Failed to update column"));
      setName(originalName);
      // Revert the optimistic form-field name update using the captured original
      onRenamed?.(originalName);
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

    // Optimistically update form state so saves that happen before the
    // column-rename API responds still capture the new label.
    onRenamed?.(trimmedName);
    mutation.mutate({ newName: trimmedName, originalName: columnName });
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

