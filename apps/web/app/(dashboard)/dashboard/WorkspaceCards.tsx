"use client";

import Link from "next/link";
import { ArrowUpRight, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { Skeleton } from "@/components/ui/skeleton";

const WORKSPACE_COLORS = [
  "from-violet-500 to-indigo-600",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-fuchsia-500 to-purple-600",
];

const ROLE_BADGE: Record<string, { label: string; cn: string }> = {
  OWNER:  { label: "Owner",  cn: "bg-amber-100 text-amber-700 border-amber-200" },
  ADMIN:  { label: "Admin",  cn: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  MEMBER: { label: "Member", cn: "bg-muted text-muted-foreground border-border" },
  VIEWER: { label: "Viewer", cn: "bg-muted text-muted-foreground border-border" },
  GUEST:  { label: "Guest",  cn: "bg-muted text-muted-foreground border-border" },
};

export function WorkspaceCards() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-32 rounded bg-muted animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const memberships: any[] = user.workspaceMemberships ?? [];

  if (memberships.length === 0) {
    return (
      <section>
        <SectionTitle title="My Workspaces" subtitle="Workspaces you belong to" />
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-background py-14 text-center">
          <LayoutDashboard className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No workspaces yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Ask your admin to invite you to a workspace.</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionTitle title="My Workspaces" subtitle="Workspaces you belong to" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {memberships.map((m: any, idx: number) => {
          const ws = m.workspace;
          const colorGradient = WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length];
          const roleBadge = ROLE_BADGE[m.role] ?? ROLE_BADGE.MEMBER;

          const boardsInWs = (user.boardMemberships ?? []).filter(
            (bm: any) => bm.board?.workspace?.id === ws.id,
          );

          return (
            <Link
              key={ws.id}
              href={`/workspace/${ws.id}`}
              className="group relative overflow-hidden rounded-2xl border bg-background shadow-sm transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
            >
              {/* Colored top accent */}
              <div className={`h-1.5 w-full bg-gradient-to-r ${colorGradient}`} />

              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${colorGradient} text-white shadow-sm`}>
                      <span className="text-base font-bold">
                        {ws.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{ws.name}</p>
                      {ws.description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{ws.description}</p>
                      )}
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    <span>
                      {boardsInWs.length} {boardsInWs.length === 1 ? "board" : "boards"}
                    </span>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${roleBadge.cn}`}>
                    {roleBadge.label}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}
