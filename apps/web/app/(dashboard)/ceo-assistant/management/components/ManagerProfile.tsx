"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, AlertTriangle, Clock, CheckCircle2, Activity, TrendingUp, LayoutGrid, Building2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getManagerDetail } from "../management.api";
import type { MyTaskItem } from "@/services/ceo-assistant.api";

interface Props {
  managerId: number;
  onClose: () => void;
  onTaskClick: (task: { taskId: number; taskName: string }) => void;
  onMemberClick: (userId: number) => void;
  onWorkspaceClick: (workspaceId: number, workspaceName: string) => void;
}

function initials(f: string, l: string) {
  return `${f[0] ?? ""}${l[0] ?? ""}`.toUpperCase();
}

const CAT_CONFIG = {
  overdue:  { label: "Overdue",  icon: AlertTriangle, text: "text-red-600",     dot: "bg-red-500",     badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400" },
  due_soon: { label: "Due Soon", icon: Clock,         text: "text-amber-600",   dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30" },
  inactive: { label: "Inactive", icon: Activity,      text: "text-slate-500",   dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900" },
  on_track: { label: "On Track", icon: TrendingUp,    text: "text-blue-600",    dot: "bg-blue-500",    badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30" },
  done:     { label: "Done",     icon: CheckCircle2,  text: "text-emerald-600", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30" },
} as const;

const TABS = ["Tasks", "Team", "Workspaces"] as const;

function SegmentedBar({ total, done, overdue, dueSoon, inactive }: {
  total: number; done: number; overdue: number; dueSoon: number; inactive: number;
}) {
  if (total === 0) return null;
  const onTrack = Math.max(0, total - done - overdue - dueSoon - inactive);
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;

  const segs = [
    { val: done,     color: "#10b981", label: "Done",     tooltip: `Done: ${done}` },
    { val: onTrack,  color: "#3b82f6", label: "On Track", tooltip: `On Track: ${onTrack}` },
    { val: dueSoon,  color: "#f59e0b", label: "Due Soon", tooltip: `Due Soon: ${dueSoon}` },
    { val: overdue,  color: "#ef4444", label: "Overdue",  tooltip: `Overdue: ${overdue}` },
    { val: inactive, color: "#94a3b8", label: "Inactive",  tooltip: `Inactive: ${inactive}` },
  ].filter((s) => s.val > 0);

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted gap-px">
        {segs.map((s) => (
          <div
            key={s.label}
            title={s.tooltip}
            style={{ width: pct(s.val), background: s.color, minWidth: s.val > 0 ? "2px" : "0" }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segs.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ background: s.color }} />
            {s.label}: <span className="font-bold text-foreground">{s.val}</span>
            <span className="opacity-60">({pct(s.val)})</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function ManagerProfile({ managerId, onClose, onTaskClick, onMemberClick, onWorkspaceClick }: Props) {
  const [tab, setTab] = useState<"Tasks" | "Team" | "Workspaces">("Tasks");
  const [taskFilter, setTaskFilter] = useState<MyTaskItem["category"] | "all">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["ceo-manager-detail", managerId],
    queryFn: () => getManagerDetail(managerId),
    staleTime: 60_000,
  });

  const filteredTasks = taskFilter === "all" ? (data?.tasks ?? []) : (data?.tasks ?? []).filter((t) => t.category === taskFilter);
  const taskCategories = data ? ["all", ...Array.from(new Set(data.tasks.map((t) => t.category)))] as const : ["all"];
  const pct = data && data.taskStats.totalTasks > 0 ? Math.round((data.taskStats.doneTasks / data.taskStats.totalTasks) * 100) : 0;
  const barColor = pct >= 75 ? "#10b981" : pct >= 40 ? "#3b82f6" : "#f59e0b";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-background shadow-2xl border-l border-border">
        {/* Header */}
        <div className="border-b border-border bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-900/50 dark:to-blue-950/20 px-5 py-4 shrink-0">
          <div className="flex items-start gap-3">
            {isLoading ? (
              <Skeleton className="h-14 w-14 rounded-full" />
            ) : data && (
              <Avatar className="h-14 w-14 ring-2 ring-border shrink-0">
                <AvatarImage src={data.user.avatarUrl ?? undefined} />
                <AvatarFallback className="text-lg font-bold bg-gradient-to-br from-indigo-500 to-blue-600 text-white">
                  {initials(data.user.firstName, data.user.lastName)}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1 min-w-0">
              {isLoading ? (
                <div className="space-y-2"><Skeleton className="h-5 w-36" /><Skeleton className="h-3.5 w-48" /></div>
              ) : data && (
                <>
                  <h2 className="text-base font-bold text-foreground">{data.user.firstName} {data.user.lastName}</h2>
                  <p className="text-xs text-muted-foreground">{data.user.email}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs font-medium text-muted-foreground">{data.taskStats.totalTasks} tasks · {data.workspaces.length} workspaces</span>
                    <span className="text-xs font-bold rounded-full px-2 py-0.5 text-white" style={{ background: barColor }}>{pct}% done</span>
                    {data.taskStats.overdueTasks > 0 && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full dark:bg-red-950/30">
                        {data.taskStats.overdueTasks} overdue
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
            <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Combined progress bar across ALL workspaces */}
          {data && data.taskStats.totalTasks > 0 && (
            <SegmentedBar
              total={data.taskStats.totalTasks}
              done={data.taskStats.doneTasks}
              overdue={data.taskStats.overdueTasks}
              dueSoon={data.taskStats.dueSoonTasks}
              inactive={data.taskStats.inactiveTasks}
            />
          )}

          {/* Tabs */}
          <div className="flex gap-1 mt-3 bg-muted/50 rounded-lg p-0.5">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-xs font-semibold transition-all",
                  tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t}
                {t === "Tasks" && data && ` (${data.tasks.length})`}
                {t === "Team" && data && ` (${data.team.length})`}
                {t === "Workspaces" && data && ` (${data.workspaces.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : (
            <>
              {/* ── TASKS TAB ── */}
              {tab === "Tasks" && data && (
                <div className="p-4 space-y-3">
                  {/* Mini stats grid */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { l: "Total",    v: data.taskStats.totalTasks,    c: "text-foreground",  bg: "bg-muted/50",                                 border: "border-border" },
                      { l: "Done",     v: data.taskStats.doneTasks,     c: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30",         border: "border-emerald-200 dark:border-emerald-900" },
                      { l: "Overdue",  v: data.taskStats.overdueTasks,  c: "text-red-600",     bg: "bg-red-50 dark:bg-red-950/30",                border: "border-red-200 dark:border-red-900" },
                      { l: "Due Soon", v: data.taskStats.dueSoonTasks,  c: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950/30",            border: "border-amber-200 dark:border-amber-900" },
                      { l: "Inactive", v: data.taskStats.inactiveTasks, c: "text-slate-500",   bg: "bg-slate-50 dark:bg-slate-900/40",             border: "border-slate-200 dark:border-slate-700" },
                    ].map((s) => (
                      <div key={s.l} className={cn("rounded-lg border p-2 text-center", s.bg, s.border)}>
                        <div className={cn("text-lg font-bold tabular-nums", s.c)}>{s.v}</div>
                        <div className="text-[9px] font-medium text-muted-foreground mt-0.5 leading-none">{s.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Filter pills */}
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                    {taskCategories.map((cat) => {
                      const count = cat === "all" ? data.tasks.length : data.tasks.filter((t) => t.category === cat).length;
                      const cfg = cat !== "all" ? CAT_CONFIG[cat as keyof typeof CAT_CONFIG] : null;
                      return (
                        <button
                          key={cat}
                          onClick={() => setTaskFilter(cat as any)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors shrink-0",
                            taskFilter === cat
                              ? cat === "all" ? "bg-foreground text-background border-transparent" : cfg?.badge
                              : "bg-transparent text-muted-foreground border-border hover:bg-muted/50"
                          )}
                        >
                          {cfg && <span className={cn("inline-block w-1.5 h-1.5 rounded-full", cfg.dot)} />}
                          {cat === "all" ? "All" : cfg?.label} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Task list */}
                  <div className="rounded-xl border border-border overflow-hidden">
                    {filteredTasks.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">No tasks</div>
                    ) : (
                      <div className="divide-y divide-border">
                        {filteredTasks.map((task) => {
                          const cfg = CAT_CONFIG[task.category];
                          const Icon = cfg.icon;
                          return (
                            <button
                              key={task.taskId}
                              onClick={() => onTaskClick({ taskId: task.taskId, taskName: task.taskName })}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                            >
                              <Icon className={cn("h-3.5 w-3.5 shrink-0", cfg.text)} />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-foreground truncate">{task.taskName}</div>
                                <div className="text-xs text-muted-foreground truncate">{task.boardName} · {task.workspaceName}</div>
                              </div>
                              {task.category === "overdue" && task.daysOverdue && (
                                <span className="text-xs font-bold text-red-600 shrink-0">{task.daysOverdue}d</span>
                              )}
                              {task.category === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── TEAM TAB ── */}
              {tab === "Team" && data && (
                <div className="divide-y divide-border">
                  {data.team.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">No team members found</div>
                  ) : data.team.map((member) => {
                    const mPct = member.stats.totalTasks > 0 ? Math.round((member.stats.doneTasks / member.stats.totalTasks) * 100) : 0;
                    const mColor = mPct >= 75 ? "#10b981" : mPct >= 40 ? "#3b82f6" : "#f59e0b";
                    return (
                      <button
                        key={member.userId}
                        onClick={() => onMemberClick(member.userId)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors text-left"
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={member.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-xs font-bold bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                            {initials(member.firstName, member.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-foreground">{member.firstName} {member.lastName}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded",
                              member.role === "OWNER" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" :
                              member.role === "ADMIN" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400" :
                              "bg-muted text-muted-foreground"
                            )}>{member.role}</span>
                            <span className="text-xs text-muted-foreground truncate">{member.workspaceName}</span>
                          </div>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <span className="text-xs font-bold" style={{ color: mColor }}>{mPct}%</span>
                          <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${mPct}%`, background: mColor }} />
                          </div>
                          {member.stats.overdueTasks > 0 && (
                            <span className="text-[10px] font-bold text-red-600">{member.stats.overdueTasks} overdue</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── WORKSPACES TAB ── */}
              {tab === "Workspaces" && data && (
                <div className="divide-y divide-border">
                  {data.workspaces.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">No workspaces found</div>
                  ) : data.workspaces.map((ws) => (
                    <button
                      key={ws.workspaceId}
                      onClick={() => onWorkspaceClick(ws.workspaceId, ws.workspaceName)}
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors text-left"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground">{ws.workspaceName}</div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><LayoutGrid className="h-3 w-3" /> {ws.boardCount} boards</span>
                          <span>{ws.memberCount} members</span>
                        </div>
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-1 rounded-full border",
                        ws.role === "OWNER" ? "bg-amber-100 text-amber-700 border-amber-200" :
                        ws.role === "ADMIN" ? "bg-blue-100 text-blue-700 border-blue-200" :
                        "bg-muted text-muted-foreground border-muted"
                      )}>{ws.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
