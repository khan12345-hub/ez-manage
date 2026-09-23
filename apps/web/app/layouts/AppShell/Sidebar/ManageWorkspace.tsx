"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Settings,
  Pencil,
  Trash2,
  Plus,
  LayoutGrid,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import { EditWorkspaceModal } from "@/components/EditWorkspaceModal";
import { CreateWorkspaceModal } from "@/components/CreateWorkspaceModal";
import { deleteWorkspace } from "@/services/workspace.api";

interface ManageWorkspaceDropDownProps {
  workspaceId: number;
  workspaceName?: string;
  workspaceVisibility?: "PUBLIC" | "PRIVATE";
  onBeforeOpen?: () => void;
}

export function ManageWorkspaceDropDown({
  workspaceId,
  workspaceName = "",
  workspaceVisibility = "PRIVATE",
  onBeforeOpen,
}: ManageWorkspaceDropDownProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkspace(workspaceId),
    onSuccess: () => {
      setDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Workspace deleted.");
      router.push("/dashboard");
    },
    onError: () => {
      toast.error("Failed to delete workspace.");
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="cursor-pointer outline-none rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800">
            <MoreHorizontal className="h-4.5 w-4.5" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          {/* Manage */}
          <DropdownMenuItem asChild>
            <Link
              href={`/workspace/${workspaceId}`}
              className="flex cursor-pointer items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Manage workspace
            </Link>
          </DropdownMenuItem>

          {/* Edit */}
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onSelect={(e) => {
              e.preventDefault();
              onBeforeOpen?.();
              setEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
            Edit workspace
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Delete */}
          <DropdownMenuItem
            className="cursor-pointer gap-2 text-destructive focus:text-destructive"
            onSelect={(e) => {
              e.preventDefault();
              onBeforeOpen?.();
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete workspace
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Add new workspace */}
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onSelect={(e) => {
              e.preventDefault();
              onBeforeOpen?.();
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add new workspace
          </DropdownMenuItem>

          {/* Browse all */}
          <DropdownMenuItem asChild>
            <Link
              href="/dashboard"
              className="flex cursor-pointer items-center gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              Browse all workspaces
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditWorkspaceModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        workspaceId={workspaceId}
        initialName={workspaceName}
        initialVisibility={workspaceVisibility}
      />

      <DeleteConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => deleteMutation.mutate()}
        isDeleting={deleteMutation.isPending}
        title="Delete workspace?"
        description={
          <>
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground">
              "{workspaceName}"
            </span>
            ?<br />
            <br />
            This will permanently delete the workspace and all its boards,
            tasks, and data. This action{" "}
            <span className="font-medium text-foreground">cannot be undone</span>.
          </>
        }
        confirmLabel="Delete"
        deletingLabel="Deleting..."
      />

      <CreateWorkspaceModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </>
  );
}
