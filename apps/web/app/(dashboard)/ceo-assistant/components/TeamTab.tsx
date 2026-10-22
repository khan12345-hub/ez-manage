"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, TrendingUp, CheckCircle2, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { searchManagementUsers } from "../management/management.api";
import type { TeamProgressItem, EmployeeTaskGroup } from "@/services/ceo-assistant.api";

interface Props {
  teamProgress: TeamProgressItem[];
  employees?: EmployeeTaskGroup[];
  onMemberClick: (userId: number) => void;
  onTaskClick: (task: { taskId: number; taskName: string }) => void;
  onWorkspaceClick?: (workspaceId: number, workspaceName: string) => void;
}

function initials(f: string, l: string) {
  return `${f[0] ?? ""}${l[0] ?? ""}`.toUpperCase();
}

function MemberCard({
  user,
  onClick,
}: {
  user: { id: number; firstName: string; lastName: string; email: string; avatarUrl: string | null };
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center transition-all hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 group"
    >
      <Avatar className="h-12 w-12 ring-2 ring-border group-hover:ring-blue-400 transition-all">
        <AvatarImage src={user.avatarUrl ?? undefined} />
        <AvatarFallback className="text-sm font-bold bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          {initials(user.firstName, user.lastName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 w-full">
        <div className="text-sm font-semibold text-foreground truncate">{user.firstName} {user.lastName}</div>
        <div className="text-xs text-muted-foreground truncate">{user.email}</div>
      </div>
      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
        View dashboard →
      </span>
    </button>
  );
}

function WorkspaceProgressCard({
  item, onClick,
}: { item: TeamProgressItem; onClick?: () => void }) {
  const total = item.totalTasks;
  const donePct    = total > 0 ? Math.round((item.doneTasks    / total) * 100) : 0;
  const overduePct = total > 0 ? Math.round((item.overdueTasks / total) * 100) : 0;
  const dueSoonPct = total > 0 ? Math.round((item.dueSoonTasks / total) * 100) : 0;
  const barColor   = donePct >= 75 ? "#10b981" : donePct >= 40 ? "#3b82f6" : "#f59e0b";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "rounded-xl border border-border bg-card p-4 text-left w-full",
        onClick
          ? "hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all group cursor-pointer"
          : "cursor-default"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarImage src={item.ownerAvatarUrl ?? undefined} />
            <AvatarFallback className="text-[10px] font-bold bg-gradient-to-br from-indigo-500 to-blue-600 text-white">
              {initials(item.ownerName.split(" ")[0] ?? "", item.ownerName.split(" ")[1] ?? "")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="text-sm font-bold text-foreground truncate">{item.workspaceName}</div>
            <div className="text-xs text-muted-foreground">{item.ownerName} · {item.memberCount} members</div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-lg font-black tabular-nums" style={{ color: barColor }}>{donePct}%</span>
          <div className="text-[10px] text-muted-foreground">done</div>
        </div>
      </div>

      {/* Segmented bar */}
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted gap-px">
        {donePct > 0 && (
          <div title={`Done: ${item.doneTasks}`} className="rounded-full" style={{ width: `${donePct}%`, background: "#10b981", minWidth: "3px" }} />
        )}
        {dueSoonPct > 0 && (
          <div title={`Due Soon: ${item.dueSoonTasks}`} style={{ width: `${dueSoonPct}%`, background: "#f59e0b", minWidth: "3px" }} />
        )}
        {overduePct > 0 && (
          <div title={`Overdue: ${item.overdueTasks}`} style={{ width: `${overduePct}%`, background: "#ef4444", minWidth: "3px" }} />
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mt-2.5 text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <span className="font-bold text-foreground">{item.totalTasks}</span> tasks
        </span>
        <span className="flex items-center gap-1 text-emerald-600">
          <CheckCircle2 className="h-3 w-3" /> {item.doneTasks}
        </span>
        {item.overdueTasks > 0 && (
          <span className="flex items-center gap-1 text-red-600">
            <AlertTriangle className="h-3 w-3" /> {item.overdueTasks}
          </span>
        )}
        {onClick && (
          <span className="ml-auto text-[10px] font-semibold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
            View workspace →
          </span>
        )}
      </div>
    </button>
  );
}

export function TeamTab({ teamProgress, employees = [], onMemberClick, onWorkspaceClick }: Props) {
  const [search, setSearch] = useState("");

  const { data: wsMembers, isLoading } = useQuery({
    queryKey: ["ceo-all-members"],
    queryFn: () => searchManagementUsers(""),
    staleTime: 120_000,
  });

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["ceo-member-search", search],
    queryFn: () => searchManagementUsers(search),
    enabled: search.length >= 1,
    staleTime: 30_000,
  });

  // Merge workspace members + task-assigned employees, deduped by id
  const allMembers = useMemo(() => {
    const map = new Map<number, { id: number; firstName: string; lastName: string; email: string; avatarUrl: string | null }>();
    for (const m of (wsMembers ?? [])) map.set(m.id, m);
    for (const e of employees) {
      if (!map.has(e.user.id)) map.set(e.user.id, { ...e.user, avatarUrl: e.user.avatarUrl ?? null });
    }
    return [...map.values()];
  }, [wsMembers, employees]);

  const displayed = search.length >= 1 ? (searchResults ?? []) : allMembers;
  const loading = search.length >= 1 ? isSearching : isLoading;

  return (
    <div className="space-y-6 mt-5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search any team member by name or email…"
          className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {loading && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        )}
      </div>

      {/* Team member cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Users className="h-4 w-4 text-blue-500" />
            Team Members
            {!loading && <span className="text-muted-foreground font-normal">({displayed.length})</span>}
          </h3>
          {search.length >= 1 && !loading && displayed.length === 0 && (
            <span className="text-xs text-muted-foreground">No results for "{search}"</span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : displayed.length === 0 && search.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No team members found</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {displayed.map((user) => (
              <MemberCard key={user.id} user={user} onClick={() => onMemberClick(user.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Team progress */}
      {teamProgress.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground mb-3">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Workspace Progress
            <span className="text-muted-foreground font-normal">({teamProgress.length})</span>
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {teamProgress.map((item) => (
              <WorkspaceProgressCard
                key={item.workspaceId}
                item={item}
                onClick={onWorkspaceClick ? () => onWorkspaceClick(item.workspaceId, item.workspaceName) : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
