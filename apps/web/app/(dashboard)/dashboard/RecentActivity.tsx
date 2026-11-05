"use client";

import { motion } from "framer-motion";
import { Clock, MessageSquare, Activity as ActivityIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardActivity } from "./useDashboardData";
import type { ActivityItem } from "@/services/tasks.api";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const ACTION_VERB: Record<string, string> = {
  CREATED: "created",
  UPDATED: "updated",
  DELETED: "deleted",
  ASSIGNED: "was assigned",
  UNASSIGNED: "was unassigned from",
  STATUS_CHANGED: "changed the status of",
  FILE_ADDED: "added a file to",
  COMMENT_ADDED: "commented on",
  MOVED: "moved",
  REORDERED: "reordered",
};

function describe(item: ActivityItem) {
  const taskName = item.task?.name ?? "a task";
  if (item.kind === "comment") {
    return { verb: "commented on", target: taskName, icon: "comment" as const };
  }
  const verb = ACTION_VERB[item.action ?? ""] ?? (item.action?.toLowerCase().replace(/_/g, " ") ?? "updated");
  return { verb, target: taskName, icon: "log" as const };
}

export function RecentActivity() {
  const { items, isLoading } = useDashboardActivity();

  return (
    <div
      className="rounded-2xl bg-card"
      style={{
        border: "1px solid rgba(99, 102, 241, 0.1)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
      <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid rgba(99,102,241,0.07)" }}>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "rgba(99,102,241,0.1)" }}>
          <Clock className="h-4 w-4 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
      </div>

      <div className="px-5 py-4">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-full rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ActivityIcon className="h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm font-medium text-muted-foreground">No recent activity</p>
            <p className="text-xs text-muted-foreground">Your task updates will show up here.</p>
          </div>
        ) : (
          <ol className="relative space-y-4">
            {items.map((item, idx) => {
              const d = describe(item);
              return (
                <motion.li
                  key={`${item.kind}-${item.id}`}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.35 }}
                  className="flex gap-3"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: d.icon === "comment" ? "rgba(217,70,239,0.1)" : "rgba(99,102,241,0.1)",
                    }}
                  >
                    {d.icon === "comment" ? (
                      <MessageSquare className="h-3.5 w-3.5 text-fuchsia-500" />
                    ) : (
                      <ActivityIcon className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-muted-foreground">
                      You <span className="text-muted-foreground">{d.verb}</span>{" "}
                      <span className="font-medium text-foreground">{d.target}</span>
                    </p>
                    {item.task?.group?.board?.name && (
                      <p className="truncate text-xs text-muted-foreground">
                        {item.task.group.board.name}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(item.createdAt)}</p>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
