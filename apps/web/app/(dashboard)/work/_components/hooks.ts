"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { workApi, workKeys, type TaskInput, type WorkStatus, type WorkTask } from "@/services/work.api";

const errMsg = (e: any) => e?.response?.data?.message?.toString?.() ?? "Something went wrong.";

export function useWorkList(uid: string) {
  return useQuery({ queryKey: workKeys.list(uid), queryFn: () => workApi.getList(uid), enabled: !!uid, staleTime: 30_000 });
}

export function useListTasks(listId: number | undefined) {
  return useQuery({
    queryKey: workKeys.tasks(listId ?? 0),
    queryFn: () => workApi.listTasks(listId!),
    enabled: !!listId,
    staleTime: 15_000,
  });
}

/** Patch a task with an optimistic update of the list cache. */
export function useUpdateTask(listId: number | undefined, statuses?: WorkStatus[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: TaskInput }) => workApi.updateTask(id, body),
    onMutate: async ({ id, body }) => {
      if (!listId) return {};
      const key = workKeys.tasks(listId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<WorkTask[]>(key);
      qc.setQueryData<WorkTask[]>(key, (old) =>
        old?.map((t) => {
          if (t.id !== id) return t;
          const next: WorkTask = { ...t, ...(body as any) };
          if (body.statusId !== undefined && statuses) {
            const st = statuses.find((s) => s.id === body.statusId);
            next.completedAt = st?.category === "DONE" ? t.completedAt ?? new Date().toISOString() : null;
          }
          return next;
        }),
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (listId && ctx?.prev) qc.setQueryData(workKeys.tasks(listId), ctx.prev);
      toast.error(errMsg(e));
    },
    onSuccess: (updated) => {
      if (!listId) return;
      qc.setQueryData<WorkTask[]>(workKeys.tasks(listId), (old) =>
        updated.listId !== listId ? old?.filter((t) => t.id !== updated.id) : old?.map((t) => (t.id === updated.id ? updated : t)),
      );
    },
    onSettled: (updated) => {
      qc.invalidateQueries({ queryKey: ["work", "task"] });
      qc.invalidateQueries({ queryKey: ["work", "my"] });
      if (updated && updated.listId !== listId) qc.invalidateQueries({ queryKey: workKeys.tasks(updated.listId) });
    },
  });
}

export function useCreateTask(listId: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TaskInput & { name: string }) => workApi.createTask(listId!, body),
    onSuccess: (task) => {
      qc.setQueryData<WorkTask[]>(workKeys.tasks(listId!), (old) => (old ? [...old, task] : [task]));
      qc.invalidateQueries({ queryKey: ["work", "tree"] });
      qc.invalidateQueries({ queryKey: ["work", "task"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useArchiveTask(listId: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => workApi.archiveTask(id),
    onSuccess: (_r, id) => {
      qc.setQueryData<WorkTask[]>(workKeys.tasks(listId!), (old) => old?.filter((t) => t.id !== id && t.parentId !== id));
      qc.invalidateQueries({ queryKey: ["work", "tree"] });
      qc.invalidateQueries({ queryKey: ["work", "my"] });
      toast.success("Task archived");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}
