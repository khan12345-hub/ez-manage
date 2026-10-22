"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, AlertTriangle, Clock, CheckCircle2, Activity,
  TrendingUp, Building2, Users, LayoutGrid, RefreshCw, Calendar, ChevronDown,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getManagerDetail } from "../management/management.api";
import type { MyTaskItem } from "@/services/ceo-assistant.api";

interface Props {
  userId: number;
  onBack: () => void;
  onTaskClick: (task: { taskId: number; taskName: string }) => void;
  onMemberClick?: (userId: number) => void;
  onWorkspaceClick?: (workspaceId: number, workspaceName: string) => void;
}

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

function initials(f: string, l: string) {
  return `${f[0] ?? ""}${l[0] ?? ""}`.toUpperCase();
}

const CAT = {
  overdue:  { label: "Overdue",  icon: AlertTriangle, text: "text-red-600",     dot: "bg-red-500",     badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400" },
  due_soon: { label: "Due Soon", icon: Clock,         text: "text-amber-600",   dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30" },
  inactive: { label: "Inactive", icon: Activity,      text: "text-slate-500",   dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900" },
  on_track: { label: "On Track", icon: TrendingUp,    text: "text-blue-600",    dot: "bg-blue-500",    badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30" },
  done:     { label: "Done",     icon: CheckCircle2,  text: "text-emerald-600", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30" },
} as const;

function SegBar({ total, done, overdue, dueSoon, inactive }: {
  total: number; done: number; overdue: number; dueSoon: number; inactive: number;
}) {
  if (total === 0) return null;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  const onTrack = Math.max(0, total - done - overdue - dueSoon - inactive);
  const segs = [
    { val: done,     color: "#10b981", label: "Done",     },
    { val: onTrack,  color: "#3b82f6", label: "On Track", },
    { val: dueSoon,  color: "#f59e0b", label: "Due Soon", },
    { val: overdue,  color: "#ef4444", label: "Overdue",  },
    { val: inactive, color: "#94a3b8", label: "Inactive", },
  ].filter((s) => s.val > 0);

  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/20 gap-0.5">
        {segs.map((s) => (
          <div
            key={s.label}
            title={`${s.label}: ${s.val} (${pct(s.val)})`}
            style={{ width: pct(s.val), background: s.color, minWidth: s.val > 0 ? "3px" : "0" }}
            className="first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segs.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-[11px] text-white/70">
            <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ background: s.color }} />
            {s.label}: <span className="font-bold text-white">{s.val}</span>
            <span className="opacity-60">({pct(s.val)})</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function UserDashboard({ userId, onBack, onTaskClick, onMemberClick, onWorkspaceClick }: Props) {
  const [taskFilter, setTaskFilter] = useState<MyTaskItem["category"] | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateOpt>("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ceo-manager-detail", userId],
    queryFn: () => getManagerDetail(userId),
    staleTime: 60_000,
  });

  const dateFrom = useMemo(() => getDateFrom(dateFilter), [dateFilter]);

  const dateTasks = useMemo(() =>
    dateFrom && data
      ? data.tasks.filter((t) => t.dueDate && new Date(t.dueDate) >= dateFrom)
      : (data?.tasks ?? []),
    [data, dateFrom]);

  const filteredStats = useMemo(() => ({
    totalTasks:    dateTasks.length,
    doneTasks:     dateTasks.filter((t) => t.category === "done").length,
    overdueTasks:  dateTasks.filter((t) => t.category === "overdue").length,
    dueSoonTasks:  dateTasks.filter((t) => t.category === "due_soon").length,
    inactiveTasks: dateTasks.filter((t) => t.category === "inactive").length,
  }), [dateTasks]);

  const pct = filteredStats.totalTasks > 0
    ? Math.round((filteredStats.doneTasks / filteredStats.totalTasks) * 100)
    : 0;
  const pctColor = pct >= 75 ? "#10b981" : pct >= 40 ? "#3b82f6" : "#f59e0b";

  const categories = dateTasks.length > 0
    ? (["all", ...Array.from(new Set(dateTasks.map((t) => t.category)))] as const)
    : ["all"];
  const filteredTasks = taskFilter === "all"
    ? dateTasks
    : dateTasks.filter((t) => t.category === taskFilter);

  return (
    <div className="min-h-full" style={{ background: "hsl(var(--muted)/0.3)" }}>
      {/* ── Hero Banner ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #0f172a 70%, #0c1a38 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-violet-600/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6">
          {/* Back + Date Filter + Refresh */}
          <div className="flex items-center justify-between mb-5 gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/15 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Dashboard
            </button>
            <div className="flex items-center gap-2">
              {/* Date filter */}
              <div className="relative flex items-center">
                <Calendar className="absolute left-2 h-3.5 w-3.5 text-white/50 pointer-events-none" />
                <select
                  value={dateFilter}
                  onChange={(e) => { setDateFilter(e.target.value as DateOpt); setTaskFilter("all"); }}
                  className="appearance-none rounded-lg border border-white/15 bg-white/10 pl-7 pr-6 py-1.5 text-xs font-medium text-white/80 focus:outline-none focus:ring-2 focus:ring-white/20 cursor-pointer"
                >
                  {DATE_OPTS.map((o) => <option key={o.value} value={o.value} className="bg-slate-900 text-white">{o.label}</option>)}
                </select>
                <ChevronDown className="absolute right-1.5 h-3 w-3 text-white/50 pointer-events-none" />
              </div>
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/15 transition-colors disabled:opacity-40"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                Refresh
              </button>
            </div>
          </div>

          {/* User info */}
          {isLoading ? (
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full bg-white/10" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-48 bg-white/10" />
                <Skeleton className="h-4 w-64 bg-white/10" />
              </div>
            </div>
          ) : data && (
            <>
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 ring-2 ring-white/20 shrink-0">
                  <AvatarImage src={data.user.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xl font-bold bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                    {initials(data.user.firstName, data.user.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold text-white">{data.user.firstName} {data.user.lastName}</h1>
                    <span
                      className="rounded-full border border-white/20 px-2.5 py-0.5 text-xs font-bold"
                      style={{ background: `${pctColor}30`, color: pctColor, borderColor: `${pctColor}50` }}
                    >
                      {pct}% done
                    </span>
                    {filteredStats.overdueTasks > 0 && (
                      <span className="rounded-full border border-red-400/30 bg-red-500/20 px-2.5 py-0.5 text-xs font-bold text-red-400">
                        {filteredStats.overdueTasks} overdue
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-white/50">{data.user.email}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/70">
                      <LayoutGrid className="h-3 w-3" />
                      {filteredStats.totalTasks} tasks
                    </span>
                    {data.workspaces.length > 0 && (
                      <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/70">
                        <Building2 className="h-3 w-3" />
                        {data.workspaces.length} workspace{data.workspaces.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {data.team.length > 0 && (
                      <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/70">
                        <Users className="h-3 w-3" />
                        {data.team.length} team members
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Segmented progress bar */}
              {filteredStats.totalTasks > 0 && (
                <div className="mt-5">
                  <SegBar
                    total={filteredStats.totalTasks}
                    done={filteredStats.doneTasks}
                    overdue={filteredStats.overdueTasks}
                    dueSoon={filteredStats.dueSoonTasks}
                    inactive={filteredStats.inactiveTasks}
                  />
                </div>
              )}
            </>
          )}
        </div>
        <div className="h-4 w-full" style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--muted)/0.3))" }} />
      </div>

      {/* ── Content ── */}
      <div className="mx-auto max-w-5xl px-4 pb-10 sm:px-6 mt-5 space-y-5">
        {isLoading ? (
          <>
            <div className="grid grid-cols-5 gap-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </>
        ) : data ? (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { l: "Total",    v: filteredStats.totalTasks,    cls: "text-foreground",  bg: "bg-card border-border",                                     },
                { l: "Done",     v: filteredStats.doneTasks,     cls: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900" },
                { l: "Overdue",  v: filteredStats.overdueTasks,  cls: "text-red-600",     bg: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900"             },
                { l: "Due Soon", v: filteredStats.dueSoonTasks,  cls: "text-amber-600",   bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900"     },
                { l: "Inactive", v: filteredStats.inactiveTasks, cls: "text-slate-500",   bg: "bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-700"     },
              ].map((s) => (
                <div key={s.l} className={cn("rounded-xl border p-4 text-center", s.bg)}>
                  <div className={cn("text-2xl font-black tabular-nums", s.cls)}>{s.v}</div>
                  <div className="text-xs font-medium text-muted-foreground mt-1">{s.l}</div>
                </div>
              ))}
            </div>

            {/* Main 2-column layout */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {/* Task list (left, 2/3 width) */}
              <div className="lg:col-span-2 space-y-3">
                <h2 className="text-sm font-bold text-foreground">Tasks ({dateTasks.length})</h2>

                {/* Filter pills */}
                <div className="flex gap-1.5 flex-wrap">
                  {categories.map((cat) => {
                    const count = cat === "all" ? dateTasks.length : dateTasks.filter((t) => t.category === cat).length;
                    const cfg = cat !== "all" ? CAT[cat as keyof typeof CAT] : null;
                    return (
                      <button
                        key={cat}
                        onClick={() => setTaskFilter(cat as any)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors",
                          taskFilter === cat
                            ? cat === "all" ? "bg-foreground text-background border-transparent" : cfg?.badge
                            : "bg-card text-muted-foreground border-border hover:bg-muted/50"
                        )}
                      >
                        {cfg && <span className={cn("inline-block w-1.5 h-1.5 rounded-full", cfg.dot)} />}
                        {cat === "all" ? "All" : cfg?.label} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Tasks */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  {filteredTasks.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">No tasks</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredTasks.map((task) => {
                        const cfg = CAT[task.category];
                        const Icon = cfg.icon;
                        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                        return (
                          <button
                            key={task.taskId}
                            onClick={() => onTaskClick({ taskId: task.taskId, taskName: task.taskName })}
                            className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors text-left group"
                          >
                            <Icon className={cn("h-4 w-4 shrink-0", cfg.text)} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground truncate group-hover:text-blue-600 transition-colors">{task.taskName}</div>
                              <div className="text-xs text-muted-foreground truncate mt-0.5">{task.boardName} · {task.workspaceName}</div>
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
                              {task.category === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right column: workspaces + team */}
              <div className="space-y-5">
                {/* Workspaces */}
                {data.workspaces.length > 0 && (
                  <div>
                    <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-blue-500" />
                      Workspaces ({data.workspaces.length})
                    </h2>
                    <div className="space-y-2">
                      {data.workspaces.map((ws) => (
                        <button
                          key={ws.workspaceId}
                          onClick={() => onWorkspaceClick?.(ws.workspaceId, ws.workspaceName)}
                          className="w-full rounded-xl border border-border bg-card p-3.5 text-left hover:border-blue-300 hover:shadow-sm transition-all group"
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="text-sm font-semibold text-foreground truncate group-hover:text-blue-600 transition-colors">{ws.workspaceName}</div>
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0",
                              ws.role === "OWNER" ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400" :
                              ws.role === "ADMIN" ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400" :
                              "bg-muted text-muted-foreground border-border"
                            )}>{ws.role}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><LayoutGrid className="h-3 w-3" /> {ws.boardCount} boards</span>
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {ws.memberCount} members</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Team members */}
                {data.team.length > 0 && (
                  <div>
                    <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      Team ({data.team.length})
                    </h2>
                    <div className="space-y-2">
                      {data.team.map((member) => {
                        const mPct = member.stats.totalTasks > 0
                          ? Math.round((member.stats.doneTasks / member.stats.totalTasks) * 100)
                          : 0;
                        const mColor = mPct >= 75 ? "#10b981" : mPct >= 40 ? "#3b82f6" : "#f59e0b";
                        return (
                          <button
                            key={member.userId}
                            onClick={() => onMemberClick?.(member.userId)}
                            className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-blue-300 hover:shadow-sm transition-all text-left group"
                          >
                            <Avatar className="h-9 w-9 shrink-0">
                              <AvatarImage src={member.avatarUrl ?? undefined} />
                              <AvatarFallback className="text-xs font-bold bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                                {initials(member.firstName, member.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-foreground truncate group-hover:text-blue-600 transition-colors">{member.firstName} {member.lastName}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${mPct}%`, background: mColor }} />
                                </div>
                                <span className="text-[10px] font-bold shrink-0" style={{ color: mColor }}>{mPct}%</span>
                              </div>
                            </div>
                            {member.stats.overdueTasks > 0 && (
                              <span className="text-[10px] font-bold text-red-600 shrink-0">{member.stats.overdueTasks} overdue</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
