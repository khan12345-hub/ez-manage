"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  getTimeEntries,
  startTimer,
  stopTimer,
} from "@/services/time-tracking.api";
import { type CellEditorProps } from "../../EditableCells/EditableCell";

function formatDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function TimeTrackingCell({
  task,
  boardId,
}: CellEditorProps<number>) {
  const qc = useQueryClient();
  const [runningMs, setRunningMs] = useState(0);

  const { data: entries = [] } = useQuery({
    queryKey: ["time-entries", boardId, task?.id],
    queryFn: () => getTimeEntries(boardId!, task!.id),
    enabled: Boolean(boardId && task?.id),
    staleTime: 120_000,        // 2 minutes — avoid re-fetching every tab switch
    gcTime: 300_000,           // keep cached for 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const activeEntry = entries.find((e) => !e.endedAt) ?? null;

  // Live tick while a timer is running
  useEffect(() => {
    if (!activeEntry) {
      setRunningMs(0);
      return;
    }
    const startedAt = new Date(activeEntry.startedAt).getTime();
    const update = () => setRunningMs(Date.now() - startedAt);
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [activeEntry?.id, activeEntry?.startedAt]);

  const completedMs = entries
    .filter((e) => e.endedAt && e.durationMs != null)
    .reduce((sum, e) => sum + (e.durationMs ?? 0), 0);

  const totalMs = completedMs + runningMs;
  const isRunning = Boolean(activeEntry);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["time-entries", boardId, task?.id] });

  const startMutation = useMutation({
    mutationFn: () => startTimer(boardId!, task!.id),
    onSuccess: invalidate,
    onError: () => toast.error("Could not start timer"),
  });

  const stopMutation = useMutation({
    mutationFn: () => stopTimer(boardId!, task!.id),
    onSuccess: invalidate,
    onError: () => toast.error("Could not stop timer"),
  });

  const isMutating = startMutation.isPending || stopMutation.isPending;

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={isMutating}
        onClick={(e) => {
          e.stopPropagation();
          if (isRunning) stopMutation.mutate();
          else startMutation.mutate();
        }}
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors",
          isRunning
            ? "text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/40"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          isMutating && "cursor-wait opacity-50",
        )}
        title={isRunning ? "Pause timer" : "Start timer"}
      >
        {isRunning ? (
          <Pause className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Play className="h-3.5 w-3.5 fill-current" />
        )}
      </button>

      <span
        className={cn(
          "tabular-nums text-[12px]",
          totalMs > 0
            ? isRunning
              ? "font-medium text-orange-500"
              : "text-foreground"
            : "text-muted-foreground/50",
        )}
      >
        {totalMs > 0 ? formatDuration(totalMs) : "-"}
      </span>
    </div>
  );
}
