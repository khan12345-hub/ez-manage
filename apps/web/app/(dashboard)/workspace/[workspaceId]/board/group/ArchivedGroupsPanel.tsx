"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Archive, ChevronDown, ChevronRight, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getArchivedGroups, unarchiveGroup, deleteGroup } from "@/services/groups.api";
import { useInviteModalStore } from "@/store/invite-modal";
import { usePermissions } from "@/services/permissions/permissions.hooks";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  boardId: number;
}

export function ArchivedGroupsPanel({ boardId }: Props) {
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const queryClient = useQueryClient();

  const { boardRole } = useInviteModalStore();
  const { isSuperAdmin } = usePermissions();
  const canSeeArchived = isSuperAdmin || boardRole === "OWNER" || boardRole === "ADMIN";

  if (!canSeeArchived) return null;

  const { data: archivedGroups = [], isLoading } = useQuery({
    queryKey: ["archived-groups", boardId],
    queryFn: () => getArchivedGroups(boardId),
    enabled: open,
  });

  const unarchiveMutation = useMutation({
    mutationFn: (groupId: number) => unarchiveGroup(boardId, groupId),
    onSuccess: () => {
      toast.success("Group restored to board.");
      queryClient.invalidateQueries({ queryKey: ["archived-groups", boardId] });
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
    onError: () => toast.error("Failed to restore group."),
  });

  const deleteMutation = useMutation({
    mutationFn: (groupId: number) => deleteGroup(groupId, boardId),
    onSuccess: () => {
      toast.success("Group permanently deleted.");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["archived-groups", boardId] });
    },
    onError: () => toast.error("Failed to delete group."),
  });

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Archive className="h-4 w-4" />
        Archived Groups
      </button>

      {open && (
        <div className="mt-2 rounded-md border bg-muted/30">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading archived groups…
            </div>
          ) : archivedGroups.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No archived groups.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Group</th>
                  <th className="px-4 py-2 text-left font-medium">Tasks</th>
                  <th className="px-4 py-2 text-left font-medium">Archived</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivedGroups.map((group) => (
                  <tr key={group.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: group.color ?? "#94a3b8" }}
                        />
                        <span className="font-medium">{group.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {group._count.tasks} task{group._count.tasks !== 1 ? "s" : ""}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(group.updatedAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          disabled={unarchiveMutation.isPending}
                          onClick={() => unarchiveMutation.mutate(group.id)}
                        >
                          {unarchiveMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteTarget({ id: group.id, name: group.name })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete group?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> and all its tasks will be permanently deleted.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
