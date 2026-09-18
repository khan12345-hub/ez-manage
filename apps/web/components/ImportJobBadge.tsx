"use client";

import { FileSpreadsheet, Loader2 } from "lucide-react";
import { useImportJobs } from "@/providers/ImportJobContext";

export function ImportJobBadge() {
  const { jobs } = useImportJobs();

  if (!jobs.length) return null;

  return (
    <>
      {jobs.map((job) => (
        <div
          key={job.jobId}
          className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
        >
          <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          <FileSpreadsheet className="h-3 w-3 shrink-0" />
          <span className="max-w-[110px] truncate hidden sm:inline">
            Importing &ldquo;{job.boardName}&rdquo;
          </span>
          <span className="sm:hidden">Importing…</span>
        </div>
      ))}
    </>
  );
}
