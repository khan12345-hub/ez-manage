"use client";

import { useAuth } from "@/providers/AuthProvider";
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
  const { user } = useAuth();
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Workspaces</h2>
        <p className="text-sm text-muted-foreground">
          Workspaces you are a member of
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {user && user.workspaceMemberships.map((workspaceMembership:any) => (
          <button
            key={workspaceMembership.workspace.name}
            className="group rounded-2xl border bg-background p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex size-11 items-center justify-center rounded-xl bg-primary`}
                >
                  <FolderKanban className="size-5 text-white" />
                </div>

                <div>
                  <h3 className="font-semibold">{workspaceMembership.workspace.name}</h3>
                  <p className="text-xs text-muted-foreground">Workspace</p>
                </div>
              </div>

              <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
            </div>

            
          </button>
        ))}
      </div>
    </section>
  );
}
