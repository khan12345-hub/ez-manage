"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Timer } from "lucide-react";
import { getMyActiveTimer } from "@/services/time-tracking.api";
import { useTaskDetailsStore } from "@/store/task-details-store";

function formatElapsed(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function ActiveTimerBadge() {
  const { data: entry } = useQuery({
    queryKey: ["my-active-timer"],
    queryFn: getMyActiveTimer,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const [elapsed, setElapsed] = useState("");
  const open = useTaskDetailsStore((s) => s.open);

  useEffect(() => {
    if (!entry) { setElapsed(""); return; }
    setElapsed(formatElapsed(entry.startedAt));
    const id = setInterval(() => setElapsed(formatElapsed(entry.startedAt)), 1000);
    return () => clearInterval(id);
  }, [entry]);

  if (!entry) return null;

  // Truncate long task names
  const taskName =
    entry.task.name.length > 22 ? entry.task.name.slice(0, 22) + "…" : entry.task.name;

  return (
    <button
      type="button"
      onClick={() =>
        open({ taskId: entry.taskId, boardId: entry.boardId, groupId: entry.task.groupId })
      }
      title={`Timer running on "${entry.task.name}" — click to open task`}
      className="flex items-center gap-2 rounded-full border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 shadow-sm transition-colors hover:bg-green-100 cursor-pointer"
    >
      {/* Pulsing dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-600" />
      </span>

      <Timer className="h-3.5 w-3.5 shrink-0" />

      <span className="hidden sm:inline max-w-[140px] truncate">{taskName}</span>

      <span className="font-mono font-semibold tabular-nums">{elapsed}</span>
    </button>
  );
}
