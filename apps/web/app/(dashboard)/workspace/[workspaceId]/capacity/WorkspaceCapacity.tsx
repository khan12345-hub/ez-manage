"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, ChevronDown, ChevronRight, Lock } from "lucide-react";
import { getWorkspaceCapacity, CapacityMember, CapacityTask } from "@/services/workspace.api";
import { useTaskDetailsStore } from "@/store/task-details-store";
import { useInviteModalStore } from "@/store/invite-modal";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/resolveUrl";

interface Props {
  workspaceId: string | number;
}

function workloadLevel(total: number): "empty" | "light" | "medium" | "heavy" | "overloaded" {
  if (total === 0) return "empty";
  if (total <= 3) return "light";
  if (total <= 6) return "medium";
  if (total <= 10) return "heavy";
  return "overloaded";
}

const LEVEL_STYLES = {
  empty:      { bar: "bg-muted", text: "text-muted-foreground", label: "No tasks" },
  light:      { bar: "bg-emerald-500", text: "text-emerald-600", label: "Light" },
  medium:     { bar: "bg-yellow-400", text: "text-yellow-600", label: "Medium" },
  heavy:      { bar: "bg-orange-500", text: "text-orange-600", label: "Heavy" },
  overloaded: { bar: "bg-destructive", text: "text-destructive", label: "Overloaded" },
};

function Avatar({ user }: { user: CapacityMember["user"] }) {
  const [err, setErr] = useState(false);
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
  return (
    <div className="h-8 w-8 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary overflow-hidden">
      {user.avatarUrl && !err ? (
        <img
          src={resolveUrl(user.avatarUrl)}
          alt={initials}
          className="h-full w-full object-cover"
          onError={() => setErr(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
}

function StatusPill({ label, color }: { label: string | null; color: string | null }) {
  if (!label) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-px text-[10px] font-medium text-white"
      style={{ backgroundColor: color ?? "#6b7280" }}
    >
      {label}
    </span>
  );
}

function DueDateBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return <span className="text-xs text-muted-foreground">No date</span>;
  const d = new Date(dueDate);
  const now = new Date();
  const isOverdue = d < now;
  const isSoon = !isOverdue && d.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000;
  return (
    <span className={cn(
      "text-xs font-medium",
      isOverdue ? "text-destructive" : isSoon ? "text-orange-500" : "text-muted-foreground",
    )}>
      {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
    </span>
  );
}

function MemberRow({ member }: { member: CapacityMember }) {
  const [expanded, setExpanded] = useState(false);
  const { open } = useTaskDetailsStore();
  const level = workloadLevel(member.totalTasks);
  const styles = LEVEL_STYLES[level];
  const barPct = Math.min((member.totalTasks / 12) * 100, 100);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Member header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors text-left"
      >
        <Avatar user={member.user} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold">
              {member.user.firstName} {member.user.lastName}
            </span>
            <div className="flex items-center gap-3 shrink-0 ml-4">
              {/* Breakdown pills */}
              {member.overdueTasks > 0 && (
                <span className="text-[11px] font-medium text-destructive">
                  {member.overdueTasks} overdue
                </span>
              )}
              {member.dueSoonTasks > 0 && (
                <span className="text-[11px] font-medium text-orange-500">
                  {member.dueSoonTasks} due soon
                </span>
              )}
              <span className={cn("text-[11px] font-semibold", styles.text)}>
                {member.totalTasks} task{member.totalTasks !== 1 ? "s" : ""}
              </span>
              <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted", styles.text)}>
                {styles.label}
              </span>
            </div>
          </div>

          {/* Workload bar */}
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", styles.bar)}
              style={{ width: `${barPct}%` }}
            />
          </div>
        </div>

        {member.totalTasks > 0 && (
          <div className="shrink-0 text-muted-foreground">
            {expanded
              ? <ChevronDown className="h-4 w-4" />
              : <ChevronRight className="h-4 w-4" />
            }
          </div>
        )}
      </button>

      {/* Task list */}
      {expanded && member.tasks.length > 0 && (
        <div className="border-t border-border">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 border-b border-border">
            <span>Task</span>
            <span>Board · Group</span>
            <span>Status</span>
            <span>Due</span>
          </div>
          {member.tasks.map((task: CapacityTask) => (
            <button
              key={task.id}
              onClick={() => open({ taskId: task.id, boardId: task.boardId, groupId: task.groupId })}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-4 w-full px-5 py-2.5 text-left text-xs hover:bg-muted/40 transition-colors border-b border-border/50 last:border-0 items-center"
            >
              <span className="truncate font-medium">{task.name}</span>
              <span className="text-muted-foreground shrink-0 max-w-[160px] truncate">
                {task.boardName}
                <span className="text-muted-foreground/50 mx-1">·</span>
                {task.groupName}
              </span>
              <StatusPill label={task.statusLabel} color={task.statusColor} />
              <DueDateBadge dueDate={task.dueDate} />
            </button>
          ))}
        </div>
      )}

      {expanded && member.totalTasks === 0 && (
        <div className="px-5 py-3 text-xs text-muted-foreground border-t border-border">
          No tasks assigned
        </div>
      )}
    </div>
  );
}

export default function WorkspaceCapacity({ workspaceId }: Props) {
  const [sortBy, setSortBy] = useState<"busiest" | "lightest" | "name">("busiest");
  const { workspaceRole } = useInviteModalStore();
  const isManagerRole = workspaceRole === "OWNER" || workspaceRole === "ADMIN";

  if (!isManagerRole && workspaceRole) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Access restricted</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Capacity Planning is only available to workspace admins and owners.
          </p>
        </div>
      </div>
    );
  }

  const { data = [], isLoading } = useQuery({
    queryKey: ["workspace-capacity", workspaceId],
    queryFn: () => getWorkspaceCapacity(workspaceId),
    staleTime: 60_000,
  });

  const sorted = [...data].sort((a, b) => {
    if (sortBy === "busiest") return b.totalTasks - a.totalTasks;
    if (sortBy === "lightest") return a.totalTasks - b.totalTasks;
    return `${a.user.firstName} ${a.user.lastName}`.localeCompare(`${b.user.firstName} ${b.user.lastName}`);
  });

  const totalAssigned = data.reduce((s, m) => s + m.totalTasks, 0);
  const overloadedCount = data.filter((m) => m.totalTasks > 10).length;
  const unassignedCount = data.filter((m) => m.totalTasks === 0).length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h1 className="text-sm font-semibold">Capacity Planning</h1>
        <span className="text-xs text-muted-foreground">· {data.length} members</span>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-5">
        {/* Stats row */}
        {!isLoading && data.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Team members", value: data.length },
              { label: "Total tasks assigned", value: totalAssigned },
              { label: "Overloaded (10+)", value: overloadedCount, danger: overloadedCount > 0 },
              { label: "No tasks", value: unassignedCount },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
                <p className={cn("text-2xl font-bold tabular-nums", s.danger ? "text-destructive" : "")}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Sort control */}
        {!isLoading && data.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort:</span>
            {(["busiest", "lightest", "name"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
                  sortBy === opt
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {opt === "busiest" ? "Busiest first" : opt === "lightest" ? "Lightest first" : "Name A–Z"}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        )}

        {/* Member rows */}
        {!isLoading && (
          <div className="flex flex-col gap-3">
            {sorted.map((member) => (
              <MemberRow key={member.user.id} member={member} />
            ))}
          </div>
        )}

        {!isLoading && data.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-16">
            No members found in this workspace.
          </p>
        )}
      </div>
    </div>
  );
}
