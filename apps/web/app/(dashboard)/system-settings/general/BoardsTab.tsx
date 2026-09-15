"use client";

import { BarChart3, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import {
  AdminBoard,
  deleteAdminBoard,
  getAllBoards,
  updateAdminBoard,
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

export function BoardsTab() {
  const queryClient = useQueryClient();
  const [selectedBoard, setSelectedBoard] = useState<AdminBoard | null>(null);
  const [editingBoard, setEditingBoard] = useState<AdminBoard | null>(null);

  const { data: boards = [], isLoading } = useQuery({
    queryKey: ["admin", "boards"],
    queryFn: getAllBoards,
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAdminBoard(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "boards"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      setSelectedBoard(null);
      toast.success("Board deleted");
    },
    onError: () => {
      toast.error("Failed to delete board");
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      updateAdminBoard(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "boards"] });
      setEditingBoard(null);
      toast.success("Board updated");
    },
    onError: () => toast.error("Failed to update board"),
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Boards</h2>
        <p className="text-sm text-muted-foreground">
          Manage boards, groups and tasks.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left">
                  <th className="px-5 py-3">Board</th>
                  <th className="px-5 py-3">Workspace</th>
                  <th className="px-5 py-3">Groups</th>
                  <th className="px-5 py-3">Tasks</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-9 w-9 rounded-lg" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                        </td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-8" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-10" /></td>
                        <td className="px-5 py-4" />
                      </tr>
                    ))
                  : boards.map((board) => (
                      <tr
                        key={board.id}
                        className="border-b last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <BarChart3 className="h-4 w-4" />
                            </div>
                            <span className="font-medium">{board.name}</span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-muted-foreground">
                          {board.workspaceName}
                        </td>

                        <td className="px-5 py-4">{board.groups}</td>

                        <td className="px-5 py-4">{board.tasks.toLocaleString()}</td>

                        <td className="px-5 py-4 text-right">
                          <RowActions
                            onEdit={() => setEditingBoard(board)}
                            onDelete={() => setSelectedBoard(board)}
                          />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <DeleteDialog
        open={!!selectedBoard}
        onOpenChange={(open) => !open && setSelectedBoard(null)}
        title="Delete board?"
        description={`Deleting "${selectedBoard?.name}" will permanently remove its groups, tasks and media.`}
        onConfirm={() =>
          selectedBoard && deleteMutation.mutate(selectedBoard.id)
        }
        loading={deleteMutation.isPending}
      />

      {/* Admin edit board dialog */}
      {editingBoard &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="relative w-full max-w-sm rounded-xl border bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 rounded-t-xl" />
              <button
                onClick={() => setEditingBoard(null)}
                className="absolute top-4 right-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
              <h2 className="mb-4 text-lg font-bold">Edit Board</h2>
              <AdminEditForm
                initialName={editingBoard.name}
                isPending={editMutation.isPending}
                onCancel={() => setEditingBoard(null)}
                onSubmit={(name) =>
                  editMutation.mutate({ id: editingBoard.id, data: { name } })
                }
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
