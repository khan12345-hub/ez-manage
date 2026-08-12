"use client";

import { ChevronRight, LayoutDashboard, Star } from "lucide-react";

import { Button } from "@/components/ui/button";

const boards = [
  {
    name: "Development",
    workspace: "Engineering",
    tasks: 32,
    active: 8,
    favorite: true,
  },
  {
    name: "Website",
    workspace: "Marketing",
    tasks: 18,
    active: 5,
    favorite: true,
  },
  {
    name: "Internal Tasks",
    workspace: "Operations",
    tasks: 9,
    active: 3,
    favorite: false,
  },
  {
    name: "Product Roadmap",
    workspace: "Engineering",
    tasks: 26,
    active: 11,
    favorite: false,
  },
];

export function MyBoards() {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">My Boards</h2>
          <p className="text-sm text-muted-foreground">
            Boards you recently accessed
          </p>
        </div>

        <Button variant="ghost" className="gap-1">
          View all
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
        {boards.map((board) => (
          <button
            key={board.name}
            className="group flex w-full items-center gap-4 border-b px-5 py-4 text-left transition last:border-0 hover:bg-muted/40"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              <LayoutDashboard className="size-4 text-muted-foreground" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {board.favorite && (
                  <Star className="size-3.5 fill-current text-yellow-500" />
                )}

                <p className="truncate text-sm font-semibold">
                  {board.name}
                </p>
              </div>

              <p className="mt-0.5 text-xs text-muted-foreground">
                {board.workspace}
              </p>
            </div>

            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{board.tasks}</p>
              <p className="text-xs text-muted-foreground">Tasks</p>
            </div>

            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{board.active}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>

            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </section>
  );
}