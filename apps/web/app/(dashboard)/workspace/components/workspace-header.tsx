"use client";
import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, PenIcon, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { WorkspaceAvatar } from "./workspace-avatar";
import { WorkspaceActions } from "./workspace-actions";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateWorkspace, deleteWorkspace } from "@/services/workspace.api";
import { AssetVisibility, UserRole } from "@repo/shared";
import { useAuth } from "@/providers/AuthProvider";
import { InviteModal } from "@/components/InviteModal";
import { useInviteModalStore } from "@/store/invite-modal";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
// interface Workspace {
//   id: number;
//   name: string;
//   description: string;
//   avatar: string;
//   // members: number;
//   visibility?: AssetVisibility;
//   role?: UserRole;
//   members:Members
// }

export interface WorkspaceResponse {
  id: number;
  name: string;
  description: string | null;
  visibility: AssetVisibility;

  createdById: number;

  members: number;

  // boards: WorkspaceBoard[];

  // _count: {
  //   boards: number;
  //   members: number;
  // };
  _count: any;
}

export interface WorkspaceMember {
  id: number;
  workspaceId: number;
  userId: number;
  role: UserRole;
  createdAt: string;

  user: {
    id: number;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}
interface Props {
  workspace: WorkspaceResponse;
  onWorkspaceUpdate?: (updatedWorkspace: any) => void;
}

export function WorkspaceHeader({ workspace, onWorkspaceUpdate }: Props) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const workspaceId = Number(params.id);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(workspace.name);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { mutate: updateWorkspaceName, isPending } = useMutation({
    mutationFn: () => updateWorkspace(workspaceId, { name: newName.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspace", workspaceId],
      });

      setIsRenaming(false);
      toast.success("Workspace renamed successfully");
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message || "Failed to rename workspace";
      toast.error(errorMessage);
      console.error("Error updating workspace:", error);
    },
  });

  const { mutate: deleteWorkspaceHandler, isPending: isDeleting } = useMutation(
    {
      mutationFn: () => deleteWorkspace(workspaceId),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["workspaces"],
        });
        setIsDeleteDialogOpen(false);
        toast.success("Workspace deleted successfully");
        // Redirect to workspaces list after deletion
        router.push("/dashboard");
      },
      onError: (error: any) => {
        const errorMessage =
          error?.response?.data?.message || "Failed to delete workspace";
        toast.error(errorMessage);
        console.error("Error deleting workspace:", error);
      },
    },
  );

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const validateWorkspaceName = (name: string): string[] => {
    const validationErrors: string[] = [];

    if (!name || name.trim().length === 0) {
      validationErrors.push("Workspace name cannot be empty");
    }

    if (name.trim().length > 100) {
      validationErrors.push("Workspace name must not exceed 100 characters");
    }

    if (name.trim().length < 1) {
      validationErrors.push("Workspace name must be at least 1 character");
    }

    return validationErrors;
  };

  const handleRenameClick = () => {
    setIsRenaming(true);
    setNewName(workspace.name);
    setErrors([]);
  };

  const handleSaveRename = () => {
    const validationErrors = validateWorkspaceName(newName);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (newName.trim() === workspace.name) {
      setIsRenaming(false);
      return;
    }

    updateWorkspaceName();
  };

  const handleCancel = () => {
    setIsRenaming(false);
    setNewName(workspace.name);
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
    deleteWorkspaceHandler();
  };

  console.log({
    workspace,
    createdById: workspace.createdById,
    userId: user?.id,
    equal: workspace.createdById === user?.id,
  });

  const open = useInviteModalStore((state) => state.open);

  return (
    <>
      <div className="-mt-5 flex items-end justify-between">
        <div className="flex items-end gap-6">
          <WorkspaceAvatar name={workspace.name} />
          <div className=" z-10">
            {isRenaming ? (
              <div className="mb-2">
                <div className="flex items-center gap-2">
                  <Input
                    ref={inputRef}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter workspace name"
                    disabled={isPending}
                    className="text-5xl font-bold h-auto py-1"
                    maxLength={100}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveRename}
                      disabled={isPending}
                    >
                      {isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancel}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
                {errors.length > 0 && (
                  <div className="mt-2 text-sm text-destructive">
                    {errors.map((error, idx) => (
                      <div key={idx}>{error}</div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-5xl font-bold tracking-tight">
                  {workspace.name}
                </h1>
              </div>
            )}
            <p className="text-muted-foreground">{workspace.description}</p>
            <div className="mt-2 flex items-center gap-3 text-xs font-medium text-muted-foreground">
              <span>{workspace.members} members</span>
              {workspace.visibility && <span>{workspace.visibility}</span>}
            </div>
          </div>
        </div>
        {/* <WorkspaceActions /> */}

        {workspace.createdById === user.id && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="mb-2">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-max">
                <DropdownMenuItem onClick={open}>
                  <Plus className="mr-2 h-4 w-4" />
                  Invite a member
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRenameClick}>
                  <PenIcon className="mr-2 h-4 w-4" />
                  Rename Workspace
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDeleteClick}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Workspace
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <InviteModal />
          </>
        )}
      </div>

      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
        title="Delete Workspace"
        description="Are you sure you want to delete this workspace? This action cannot be undone. All boards and members associated with this workspace will also be deleted."
      />
    </>
  );
}
