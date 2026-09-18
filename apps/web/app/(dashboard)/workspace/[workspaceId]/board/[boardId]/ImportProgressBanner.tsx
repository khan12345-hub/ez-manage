"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, FileDown, PauseCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";

import { pauseImport, resumeImport, getImportProgress, ImportProgress } from "@/services/boards.api";
import { connectNotificationStream } from "@/services/notifications.sse";

interface Props {
  boardId: number;
}

export function ImportProgressBanner({ boardId }: Props) {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Initial fetch
  const { data } = useQuery({
    queryKey: ["import-progress", boardId],
    queryFn: () => getImportProgress(boardId),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (data) setProgress(data);
  }, [data]);

  // Listen for SSE updates
  useEffect(() => {
    const disconnect = connectNotificationStream(
      () => {},
      (p) => {
        if (p.boardId === boardId) setProgress(p as any);
      },
    );
    return disconnect;
  }, [boardId]);

  const pauseMutation = useMutation({
    mutationFn: () => pauseImport(boardId),
    onSuccess: () => {
      toast.success("File import paused.");
      setProgress((p) => p ? { ...p, isPaused: true, paused: p.pending, pending: 0 } : p);
    },
    onError: () => toast.error("Failed to pause import."),
  });

  const resumeMutation = useMutation({
    mutationFn: () => resumeImport(boardId),
    onSuccess: () => {
      toast.success("File import resumed.");
      setProgress((p) => p ? { ...p, isPaused: false, pending: p.paused, paused: 0 } : p);
    },
    onError: () => toast.error("Failed to resume import."),
  });

  // Hide when nothing to show or dismissed
  const hasActivity = progress && progress.total > 0 && (progress.pending > 0 || progress.paused > 0);
  if (!hasActivity || dismissed) return null;

  const done = progress!.done;
  const total = progress!.total;
  const isPaused = progress!.isPaused;
  const percent = Math.round((done / total) * 100);
  const isMutating = pauseMutation.isPending || resumeMutation.isPending;

  return (
    <div className="flex items-center gap-3 border-b bg-blue-50 px-4 py-2.5 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
      <FileDown className={`h-4 w-4 shrink-0 ${isPaused ? "" : "animate-pulse"}`} />

      <div className="flex flex-1 items-center gap-3 min-w-0">
        <span className="font-medium shrink-0">
          {isPaused ? "Import paused" : "Importing files..."}
        </span>
        <span className="text-blue-600 dark:text-blue-300 shrink-0">
          {done} / {total} done
        </span>

        {/* Progress bar */}
        <div className="flex-1 h-1.5 rounded-full bg-blue-200 dark:bg-blue-800 overflow-hidden min-w-[60px] max-w-xs">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isPaused ? "bg-blue-300" : "bg-blue-500"}`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <span className="text-blue-500 dark:text-blue-400 shrink-0">
          {percent}%
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {isPaused ? (
          <button
            type="button"
            onClick={() => resumeMutation.mutate()}
            disabled={isMutating}
            title="Resume importing"
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-900"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={() => pauseMutation.mutate()}
            disabled={isMutating}
            title="Pause importing"
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-900"
          >
            <PauseCircle className="h-3.5 w-3.5" />
            Stop
          </button>
        )}

        <button
          type="button"
          onClick={() => setDismissed(true)}
          title="Dismiss"
          className="rounded p-1 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
