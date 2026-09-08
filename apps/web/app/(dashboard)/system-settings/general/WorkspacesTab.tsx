"use client";

import { ArrowRight, FolderKanban, Plus } from "lucide-react";
import { useState } from "react";
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
} from "@/services/admin.api";
import { DeleteDialog } from "./DeleteDialog";
import { RowActions } from "./RowActions";

export function WorkspacesTab() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] =
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
                      onEdit={() => {}}
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

      <CreateWorkspaceModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
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
