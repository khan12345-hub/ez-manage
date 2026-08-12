"use client";

import { ArrowUpRight, FolderKanban } from "lucide-react";

const workspaces = [
  {
    name: "Engineering",
    boards: 8,
    tasks: 42,
    color: "bg-violet-500",
  },
  {
    name: "Marketing",
    boards: 4,
    tasks: 18,
    color: "bg-blue-500",
  },
  {
    name: "Operations",
    boards: 3,
    tasks: 12,
    color: "bg-emerald-500",
  },
];

export function WorkspaceCards() {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Workspaces</h2>
        <p className="text-sm text-muted-foreground">
          Workspaces you are a member of
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {workspaces.map((workspace) => (
          <button
            key={workspace.name}
            className="group rounded-2xl border bg-background p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex size-11 items-center justify-center rounded-xl ${workspace.color}`}
                >
                  <FolderKanban className="size-5 text-white" />
                </div>

                <div>
                  <h3 className="font-semibold">{workspace.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    Workspace
                  </p>
                </div>
              </div>

              <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
            </div>

            <div className="mt-6 flex gap-6">
              <div>
                <p className="text-lg font-semibold">
                  {workspace.boards}
                </p>
                <p className="text-xs text-muted-foreground">Boards</p>
              </div>

              <div>
                <p className="text-lg font-semibold">
                  {workspace.tasks}
                </p>
                <p className="text-xs text-muted-foreground">
                  Active tasks
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}