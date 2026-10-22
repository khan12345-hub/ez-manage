"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, AlertTriangle, Clock, CheckCircle2, Activity, TrendingUp, ChevronDown, ChevronUp, Users, LayoutGrid, ArrowLeft, Calendar, ChevronDown as ChevronDownIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getWorkspaceDetail } from "../management.api";
import type { WorkspaceAssignee } from "../management.api";
import type { MyTaskItem } from "@/services/ceo-assistant.api";

interface Props {
  workspaceId: number;
  workspaceName: string;
  onClose: () => void;
  onTaskClick: (task: { taskId: number; taskName: string }) => void;
  onMemberClick?: (userId: number) => void;
  onBack?: () => void;
}

function initials(f: string, l: string) {
  return `${f[0] ?? ""}${l[0] ?? ""}`.toUpperCase();
}

const CAT_CONFIG = {
  overdue:  { label: "Overdue",  icon: AlertTriangle, text: "text-red-600",     dot: "bg-red-500"     },
  due_soon: { label: "Due Soon", icon: Clock,         text: "text-amber-600",   dot: "bg-amber-500"   },
  inactive: { label: "Inactive", icon: Activity,      text: "text-slate-500",   dot: "bg-slate-400"   },
  on_track: { label: "On Track", icon: TrendingUp,    text: "text-blue-600",    dot: "bg-blue-500"    },
  done:     { label: "Done",     icon: CheckCircle2,  text: "text-emerald-600", dot: "bg-emerald-500" },
} as const;

const DATE_OPTS = [
  { value: "all",     label: "All Time"     },
  { value: "week",    label: "This Week"    },
  { value: "month",   label: "This Month"   },
  { value: "quarter", label: "This Quarter" },
  { value: "year",    label: "This Year"    },
] as const;
type DateOpt = typeof DATE_OPTS[number]["value"];

function getDateFrom(f: DateOpt): Date | null {
  if (f === "all") return null;
  const n = new Date();
  if (f === "week")    return new Date(n.getTime() - 7 * 86_400_000);
  if (f === "month")   return new Date(n.getFullYear(), n.getMonth(), 1);
  if (f === "quarter") return new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3, 1);
  if (f === "year")    return new Date(n.getFullYear(), 0, 1);
  return null;
}

function AssigneeRow({
  assignee, onTaskClick, onMemberClick, dateFrom,
}: {
  assignee: WorkspaceAssignee;
  onTaskClick: (t: { taskId: number; taskName: string }) => void;
  onMemberClick?: (id: number) => void;
  dateFrom: Date | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const tasks = useMemo(() =>
    dateFrom
      ? assignee.tasks.filter((t) => t.dueDate && new Date(t.dueDate) >= dateFrom)
      : assignee.tasks,
    [assignee.tasks, dateFrom]);

  const filteredDone    = tasks.filter((t) => t.category === "done").length;
  const filteredOverdue = tasks.filter((t) => t.category === "overdue").length;

  const pct = tasks.length > 0 ? Math.round((filteredDone / tasks.length) * 100) : 0;
  const barColor = pct >= 75 ? "#10b981" : pct >= 40 ? "#3b82f6" : "#f59e0b";

  return (
    <div className="border-b border-border last:border-0">
      {/* Assignee header row */}
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/20">
        <button
          onClick={() => onMemberClick?.(assignee.userId)}
          className="flex items-center gap-2.5 flex-1 min-w-0 text-left hover:opacity-75 transition-opacity"
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={assignee.avatarUrl ?? undefined} />
            <AvatarFallback className="text-xs font-bold bg-gradient-to-br from-slate-500 to-slate-700 text-white">
              {initials(assignee.firstName, assignee.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">
              {assignee.firstName} {assignee.lastName}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                assignee.role === "OWNER" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" :
                assignee.role === "ADMIN" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400" :
                "bg-muted text-muted-foreground"
              )}>{assignee.role}</span>
            </div>
          </div>
        </button>

        {/* Progress + stats */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            {filteredOverdue > 0 && (
              <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 dark:bg-red-950/30 dark:border-red-900">
                {filteredOverdue}↑
              </span>
            )}
            {filteredDone > 0 && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 dark:bg-emerald-950/30 dark:border-emerald-900">
                {filteredDone}✓
              </span>
            )}
            <span className="text-[10px] font-bold text-muted-foreground">{tasks.length} total</span>
          </div>
          <div className="w-20">
            <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
            </div>
          </div>
          <button
            onClick={() => setExpanded((p) => !p)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Tasks expanded */}
      {expanded && (
        <div className="bg-background divide-y divide-border/60">
          {tasks.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">No tasks for this period</div>
          ) : tasks.map((task) => {
            const cfg = CAT_CONFIG[task.category];
            const Icon = cfg.icon;
            const dueDate = task.dueDate ? new Date(task.dueDate) : null;
            return (
              <button
                key={task.taskId}
                onClick={() => onTaskClick({ taskId: task.taskId, taskName: task.taskName })}
                className="w-full flex items-center gap-3 px-6 py-2.5 hover:bg-muted/30 transition-colors text-left"
              >
                <Icon className={cn("h-3 w-3 shrink-0", cfg.text)} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">{task.taskName}</div>
                  <div className="text-[10px] text-muted-foreground">{task.groupName}</div>
                </div>
                <div className="shrink-0 text-right">
                  {task.category === "overdue" && task.daysOverdue && (
                    <span className="text-[10px] font-semibold text-red-600">{task.daysOverdue}d</span>
                  )}
                  {task.category === "due_soon" && dueDate && (
                    <span className="text-[10px] font-semibold text-amber-600">
                      {dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  )}
                  {task.category === "done" && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function WorkspaceDetailPanel({ workspaceId, workspaceName, onClose, onTaskClick, onMemberClick, onBack }: Props) {
  const [dateFilter, setDateFilter] = useState<DateOpt>("all");
  const dateFrom = useMemo(() => getDateFrom(dateFilter), [dateFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ["ceo-workspace-detail", workspaceId],
    queryFn: () => getWorkspaceDetail(workspaceId),
    staleTime: 60_000,
  });

  const filteredAssignees = useMemo(() => {
    if (!data) return [];
    if (!dateFrom) return data.assignees;
    return data.assignees.map((a) => ({
      ...a,
      tasks: a.tasks.filter((t) => t.dueDate && new Date(t.dueDate) >= dateFrom),
    }));
  }, [data, dateFrom]);

  const totalTasks   = filteredAssignees.reduce((s, a) => s + a.tasks.length, 0);
  const doneTasks    = filteredAssignees.reduce((s, a) => s + a.tasks.filter((t) => t.category === "done").length, 0);
  const overdueTasks = filteredAssignees.reduce((s, a) => s + a.tasks.filter((t) => t.category === "overdue").length, 0);
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-background shadow-2xl border-l border-border">
        {/* Header */}
        <div className="border-b border-border bg-muted/20 px-5 py-4 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            {onBack && (
              <button onClick={onBack} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Workspace Detail</span>
            <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-foreground truncate">{workspaceName}</h2>
            {/* Date filter */}
            <div className="relative shrink-0 flex items-center">
              <Calendar className="absolute left-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateOpt)}
                className="appearance-none rounded-xl border border-border bg-muted/40 pl-7 pr-6 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                {DATE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDownIcon className="absolute right-1.5 h-3 w-3 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {data && !isLoading && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border bg-card p-2.5 text-center">
                <div className="text-xl font-bold tabular-nums text-foreground">{totalTasks}</div>
                <div className="text-[10px] text-muted-foreground">Total Tasks</div>
              </div>
              <div className="rounded-lg border border-border bg-emerald-50 dark:bg-emerald-950/30 p-2.5 text-center">
                <div className="text-xl font-bold tabular-nums text-emerald-600">{doneTasks}</div>
                <div className="text-[10px] text-muted-foreground">Done</div>
              </div>
              <div className="rounded-lg border border-border bg-red-50 dark:bg-red-950/30 p-2.5 text-center">
                <div className="text-xl font-bold tabular-nums text-red-600">{overdueTasks}</div>
                <div className="text-[10px] text-muted-foreground">Overdue</div>
              </div>
            </div>
          )}

          {data && totalTasks > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Overall progress</span><span className="font-bold" style={{ color: pct >= 75 ? "#10b981" : pct >= 40 ? "#3b82f6" : "#f59e0b" }}>{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 75 ? "#10b981" : pct >= 40 ? "#3b82f6" : "#f59e0b" }} />
              </div>
            </div>
          )}
        </div>

        {/* Assignee list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : !data || data.assignees.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No task data for this workspace</div>
          ) : (
            <div className="divide-y divide-border">
              {filteredAssignees.map((assignee) => (
                <AssigneeRow
                  key={assignee.userId}
                  assignee={assignee}
                  onTaskClick={onTaskClick}
                  onMemberClick={onMemberClick}
                  dateFrom={dateFrom}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
