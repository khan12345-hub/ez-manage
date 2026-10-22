"use client";

import { useMemo } from "react";
import { BrainCircuit, AlertTriangle, Zap, Users2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { EmployeeTaskGroup, TeamProgressItem } from "@/services/ceo-assistant.api";

interface Props {
  employees: EmployeeTaskGroup[];
  teamProgress: TeamProgressItem[];
  stats: { overdueCount: number; dueSoonCount: number; inactiveCount: number; employeeCount: number };
  summary?: { workspaceCount: number; boardCount: number; teamMemberCount: number } | null;
  isLoading: boolean;
  onMemberClick: (userId: number) => void;
  onWorkspaceClick: (workspaceId: number, workspaceName: string) => void;
}

function generateBriefing(
  employees: EmployeeTaskGroup[],
  teamProgress: TeamProgressItem[],
  stats: Props["stats"],
  summary?: Props["summary"] | null,
): string {
  if (!employees.length && !teamProgress.length) return "No task data available yet. Assign tasks to team members to see insights.";

  const parts: string[] = [];
  const teamCount  = summary?.teamMemberCount ?? employees.length;
  const wsCount    = summary?.workspaceCount  ?? teamProgress.length;
  const totalTasks = teamProgress.reduce((s, w) => s + w.totalTasks, 0);
  const totalDone  = teamProgress.reduce((s, w) => s + w.doneTasks,  0);
  const donePct    = totalTasks > 0 ? Math.round((totalDone  / totalTasks) * 100) : 0;
  const overduePct = totalTasks > 0 ? Math.round((stats.overdueCount / totalTasks) * 100) : 0;

  if (stats.overdueCount === 0) {
    parts.push(`Your team of ${teamCount} is on track — no overdue tasks across ${wsCount} workspace${wsCount !== 1 ? "s" : ""}.`);
  } else {
    parts.push(`Your team of ${teamCount} has ${stats.overdueCount} overdue task${stats.overdueCount !== 1 ? "s" : ""} (${overduePct}% of all work) across ${wsCount} workspace${wsCount !== 1 ? "s" : ""}.`);
  }

  const riskWs = [...teamProgress]
    .filter(w => w.totalTasks > 0 && w.overdueTasks > 0)
    .sort((a, b) => (b.overdueTasks / b.totalTasks) - (a.overdueTasks / a.totalTasks))[0];
  if (riskWs) {
    const rPct = Math.round((riskWs.overdueTasks / riskWs.totalTasks) * 100);
    parts.push(`${riskWs.workspaceName} has the highest risk with ${rPct}% overdue tasks.`);
  }

  const topMember = [...employees].sort((a, b) => b.overdue.length - a.overdue.length)[0];
  if (topMember && topMember.overdue.length > 0) {
    parts.push(`${topMember.user.firstName} ${topMember.user.lastName} has ${topMember.overdue.length} overdue task${topMember.overdue.length !== 1 ? "s" : ""} — needs immediate attention.`);
  }

  if (totalDone > 0) parts.push(`${totalDone} task${totalDone !== 1 ? "s" : ""} completed overall (${donePct}%).`);
  if (stats.inactiveCount > 0) parts.push(`${stats.inactiveCount} task${stats.inactiveCount !== 1 ? "s" : ""} have had no recent activity.`);

  return parts.join(" ");
}

export function AiInsightsPanel({
  employees, teamProgress, stats, summary, isLoading, onMemberClick, onWorkspaceClick,
}: Props) {

  const briefing = useMemo(
    () => generateBriefing(employees, teamProgress, stats, summary),
    [employees, teamProgress, stats, summary],
  );

  const riskWorkspaces = useMemo(() =>
    teamProgress
      .filter(w => w.totalTasks > 0 && w.overdueTasks > 0)
      .map(w => ({
        ...w,
        overduePct: Math.round((w.overdueTasks / w.totalTasks) * 100),
        level: (w.overdueTasks / w.totalTasks > 0.30 ? "high" : "medium") as "high" | "medium",
      }))
      .filter(w => w.overduePct >= 15)
      .sort((a, b) => b.overduePct - a.overduePct),
    [teamProgress],
  );

  const riskMembers = useMemo(() =>
    employees
      .filter(e => e.overdue.length >= 3)
      .map(e => ({
        ...e,
        level: (e.overdue.length >= 5 ? "high" : "medium") as "high" | "medium",
      }))
      .sort((a, b) => b.overdue.length - a.overdue.length)
      .slice(0, 4),
    [employees],
  );

  const focusItems = useMemo(() =>
    [...employees]
      .map(e => ({ ...e, score: e.overdue.length * 3 + e.dueSoon.length * 1.5 + e.inactive.length * 0.5 }))
      .filter(e => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6),
    [employees],
  );

  const workloadItems = useMemo(() => {
    const items = [...employees]
      .map(e => ({
        ...e,
        overduePct: e.totalCount > 0 ? (e.overdue.length / e.totalCount) * 100 : 0,
      }))
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, 8);
    const max = Math.max(...items.map(i => i.totalCount), 1);
    return items.map(i => ({ ...i, barWidth: Math.max((i.totalCount / max) * 100, i.totalCount > 0 ? 5 : 0) }));
  }, [employees]);

  const hasRisks = riskWorkspaces.length > 0 || riskMembers.length > 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-52 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* AI Briefing */}
      <div
        className="rounded-2xl border border-violet-200/70 dark:border-violet-900/50 overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.07) 0%, rgba(59,130,246,0.04) 100%)" }}
      >
        <div className="px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500 shadow-sm mt-0.5">
              <BrainCircuit className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold text-violet-700 dark:text-violet-400 uppercase tracking-wider">
                  AI Intelligence Briefing
                </span>
                <span className="rounded-full bg-violet-100 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-800 px-1.5 py-0.5 text-[9px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                  Live
                </span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{briefing}</p>
            </div>
          </div>

          {/* Risk Alerts row */}
          {hasRisks && (
            <div className="mt-3 pt-3 border-t border-violet-200/40 dark:border-violet-800/30">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Risk Alerts</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {riskWorkspaces.map(ws => (
                  <button
                    key={ws.workspaceId}
                    onClick={() => onWorkspaceClick(ws.workspaceId, ws.workspaceName)}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors hover:shadow-sm",
                      ws.level === "high"
                        ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400"
                        : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400",
                    )}
                  >
                    <span>{ws.level === "high" ? "🔴" : "🟡"}</span>
                    {ws.workspaceName}
                    <span className="opacity-60 ml-0.5">· {ws.overduePct}% overdue</span>
                  </button>
                ))}
                {riskMembers.map(m => (
                  <button
                    key={m.user.id}
                    onClick={() => onMemberClick(m.user.id)}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors hover:shadow-sm",
                      m.level === "high"
                        ? "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/30 dark:border-orange-900 dark:text-orange-400"
                        : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400",
                    )}
                  >
                    🟠 {m.user.firstName} {m.user.lastName}
                    <span className="opacity-60 ml-0.5">· {m.overdue.length} overdue</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Focus Today + Workload Balance */}
      {(focusItems.length > 0 || workloadItems.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Focus Today */}
          {focusItems.length > 0 && (
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-bold text-foreground">Focus Today</span>
                <span className="ml-auto text-[10px] text-muted-foreground">Ranked by urgency</span>
              </div>
              <div className="divide-y divide-border">
                {focusItems.map((item, idx) => (
                  <button
                    key={item.user.id}
                    onClick={() => onMemberClick(item.user.id)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors text-left group"
                  >
                    <span className="text-xs font-black tabular-nums text-muted-foreground w-4 shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white">
                      {item.user.firstName[0]}{item.user.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-foreground group-hover:text-blue-600 transition-colors truncate">
                        {item.user.firstName} {item.user.lastName}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {item.overdue.length > 0 && (
                          <span className="text-[10px] text-red-600 font-semibold">{item.overdue.length} overdue</span>
                        )}
                        {item.dueSoon.length > 0 && (
                          <span className="text-[10px] text-amber-600">{item.dueSoon.length} due soon</span>
                        )}
                        {item.inactive.length > 0 && (
                          <span className="text-[10px] text-slate-500">{item.inactive.length} inactive</span>
                        )}
                      </div>
                    </div>
                    <span className={cn(
                      "shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full",
                      item.overdue.length >= 5
                        ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                        : item.overdue.length >= 3
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                    )}>
                      {item.overdue.length >= 5 ? "Critical" : item.overdue.length >= 3 ? "High" : "Medium"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Workload Balance */}
          {workloadItems.length > 0 && (
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
                <Users2 className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-bold text-foreground">Workload Balance</span>
                <span className="ml-auto text-[10px] text-muted-foreground">Tasks per member</span>
              </div>
              <div className="px-5 py-4 space-y-3.5">
                {workloadItems.map(item => {
                  const barColor = item.overduePct > 30 ? "#ef4444" : item.overduePct > 15 ? "#f59e0b" : "#3b82f6";
                  return (
                    <button
                      key={item.user.id}
                      onClick={() => onMemberClick(item.user.id)}
                      className="w-full text-left group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground group-hover:text-blue-600 transition-colors truncate max-w-[60%]">
                          {item.user.firstName} {item.user.lastName}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {item.overdue.length > 0 && (
                            <span className="text-[10px] font-bold text-red-600">{item.overdue.length} overdue</span>
                          )}
                          <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                            {item.totalCount} tasks
                          </span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${item.barWidth}%`, background: barColor }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
