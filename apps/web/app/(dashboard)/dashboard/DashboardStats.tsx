"use client";

import { useAuth } from "@/providers/AuthProvider";
import { FolderKanban, LayoutDashboard, ShieldCheck, Crown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const ROLE_RANK: Record<string, number> = {
  OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1, GUEST: 0,
};

export function DashboardStats() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  const workspaceCount = user.workspaceMemberships?.length ?? 0;
  const boardCount = user.boardMemberships?.length ?? 0;

  const leadingBoards = (user.boardMemberships ?? []).filter(
    (m: any) => m.role === "OWNER" || m.role === "ADMIN",
  ).length;

  const topRole = (user.workspaceMemberships ?? []).reduce(
    (best: string, m: any) =>
      (ROLE_RANK[m.role] ?? 0) > (ROLE_RANK[best] ?? 0) ? m.role : best,
    "MEMBER",
  );

  const ROLE_LABEL: Record<string, string> = {
    OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member", VIEWER: "Viewer", GUEST: "Guest",
  };

  const stats = [
    {
      label: "My Workspaces",
      value: workspaceCount,
      subtitle: workspaceCount === 1 ? "workspace" : "workspaces joined",
      icon: <FolderKanban className="h-5 w-5 text-violet-600" />,
      iconBg: "bg-violet-100",
      valueCn: "text-violet-700",
    },
    {
      label: "My Boards",
      value: boardCount,
      subtitle: boardCount === 1 ? "board" : "boards across all workspaces",
      icon: <LayoutDashboard className="h-5 w-5 text-blue-600" />,
      iconBg: "bg-blue-100",
      valueCn: "text-blue-700",
    },
    {
      label: "Boards Leading",
      value: leadingBoards,
      subtitle: "as Owner or Admin",
      icon: <ShieldCheck className="h-5 w-5 text-emerald-600" />,
      iconBg: "bg-emerald-100",
      valueCn: "text-emerald-700",
    },
    {
      label: "Highest Role",
      value: ROLE_LABEL[topRole] ?? "Member",
      subtitle: "across all workspaces",
      icon: <Crown className="h-5 w-5 text-amber-600" />,
      iconBg: "bg-amber-100",
      valueCn: "text-amber-700",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="group rounded-2xl border bg-background p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <p className={`mt-1.5 text-2xl font-bold ${s.valueCn}`}>{s.value}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{s.subtitle}</p>
            </div>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.iconBg}`}>
              {s.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
