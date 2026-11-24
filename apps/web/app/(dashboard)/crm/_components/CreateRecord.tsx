"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/providers/AuthProvider";
import { crmApi, LEAD_STATUSES, LEAD_STATUS_LABEL, LIFECYCLES, LIFECYCLE_LABEL, type CrmCompany } from "@/services/crm.api";
import { btnGhost, btnPrimary, dayIso, errMsg, input, useCrmWs } from "../_lib/crm";
import { PersonPick } from "./bits";

export type CreateKind = "contact" | "company" | "deal" | "task";

/** pick a company of this CRM (searches the server) */
export function CompanyPick({ ws, value, onChange, label = "Company" }: { ws: string; value: { id: number; name: string } | null; onChange: (c: { id: number; name: string } | null) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data } = useQuery({ queryKey: ["crm", ws, "company-pick", q.trim()], queryFn: () => crmApi.list<CrmCompany>(ws, "company", { q: q.trim(), pageSize: 20, sort: "name", dir: "asc" }), enabled: open });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`${label}: ${value?.name ?? "none"}`} className="flex h-9 w-full min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-2.5 text-left text-[13px]">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted-foreground")}>{value?.name ?? "No company"}</span>
          {value ? <span role="button" aria-label="Clear company" onClick={(e) => { e.stopPropagation(); onChange(null); }} className="rounded p-0.5 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></span> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[240px] rounded-xl p-1.5">
        <label className="mb-1 flex h-8 items-center gap-1.5 rounded-lg border border-border px-2"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a company" aria-label="Find a company" className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none" /></label>
        <ul className="max-h-56 overflow-y-auto">
          {(data?.rows ?? []).map((c) => <li key={c.id}><button type="button" onClick={() => { onChange({ id: c.id, name: c.name }); setOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-accent"><span className="min-w-0 flex-1 truncate">{c.name}</span>{c.domain && <span className="text-[11px] text-muted-foreground">{c.domain}</span>}{value?.id === c.id && <Check className="h-3.5 w-3.5 text-primary" />}</button></li>)}
          {data && !data.rows.length && <li className="px-2 py-3 text-center text-[12px] text-muted-foreground">No companies found.</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

const F = ({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) => (
  <label className={cn("block", wide && "sm:col-span-2")}><span className="mb-1 block text-[12px] font-medium text-muted-foreground">{label}</span>{children}</label>
);

export function CreateRecord({ kind, onClose, defaults }: { kind: CreateKind; onClose: () => void; defaults?: { companyId?: number; companyName?: string; contactId?: number; dealId?: number; stageId?: number; pipelineId?: number } }) {
  const { uid, ws } = useCrmWs();
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [f, setF] = useState<Record<string, any>>({ lifecycle: "lead", leadStatus: "new", ownerId: user?.id ?? null, assigneeId: user?.id ?? null, pipelineId: defaults?.pipelineId ?? null, stageId: defaults?.stageId ?? null });
  const [company, setCompany] = useState<{ id: number; name: string } | null>(defaults?.companyId ? { id: defaults.companyId, name: defaults.companyName ?? "Company" } : null);
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const members = ws?.members ?? [];
  const pipelines = ws?.pipelines ?? [];
  const pipeline = pipelines.find((p) => p.id === f.pipelineId) ?? pipelines[0];
  const openStages = (pipeline?.stages ?? []).filter((s) => !s.isLost);

  const save = useMutation({
    mutationFn: async () => {
      if (kind === "contact") return crmApi.create<{ id: number }>(uid, "contact", { firstName: f.firstName, lastName: f.lastName ?? "", email: f.email || null, phone: f.phone || null, title: f.title || null, companyId: company?.id ?? null, ownerId: f.ownerId, lifecycle: f.lifecycle, leadStatus: f.leadStatus });
      if (kind === "company") return crmApi.create<{ id: number }>(uid, "company", { name: f.name, domain: f.domain || null, industry: f.industry || null, size: f.size || null, phone: f.phone || null, city: f.city || null, country: f.country || null, ownerId: f.ownerId });
      if (kind === "deal") return crmApi.create<{ id: number }>(uid, "deal", { name: f.name, amount: Number(f.amount) || 0, pipelineId: pipeline?.id, stageId: f.stageId ?? openStages[0]?.id, closeDate: dayIso(f.closeDate ?? ""), ownerId: f.ownerId, companyId: company?.id ?? null, priority: f.priority || null, ...(defaults?.contactId && { contactIds: [defaults.contactId] }) });
      return crmApi.createActivity(uid, { kind: "task", subject: f.subject, body: f.body || null, dueAt: dayIso(f.dueAt ?? ""), assigneeId: f.assigneeId, contactId: defaults?.contactId ?? null, companyId: defaults?.companyId ?? null, dealId: defaults?.dealId ?? null });
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["crm", uid] });
      toast.success(`${kind === "company" ? "Company" : kind[0]!.toUpperCase() + kind.slice(1)} created`);
      onClose();
      if (kind !== "task" && !defaults) router.push(`/crm/${uid}/${kind === "company" ? "companies" : `${kind}s`}/${r.id}`);
    },
    onError: (e) => toast.error(errMsg(e, "Couldn't save.")),
  });
  const ready = kind === "contact" ? !!f.firstName?.trim() : kind === "task" ? !!f.subject?.trim() : !!f.name?.trim();
  const title = { contact: "New contact", company: "New company", deal: "New deal", task: "New task" }[kind];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-[24px] sm:max-w-[560px]">
        <DialogTitle className="text-[19px] font-semibold">{title}</DialogTitle>
        <DialogDescription>{kind === "task" ? "Give someone a to-do with a due date." : "You can fill in the rest later on the record."}</DialogDescription>
        <form onSubmit={(e) => { e.preventDefault(); if (ready) save.mutate(); }} className="grid gap-3 sm:grid-cols-2">
          {kind === "contact" && <>
            <F label="First name *"><input autoFocus className={input} value={f.firstName ?? ""} onChange={(e) => set("firstName", e.target.value)} /></F>
            <F label="Last name"><input className={input} value={f.lastName ?? ""} onChange={(e) => set("lastName", e.target.value)} /></F>
            <F label="Email"><input type="email" className={input} value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} /></F>
            <F label="Phone"><input className={input} value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></F>
            <F label="Job title"><input className={input} value={f.title ?? ""} onChange={(e) => set("title", e.target.value)} /></F>
            <F label="Company"><CompanyPick ws={uid} value={company} onChange={setCompany} /></F>
            <F label="Lifecycle stage"><select className={input} value={f.lifecycle} onChange={(e) => set("lifecycle", e.target.value)}>{LIFECYCLES.map((l) => <option key={l} value={l}>{LIFECYCLE_LABEL[l]}</option>)}</select></F>
            <F label="Lead status"><select className={input} value={f.leadStatus} onChange={(e) => set("leadStatus", e.target.value)}>{LEAD_STATUSES.map((l) => <option key={l} value={l}>{LEAD_STATUS_LABEL[l]}</option>)}</select></F>
            <F label="Owner" wide><PersonPick members={members} value={f.ownerId} onChange={(v) => set("ownerId", v)} /></F>
          </>}
          {kind === "company" && <>
            <F label="Company name *" wide><input autoFocus className={input} value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} /></F>
            <F label="Website / domain"><input className={input} placeholder="acme.com" value={f.domain ?? ""} onChange={(e) => set("domain", e.target.value)} /></F>
            <F label="Industry"><input className={input} value={f.industry ?? ""} onChange={(e) => set("industry", e.target.value)} /></F>
            <F label="Size"><select className={input} value={f.size ?? ""} onChange={(e) => set("size", e.target.value)}><option value="">—</option>{["1-10", "11-50", "51-200", "201-1000", "1000+"].map((s) => <option key={s}>{s}</option>)}</select></F>
            <F label="Phone"><input className={input} value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></F>
            <F label="City"><input className={input} value={f.city ?? ""} onChange={(e) => set("city", e.target.value)} /></F>
            <F label="Country"><input className={input} value={f.country ?? ""} onChange={(e) => set("country", e.target.value)} /></F>
            <F label="Owner" wide><PersonPick members={members} value={f.ownerId} onChange={(v) => set("ownerId", v)} /></F>
          </>}
          {kind === "deal" && <>
            <F label="Deal name *" wide><input autoFocus className={input} value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} /></F>
            <F label={`Amount (${ws?.currency ?? "USD"})`}><input type="number" min={0} step="0.01" className={input} value={f.amount ?? ""} onChange={(e) => set("amount", e.target.value)} /></F>
            <F label="Close date"><input type="date" className={input} value={f.closeDate ?? ""} onChange={(e) => set("closeDate", e.target.value)} /></F>
            {pipelines.length > 1 && <F label="Pipeline"><select className={input} value={pipeline?.id} onChange={(e) => { set("pipelineId", Number(e.target.value)); set("stageId", null); }}>{pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></F>}
            <F label="Stage"><select className={input} value={f.stageId ?? openStages[0]?.id ?? ""} onChange={(e) => set("stageId", Number(e.target.value))}>{openStages.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.probability}%</option>)}</select></F>
            <F label="Company"><CompanyPick ws={uid} value={company} onChange={setCompany} /></F>
            <F label="Priority"><select className={input} value={f.priority ?? ""} onChange={(e) => set("priority", e.target.value)}><option value="">—</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></F>
            <F label="Owner" wide><PersonPick members={members} value={f.ownerId} onChange={(v) => set("ownerId", v)} /></F>
          </>}
          {kind === "task" && <>
            <F label="Task *" wide><input autoFocus className={input} placeholder="e.g. Send the proposal" value={f.subject ?? ""} onChange={(e) => set("subject", e.target.value)} /></F>
            <F label="Due"><input type="date" className={input} value={f.dueAt ?? ""} onChange={(e) => set("dueAt", e.target.value)} /></F>
            <F label="Assigned to"><PersonPick members={members} value={f.assigneeId} onChange={(v) => set("assigneeId", v)} label="Assignee" allowNone={false} /></F>
            <F label="Notes" wide><textarea rows={3} className={cn(input, "h-auto py-2")} value={f.body ?? ""} onChange={(e) => set("body", e.target.value)} /></F>
          </>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
            <button type="submit" disabled={!ready || save.isPending} className={btnPrimary}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Create</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
