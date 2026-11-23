"use client";

/* Shared Work (ClickUp-style) building blocks — Ledger design. */

import { Check, Flag } from "lucide-react";
import { resolveUrl } from "@/lib/resolveUrl";
import { cn } from "@/lib/utils";
import {
  PRIORITY_META,
  dayOf,
  initials,
  isTaskOverdue,
  userName,
  type WorkPriority,
  type WorkStatus,
  type WorkTask,
  type WorkUser,
} from "@/services/work.api";

/** ClickUp-style status ring: hollow for not started, half for active, filled check for done. */
export function StatusGlyph({ status, size = 16, className }: { status?: Pick<WorkStatus, "color" | "category"> | null; size?: number; className?: string }) {
  const color = status?.color ?? "#9CA3AF";
  const cat = status?.category ?? "NOT_STARTED";
  return (
    <span
      aria-hidden
      className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full", className)}
      style={{
        width: size,
        height: size,
        border: `2px solid ${color}`,
        background:
          cat === "DONE"
            ? color
            : cat === "ACTIVE"
              ? `conic-gradient(${color} 0 50%, transparent 50% 100%)`
              : "transparent",
      }}
    >
      {cat === "DONE" && <Check className="text-white" style={{ width: size * 0.62, height: size * 0.62 }} strokeWidth={3.2} />}
    </span>
  );
}

/** readable text colour on a solid chip of this colour (light greys/yellows get dark text) */
export function onColor(hex?: string | null) {
  const m = /^#?([0-9a-f]{6})/i.exec(hex ?? "");
  if (!m) return "#ffffff";
  const n = parseInt(m[1] ?? "0", 16);
  const yiq = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  return yiq >= 150 ? "#0e1a14" : "#ffffff";
}

export function StatusPill({ status, className }: { status?: Pick<WorkStatus, "name" | "color" | "category"> | null; className?: string }) {
  if (!status) return <span className={cn("text-xs text-muted-foreground", className)}>No status</span>;
  return (
    <span
      className={cn("ez-tint inline-flex max-w-full items-center gap-1.5 truncate rounded-md px-2 py-0.5 text-[11.5px] font-semibold uppercase tracking-[0.04em]", className)}
      style={{ "--c": status.color } as React.CSSProperties}
    >
      <StatusGlyph status={status} size={10} />
      <span className="truncate">{status.name}</span>
    </span>
  );
}

export function PriorityFlag({ priority, showLabel = false, className }: { priority: WorkPriority | null; showLabel?: boolean; className?: string }) {
  if (!priority) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-muted-foreground/50", className)} title="No priority">
        <Flag className="h-3.5 w-3.5" />
        {showLabel && <span className="text-xs">None</span>}
      </span>
    );
  }
  const m = PRIORITY_META[priority];
  return (
    <span className={cn("inline-flex items-center gap-1", className)} title={`${m.label} priority`}>
      <Flag className="h-3.5 w-3.5" style={{ color: m.color, fill: m.color }} />
      {showLabel && <span className="text-xs font-medium" style={{ color: m.color }}>{m.label}</span>}
    </span>
  );
}

const AVATAR_TONES = ["#0b2a1f", "#047857", "#b08d57", "#1d4ed8", "#9d174d", "#0f766e", "#b45309"];

export function Avatar({ user, size = 24, className }: { user: WorkUser; size?: number; className?: string }) {
  const tone = `hsl(${Math.round((user.id * 137.508) % 360)} 58% 40%)`;
  return user.avatarUrl ? (
    <img
      src={resolveUrl(user.avatarUrl)}
      alt={userName(user)}
      title={userName(user)}
      className={cn("shrink-0 rounded-full object-cover ring-2 ring-card", className)}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      title={userName(user)}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-card", className)}
      style={{ width: size, height: size, background: tone, fontSize: Math.max(9, size * 0.38) }}
    >
      {initials(user)}
    </span>
  );
}

export function AvatarStack({ users, max = 3, size = 24 }: { users: WorkUser[]; max?: number; size?: number }) {
  if (!users.length) return null;
  const shown = users.slice(0, max);
  return (
    <span className="flex -space-x-1.5">
      {shown.map((u) => (
        <Avatar key={u.id} user={u} size={size} />
      ))}
      {users.length > max && (
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground ring-2 ring-card"
          style={{ width: size, height: size, fontSize: size * 0.38 }}
        >
          +{users.length - max}
        </span>
      )}
    </span>
  );
}

export function dueText(iso: string) {
  const d = dayOf(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  // show a time only when one was set (not the default noon)
  const raw = new Date(iso);
  const t = raw.getHours() === 12 && raw.getMinutes() === 0 ? "" : ` · ${raw.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  if (diff === 0) return `Today${t}`;
  if (diff === 1) return `Tomorrow${t}`;
  if (diff === -1) return `Yesterday${t}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) }) + t;
}

export function DueLabel({ task, className }: { task: Pick<WorkTask, "dueDate" | "completedAt">; className?: string }) {
  if (!task.dueDate) return <span className={cn("text-xs text-muted-foreground/50", className)}>—</span>;
  const overdue = isTaskOverdue(task);
  const isToday = dueText(task.dueDate) === "Today" && !task.completedAt;
  return (
    <span
      className={cn(
        "text-[12.5px] tabular-nums",
        overdue ? "font-semibold text-destructive" : isToday ? "font-semibold text-[#b45309] dark:text-brass-soft" : "text-muted-foreground",
        task.completedAt && "text-muted-foreground/60 line-through decoration-muted-foreground/40",
        className,
      )}
    >
      {dueText(task.dueDate)}
    </span>
  );
}

/** "YYYY-MM-DD" for <input type=date> from an ISO string. */
export const toDateInput = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA") : "");
/** Store as local-noon ISO so the calendar day never shifts across time zones. */
export const fromDateInput = (v: string) => (v ? new Date(`${v}T12:00:00`).toISOString() : null);
