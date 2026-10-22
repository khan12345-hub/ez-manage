"use client";

import { useState } from "react";
import { X, AlertTriangle, Clock, Activity, CheckCircle2, TrendingUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PanelTask {
  taskId: number;
  taskName: string;
  boardName: string;
  workspaceName: string;
  groupName: string;
  dueDate: string | null;
  daysOverdue: number | null;
  category: "overdue" | "due_soon" | "on_track" | "done" | "inactive";
  assigneeName?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  tasks: PanelTask[];
  onClose: () => void;
  onTaskClick: (task: { taskId: number; taskName: string }) => void;
  accentColor?: string;
}

const CAT = {
  overdue:  { icon: AlertTriangle, text: "text-red-600",     iconBg: "bg-red-100 border-red-200"      },
  due_soon: { icon: Clock,         text: "text-amber-600",   iconBg: "bg-amber-100 border-amber-200"  },
  inactive: { icon: Activity,      text: "text-slate-500",   iconBg: "bg-slate-100 border-slate-200"  },
  on_track: { icon: TrendingUp,    text: "text-blue-600",    iconBg: "bg-blue-100 border-blue-200"    },
  done:     { icon: CheckCircle2,  text: "text-emerald-600", iconBg: "bg-emerald-100 border-emerald-200" },
} as const;

export function TaskListPanel({ title, subtitle, tasks, onClose, onTaskClick, accentColor = "#3b82f6" }: Props) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? tasks.filter(
        (t) =>
          t.taskName.toLowerCase().includes(search.toLowerCase()) ||
          t.boardName.toLowerCase().includes(search.toLowerCase()) ||
          t.workspaceName.toLowerCase().includes(search.toLowerCase()),
      )
    : tasks;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col bg-background shadow-2xl border-l border-border">
        {/* Header */}
        <div className="border-b border-border px-5 py-4 shrink-0" style={{ borderTop: `3px solid ${accentColor}` }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-foreground">{title}</h2>
              {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="w-full rounded-lg border border-border bg-muted/40 pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{filtered.length} task{filtered.length !== 1 ? "s" : ""}</p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">No tasks found</div>
          ) : (
            filtered.map((task) => {
              const cfg = CAT[task.category];
              const Icon = cfg.icon;
              const dueDate = task.dueDate ? new Date(task.dueDate) : null;
              return (
                <button
                  key={task.taskId}
                  onClick={() => onTaskClick({ taskId: task.taskId, taskName: task.taskName })}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors text-left group"
                >
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", cfg.iconBg)}>
                    <Icon className={cn("h-3.5 w-3.5", cfg.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate group-hover:text-blue-600 transition-colors">{task.taskName}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                      <span className="truncate">{task.boardName}</span>
                      <span>·</span>
                      <span className="truncate">{task.workspaceName}</span>
                      {task.assigneeName && (
                        <>
                          <span>·</span>
                          <span className="truncate text-blue-600 font-medium">{task.assigneeName}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {task.category === "overdue" && task.daysOverdue && (
                      <span className="text-xs font-bold text-red-600">{task.daysOverdue}d overdue</span>
                    )}
                    {task.category === "due_soon" && dueDate && (
                      <span className="text-xs font-semibold text-amber-600">
                        {dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
