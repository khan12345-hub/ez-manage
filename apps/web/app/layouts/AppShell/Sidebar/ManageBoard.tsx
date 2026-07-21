"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateBoard, deleteBoard } from "@/services/boards.api";
import { useRouter } from "next/navigation";

interface ManageBoardDropdownProps {
  boardId: number;
  boardName: string;
  workspaceId: number;
}

export function ManageBoardDropdown({
  boardId,
  boardName,
  workspaceId,
}: ManageBoardDropdownProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(boardName);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const router = useRouter()
  const { mutate: renameMutation, isPending: isRenaming_ } = useMutation({
    mutationFn: () => updateBoard(boardId, { name: newName.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["boards", workspaceId],
      });
      setIsRenaming(false);
      setErrors([]);
      toast.success("Board renamed successfully");
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message || "Failed to rename board";
      toast.error(errorMessage);
    },
  });

  const { mutate: deleteMutation, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteBoard(boardId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["boards", workspaceId],
      });
      router.replace("/dashboard")
      setIsDeleteDialogOpen(false);
      toast.success("Board deleted successfully");
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message || "Failed to delete board";
      toast.error(errorMessage);
    },
  });

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const validateBoardName = (name: string): string[] => {
    const validationErrors: string[] = [];

    if (!name || name.trim().length === 0) {
      validationErrors.push("Board name cannot be empty");
    }

    if (name.trim().length > 100) {
      validationErrors.push("Board name must not exceed 100 characters");
    }

    if (name.trim().length < 1) {
      validationErrors.push("Board name must be at least 1 character");
    }

    return validationErrors;
  };

  const handleRenameClick = () => {
    setIsRenaming(true);
    setNewName(boardName);
    setErrors([]);
  };

  const handleSaveRename = () => {
    const validationErrors = validateBoardName(newName);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (newName.trim() === boardName) {
      setIsRenaming(false);
      return;
    }

    renameMutation();
  };

  const handleCancel = () => {
    setIsRenaming(false);
    setNewName(boardName);
    setErrors([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveRename();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    deleteMutation();
  };

  if (isRenaming) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          ref={inputRef}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRenaming_}
          className="h-6 text-xs"
          maxLength={100}
        />
        <Button
          size="sm"
          onClick={handleSaveRename}
          disabled={isRenaming_}
          className="h-6 px-2 text-xs"
        >
          {isRenaming_ ? "..." : "Save"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCancel}
          disabled={isRenaming_}
          className="h-6 px-2 text-xs"
        >
          Cancel
        </Button>
        {errors.length > 0 && (
          <div className="absolute top-full mt-1 text-xs text-destructive">
            {errors[0]}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-max">
          <DropdownMenuItem onClick={handleRenameClick}>
            Rename Board
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleDeleteClick}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete Board
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Board</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this board? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
