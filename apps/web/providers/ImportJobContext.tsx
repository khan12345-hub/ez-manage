"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getImportJob } from "@/services/boards.api";

interface ActiveJob {
  jobId: number;
  boardName: string;
  workspaceId: number;
}

interface ImportJobContextValue {
  jobs: ActiveJob[];
  startJob: (jobId: number, boardName: string, workspaceId: number) => void;
}

const ImportJobContext = createContext<ImportJobContextValue>({
  jobs: [],
  startJob: () => {},
});

export function useImportJobs() {
  return useContext(ImportJobContext);
}

export function ImportJobProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const router = useRouter();
  const queryClient = useQueryClient();
  const timersRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());

  const removeJob = useCallback((jobId: number) => {
    setJobs((prev) => prev.filter((j) => j.jobId !== jobId));
    const timer = timersRef.current.get(jobId);
    if (timer) {
      clearInterval(timer);
      timersRef.current.delete(jobId);
    }
  }, []);

  const pollJob = useCallback(
    async (job: ActiveJob) => {
      try {
        const status = await getImportJob(job.jobId);
        if (!status) return;

        if (status.status === "done") {
          removeJob(job.jobId);
          void queryClient.invalidateQueries({
            queryKey: ["boards", job.workspaceId],
          });
          toast.success(`Board "${job.boardName}" imported successfully.`);
          if (status.boardId) {
            router.push(
              `/workspace/${job.workspaceId}/board/${status.boardId}`,
            );
          }
        } else if (status.status === "failed") {
          removeJob(job.jobId);
          toast.error(
            status.error ?? `Import of "${job.boardName}" failed.`,
          );
        }
      } catch {
        // ignore transient network errors — keep polling
      }
    },
    [removeJob, queryClient, router],
  );

  const startJob = useCallback(
    (jobId: number, boardName: string, workspaceId: number) => {
      const job: ActiveJob = { jobId, boardName, workspaceId };

      setJobs((prev) => {
        // avoid duplicates if called twice
        if (prev.some((j) => j.jobId === jobId)) return prev;
        return [...prev, job];
      });

      // poll every 3 s
      const timer = setInterval(() => void pollJob(job), 3000);
      timersRef.current.set(jobId, timer);

      // first check after 1 s
      setTimeout(() => void pollJob(job), 1000);
    },
    [pollJob],
  );

  // cleanup on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearInterval(t));
    };
  }, []);

  return (
    <ImportJobContext.Provider value={{ jobs, startJob }}>
      {children}
    </ImportJobContext.Provider>
  );
}
