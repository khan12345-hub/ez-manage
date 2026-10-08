"use client";

import {
  CheckCircle2,
  MessageSquare,
  Timer,
  UserPlus,
  FileDown,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ImportJobSummary } from "@/services/boards.api";

interface ImportSummaryModalProps {
  boardName: string;
  boardId: number;
  workspaceId: number;
  summary: ImportJobSummary;
  onClose: () => void;
  onGoToBoard: () => void;
}

interface StatRowProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  show?: boolean;
}

function StatRow({ icon, label, value, color, show = true }: StatRowProps) {
  if (!show) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-muted/40">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
        {icon}
      </div>
      <span className="flex-1 text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-foreground">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

export function ImportSummaryModal({
  boardName,
  summary,
  onClose,
  onGoToBoard,
}: ImportSummaryModalProps) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200 p-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Top gradient accent */}
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600" />

        {/* Header */}
        <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <CheckCircle2 className="h-7 w-7" />
          </div>

          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Import complete
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{boardName}</span>{" "}
              is ready to use
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mx-4 mb-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          <StatRow
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Tasks created"
            value={summary.tasksCreated}
            color="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
          <StatRow
            icon={<MessageSquare className="h-4 w-4" />}
            label="Comments imported"
            value={summary.commentsCreated}
            color="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
            show={summary.commentsCreated > 0}
          />
          <StatRow
            icon={<Timer className="h-4 w-4" />}
            label="Time entries created"
            value={summary.timeEntriesCreated}
            color="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
            show={summary.timeEntriesCreated > 0}
          />
          <StatRow
            icon={<UserPlus className="h-4 w-4" />}
            label="Users created"
            value={summary.usersCreated}
            color="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
            show={summary.usersCreated > 0}
          />
          <StatRow
            icon={<FileDown className="h-4 w-4" />}
            label="Files queued for download"
            value={summary.filesQueued}
            color="bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400"
            show={summary.filesQueued > 0}
          />
          <StatRow
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Assignments skipped"
            value={summary.skipped}
            color="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
            show={summary.skipped > 0}
          />
        </div>

        {summary.skipped > 0 && (
          <p className="mx-4 mb-4 text-[11px] text-muted-foreground">
            Some person assignments or file URLs could not be resolved — usually because those users are not yet in this workspace. All tasks were still imported.
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 border-t border-border px-4 py-4">
          <Button
            type="button"
            variant="outline"
            className="h-9 flex-1 text-xs font-semibold border-border"
            onClick={onClose}
          >
            Dismiss
          </Button>

          <Button
            type="button"
            className="h-9 flex-1 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
            onClick={onGoToBoard}
          >
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Go to board
          </Button>
        </div>
      </div>
    </div>
  );
}
