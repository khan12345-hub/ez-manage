"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRightLeft, CalendarCheck2, CheckCircle2, Circle, Loader2, Mail, MessageSquareText, PhoneCall, Sparkles, StickyNote, Trash2, UserRoundCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { contactName, crmApi, crmKeys, userName, type CrmActivity, type CrmObject } from "@/services/crm.api";
import { ago, btnPrimary, dayIso, fmtDate, fmtDateTime, input, isPast, onErr, useCrmWs } from "../_lib/crm";
import { Avatar, PersonPick } from "./bits";

const KIND = {
  note: { label: "Note", icon: StickyNote, tone: "#b45309" },
  call: { label: "Call", icon: PhoneCall, tone: "#047857" },
  meeting: { label: "Meeting", icon: CalendarCheck2, tone: "#2563eb" },
  email_log: { label: "Email", icon: Mail, tone: "#7c3aed" },
  task: { label: "Task", icon: CheckCircle2, tone: "#be185d" },
  event: { label: "Update", icon: Sparkles, tone: "#64748b" },
} as const;
const OUTCOMES = ["Connected", "Left voicemail", "No answer", "Busy", "Wrong number"];

function eventText(a: CrmActivity) {
  const m = a.meta ?? {};
  switch (m.event) {
    case "created": return m.stage ? `created this deal in ${m.stage}` : "created this record";
    case "stage_changed": return <>moved the deal from <b>{m.from}</b> to <b>{m.to}</b>{m.reason ? <> · “{m.reason}”</> : null}</>;
    case "owner_changed": return "changed the owner";
    case "lifecycle_changed": return <>changed lifecycle from <b>{m.from}</b> to <b>{m.to}</b></>;
    case "company_changed": return "changed the company";
    case "amount_changed": return <>changed the amount from <b>{Number(m.from).toLocaleString()}</b> to <b>{Number(m.to).toLocaleString()}</b></>;
    default: return "updated this record";
  }
}

/** one line of the timeline / recent activity */
export function ActivityLine({ a, ws, compact, onToggle, onDelete, canDelete }: { a: CrmActivity; ws: string; compact?: boolean; onToggle?: () => void; onDelete?: () => void; canDelete?: boolean }) {
  const K = KIND[a.kind] ?? KIND.event;
  const target = a.deal ? { href: `/crm/${ws}/deals/${a.deal.id}`, label: a.deal.name } : a.contact ? { href: `/crm/${ws}/contacts/${a.contact.id}`, label: contactName(a.contact) } : a.company ? { href: `/crm/${ws}/companies/${a.company.id}`, label: a.company.name } : null;
  if (a.kind === "event") {
    return (
      <div className="flex items-start gap-2.5 text-[12.5px] text-muted-foreground">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.06]">{a.meta?.event === "stage_changed" ? <ArrowRightLeft className="h-3 w-3" /> : a.meta?.event === "owner_changed" ? <UserRoundCog className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}</span>
        <span className="min-w-0 flex-1"><b className="font-semibold text-foreground">{userName(a.owner) || "Someone"}</b> {eventText(a)}{compact && target && <> · <Link href={target.href} className="text-foreground hover:underline">{target.label}</Link></>}</span>
        <span className="shrink-0 text-[11px]">{ago(a.createdAt)}</span>
      </div>
    );
  }
  return (
    <div className={cn("group flex items-start gap-2.5", !compact && "rounded-2xl border border-border/70 bg-background/60 p-3")}>
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: `${K.tone}18`, color: K.tone }}><K.icon className="h-3.5 w-3.5" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-1.5 text-[12.5px]">
          <b className="font-semibold">{userName(a.owner) || "Someone"}</b>
          <span className="text-muted-foreground">{a.kind === "task" ? "added a task" : a.kind === "call" ? "logged a call" : a.kind === "meeting" ? "logged a meeting" : a.kind === "email_log" ? "logged an email" : "left a note"}</span>
          {compact && target && <>· <Link href={target.href} className="font-medium hover:underline">{target.label}</Link></>}
          <span className="ml-auto text-[11px] text-muted-foreground" title={fmtDateTime(a.createdAt)}>{ago(a.createdAt)}</span>
        </span>
        {a.subject && (
          <span className="mt-0.5 flex items-center gap-1.5 text-[13.5px] font-semibold">
            {a.kind === "task" && onToggle && <button type="button" aria-label={a.doneAt ? "Mark not done" : "Mark done"} onClick={onToggle} className="text-muted-foreground hover:text-primary">{a.doneAt ? <CheckCircle2 className="h-4 w-4 text-[#047857]" /> : <Circle className="h-4 w-4" />}</button>}
            <span className={cn(a.doneAt && "text-muted-foreground line-through")}>{a.subject}</span>
          </span>
        )}
        {!compact && a.body && <span className="mt-1 block whitespace-pre-wrap text-[13px] text-foreground/85">{a.body}</span>}
        {!compact && (a.outcome || a.durationMin || a.dueAt || a.assignee) && (
          <span className="mt-1.5 flex flex-wrap gap-1.5 text-[11.5px]">
            {a.outcome && <span className="rounded-full bg-black/[0.04] px-2 py-0.5 dark:bg-white/[0.06]">{a.outcome}</span>}
            {a.durationMin ? <span className="rounded-full bg-black/[0.04] px-2 py-0.5 dark:bg-white/[0.06]">{a.durationMin} min</span> : null}
            {a.dueAt && <span className={cn("rounded-full px-2 py-0.5", !a.doneAt && isPast(a.dueAt) ? "bg-[#dc2626]/10 font-semibold text-[#dc2626] dark:text-[#f87171]" : "bg-black/[0.04] dark:bg-white/[0.06]")}>Due {fmtDate(a.dueAt)}</span>}
            {a.assignee && <span className="flex items-center gap-1 rounded-full bg-black/[0.04] py-0.5 pl-0.5 pr-2 dark:bg-white/[0.06]"><Avatar user={a.assignee} size={16} />{userName(a.assignee)}</span>}
          </span>
        )}
      </span>
      {canDelete && onDelete && <button type="button" aria-label="Delete" onClick={onDelete} className="rounded-lg p-1 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-destructive focus:opacity-100 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>}
    </div>
  );
}

/** composer (Note | Call | Meeting | Email | Task) + filtered timeline for one record */
export function Timeline({ object, id, links }: { object: CrmObject; id: number; links: { contactId?: number; companyId?: number; dealId?: number } }) {
  const { uid, ws } = useCrmWs();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [kind, setKind] = useState<"note" | "call" | "meeting" | "email_log" | "task">("note");
  const [f, setF] = useState<Record<string, any>>({});
  const [filter, setFilter] = useState<"all" | "note" | "call" | "meeting" | "task" | "event">("all");
  const { data = [], isLoading } = useQuery({ queryKey: crmKeys.timeline(uid, object, id), queryFn: () => crmApi.timeline(uid, object, id), enabled: !!uid });
  const refresh = () => { qc.invalidateQueries({ queryKey: crmKeys.timeline(uid, object, id) }); qc.invalidateQueries({ queryKey: ["crm", uid, "tasks"] }); qc.invalidateQueries({ queryKey: ["crm", uid, "home"] }); };
  const add = useMutation({
    mutationFn: () => crmApi.createActivity(uid, { kind, ...links, subject: f.subject?.trim() || null, body: f.body?.trim() || null, outcome: f.outcome || null, durationMin: f.durationMin ? Number(f.durationMin) : null, dueAt: kind === "task" ? dayIso(f.dueAt ?? "") : null, ...(kind === "task" && { assigneeId: f.assigneeId ?? user?.id }) }),
    onSuccess: () => { setF({}); refresh(); toast.success(kind === "task" ? "Task added" : "Logged"); },
    onError: onErr("Couldn't save."),
  });
  const toggle = useMutation({ mutationFn: (a: CrmActivity) => crmApi.updateActivity(uid, a.id, { done: !a.doneAt }), onSuccess: refresh, onError: onErr() });
  const remove = useMutation({ mutationFn: (a: CrmActivity) => crmApi.deleteActivity(uid, a.id), onSuccess: refresh, onError: onErr() });
  const shown = useMemo(() => (filter === "all" ? data : data.filter((a) => a.kind === filter)), [data, filter]);
  const groups = useMemo(() => {
    const g: { label: string; items: CrmActivity[] }[] = [];
    for (const a of shown) {
      const label = new Date(a.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const last = g[g.length - 1];
      if (last?.label === label) last.items.push(a); else g.push({ label, items: [a] });
    }
    return g;
  }, [shown]);
  const ready = kind === "task" ? !!f.subject?.trim() : !!(f.body?.trim() || f.subject?.trim());

  return (
    <div className="space-y-4">
      {ws?.canEdit && (
        <div className="rounded-[20px] border border-border bg-background/80 p-3 shadow-[0_1px_2px_rgb(11_42_31/0.04)]">
          <div role="tablist" aria-label="Log" className="mb-2 flex flex-wrap gap-1">
            {(["note", "call", "meeting", "email_log", "task"] as const).map((k) => { const K = KIND[k]; return (
              <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12.5px] font-medium transition", kind === k ? "bg-card shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}><K.icon className="h-3.5 w-3.5" style={{ color: kind === k ? K.tone : undefined }} />{K.label}</button>
            ); })}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (ready) add.mutate(); }} className="space-y-2">
            {(kind !== "note") && <input value={f.subject ?? ""} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder={kind === "task" ? "What needs to be done?" : kind === "call" ? "Call about…" : kind === "meeting" ? "Meeting title" : "Email subject"} aria-label="Title" className={input} />}
            <textarea value={f.body ?? ""} onChange={(e) => setF({ ...f, body: e.target.value })} rows={kind === "note" ? 3 : 2} placeholder={kind === "note" ? "Write a note… what was said, what's next" : "Details (optional)"} aria-label="Details" className={cn(input, "h-auto resize-y py-2")} />
            <div className="flex flex-wrap items-center gap-2">
              {kind === "call" && <select aria-label="Outcome" value={f.outcome ?? ""} onChange={(e) => setF({ ...f, outcome: e.target.value })} className="h-8 rounded-lg border border-border bg-background px-2 text-[12.5px]"><option value="">Outcome…</option>{OUTCOMES.map((o) => <option key={o}>{o}</option>)}</select>}
              {(kind === "call" || kind === "meeting") && <label className="flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-2 text-[12.5px] text-muted-foreground"><input type="number" min={0} value={f.durationMin ?? ""} onChange={(e) => setF({ ...f, durationMin: e.target.value })} aria-label="Minutes" className="w-12 bg-transparent text-foreground outline-none" />min</label>}
              {kind === "task" && <>
                <label className="flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-2 text-[12.5px] text-muted-foreground">Due <input type="date" value={f.dueAt ?? ""} onChange={(e) => setF({ ...f, dueAt: e.target.value })} aria-label="Due date" className="bg-transparent text-foreground outline-none" /></label>
                <div className="w-48"><PersonPick members={ws.members} value={f.assigneeId ?? user?.id ?? null} onChange={(v) => setF({ ...f, assigneeId: v })} label="Assignee" allowNone={false} /></div>
              </>}
              <span className="flex-1" />
              <button type="submit" disabled={!ready || add.isPending} className={btnPrimary}>{add.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{kind === "task" ? "Add task" : "Log"}</button>
            </div>
          </form>
        </div>
      )}
      <div role="group" aria-label="Show" className="flex flex-wrap gap-1 text-[12px]">
        {([["all", "All"], ["note", "Notes"], ["call", "Calls"], ["meeting", "Meetings"], ["task", "Tasks"], ["event", "Updates"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={cn("rounded-full px-2.5 py-1 font-medium", filter === k ? "bg-forest text-white dark:bg-primary dark:text-primary-foreground" : "bg-black/[0.04] text-muted-foreground hover:text-foreground dark:bg-white/[0.06]")}>{l}</button>)}
      </div>
      {isLoading ? <p className="py-6 text-center text-[12.5px] text-muted-foreground">Loading…</p> : !shown.length ? (
        <p className="flex items-center justify-center gap-2 py-10 text-[13px] text-muted-foreground"><MessageSquareText className="h-4 w-4" /> Nothing here yet.</p>
      ) : groups.map((g) => (
        <section key={g.label} aria-label={g.label}>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{g.label}</h3>
          <ul className="space-y-2">{g.items.map((a) => <li key={a.id}><ActivityLine a={a} ws={uid} onToggle={() => toggle.mutate(a)} onDelete={() => remove.mutate(a)} canDelete={!!ws && (a.ownerId === user?.id || ws.canAdmin)} /></li>)}</ul>
        </section>
      ))}
    </div>
  );
}
