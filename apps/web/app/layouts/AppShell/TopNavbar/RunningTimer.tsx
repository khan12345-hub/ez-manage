"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Square, Timer } from "lucide-react";
import { toast } from "sonner";
import { formatDuration, workApi } from "@/services/work.api";

/** Work's running time tracker, shown in the top bar while a timer runs (any page). */
export function RunningTimer() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["work", "running"],
    queryFn: async () => (await workApi.runningTimer()) || null,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!data) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [data]);

  const stop = useMutation({
    mutationFn: () => workApi.stopTimer(),
    onSuccess: () => {
      qc.setQueryData(["work", "running"], null);
      qc.invalidateQueries({ queryKey: ["work", "task"] });
      if (data) qc.invalidateQueries({ queryKey: ["work", "time", data.task.id] });
      toast.success("Timer stopped");
    },
    onError: () => toast.error("Couldn't stop the timer."),
  });

  if (!data) return null;
  const secs = Math.max(0, Math.round((now - new Date(data.startedAt).getTime()) / 1000));
  const href = `/work/${data.task.list.space.workspace?.uid ?? data.task.list.space.workspaceId}/list/${data.task.list.uid}?task=${data.task.uid}`;

  return (
    <div className="flex h-8 items-center overflow-hidden rounded-full border border-destructive/30 bg-destructive/5 text-[12.5px]" role="status" aria-label="Running timer">
      <Link href={href} title={`Tracking: ${data.task.name}`} className="flex min-w-0 items-center gap-1.5 py-1 pl-2.5 pr-2 hover:bg-destructive/10">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
        </span>
        <Timer className="hidden h-3.5 w-3.5 text-destructive sm:block" />
        <span className="hidden max-w-[140px] truncate font-medium text-foreground lg:inline">{data.task.name}</span>
        <span className="font-mono font-semibold tabular-nums text-destructive">{formatDuration(secs)}</span>
      </Link>
      <button
        type="button"
        onClick={() => stop.mutate()}
        disabled={stop.isPending}
        aria-label="Stop running timer"
        title="Stop timer"
        className="flex h-full items-center border-l border-destructive/20 px-2 text-destructive hover:bg-destructive/10 disabled:opacity-50"
      >
        <Square className="h-3 w-3 fill-current" />
      </button>
    </div>
  );
}
