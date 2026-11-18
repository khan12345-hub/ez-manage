"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "../../_components/PageHeader";
import { useParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Loader2, SendHorizontal, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const PROMPTS = ["What is overdue, and who owns it?", "What did the team finish this week?", "What is due in the next 7 days?", "Who has the most open tasks?", "Which high-priority tasks have nobody on them?"];

/** Work → Ask AI: questions about this workspace, answered only from the tasks you can see. */
export default function WorkAiPage() {
  const { workspaceId: ws } = useParams<{ workspaceId: string }>();
  const [lines, setLines] = useState<{ role: "you" | "ai"; text: string }[]>([]);
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);
  const ask = useMutation({
    mutationFn: async (q: string) => (await api.post<{ answer: string; tasksSeen: number }>(`/work/workspaces/${ws}/ai/ask`, { question: q }, { timeout: 120_000 })).data,
    onMutate: (q) => { setLines((l) => [...l, { role: "you", text: q }]); setText(""); },
    onSuccess: (r) => setLines((l) => [...l, { role: "ai", text: r.answer }]),
    onError: (e: any) => setLines((l) => [...l, { role: "ai", text: e?.response?.data?.message?.toString?.() ?? "Work AI couldn't answer right now." }]),
  });
  const send = (q: string) => { const v = q.trim(); if (v && !ask.isPending) ask.mutate(v); };
  return (
    <div className="mx-auto flex h-full max-w-[860px] flex-col p-4 sm:p-6">
      <PageHeader icon={Sparkles} title="Ask AI" subtitle="Answers come only from the tasks you can see in this workspace." color="#7c3aed" />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card p-4">
        {!lines.length && (
          <div className="py-10 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-[#7c3aed]" />
            <p className="mt-2 text-[15px] font-medium">Ask about tasks, people, deadlines or progress</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">{PROMPTS.map((p) => <button key={p} type="button" onClick={() => send(p)} className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] text-muted-foreground hover:bg-accent hover:text-foreground">{p}</button>)}</div>
          </div>
        )}
        {lines.map((l, i) => (
          <div key={i} className={cn("flex", l.role === "you" ? "justify-end" : "justify-start")}>
            <p className={cn("max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed", l.role === "you" ? "bg-primary text-primary-foreground" : "border border-border bg-background")}>{l.text.replace(/\*\*/g, "")}</p>
          </div>
        ))}
        {ask.isPending && <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking through your tasks…</p>}
        <div ref={end} />
      </div>
      <div className="mt-3 flex gap-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} rows={2} maxLength={1000} aria-label="Ask Work AI" placeholder="Ask anything… e.g. What is Ali working on?" className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus:border-primary/50" />
        <button type="button" aria-label="Ask" disabled={!text.trim() || ask.isPending} onClick={() => send(text)} className="flex h-11 w-11 items-center justify-center self-end rounded-xl bg-primary text-primary-foreground disabled:opacity-40"><SendHorizontal className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
