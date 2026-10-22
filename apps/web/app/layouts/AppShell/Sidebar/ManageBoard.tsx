"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, FolderPen, MoreHorizontal, Trash2 } from "lucide-react";
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
import { updateBoard, deleteBoard, getBoardDetail } from "@/services/boards.api";
import { useRouter } from "next/navigation";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";

interface ManageBoardDropdownProps {
  boardId: number;
  boardName: string;
  workspaceId: number;
  onBeforeOpen?: () => void;
}

export function ManageBoardDropdown({
  boardId,
  boardName,
  workspaceId,
  onBeforeOpen,
}: ManageBoardDropdownProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(boardName);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const budgetInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: boardDetail } = useQuery({
    queryKey: ["board", boardId, "", ""],
    queryFn: () => getBoardDetail(boardId),
    enabled: isBudgetDialogOpen,
  });

  const { mutate: budgetMutation, isPending: isBudgetSaving } = useMutation({
    mutationFn: (hours: number | null) => updateBoard(boardId, { budgetHours: hours }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      queryClient.invalidateQueries({ queryKey: ["board-time-summary", boardId] });
      setIsBudgetDialogOpen(false);
      toast.success("Budget updated");
    },
    onError: () => toast.error("Failed to update budget"),
  });
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
    onBeforeOpen?.();
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    deleteMutation();
  };

  if (isRenaming) {
    return (
      <div className=" flex items-center gap-1.5">
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
          <button className="cursor-pointer outline-none rounded p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-max">
          <DropdownMenuItem onClick={handleRenameClick} className="cursor-pointer">
            <FolderPen strokeWidth={1} />
            Rename Board
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setBudgetInput(String(boardDetail?.budgetHours ?? ""));
              setIsBudgetDialogOpen(true);
            }}
            className="cursor-pointer"
          >
            <Clock className="h-4 w-4" />
            Set Budget Hours
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleDeleteClick}
            className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
          >
            <Trash2 />
            Delete Board
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Budget Hours Dialog */}
      <Dialog open={isBudgetDialogOpen} onOpenChange={setIsBudgetDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Budget Hours</DialogTitle>
            <DialogDescription>
              Set a time budget for this board. You'll get notified at 80% and 100%.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              ref={budgetInputRef}
              type="number"
              min={0}
              step={0.5}
              placeholder="e.g. 40"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const h = parseFloat(budgetInput);
                  budgetMutation(isNaN(h) || budgetInput === "" ? null : h);
                }
              }}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Leave empty to remove the budget.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBudgetDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isBudgetSaving}
              onClick={() => {
                const h = parseFloat(budgetInput);
                budgetMutation(isNaN(h) || budgetInput === "" ? null : h);
              }}
            >
              {isBudgetSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
        title="Delete Board"
        description="Are you sure you want to delete this board? This action cannot be undone."
      />
    </>
  );
}
