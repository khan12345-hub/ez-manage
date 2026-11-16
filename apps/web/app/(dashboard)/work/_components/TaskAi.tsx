"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { workApi, type WorkTaskDetail } from "@/services/work.api";

type Result = { action: "describe" | "summarize"; text: string } | { action: "subtasks"; subtasks: string[] };
const errMsg = (e: any, f: string) => e?.response?.data?.message?.toString?.() ?? f;

/** Work AI on a task: write the description, summarize the comments, suggest subtasks. You apply what you like. */
export function TaskAi({ task, canEdit, onDescription }: { task: WorkTaskDetail; canEdit: boolean; onDescription: (text: string) => void }) {
  const qc = useQueryClient();
  const [result, setResult] = useState<Result | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const run = useMutation({
    mutationFn: async (action: "describe" | "summarize" | "subtasks") => (await api.post<any>(`/work/tasks/${task.id}/ai`, { action }, { timeout: 120_000 })).data,
    onSuccess: (r) => { setResult(r); if (r.action === "subtasks") setPicked(r.subtasks); },
    onError: (e) => toast.error(errMsg(e, "Work AI couldn't answer right now.")),
  });
  const add = useMutation({
    mutationFn: async () => { for (const name of picked) await workApi.createTask(task.listId, { name, parentId: task.id }); return picked.length; },
    onSuccess: (n) => { toast.success(`${n} ${n === 1 ? "subtask" : "subtasks"} added`); setResult(null); qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "work" }); },
    onError: (e) => toast.error(errMsg(e, "Couldn't add them.")),
  });
  const btn = "rounded-md px-2 py-1 text-[12px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50";
  return (
    <section aria-label="Work AI" className="rounded-xl border border-[#7c3aed]/25 bg-[#7c3aed]/[0.04] p-2.5">
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 flex items-center gap-1 text-[12px] font-semibold text-[#6d28d9] dark:text-[#c4b5fd]"><Sparkles className="h-3.5 w-3.5" /> AI</span>
        {canEdit && <button type="button" disabled={run.isPending} onClick={() => run.mutate("describe")} className={btn}>Write description</button>}
        <button type="button" disabled={run.isPending} onClick={() => run.mutate("summarize")} className={btn}>Summarize comments</button>
        {canEdit && <button type="button" disabled={run.isPending} onClick={() => run.mutate("subtasks")} className={btn}>Suggest subtasks</button>}
        {run.isPending && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {result && (
        <div className="mt-2 rounded-lg border border-border bg-card p-3 text-[13px]">
          <div className="mb-1 flex items-center justify-between"><span className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">{result.action === "describe" ? "Suggested description" : result.action === "summarize" ? "Summary of the comments" : "Suggested subtasks"}</span><button type="button" aria-label="Close" onClick={() => setResult(null)} className="rounded p-0.5 text-muted-foreground hover:bg-accent"><X className="h-3.5 w-3.5" /></button></div>
          {result.action === "subtasks" ? (
            <>
              <ul className="space-y-1">{result.subtasks.map((s) => (
                <li key={s}><label className="flex items-start gap-2"><input type="checkbox" checked={picked.includes(s)} onChange={(e) => setPicked(e.target.checked ? [...picked, s] : picked.filter((x) => x !== s))} className="mt-1" />{s}</label></li>
              ))}</ul>
              <div className="mt-2 flex justify-end"><button type="button" disabled={!picked.length || add.isPending} onClick={() => add.mutate()} className="h-8 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-50">Add {picked.length} {picked.length === 1 ? "subtask" : "subtasks"}</button></div>
            </>
          ) : (
            <>
              <p className="whitespace-pre-wrap leading-relaxed">{result.text}</p>
              {result.action === "describe" && canEdit && (
                <div className="mt-2 flex justify-end gap-2">
                  {task.description && <button type="button" onClick={() => { onDescription(`${task.description}\n\n${result.text}`); setResult(null); }} className="h-8 rounded-md border border-border px-3 text-[12.5px] hover:bg-accent">Add below</button>}
                  <button type="button" onClick={() => { onDescription(result.text); setResult(null); }} className={cn("h-8 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground")}>{task.description ? "Replace description" : "Use as description"}</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
