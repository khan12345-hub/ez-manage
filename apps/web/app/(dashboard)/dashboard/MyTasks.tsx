"use client";

import { CalendarDays, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const tasks = [
  {
    id: 1,
    name: "Fix authentication issue",
    board: "Development",
    status: "Working",
    statusClass:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    due: "Today",
  },
  {
    id: 2,
    name: "Update dashboard UI",
    board: "EzManage",
    status: "Review",
    statusClass:
      "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    due: "Tomorrow",
  },
  {
    id: 3,
    name: "Create API documentation",
    board: "Backend",
    status: "Todo",
    statusClass:
      "bg-muted text-muted-foreground",
    due: "Aug 15",
  },
  {
    id: 4,
    name: "Prepare release checklist",
    board: "Development",
    status: "Working",
    statusClass:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    due: "Aug 16",
  },
];

export function MyTasks() {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">My Tasks</h2>
          <p className="text-sm text-muted-foreground">
            Tasks currently assigned to you
          </p>
        </div>

        <Button variant="ghost" className="gap-1">
          View all
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
        <div className="hidden grid-cols-[minmax(0,2fr)_1fr_140px_120px] border-b bg-muted/40 px-5 py-3 text-xs font-medium text-muted-foreground md:grid">
          <span>Task</span>
          <span>Board</span>
          <span>Status</span>
          <span>Due</span>
        </div>

        {tasks.map((task) => (
          <div
            key={task.id}
            className="grid gap-3 border-b px-5 py-4 last:border-0 md:grid-cols-[minmax(0,2fr)_1fr_140px_120px] md:items-center"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md border">
                <span className="size-2 rounded-full bg-muted-foreground/50" />
              </div>

              <span className="truncate text-sm font-medium">
                {task.name}
              </span>
            </div>

            <span className="text-sm text-muted-foreground">
              {task.board}
            </span>

            <div>
              <Badge
                variant="secondary"
                className={`rounded-md border-0 ${task.statusClass}`}
              >
                {task.status}
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="size-4" />
              {task.due}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}