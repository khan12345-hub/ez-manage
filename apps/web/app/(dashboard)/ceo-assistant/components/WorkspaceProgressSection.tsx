"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { TeamProgressItem } from "@/services/ceo-assistant.api";

interface Props {
  teamProgress: TeamProgressItem[];
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-bold tabular-nums w-8 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

export function WorkspaceProgressSection({ teamProgress }: Props) {
  if (teamProgress.length === 0) return null;

  const overall = {
    total: teamProgress.reduce((s, w) => s + w.totalTasks, 0),
    done: teamProgress.reduce((s, w) => s + w.doneTasks, 0),
    overdue: teamProgress.reduce((s, w) => s + w.overdueTasks, 0),
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Team Progress</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Task completion by workspace</p>
        </div>
        {overall.total > 0 && (
          <div className="flex items-center gap-4 text-xs">
            <span className="text-emerald-600 font-semibold">{overall.done} done</span>
            <span className="text-red-500 font-semibold">{overall.overdue} overdue</span>
            <span className="text-muted-foreground">{overall.total} total</span>
          </div>
        )}
      </div>

      <div className="divide-y divide-border">
        {teamProgress.map((ws) => {
          const pct = ws.totalTasks > 0 ? Math.round((ws.doneTasks / ws.totalTasks) * 100) : 0;
          const progressColor = pct >= 75 ? "#10b981" : pct >= 40 ? "#3b82f6" : "#f59e0b";

          return (
            <div key={ws.workspaceId} className="px-5 py-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="h-8 w-8 ring-2 ring-border">
                  <AvatarImage src={ws.ownerAvatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs font-bold bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                    {initials(ws.ownerName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">{ws.ownerName}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground truncate">{ws.workspaceName}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span>{ws.memberCount} member{ws.memberCount !== 1 ? "s" : ""}</span>
                    <span>·</span>
                    <span>{ws.totalTasks} task{ws.totalTasks !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold tabular-nums" style={{ color: progressColor }}>{pct}%</div>
                  <div className="text-[10px] text-muted-foreground">complete</div>
                </div>
              </div>

              <ProgressBar value={ws.doneTasks} max={ws.totalTasks} color={progressColor} />

              <div className="flex gap-4 mt-2.5 text-xs">
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" />
                  {ws.doneTasks} done
                </span>
                {ws.overdueTasks > 0 && (
                  <span className="flex items-center gap-1 text-red-500 font-medium">
                    <span className="inline-block w-2 h-2 rounded-sm bg-red-400" />
                    {ws.overdueTasks} overdue
                  </span>
                )}
                {ws.dueSoonTasks > 0 && (
                  <span className="flex items-center gap-1 text-amber-600 font-medium">
                    <span className="inline-block w-2 h-2 rounded-sm bg-amber-400" />
                    {ws.dueSoonTasks} due soon
                  </span>
                )}
                {ws.totalTasks - ws.doneTasks - ws.overdueTasks - ws.dueSoonTasks > 0 && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <span className="inline-block w-2 h-2 rounded-sm bg-slate-300" />
                    {ws.totalTasks - ws.doneTasks - ws.overdueTasks - ws.dueSoonTasks} remaining
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
