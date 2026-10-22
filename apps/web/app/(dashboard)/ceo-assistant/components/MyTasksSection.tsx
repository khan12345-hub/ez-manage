"use client";

import { useState } from "react";
import { AlertTriangle, Clock, CheckCircle2, ChevronDown, ChevronUp, Activity, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MyTaskItem } from "@/services/ceo-assistant.api";

interface Props {
  myTasks: MyTaskItem[];
  onTaskClick: (task: { taskId: number; taskName: string }) => void;
}

const CATEGORY_CONFIG = {
  overdue:  { label: "Overdue",  icon: AlertTriangle, dot: "bg-red-500",   text: "text-red-600",   badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400" },
  due_soon: { label: "Due Soon", icon: Clock,         dot: "bg-amber-500", text: "text-amber-600", badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400" },
  inactive: { label: "Inactive", icon: Activity,      dot: "bg-slate-400", text: "text-slate-600",  badge: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400" },
  on_track: { label: "On Track", icon: TrendingUp,    dot: "bg-blue-500",  text: "text-blue-600",  badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-400" },
  done:     { label: "Done",     icon: CheckCircle2,  dot: "bg-emerald-500", text: "text-emerald-600", badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400" },
} as const;

export function MyTasksSection({ myTasks, onTaskClick }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState<MyTaskItem["category"] | "all">("all");

  if (myTasks.length === 0) return null;

  const overdueCount = myTasks.filter((t) => t.category === "overdue").length;
  const doneCount = myTasks.filter((t) => t.category === "done").length;
  const pct = Math.round((doneCount / myTasks.length) * 100);

  const categories = ["all", ...Array.from(new Set(myTasks.map((t) => t.category)))] as const;
  const filtered = filter === "all" ? myTasks : myTasks.filter((t) => t.category === filter);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-4 border-b border-border px-5 py-3.5 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">My Tasks</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{myTasks.length} tasks assigned to you</p>
        </div>

        {/* Mini progress */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-sm font-bold tabular-nums text-foreground">{pct}%</div>
            <div className="text-[10px] text-muted-foreground">done</div>
          </div>
          <div className="w-20">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: pct >= 75 ? "#10b981" : pct >= 40 ? "#8b5cf6" : "#f59e0b" }}
              />
            </div>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <>
          {/* Filter pills */}
          <div className="flex gap-1.5 px-5 py-2.5 border-b border-border overflow-x-auto">
            {categories.map((cat) => {
              const count = cat === "all" ? myTasks.length : myTasks.filter((t) => t.category === cat).length;
              const cfg = cat !== "all" ? CATEGORY_CONFIG[cat] : null;
              return (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors",
                    filter === cat
                      ? cat === "all"
                        ? "bg-foreground text-background border-transparent"
                        : cfg?.badge
                      : "bg-transparent text-muted-foreground border-border hover:bg-muted/50",
                  )}
                >
                  {cfg && <span className={cn("inline-block w-1.5 h-1.5 rounded-full", cfg.dot)} />}
                  {cat === "all" ? "All" : cfg?.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Task list */}
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {filtered.map((task) => {
              const cfg = CATEGORY_CONFIG[task.category];
              const Icon = cfg.icon;
              const dueDate = task.dueDate ? new Date(task.dueDate) : null;

              return (
                <button
                  key={task.taskId}
                  onClick={() => onTaskClick({ taskId: task.taskId, taskName: task.taskName })}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors text-left"
                >
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", cfg.text)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{task.taskName}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span className="truncate">{task.boardName}</span>
                      <span>·</span>
                      <span className="truncate">{task.workspaceName}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {task.category === "overdue" && task.daysOverdue && (
                      <span className={cn("text-xs font-semibold", cfg.text)}>{task.daysOverdue}d overdue</span>
                    )}
                    {task.category === "due_soon" && dueDate && (
                      <span className={cn("text-xs font-semibold", cfg.text)}>
                        {dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    )}
                    {task.category === "done" && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
