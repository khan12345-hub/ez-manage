"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, SendHorizontal, Sparkles, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ceoApi, type CeoAiAction } from "@/services/ceo-tower.api";
import { RichText } from "../../work/_components/chat/ChatMessages";

type Line = { role: "user" | "assistant"; text: string };

/**
 * A compact Executive-AI chat scoped to the open channel. The channel context (name, company, people)
 * is prepended to the first question, so the CEO can ask "did they reply / is it done / re-send it"
 * about this chat without leaving it. It reuses the Executive AI — actions only run after Confirm.
 */
export function ChannelAiPanel({ context, suggestions, onClose }: { context: string; suggestions: string[]; onClose: () => void }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [actions, setActions] = useState<CeoAiAction[]>([]);
  const [text, setText] = useState("");
  const [convId, setConvId] = useState<string | null>(null);
  const firstRef = useRef(true);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [lines, actions]);

  const ask = useMutation({
    mutationFn: (q: string) => ceoApi.aiChat(firstRef.current ? `${context}\n\nQuestion: ${q}` : q, convId),
    onMutate: (q: string) => { setLines((l) => [...l, { role: "user", text: q }]); setText(""); },
    onSuccess: (t) => { firstRef.current = false; setConvId(t.conversationId); setLines((l) => [...l, { role: "assistant", text: t.reply }]); if (t.actions.length) setActions((a) => [...a, ...t.actions]); },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Something went wrong."),
  });
  const decide = useMutation({ mutationFn: ({ id, confirm }: { id: string; confirm: boolean }) => ceoApi.aiDecide(id, confirm), onSuccess: (a) => setActions((s) => s.map((x) => (x.id === a.id ? a : x))) });
  const send = () => { const q = text.trim(); if (q && !ask.isPending) ask.mutate(q); };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest text-brass-soft dark:bg-primary/20"><Sparkles className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold leading-tight">Ask AI about this chat</span><span className="block text-[11px] text-muted-foreground">Replies, progress & reminders — it acts only after you confirm</span></span>
        <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {!lines.length && (
          <div className="space-y-2">
            <p className="text-[12.5px] text-muted-foreground">Ask about the people in this chat:</p>
            {suggestions.map((s) => <button key={s} type="button" disabled={ask.isPending} onClick={() => ask.mutate(s)} className="block w-full rounded-xl border border-border px-3 py-2 text-left text-[12.5px] hover:bg-accent disabled:opacity-50">{s}</button>)}
          </div>
        )}
        {lines.map((l, i) => (
          <div key={i} className={cn("flex", l.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[88%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed", l.role === "user" ? "bg-forest text-forest-foreground dark:bg-primary dark:text-primary-foreground" : "border border-border bg-background")}>
              {l.role === "assistant" ? <RichText text={l.text} /> : l.text}
            </div>
          </div>
        ))}
        {actions.map((a) => <ActionRow key={a.id} a={a} busy={decide.isPending} onDecide={(confirm) => decide.mutate({ id: a.id, confirm })} />)}
        {ask.isPending && <p className="flex items-center gap-2 text-[12px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking…</p>}
        <div ref={bottom} />
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={2} maxLength={2000}
            placeholder="Ask about this chat…" aria-label="Ask AI about this chat" className="min-h-[40px] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary/50" />
          <button type="button" aria-label="Ask" disabled={!text.trim() || ask.isPending} onClick={send} className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest text-forest-foreground disabled:opacity-40 dark:bg-primary dark:text-primary-foreground"><SendHorizontal className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

/** A prepared action (message / reminder etc.) — nothing is sent until Confirm. */
function ActionRow({ a, busy, onDecide }: { a: CeoAiAction; busy: boolean; onDecide: (confirm: boolean) => void }) {
  const p: any = a.payload ?? {};
  const n = p.people?.length ?? 0;
  const title = a.kind === "message" ? `Message ${n} ${n === 1 ? "person" : "people"}` : a.kind === "email" ? `Email ${n} ${n === 1 ? "person" : "people"}` : a.kind === "meeting" ? "Schedule a meeting" : "Create and assign a task";
  return (
    <div className="rounded-2xl border border-[#b08d57]/40 bg-[#b08d57]/[0.06] p-3">
      <p className="text-[13px] font-semibold">{title}</p>
      {p.body && <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-muted-foreground">{String(p.body).slice(0, 400)}</p>}
      {a.status === "done" ? <p className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-[#047857]"><Check className="h-3.5 w-3.5" /> Sent</p>
        : a.status === "cancelled" ? <p className="mt-2 text-[12px] text-muted-foreground">Cancelled</p>
        : a.status === "failed" ? <p className="mt-2 text-[12px] text-destructive">Couldn&apos;t send.</p>
        : (
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy} onClick={() => onDecide(true)} className="flex h-8 items-center gap-1 rounded-lg bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"><Check className="h-3.5 w-3.5" /> Confirm & send</button>
            <button type="button" disabled={busy} onClick={() => onDecide(false)} className="flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-[12.5px] hover:bg-accent"><XCircle className="h-3.5 w-3.5" /> Cancel</button>
          </div>
        )}
    </div>
  );
}
