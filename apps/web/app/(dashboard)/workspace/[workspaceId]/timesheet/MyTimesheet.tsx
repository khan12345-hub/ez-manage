"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock, Lock } from "lucide-react";
import { getMyTimesheet, TimesheetData } from "@/services/time-tracking.api";
import { useTaskDetailsStore } from "@/store/task-details-store";
import { useInviteModalStore } from "@/store/invite-modal";
import { cn } from "@/lib/utils";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getSundayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMs(ms: number, fallback = "—"): string {
  if (!ms) return fallback;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours(), min = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${String(min).padStart(2, "0")} ${ampm}`;
}

function StatusDot({ color, label }: { color: string | null; label: string | null }) {
  if (!label) return null;
  return (
    <span className="flex items-center gap-1 shrink-0">
      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color ?? "#6b7280" }} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </span>
  );
}

interface Props {
  workspaceId: string | number;
}

export default function MyTimesheet({ workspaceId }: Props) {
  const { workspaceRole } = useInviteModalStore();
  const isAtLeastMember =
    workspaceRole === "OWNER" || workspaceRole === "ADMIN" || workspaceRole === "MEMBER";

  const today = new Date();
  const [weekStart, setWeekStart] = useState(() => getSundayOfWeek(today));
  const [tab, setTab] = useState<"timesheet" | "entries">("timesheet");

  if (!isAtLeastMember && workspaceRole) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Access restricted</p>
          <p className="mt-1 text-xs text-muted-foreground">
            My Timesheet is not available for your role.
          </p>
        </div>
      </div>
    );
  }

  const weekStartKey = toDateKey(weekStart);
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

  const { data, isLoading } = useQuery({
    queryKey: ["my-timesheet", workspaceId, weekStartKey],
    queryFn: () => getMyTimesheet(workspaceId, weekStartKey),
    staleTime: 30_000,
  });

  function prevWeek() {
    setWeekStart((d) => new Date(d.getTime() - 7 * 24 * 60 * 60 * 1000));
  }
  function nextWeek() {
    setWeekStart((d) => new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000));
  }
  function goToday() {
    setWeekStart(getSundayOfWeek(today));
  }

  const weekLabel = (() => {
    const s = weekStart;
    const e = weekEnd;
    if (s.getMonth() === e.getMonth()) {
      return `${MONTH_SHORT[s.getMonth()]} ${s.getDate()} – ${e.getDate()}, ${s.getFullYear()}`;
    }
    return `${MONTH_SHORT[s.getMonth()]} ${s.getDate()} – ${MONTH_SHORT[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  })();

  const todayKey = toDateKey(today);
  const weekDates: string[] = data?.weekDates ?? Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
    return toDateKey(d);
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h1 className="text-sm font-semibold">My Timesheet</h1>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          {/* Week navigation */}
          <div className="flex items-center gap-1">
            <button onClick={prevWeek} className="rounded p-1.5 hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[200px] text-center text-sm font-semibold">{weekLabel}</span>
            <button onClick={nextWeek} className="rounded p-1.5 hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={goToday}
              className="ml-2 rounded px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
            >
              Today
            </button>
          </div>

          {/* Tabs */}
          <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
            <button
              onClick={() => setTab("timesheet")}
              className={cn(
                "px-3 py-1.5 transition-colors",
                tab === "timesheet" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              Timesheet
            </button>
            <button
              onClick={() => setTab("entries")}
              className={cn(
                "px-3 py-1.5 transition-colors border-l border-border",
                tab === "entries" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              Time Entries
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isLoading && (
            <div className="flex flex-col gap-2 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && tab === "timesheet" && (
            <TimesheetGrid data={data} weekDates={weekDates} todayKey={todayKey} />
          )}

          {!isLoading && tab === "entries" && (
            <EntriesList data={data} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Timesheet grid tab ─────────────────────────────────────────────────── */

function TimesheetGrid({
  data, weekDates, todayKey,
}: {
  data: TimesheetData | undefined;
  weekDates: string[];
  todayKey: string;
}) {
  const { open } = useTaskDetailsStore();
  const rows = data?.rows ?? [];
  const dayTotals = data?.dayTotals ?? {};
  const weekTotalMs = data?.weekTotalMs ?? 0;

  return (
    <div className="min-w-[700px]">
      {/* Header row */}
      <div
        className="grid border-b border-border bg-muted/40 sticky top-0 z-10"
        style={{ gridTemplateColumns: "1fr repeat(7, 90px) 90px" }}
      >
        <div className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Task / Board
        </div>
        {weekDates.map((dateKey, i) => {
          const d = new Date(dateKey + "T12:00:00");
          const isToday = dateKey === todayKey;
          const dayTotal = dayTotals[dateKey];
          return (
            <div
              key={dateKey}
              className={cn(
                "border-l border-border px-2 py-2 text-center",
                isToday && "bg-primary/5",
              )}
            >
              <div className={cn("text-[10px] font-semibold uppercase tracking-wider", isToday ? "text-primary" : "text-muted-foreground")}>
                {DAY_SHORT[d.getDay()]}
              </div>
              <div className={cn("text-[11px] font-bold tabular-nums mt-0.5", isToday ? "text-primary" : "text-foreground")}>
                {dayTotal ? formatMs(dayTotal, "0h") : "0h"}
              </div>
            </div>
          );
        })}
        <div className="border-l border-border px-2 py-2 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total</div>
          <div className="text-[11px] font-bold tabular-nums mt-0.5 text-primary">
            {formatMs(weekTotalMs, "0h")}
          </div>
        </div>
      </div>

      {/* Task rows */}
      {rows.map((row) => (
        <div
          key={row.task.id}
          className="grid border-b border-border/60 hover:bg-muted/20 transition-colors"
          style={{ gridTemplateColumns: "1fr repeat(7, 90px) 90px" }}
        >
          <div className="flex flex-col justify-center gap-0.5 px-4 py-3">
            <button
              onClick={() => open({ taskId: row.task.id, boardId: row.task.boardId, groupId: row.task.groupId })}
              className="text-xs font-medium truncate text-left hover:underline cursor-pointer"
            >
              {row.task.name}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground truncate">
                {row.task.boardName}
                {row.task.groupName && <> · {row.task.groupName}</>}
              </span>
              <StatusDot color={row.task.statusColor} label={row.task.statusLabel} />
            </div>
          </div>
          {weekDates.map((dateKey) => {
            const ms = row.days[dateKey];
            const isToday = dateKey === todayKey;
            return (
              <div
                key={dateKey}
                className={cn(
                  "flex items-center justify-center border-l border-border/60 text-xs tabular-nums",
                  isToday && "bg-primary/5",
                  ms ? "font-semibold text-foreground" : "text-muted-foreground/40",
                )}
              >
                {ms ? formatMs(ms) : "—"}
              </div>
            );
          })}
          <div className="flex items-center justify-center border-l border-border/60 text-xs font-bold tabular-nums text-primary">
            {formatMs(row.totalMs)}
          </div>
        </div>
      ))}

      {/* Total footer row */}
      {rows.length > 0 && (
        <div
          className="grid border-b border-border bg-muted/30"
          style={{ gridTemplateColumns: "1fr repeat(7, 90px) 90px" }}
        >
          <div className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Total
          </div>
          {weekDates.map((dateKey) => {
            const ms = dayTotals[dateKey];
            const isToday = dateKey === todayKey;
            return (
              <div
                key={dateKey}
                className={cn(
                  "flex items-center justify-center border-l border-border/60 text-xs font-bold tabular-nums",
                  isToday && "bg-primary/10",
                  ms ? "text-foreground" : "text-muted-foreground/40",
                )}
              >
                {ms ? formatMs(ms) : "—"}
              </div>
            );
          })}
          <div className="flex items-center justify-center border-l border-border/60 text-xs font-bold tabular-nums text-primary">
            {formatMs(weekTotalMs, "—")}
          </div>
        </div>
      )}

      {rows.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No time logged this week.
        </div>
      )}
    </div>
  );
}

/* ── Time entries tab ───────────────────────────────────────────────────── */

function EntriesList({ data }: { data: TimesheetData | undefined }) {
  const { open } = useTaskDetailsStore();
  const groups = data?.entries ?? [];

  if (groups.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        No time entries this week.
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {groups.map((group) => {
        const d = new Date(group.date + "T12:00:00");
        const label = `${DAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
        return (
          <div key={group.date}>
            {/* Day header */}
            <div className="flex items-center justify-between bg-muted/30 px-5 py-2.5">
              <span className="text-xs font-bold">{label}</span>
              <span className="text-xs font-semibold tabular-nums text-primary">
                {formatMs(group.dayTotalMs)}
              </span>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_140px_90px_90px_80px] gap-4 px-5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 border-b border-border/40">
              <span>Task</span>
              <span>Board · Group</span>
              <span className="text-center">Start</span>
              <span className="text-center">End</span>
              <span className="text-right">Duration</span>
            </div>

            {/* Entry rows */}
            {group.items.map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-[1fr_140px_90px_90px_80px] gap-4 items-center px-5 py-2.5 text-xs border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
              >
                <div className="min-w-0">
                  <button
                    onClick={() => open({ taskId: entry.taskId, boardId: entry.boardId, groupId: entry.groupId })}
                    className="font-medium truncate block text-left hover:underline cursor-pointer"
                  >
                    {entry.taskName}
                  </button>
                  {entry.note && (
                    <span className="text-[10px] text-muted-foreground truncate block">{entry.note}</span>
                  )}
                </div>
                <span className="text-muted-foreground truncate">
                  {entry.boardName}
                  {entry.groupName && <> · {entry.groupName}</>}
                </span>
                <span className="text-center tabular-nums text-muted-foreground">{formatTime(entry.startedAt)}</span>
                <span className="text-center tabular-nums text-muted-foreground">{formatTime(entry.endedAt)}</span>
                <span className="text-right tabular-nums font-semibold">{formatMs(entry.durationMs)}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
