"use client";

import { useAuth } from "@/providers/AuthProvider";
import {
  LayoutGrid, LayoutDashboard, Users, AlertCircle, Crown,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, type Variants } from "framer-motion";
import { useDashboardAggregates } from "./useDashboardData";

const ROLE_RANK: Record<string, number> = {
  OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1, GUEST: 0,
};
const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member", VIEWER: "Viewer", GUEST: "Guest",
};

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.46, ease: [0.22, 1, 0.36, 1] } },
};

export function DashboardStats() {
  const { user } = useAuth();
  const agg = useDashboardAggregates();

  if (!user) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  const workspaceCount = user.workspaceMemberships?.length ?? 0;
  const boardCount = user.boardMemberships?.length ?? 0;

  const topRole = (user.workspaceMemberships ?? []).reduce(
    (best: string, m: any) =>
      (ROLE_RANK[m.role] ?? 0) > (ROLE_RANK[best] ?? 0) ? m.role : best,
    "MEMBER",
  );

  const loadingData = agg.isLoading;

  const stats = [
    {
      label: "Total Workspaces",
      value: workspaceCount,
      subtitle: "Active workspaces",
      icon: <LayoutGrid className="h-5 w-5 text-violet-600" />,
      iconBg: "bg-violet-100",
      valueCn: "text-foreground",
      accent: "#7c3aed",
      pending: false,
    },
    {
      label: "Total Boards",
      value: boardCount,
      subtitle: "Across all workspaces",
      icon: <LayoutDashboard className="h-5 w-5 text-blue-600" />,
      iconBg: "bg-blue-100",
      valueCn: "text-foreground",
      accent: "#2563eb",
      pending: false,
    },
    {
      label: "Team Members",
      value: agg.teamMemberCount,
      subtitle: "Collaborators on your tasks",
      icon: <Users className="h-5 w-5 text-emerald-600" />,
      iconBg: "bg-emerald-100",
      valueCn: "text-foreground",
      accent: "#059669",
      pending: loadingData,
    },
    {
      label: "Overdue Tasks",
      value: agg.overdueCount,
      subtitle: agg.overdueCount > 0 ? "Need attention" : "All on track",
      icon: <AlertCircle className="h-5 w-5 text-rose-600" />,
      iconBg: "bg-rose-100",
      valueCn: agg.overdueCount > 0 ? "text-rose-600" : "text-foreground",
      accent: "#e11d48",
      pending: loadingData,
    },
    {
      label: "Highest Role",
      value: ROLE_LABEL[topRole] ?? "Member",
      subtitle: "Across all workspaces",
      icon: <Crown className="h-5 w-5 text-amber-600" />,
      iconBg: "bg-amber-100",
      valueCn: "text-amber-600",
      accent: "#d97706",
      pending: false,
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5"
    >
      {stats.map((s) => (
        <motion.div
          key={s.label}
          variants={item}
          whileHover={{ y: -5, boxShadow: "0 12px 28px rgba(99,102,241,0.15)" }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="group rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.iconBg}`}
            >
              {s.icon}
            </div>
            <div
              className="h-1 w-6 rounded-full"
              style={{ background: s.accent, opacity: 0.4 }}
            />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground">{s.label}</p>
          {s.pending ? (
            <Skeleton className="mt-1.5 h-8 w-12 rounded" />
          ) : (
            <p className={`mt-1 text-2xl font-bold tabular-nums ${s.valueCn}`}>{s.value}</p>
          )}
          <p className="mt-0.5 text-[11px] text-muted-foreground">{s.subtitle}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}
