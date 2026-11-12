"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bot, Check, CheckCircle2, Loader2, MessageSquarePlus, Plus, SendHorizontal, ShieldCheck, Sparkles, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ceoApi, type CeoAiAction } from "@/services/ceo-tower.api";
import { RichText } from "../../work/_components/chat/ChatMessages";

export const AI_PROMPTS = ["Khan kia kar raha hai?", "Kaun se tasks in progress hain?", "Kis ki team peeche hai?", "Kya overdue hai 48 ghante se zyada?", "Sab managers ko weekly update ka message bhej do"];
const CONV_KEY = "ez:ceo:ai:conversation";

type Line = { role: "user" | "assistant"; text: string; used?: string[] };

/** CEO Tower → Executive AI: ask anything; actions the AI prepares wait for your Confirm */
export function AiView({ initialAsk, onAsked }: { initialAsk?: string | null; onAsked?: () => void }) {
  const qc = useQueryClient();
  const { data: status } = useQuery({ queryKey: ["ceo-tower", "ai", "status"], queryFn: ceoApi.aiStatus });
  const { data: convs = [] } = useQuery({ queryKey: ["ceo-tower", "ai", "conversations"], queryFn: ceoApi.aiConversations });
  const [convId, setConvId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [actions, setActions] = useState<CeoAiAction[]>([]);
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  // reopen the last conversation
  useEffect(() => {
    let id: string | null = null;
    try { id = localStorage.getItem(CONV_KEY); } catch {}
    if (id && !initialAsk) void open(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [lines.length, actions.length]);

  const open = async (id: string) => {
    try {
      const c = await ceoApi.aiConversation(id);
      setConvId(c.id); setLines(c.messages); setActions(c.actions);
      try { localStorage.setItem(CONV_KEY, c.id); } catch {}
    } catch { newChat(); }
  };
  const newChat = () => { setConvId(null); setLines([]); setActions([]); try { localStorage.removeItem(CONV_KEY); } catch {} };

  const ask = useMutation({
    mutationFn: (q: string) => ceoApi.aiChat(q, convId),
    onMutate: (q) => { setLines((l) => [...l, { role: "user", text: q }]); setText(""); },
    onSuccess: (r) => {
      setConvId(r.conversationId);
      try { localStorage.setItem(CONV_KEY, r.conversationId); } catch {}
      setLines((l) => [...l, { role: "assistant", text: r.reply, used: r.used }]);
      if (r.actions.length) setActions((a) => [...a, ...r.actions]);
      qc.invalidateQueries({ queryKey: ["ceo-tower", "ai", "conversations"] });
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message?.toString?.() ?? "Executive AI could not answer right now.";
      setLines((l) => [...l, { role: "assistant", text: `⚠️ ${msg}` }]);
    },
  });
  const decide = useMutation({
    mutationFn: ({ id, confirm }: { id: string; confirm: boolean }) => ceoApi.aiDecide(id, confirm),
    onSuccess: (a) => {
      setActions((all) => all.map((x) => (x.id === a.id ? a : x)));
      if (a.status === "done") toast.success(a.kind === "message" ? `Sent to ${(a.result?.sent ?? []).join(", ")}` : `Task created: ${a.result?.name}`);
      else if (a.status === "failed") toast.error("It could not be done — see the card.");
      qc.invalidateQueries({ queryKey: ["ceo-tower"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Something went wrong."),
  });

  // a question passed in from the Portfolio box
  useEffect(() => {
    if (initialAsk && status?.configured && !ask.isPending) { newChat(); ask.mutate(initialAsk); onAsked?.(); }
  }, [initialAsk, status?.configured]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => { const q = text.trim(); if (q && !ask.isPending) ask.mutate(q); };

  return (
    <section aria-label="Executive AI" className="grid min-h-[640px] gap-4 lg:grid-cols-[260px_1fr]">
      <aside aria-label="Conversations" className="rounded-2xl border border-border bg-card p-3">
        <button type="button" onClick={newChat} className="mb-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-forest text-[13px] font-semibold text-forest-foreground hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground"><Plus className="h-4 w-4" /> New conversation</button>
        <ul className="space-y-0.5">
          {convs.map((c) => (
            <li key={c.id}><button type="button" onClick={() => open(c.id)} aria-current={c.id === convId || undefined} className={cn("block w-full truncate rounded-md px-2 py-1.5 text-left text-[12.5px]", c.id === convId ? "bg-accent font-semibold" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground")}>{c.title || "Conversation"}</button></li>
          ))}
          {!convs.length && <li className="px-2 py-2 text-[12px] text-muted-foreground">Your conversations show up here.</li>}
        </ul>
      </aside>

      <div className="flex min-h-0 flex-col rounded-2xl border border-border bg-card">
        <header className="flex items-center gap-3 border-b border-border px-5 py-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-brass-soft"><Sparkles className="h-4.5 w-4.5" /></span>
          <span className="flex-1"><span className="block font-serif text-[20px] leading-tight">Executive AI</span><span className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Live data from all your companies{status?.model ? ` · ${status.model}` : ""}</span></span>
          <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-primary ring-1 ring-primary/25"><ShieldCheck className="h-3.5 w-3.5" /> Acts only after you confirm</span>
        </header>

        {status && !status.configured && (
          <p role="alert" className="mx-5 mt-4 rounded-xl border border-[#b08d57]/40 bg-[#b08d57]/8 px-4 py-3 text-[13px]">
            <strong>Executive AI isn&apos;t switched on yet.</strong> Add <code className="rounded bg-muted px-1 font-mono text-[12px]">ANTHROPIC_API_KEY</code> to the API server&apos;s settings (<code className="font-mono text-[12px]">apps/api/.env</code>) and restart it. Everything else in CEO Tower works without it.
          </p>
        )}

        <div aria-label="AI conversation" aria-live="polite" className="min-h-[360px] flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {!lines.length && (
            <div className="flex flex-col items-center py-10 text-center">
              <Bot className="h-9 w-9 text-[#b08d57]" />
              <p className="mt-2 font-serif text-[22px]">Ask about any person, team, company, folder or list</p>
              <p className="mt-1 max-w-[520px] text-[13px] text-muted-foreground">It reads live Boards and Work data. It can also prepare messages and tasks for you — nothing is sent until you press Confirm.</p>
            </div>
          )}
          {lines.map((l, i) => (
            <div key={i} className={cn("flex", l.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[78%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed", l.role === "user" ? "bg-forest text-forest-foreground dark:bg-primary dark:text-primary-foreground" : "border border-border bg-background")}>
                {l.role === "assistant" ? <RichText text={l.text} /> : l.text}
                {l.used?.length ? <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">Looked at: {l.used.map((u) => u.replace(/_/g, " ")).join(" · ")}</p> : null}
              </div>
            </div>
          ))}
          {actions.map((a) => <ActionCard key={a.id} a={a} busy={decide.isPending} onDecide={(confirm) => decide.mutate({ id: a.id, confirm })} />)}
          {ask.isPending && <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking through your companies…</p>}
          <div ref={bottom} />
        </div>

        <div className="border-t border-border px-5 py-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {AI_PROMPTS.map((p) => <button key={p} type="button" disabled={!status?.configured || ask.isPending} onClick={() => ask.mutate(p)} className="rounded-lg border border-border px-2.5 py-1 text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50">{p}</button>)}
          </div>
          <div className="flex items-end gap-2">
            <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={2} maxLength={4000} disabled={!status?.configured}
              placeholder={status?.configured ? "Ask anything… e.g. Khan ki team ka progress kya hai?" : "Executive AI is not switched on yet"} aria-label="Ask Executive AI"
              className="min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-[13.5px] outline-none focus:border-primary/50 disabled:opacity-60" />
            <button type="button" aria-label="Ask" disabled={!text.trim() || ask.isPending || !status?.configured} onClick={send} className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest text-forest-foreground disabled:opacity-40 dark:bg-primary dark:text-primary-foreground"><SendHorizontal className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** what the AI prepared; nothing happens until Confirm */
function ActionCard({ a, busy, onDecide }: { a: CeoAiAction; busy: boolean; onDecide: (confirm: boolean) => void }) {
  const p = a.payload ?? {};
  const title = a.kind === "message" ? `Message ${p.people?.length ?? 0} ${p.people?.length === 1 ? "person" : "people"}` : "Create and assign a task";
  return (
    <article aria-label={title} className={cn("rounded-2xl border p-4", a.status === "pending" ? "border-[#b08d57]/50 bg-[#b08d57]/5" : a.status === "done" ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30")}>
      <p className="flex items-center gap-2 text-[13px] font-semibold">{a.kind === "message" ? <MessageSquarePlus className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} {title}
        <span className={cn("ml-auto rounded-full px-2 py-0.5 font-mono text-[10.5px] uppercase", a.status === "pending" ? "bg-[#b08d57]/20 text-[#8a6a35] dark:text-[#d9bd8c]" : a.status === "done" ? "bg-primary/15 text-primary" : a.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>{a.status === "pending" ? "waiting for you" : a.status}</span>
      </p>
      {a.kind === "message" ? (
        <>
          <p className="mt-2 text-[12.5px] text-muted-foreground">To: {(p.people ?? []).map((x: any) => x.name + (x.reachable === false ? " (not in Work — can't receive)" : "")).join(", ")}</p>
          <blockquote className="mt-2 whitespace-pre-wrap rounded-lg border-l-4 border-[#b08d57]/50 bg-background px-3 py-2 text-[13px]">{p.text}</blockquote>
        </>
      ) : (
        <dl className="mt-2 grid grid-cols-[90px_1fr] gap-x-3 gap-y-1 text-[12.5px]">
          <dt className="text-muted-foreground">Task</dt><dd className="font-medium">{p.name}</dd>
          <dt className="text-muted-foreground">List</dt><dd>{p.list}</dd>
          <dt className="text-muted-foreground">Assign to</dt><dd>{(p.assignees ?? []).map((x: any) => x.name).join(", ")}</dd>
          {p.due && <><dt className="text-muted-foreground">Due</dt><dd>{p.due}</dd></>}
          {p.priority && <><dt className="text-muted-foreground">Priority</dt><dd className="capitalize">{String(p.priority).toLowerCase()}</dd></>}
          {p.description && <><dt className="text-muted-foreground">Details</dt><dd className="whitespace-pre-wrap">{p.description}</dd></>}
        </dl>
      )}
      {a.status === "pending" ? (
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={busy} onClick={() => onDecide(true)} className="flex h-9 items-center gap-1.5 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"><Check className="h-4 w-4" /> Confirm</button>
          <button type="button" disabled={busy} onClick={() => onDecide(false)} className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium hover:bg-accent disabled:opacity-50"><X className="h-4 w-4" /> Cancel</button>
        </div>
      ) : a.status === "done" ? (
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-primary"><CheckCircle2 className="h-3.5 w-3.5" /> {a.kind === "message" ? `Sent to ${(a.result?.sent ?? []).join(", ")}` : `Task created: ${a.result?.name}`}{a.result?.failed?.length ? <span className="text-destructive"> · not sent to {a.result.failed.map((f: any) => f.name).join(", ")}</span> : null}</p>
      ) : a.status === "failed" ? (
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-destructive"><XCircle className="h-3.5 w-3.5" /> {a.result?.error ?? (a.result?.failed ?? []).map((f: any) => `${f.name}: ${f.reason}`).join("; ") ?? "Could not be done."}</p>
      ) : a.status === "cancelled" ? <p className="mt-2 text-[12.5px] text-muted-foreground">Cancelled — nothing was sent.</p> : null}
    </article>
  );
}
