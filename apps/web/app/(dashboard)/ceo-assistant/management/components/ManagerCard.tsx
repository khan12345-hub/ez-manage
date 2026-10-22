"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { hideMember, showMember } from "../management.api";
import type { ManagementMember } from "../management.api";

interface Props {
  member: ManagementMember;
  hidden?: boolean;
  onClick: () => void;
}

function initials(f: string, l: string) {
  return `${f[0] ?? ""}${l[0] ?? ""}`.toUpperCase();
}

function StatPill({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold", cls)}>
      {value} {label}
    </span>
  );
}

export function ManagerCard({ member, hidden = false, onClick }: Props) {
  const queryClient = useQueryClient();

  const hideMutation = useMutation({
    mutationFn: () => (hidden ? showMember(member.userId) : hideMember(member.userId)),
    onSuccess: () => {
      toast.success(hidden ? "Member shown." : "Member hidden.");
      queryClient.invalidateQueries({ queryKey: ["ceo-management-team"] });
    },
  });

  const primaryRole = member.workspaces[0]?.role ?? (member.addedManually ? "Added manually" : "Member");
  const primaryWorkspace = member.workspaces[0]?.workspaceName ?? "";
  const pct = member.stats.totalTasks > 0
    ? Math.round((member.stats.doneTasks / member.stats.totalTasks) * 100)
    : 0;

  return (
    <div className={cn("group relative rounded-xl border bg-card transition-all hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900", hidden ? "opacity-60" : "")}>
      {/* Hide / Show button */}
      <button
        onClick={(e) => { e.stopPropagation(); hideMutation.mutate(); }}
        disabled={hideMutation.isPending}
        className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground z-10"
        title={hidden ? "Show in management team" : "Hide from management team"}
      >
        {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </button>

      <button onClick={onClick} className="w-full text-left p-4">
        {/* Avatar + name */}
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10 ring-2 ring-border">
            <AvatarImage src={member.avatarUrl ?? undefined} />
            <AvatarFallback className="text-sm font-bold bg-gradient-to-br from-indigo-500 to-blue-600 text-white">
              {initials(member.firstName, member.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-foreground truncate">
              {member.firstName} {member.lastName}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                primaryRole === "OWNER" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" :
                primaryRole === "ADMIN" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400" :
                "bg-muted text-muted-foreground"
              )}>
                {primaryRole}
              </span>
              {primaryWorkspace && (
                <span className="text-xs text-muted-foreground truncate">{primaryWorkspace}</span>
              )}
            </div>
          </div>
        </div>

        {/* Mini progress bar */}
        {member.stats.totalTasks > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>Task completion</span>
              <span className="font-bold">{pct}%</span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: pct >= 75 ? "#10b981" : pct >= 40 ? "#3b82f6" : "#f59e0b",
                }}
              />
            </div>
          </div>
        )}

        {/* Stat pills */}
        <div className="flex flex-wrap gap-1.5">
          {member.stats.overdueTasks > 0 && (
            <StatPill label="overdue" value={member.stats.overdueTasks} cls="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400" />
          )}
          {member.stats.doneTasks > 0 && (
            <StatPill label="done" value={member.stats.doneTasks} cls="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400" />
          )}
          <StatPill label="total" value={member.stats.totalTasks} cls="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-400" />
          {member.stats.inactiveTasks > 0 && (
            <StatPill label="inactive" value={member.stats.inactiveTasks} cls="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400" />
          )}
        </div>

        {member.workspaces.length > 1 && (
          <div className="mt-2 text-[10px] text-muted-foreground">
            +{member.workspaces.length - 1} more workspace{member.workspaces.length > 2 ? "s" : ""}
          </div>
        )}
      </button>
    </div>
  );
}
