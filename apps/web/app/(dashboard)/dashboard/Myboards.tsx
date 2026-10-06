"use client";

import Link from "next/link";
import { ChevronRight, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { Skeleton } from "@/components/ui/skeleton";

const ROLE_BADGE: Record<string, { label: string; cn: string }> = {
  OWNER:  { label: "Owner",  cn: "bg-amber-100 text-amber-700 border-amber-200" },
  ADMIN:  { label: "Admin",  cn: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  MEMBER: { label: "Member", cn: "bg-slate-100 text-slate-600 border-slate-200" },
  VIEWER: { label: "Viewer", cn: "bg-gray-100 text-gray-500 border-gray-200" },
  GUEST:  { label: "Guest",  cn: "bg-zinc-100 text-zinc-500 border-zinc-200" },
};

const WS_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500",
  "bg-amber-500",  "bg-rose-500", "bg-fuchsia-500",
];

function wsColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return WS_COLORS[Math.abs(h) % WS_COLORS.length];
}

export function MyBoards() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-24 rounded bg-muted animate-pulse" />
        <div className="overflow-hidden rounded-2xl border bg-background shadow-sm divide-y">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const memberships: any[] = user.boardMemberships ?? [];

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">My Boards</h2>
          <p className="text-sm text-muted-foreground">All boards you have access to</p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {memberships.length}
        </span>
      </div>

      {memberships.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-background py-14 text-center">
          <LayoutDashboard className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No boards yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Create a board or ask a workspace admin to add you.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
          {memberships.map((m: any) => {
            const board = m.board;
            const workspace = board.workspace;
            const roleBadge = ROLE_BADGE[m.role] ?? ROLE_BADGE.MEMBER;
            const dotColor = wsColor(workspace?.name ?? "");

            return (
              <Link
                key={board.id}
                href={`/workspace/${workspace.id}/board/${board.id}`}
                className="group flex w-full items-center gap-4 border-b px-5 py-3.5 text-left transition last:border-0 hover:bg-muted/40"
              >
                {/* Workspace color dot + board icon */}
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${dotColor}`}>
                  <LayoutDashboard className="h-4 w-4 text-white" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{board.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{workspace?.name}</p>
                </div>

                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${roleBadge.cn}`}>
                  {roleBadge.label}
                </span>

                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
