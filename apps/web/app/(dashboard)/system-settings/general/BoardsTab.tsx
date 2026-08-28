
"use client";

import { BarChart3 } from "lucide-react";
import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";

import { DeleteDialog } from "./DeleteDialog";
import { RowActions } from "./RowActions";
import { Board } from "./types";

const mockBoards: Board[] = [
  {
    id: 1,
    name: "Marketing Campaign",
    workspace: "Marketing",
    groups: 24,
    tasks: 482,
  },
  {
    id: 2,
    name: "Social Media",
    workspace: "Marketing",
    groups: 8,
    tasks: 193,
  },
  {
    id: 3,
    name: "Content Calendar",
    workspace: "Marketing",
    groups: 12,
    tasks: 321,
  },
];

export function BoardsTab() {
  const [selectedBoard, setSelectedBoard] =
    useState<Board | null>(null);

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
                  <th className="px-5 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {mockBoards.map((board) => (
                  <tr
                    key={board.id}
                    className="border-b last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <BarChart3 className="h-4 w-4" />
                        </div>

                        <span className="font-medium">
                          {board.name}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-muted-foreground">
                      {board.workspace}
                    </td>

                    <td className="px-5 py-4">
                      {board.groups}
                    </td>

                    <td className="px-5 py-4">
                      {board.tasks}
                    </td>

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
        onOpenChange={(open) =>
          !open && setSelectedBoard(null)
        }
        title="Delete board?"
        description={`Deleting "${selectedBoard?.name}" may permanently remove its groups, tasks and media.`}
      />
    </div>
  );
}

