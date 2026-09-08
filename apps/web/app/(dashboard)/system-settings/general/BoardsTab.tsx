"use client";

import { BarChart3 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { AdminBoard, deleteAdminBoard, getAllBoards } from "@/services/admin.api";
import { DeleteDialog } from "./DeleteDialog";
import { RowActions } from "./RowActions";

export function BoardsTab() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [selectedBoard, setSelectedBoard] = useState<AdminBoard | null>(null);

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
                            onEdit={() => {}}
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
    </div>
  );
}
