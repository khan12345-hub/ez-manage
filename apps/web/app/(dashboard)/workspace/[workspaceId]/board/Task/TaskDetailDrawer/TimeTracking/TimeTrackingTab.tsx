"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Play, Square, Plus, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  getTimeEntries,
  startTimer,
  stopTimer,
  logManualTime,
  deleteTimeEntry,
  getActiveTimer,
  type TimeEntry,
} from "@/services/time-tracking.api";

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hmsToMs(h: number, m: number, s: number): number {
  return (h * 3600 + m * 60 + s) * 1000;
}

interface LiveTimerProps {
  startedAt: string;
}

function LiveTimer({ startedAt }: LiveTimerProps) {
  const [elapsed, setElapsed] = useState(Date.now() - new Date(startedAt).getTime());

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Date.now() - new Date(startedAt).getTime());
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <span className="font-mono text-sm font-semibold text-green-600">
      {formatDuration(elapsed)}
    </span>
  );
}

interface TimeTrackingTabProps {
  taskId: number;
  boardId: number;
}

export function TimeTrackingTab({ taskId, boardId }: TimeTrackingTabProps) {
  const qc = useQueryClient();
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualHours, setManualHours] = useState("");
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualSeconds, setManualSeconds] = useState("");
  const [manualNote, setManualNote] = useState("");

  const entriesKey = ["time-entries", boardId, taskId];

  const { data: entries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: entriesKey,
    queryFn: () => getTimeEntries(boardId, taskId),
    enabled: !!boardId && !!taskId,
    refetchInterval: 30_000,
  });

  const activeEntry = entries.find((e) => e.endedAt === null) ?? null;
  const totalMs = entries.reduce((sum, e) => sum + (e.durationMs ?? 0), 0);

  const startMutation = useMutation({
    mutationFn: () => startTimer(boardId, taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: entriesKey });
      toast.success("Timer started");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Failed to start timer");
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => stopTimer(boardId, taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: entriesKey });
      toast.success("Timer stopped");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Failed to stop timer");
    },
  });

  const manualMutation = useMutation({
    mutationFn: (vars: { durationMs: number; note?: string }) =>
      logManualTime(boardId, taskId, vars.durationMs, vars.note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: entriesKey });
      toast.success("Time logged");
      setShowManualModal(false);
      setManualHours("");
      setManualMinutes("");
      setManualSeconds("");
      setManualNote("");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Failed to log time");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (entryId: number) => deleteTimeEntry(boardId, taskId, entryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: entriesKey });
      toast.success("Entry deleted");
    },
    onError: () => toast.error("Failed to delete entry"),
  });

  function handleManualSubmit() {
    const h = parseInt(manualHours || "0", 10);
    const m = parseInt(manualMinutes || "0", 10);
    const s = parseInt(manualSeconds || "0", 10);
    const ms = hmsToMs(h, m, s);
    if (ms <= 0) {
      toast.error("Duration must be greater than zero");
      return;
    }
    manualMutation.mutate({ durationMs: ms, note: manualNote || undefined });
  }

  const completedEntries = entries.filter((e) => e.endedAt !== null);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>
            Total: <strong className="text-foreground">{formatDuration(totalMs)}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowManualModal(true)}
          >
            <Plus className="mr-1 h-3 w-3" />
            Log time
          </Button>
          {activeEntry ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
            >
              <Square className="mr-1 h-3 w-3 fill-current" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
            >
              <Play className="mr-1 h-3 w-3 fill-current" />
              Start
            </Button>
          )}
        </div>
      </div>

      {/* Active timer banner */}
      {activeEntry && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="text-sm text-green-700">Timer running</span>
            {activeEntry.note && (
              <span className="text-xs text-green-600">— {activeEntry.note}</span>
            )}
          </div>
          <LiveTimer startedAt={activeEntry.startedAt} />
        </div>
      )}

      {/* Entry list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : completedEntries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
          <Clock className="h-8 w-8 opacity-30" />
          <p className="text-sm">No time logged yet</p>
          <p className="text-xs">Start a timer or log time manually</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {completedEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-2 rounded-md border px-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-3 sm:gap-0"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-5 w-5 sm:h-6 sm:w-6">
                  <AvatarImage src={entry.user.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {entry.user.firstName[0]}
                    {entry.user.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">
                    {entry.user.firstName} {entry.user.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(entry.startedAt)}
                    {entry.note && <> · {entry.note}</>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold">
                  {formatDuration(entry.durationMs ?? 0)}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(entry.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual log modal */}
      <Dialog open={showManualModal} onOpenChange={setShowManualModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Log time manually</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Duration</p>
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={manualHours}
                    onChange={(e) => setManualHours(e.target.value)}
                    className="w-12 text-center sm:w-16"
                  />
                  <span className="text-center text-xs text-muted-foreground">h</span>
                </div>
                <span className="mb-4 text-muted-foreground">:</span>
                <div className="flex flex-col gap-1">
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    placeholder="0"
                    value={manualMinutes}
                    onChange={(e) => setManualMinutes(e.target.value)}
                    className="w-12 text-center sm:w-16"
                  />
                  <span className="text-center text-xs text-muted-foreground">m</span>
                </div>
                <span className="mb-4 text-muted-foreground">:</span>
                <div className="flex flex-col gap-1">
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    placeholder="0"
                    value={manualSeconds}
                    onChange={(e) => setManualSeconds(e.target.value)}
                    className="w-12 text-center sm:w-16"
                  />
                  <span className="text-center text-xs text-muted-foreground">s</span>
                </div>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Note (optional)</p>
              <Input
                placeholder="What did you work on?"
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleManualSubmit} disabled={manualMutation.isPending}>
              Log time
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
