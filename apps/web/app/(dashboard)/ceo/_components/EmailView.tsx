"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Mail, MailPlus, MinusCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ceoApi, type CeoEmailResult } from "@/services/ceo-tower.api";
import { Avatar } from "../../work/_components/primitives";
import { PeoplePicker } from "./PeoplePicker";

const STATUS: Record<string, { label: string; cls: string; icon: typeof Mail }> = {
  sent: { label: "Sent", cls: "text-primary", icon: CheckCircle2 },
  failed: { label: "Failed", cls: "text-destructive", icon: AlertTriangle },
  not_sent: { label: "Not sent — email isn't set up", cls: "text-[#8a6a35] dark:text-[#d9bd8c]", icon: MinusCircle },
  pending: { label: "Sending", cls: "text-muted-foreground", icon: Mail },
};

/** CEO Tower → Email: write to management, a team, a company or one person; see what went out */
export function EmailView() {
  const [composing, setComposing] = useState(false);
  const { data = [], isLoading } = useQuery({ queryKey: ["ceo-tower", "email-history"], queryFn: ceoApi.emailHistory });
  return (
    <section aria-label="Email" className="rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-brass-soft"><Mail className="h-4.5 w-4.5" /></span>
        <span className="min-w-0 flex-1"><span className="block font-serif text-[21px] leading-tight">Email</span><span className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">To management, a team, a company or one person</span></span>
        <button type="button" onClick={() => setComposing(true)} className="flex h-9 items-center gap-1.5 rounded-lg bg-forest px-3.5 text-[13px] font-semibold text-forest-foreground hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground"><MailPlus className="h-4 w-4" /> Write email</button>
      </header>
      {isLoading ? <div className="h-32 animate-pulse rounded-b-2xl bg-muted" /> : !data.length ? (
        <p className="px-5 py-14 text-center text-[13px] text-muted-foreground">Emails you send from CEO Tower show up here.</p>
      ) : (
        <ul aria-label="Sent emails" className="divide-y divide-border">
          {data.map((e) => {
            const s = STATUS[e.deliveryStatus] ?? STATUS.pending!;
            return (
              <li key={e.id} className="flex items-start gap-3 px-5 py-3">
                <Avatar user={e.recipient as any} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-[13px]"><strong>{e.recipient.firstName} {e.recipient.lastName}</strong><span className="text-[11.5px] text-muted-foreground">{e.recipient.email}</span></p>
                  <p className="truncate text-[13px] font-medium">{e.subject}</p>
                  <p className="line-clamp-1 text-[12px] text-muted-foreground">{e.body}</p>
                </div>
                <span className={cn("flex shrink-0 items-center gap-1 text-[11.5px] font-medium", s.cls)}><s.icon className="h-3.5 w-3.5" /> {s.label}</span>
                <span className="w-28 shrink-0 text-right font-mono text-[11px] text-muted-foreground">{new Date(e.sentAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              </li>
            );
          })}
        </ul>
      )}
      {composing && <EmailDialog onClose={() => setComposing(false)} />}
    </section>
  );
}

export function EmailDialog({ onClose, initialTo = [] }: { onClose: () => void; initialTo?: number[] }) {
  const qc = useQueryClient();
  const [to, setTo] = useState<number[]>(initialTo);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("Hi {first_name},\n\n");
  const [done, setDone] = useState<CeoEmailResult | null>(null);
  const send = useMutation({
    mutationFn: () => ceoApi.email({ recipientIds: to, subject: subject.trim(), body: body.trim() }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["ceo-tower", "email-history"] });
      setDone(r);
      if (r.sent && !r.failed && !r.notSent) { toast.success(`Email sent to ${r.sent} ${r.sent === 1 ? "person" : "people"}`); onClose(); }
    },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't send."),
  });
  const ready = to.length > 0 && subject.trim() && body.replace(/Hi \{first_name\},/i, "").trim();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[640px]">
        <DialogTitle className="font-serif text-[22px] font-normal">Write an email</DialogTitle>
        <DialogDescription>Each person gets their own copy from you. <code className="rounded bg-muted px-1 font-mono text-[11.5px]">{"{first_name}"}</code> becomes their name.</DialogDescription>
        {done ? (
          <div role="status" className="rounded-xl border border-border p-4 text-[13px]">
            <p className="font-semibold">{done.sent} sent{done.failed ? ` · ${done.failed} failed` : ""}{done.notSent ? ` · ${done.notSent} not sent` : ""}</p>
            {done.notSent > 0 && <p className="mt-1 text-[12.5px] text-[#8a6a35] dark:text-[#d9bd8c]">Email isn&apos;t set up on this server (MAIL_HOST / MAIL_USER / MAIL_PASSWORD), so nothing went out. It is saved in your history.</p>}
            <ul className="mt-2 space-y-0.5 text-[12.5px]">{done.results.filter((r) => r.status !== "sent").map((r) => <li key={r.id}>{r.name}: {r.error ?? r.status}</li>)}</ul>
            <div className="mt-3 flex justify-end"><button type="button" onClick={onClose} className="h-8 rounded-lg border border-border px-3 text-[12.5px] hover:bg-accent">Close</button></div>
          </div>
        ) : (
          <>
            <div className="grid gap-3">
              <PeoplePicker value={to} onChange={setTo} label="To" />
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject" maxLength={200} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[14px] font-medium outline-none focus:border-primary/50" />
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} aria-label="Email" maxLength={20000} className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-[13.5px] leading-relaxed outline-none focus:border-primary/50" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] text-muted-foreground">{ready ? `${to.length} ${to.length === 1 ? "person" : "people"}` : "Pick people, add a subject and write something."}</span>
              <button type="button" disabled={!ready || send.isPending} onClick={() => send.mutate()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">{send.isPending ? "Sending…" : "Send email"}</button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
