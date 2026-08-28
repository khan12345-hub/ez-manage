"use client";

import { ArrowRight, FolderKanban, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

import { DeleteDialog } from "./DeleteDialog";
import { RowActions } from "./RowActions";
import { Workspace } from "./types";

const mockWorkspaces: Workspace[] = [
  {
    id: 1,
    name: "Marketing",
    members: 18,
    boards: 6,
    tasks: 1284,
  },
  {
    id: 2,
    name: "Development",
    members: 32,
    boards: 12,
    tasks: 5421,
  },
  {
    id: 3,
    name: "Operations",
    members: 11,
    boards: 4,
    tasks: 812,
  },
];

export function WorkspacesTab() {
  const [selectedWorkspace, setSelectedWorkspace] =
    useState<Workspace | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">
            Workspaces
          </h2>

          <p className="text-sm text-muted-foreground">
            Manage all workspaces across EzManage.
          </p>
        </div>

        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Workspace
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mockWorkspaces.map((workspace) => (
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
                  onDelete={() =>
                    setSelectedWorkspace(workspace)
                  }
                />
              </div>

              <h3 className="mt-4 font-semibold">
                {workspace.name}
              </h3>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <Info
                  label="Members"
                  value={workspace.members}
                />

                <Info
                  label="Boards"
                  value={workspace.boards}
                />

                <Info
                  label="Tasks"
                  value={workspace.tasks}
                />
              </div>

              <Button
                variant="ghost"
                className="mt-4 w-full justify-between"
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
        onOpenChange={(open) =>
          !open && setSelectedWorkspace(null)
        }
        title="Delete workspace?"
        description={`Deleting "${selectedWorkspace?.name}" may also remove its boards, groups and tasks.`}
      />
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-[11px] text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

