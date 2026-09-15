"use client";

import { ArrowRight, FolderKanban, Plus, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateWorkspaceModal } from "@/components/CreateWorkspaceModal";

import {
  AdminWorkspace,
  deleteAdminWorkspace,
  getAllWorkspaces,
  updateAdminWorkspace,
} from "@/services/admin.api";
import { DeleteDialog } from "./DeleteDialog";
import { RowActions } from "./RowActions";

function AdminEditForm({
  initialName,
  isPending,
  onCancel,
  onSubmit,
}: {
  initialName: string;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-sm font-medium">Name</label>
        <input
          className="mt-1.5 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
        />
      </div>
      <div className="flex justify-end gap-2 border-t pt-4 dark:border-zinc-800">
        <button
          onClick={onCancel}
          className="rounded-md border px-4 py-2 text-xs font-semibold hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          onClick={() => onSubmit(name.trim())}
          disabled={isPending || !name.trim()}
          className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

export function WorkspacesTab() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] =
    useState<AdminWorkspace | null>(null);
  const [editingWorkspace, setEditingWorkspace] =
    useState<AdminWorkspace | null>(null);

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ["admin", "workspaces"],
    queryFn: getAllWorkspaces,
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAdminWorkspace(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      setSelectedWorkspace(null);
      toast.success("Workspace deleted");
    },
    onError: () => {
      toast.error("Failed to delete workspace");
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      updateAdminWorkspace(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "workspaces"] });
      setEditingWorkspace(null);
      toast.success("Workspace updated");
    },
    onError: () => toast.error("Failed to update workspace"),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Workspaces</h2>
          <p className="text-sm text-muted-foreground">
            Manage all workspaces across EzManage.
          </p>
        </div>

        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Workspace
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-5 space-y-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="grid grid-cols-3 gap-3">
                    <Skeleton className="h-14" />
                    <Skeleton className="h-14" />
                    <Skeleton className="h-14" />
                  </div>
                  <Skeleton className="h-9 w-full" />
                </CardContent>
              </Card>
            ))
          : workspaces.map((workspace) => (
              <Card
                key={workspace.id}
                className="transition-colors hover:border-primary/40"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FolderKanban className="h-5 w-5" />
                    </div>

                    <RowActions
                      onEdit={() => setEditingWorkspace(workspace)}
                      onDelete={() => setSelectedWorkspace(workspace)}
                    />
                  </div>

                  <h3 className="mt-4 font-semibold">{workspace.name}</h3>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <Info label="Members" value={workspace.members} />
                    <Info label="Boards" value={workspace.boards} />
                    <Info label="Tasks" value={workspace.tasks} />
                  </div>

                  <Button
                    variant="ghost"
                    className="mt-4 w-full justify-between"
                    onClick={() => router.push(`/workspace/${workspace.id}`)}
                  >
                    View workspace
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
      </div>

      <DeleteDialog
        open={!!selectedWorkspace}
        onOpenChange={(open) => !open && setSelectedWorkspace(null)}
        title="Delete workspace?"
        description={`Deleting "${selectedWorkspace?.name}" will also remove its boards, groups and tasks. This cannot be undone.`}
        onConfirm={() =>
          selectedWorkspace && deleteMutation.mutate(selectedWorkspace.id)
        }
        loading={deleteMutation.isPending}
      />

      {/* Admin edit workspace dialog */}
      {editingWorkspace &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="relative w-full max-w-sm rounded-xl border bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 rounded-t-xl" />
              <button
                onClick={() => setEditingWorkspace(null)}
                className="absolute top-4 right-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
              <h2 className="mb-4 text-lg font-bold">Edit Workspace</h2>
              <AdminEditForm
                initialName={editingWorkspace.name}
                isPending={editMutation.isPending}
                onCancel={() => setEditingWorkspace(null)}
                onSubmit={(name) =>
                  editMutation.mutate({ id: editingWorkspace.id, data: { name } })
                }
              />
            </div>
          </div>,
          document.body,
        )}

      <CreateWorkspaceModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["admin", "workspaces"] });
          queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
        }}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}
