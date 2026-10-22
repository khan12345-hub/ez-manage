"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, AlertTriangle, Clock, CheckCircle2, Activity, TrendingUp, ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getMemberDetail } from "../management.api";
import type { MyTaskItem } from "@/services/ceo-assistant.api";

interface Props {
  userId: number;
  onClose: () => void;
  onTaskClick: (task: { taskId: number; taskName: string }) => void;
  onBack?: () => void;
}

function initials(f: string, l: string) {
  return `${f[0] ?? ""}${l[0] ?? ""}`.toUpperCase();
}

const CATEGORY_CONFIG = {
  overdue:  { label: "Overdue",  icon: AlertTriangle, dot: "bg-red-500",     text: "text-red-600",     badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400" },
  due_soon: { label: "Due Soon", icon: Clock,         dot: "bg-amber-500",   text: "text-amber-600",   badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30" },
  inactive: { label: "Inactive", icon: Activity,      dot: "bg-slate-400",   text: "text-slate-500",   badge: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:border-slate-700" },
  on_track: { label: "On Track", icon: TrendingUp,    dot: "bg-blue-500",    text: "text-blue-600",    badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30" },
  done:     { label: "Done",     icon: CheckCircle2,  dot: "bg-emerald-500", text: "text-emerald-600", badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30" },
} as const;

export function MemberFullProfile({ userId, onClose, onTaskClick, onBack }: Props) {
  const [filter, setFilter] = useState<MyTaskItem["category"] | "all">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["ceo-member-detail", userId],
    queryFn: () => getMemberDetail(userId),
    staleTime: 60_000,
  });

  const filtered = filter === "all" ? (data?.tasks ?? []) : (data?.tasks ?? []).filter((t) => t.category === filter);
  const pct = data ? (data.stats.totalTasks > 0 ? Math.round((data.stats.doneTasks / data.stats.totalTasks) * 100) : 0) : 0;
  const progressColor = pct >= 75 ? "#10b981" : pct >= 40 ? "#3b82f6" : "#f59e0b";

  const categories = data ? (["all", ...Array.from(new Set(data.tasks.map((t) => t.category)))] as const) : ["all"];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col bg-background shadow-2xl border-l border-border">
        {/* Header */}
        <div className="border-b border-border bg-muted/20 px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            {onBack && (
              <button onClick={onBack} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Member Profile</span>
            <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
            </div>
          ) : data && (
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 ring-2 ring-border">
                <AvatarImage src={data.user.avatarUrl ?? undefined} />
                <AvatarFallback className="text-base font-bold bg-gradient-to-br from-indigo-500 to-blue-600 text-white">
                  {initials(data.user.firstName, data.user.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-foreground">{data.user.firstName} {data.user.lastName}</div>
                <div className="text-xs text-muted-foreground">{data.user.email}</div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : data && (
            <>
              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Total", value: data.stats.totalTasks, color: "text-foreground", bg: "bg-muted/50" },
                  { label: "Done", value: data.stats.doneTasks, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
                  { label: "Overdue", value: data.stats.overdueTasks, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30" },
                  { label: "Due Soon", value: data.stats.dueSoonTasks, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
                ].map((s) => (
                  <div key={s.label} className={cn("rounded-lg p-3 text-center border border-border", s.bg)}>
                    <div className={cn("text-2xl font-bold tabular-nums", s.color)}>{s.value}</div>
                    <div className="text-[10px] font-medium text-muted-foreground mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              {data.stats.totalTasks > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-foreground">Completion Rate</span>
                    <span className="text-sm font-bold" style={{ color: progressColor }}>{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: progressColor }} />
                  </div>
                  <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                    <span>{data.stats.doneTasks} done</span>
                    <span>{data.stats.totalTasks - data.stats.doneTasks} remaining</span>
                  </div>
                </div>
              )}

              {/* Filter pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {categories.map((cat) => {
                  const count = cat === "all" ? data.tasks.length : data.tasks.filter((t) => t.category === cat).length;
                  const cfg = cat !== "all" ? CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG] : null;
                  return (
                    <button
                      key={cat}
                      onClick={() => setFilter(cat as any)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors shrink-0",
                        filter === cat
                          ? cat === "all" ? "bg-foreground text-background border-transparent" : cfg?.badge
                          : "bg-transparent text-muted-foreground border-border hover:bg-muted/50",
                      )}
                    >
                      {cfg && <span className={cn("inline-block w-1.5 h-1.5 rounded-full", cfg.dot)} />}
                      {cat === "all" ? "All Tasks" : cfg?.label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Task list */}
              <div className="rounded-xl border border-border overflow-hidden">
                {filtered.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">No tasks in this category</div>
                ) : (
                  <div className="divide-y divide-border">
                    {filtered.map((task) => {
                      const cfg = CATEGORY_CONFIG[task.category];
                      const Icon = cfg.icon;
                      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                      return (
                        <button
                          key={task.taskId}
                          onClick={() => onTaskClick({ taskId: task.taskId, taskName: task.taskName })}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                        >
                          <Icon className={cn("h-3.5 w-3.5 shrink-0", cfg.text)} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">{task.taskName}</div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                              <span className="truncate">{task.boardName}</span>
                              <span>·</span>
                              <span className="truncate">{task.workspaceName}</span>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            {task.category === "overdue" && task.daysOverdue && (
                              <span className="text-xs font-semibold text-red-600">{task.daysOverdue}d overdue</span>
                            )}
                            {task.category === "due_soon" && dueDate && (
                              <span className="text-xs font-semibold text-amber-600">
                                {dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                              </span>
                            )}
                            {task.category === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
