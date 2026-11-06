"use client";

import Link from "next/link";
import { ArrowUpRight, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, type Variants } from "framer-motion";

const WORKSPACE_COLORS = [
  "from-violet-500 to-primary",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-fuchsia-500 to-purple-600",
];

const ROLE_BADGE: Record<string, { label: string; cn: string }> = {
  OWNER:  { label: "Owner",  cn: "bg-amber-100 text-amber-700 border-amber-200" },
  ADMIN:  { label: "Admin",  cn: "bg-primary/10 text-primary border-primary/25" },
  MEMBER: { label: "Member", cn: "bg-muted text-muted-foreground border-border" },
  VIEWER: { label: "Viewer", cn: "bg-muted text-muted-foreground border-border" },
  GUEST:  { label: "Guest",  cn: "bg-muted text-muted-foreground border-border" },
};

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
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
        <SectionTitle title="My Workspaces" subtitle="Workspaces you belong to" count={0} />
        <div
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card py-14 text-center"
          style={{ borderColor: "rgba(4,120,87,0.25)" }}
        >
          <LayoutDashboard className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No workspaces yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Ask your admin to invite you to a workspace.</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionTitle title="My Workspaces" subtitle="Workspaces you belong to" count={memberships.length} />
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {memberships.map((m: any, idx: number) => {
          const ws = m.workspace;
          const colorGradient = WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length];
          const roleBadge = ROLE_BADGE[m.role] ?? ROLE_BADGE.MEMBER;

          const boardsInWs = (user.boardMemberships ?? []).filter(
            (bm: any) => bm.board?.workspace?.id === ws.id,
          );

          return (
            <motion.div key={ws.id} variants={item} whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
              <Link
                href={`/workspace/${(ws as any).uid ?? ws.id}`}
                className="group relative block overflow-hidden rounded-2xl bg-card transition-shadow hover:shadow-lg"
                style={{
                  border: "1px solid rgba(4,120,87,0.1)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}
              >
                {/* Colored top accent */}
                <div className={`h-1.5 w-full bg-gradient-to-r ${colorGradient}`} />

                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${colorGradient} text-white shadow-sm`}
                      >
                        <span className="text-base font-bold">
                          {ws.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{ws.name}</p>
                        {ws.description && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {ws.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      <span>
                        {boardsInWs.length}{" "}
                        {boardsInWs.length === 1 ? "board" : "boards"}
                      </span>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${roleBadge.cn}`}
                    >
                      {roleBadge.label}
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}

function SectionTitle({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle: string;
  count?: number;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h2 className="font-serif text-[21px] font-normal leading-none">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {count !== undefined && (
        <span
          className="rounded-full bg-accent px-2.5 py-0.5 font-mono text-xs font-medium text-accent-foreground"
        >
          {count}
        </span>
      )}
    </div>
  );
}
