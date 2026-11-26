"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Building2, CalendarClock, CircleDollarSign, Contact, Link2, Mail, Phone, Plus, Trash2, Trophy, Video, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  contactName, crmApi, crmKeys, fmtMoney, LEAD_STATUSES, LEAD_STATUS_LABEL, LIFECYCLES, LIFECYCLE_LABEL,
  type CrmCompany, type CrmContact, type CrmDeal, type CrmObject, type CrmProperty, type CrmStage,
} from "@/services/crm.api";
import { btnGhost, btnPrimary, dayInput, dayIso, fmtDate, glass, input, isPast, onErr, useCrmWs } from "../_lib/crm";
import { Avatar, LifecyclePill, Monogram, PersonPick, Skeleton, StagePill } from "./bits";
import { CompanyPick, CreateRecord } from "./CreateRecord";
import { Timeline } from "./Timeline";
import { ceoApi } from "@/services/ceo-tower.api";
import { MeetingDialog } from "../../ceo/_components/MeetingsView";

type FieldType = "text" | "email" | "number" | "date" | "select" | "url" | "bool" | "multiselect";

/** click-to-edit property row */
function Field({ label, value, display, type = "text", options, canEdit, onSave }: { label: string; value: unknown; display?: React.ReactNode; type?: FieldType; options?: { value: string; label: string }[]; canEdit: boolean; onSave: (v: unknown) => void }) {
  const [edit, setEdit] = useState(false);
  const empty = value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length);
  const shown = display ?? (empty ? null : type === "date" ? fmtDate(String(value), { month: "short", day: "numeric", year: "numeric" }) : type === "bool" ? (value ? "Yes" : "No") : Array.isArray(value) ? value.join(", ") : options?.find((o) => o.value === value)?.label ?? String(value));
  return (
    <div className="group rounded-xl px-2 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {edit && canEdit ? (
        type === "select" ? (
          <select autoFocus defaultValue={String(value ?? "")} onChange={(e) => { onSave(e.target.value || null); setEdit(false); }} onBlur={() => setEdit(false)} className={cn(input, "mt-0.5 h-8")}><option value="">—</option>{options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        ) : type === "bool" ? (
          <select autoFocus defaultValue={value ? "1" : ""} onChange={(e) => { onSave(!!e.target.value); setEdit(false); }} onBlur={() => setEdit(false)} className={cn(input, "mt-0.5 h-8")}><option value="">No</option><option value="1">Yes</option></select>
        ) : (
          <input autoFocus type={type === "number" ? "number" : type === "date" ? "date" : type === "email" ? "email" : "text"}
            defaultValue={type === "date" ? dayInput(value as string) : Array.isArray(value) ? value.join(", ") : String(value ?? "")}
            onBlur={(e) => { setEdit(false); const v = e.target.value.trim(); const out = v === "" ? null : type === "number" ? Number(v) : type === "date" ? dayIso(v) : type === "multiselect" ? v.split(",").map((x) => x.trim()).filter(Boolean) : v; if (JSON.stringify(out) !== JSON.stringify(value ?? null)) onSave(out); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEdit(false); }}
            className={cn(input, "mt-0.5 h-8")} />
        )
      ) : (
        <button type="button" disabled={!canEdit} onClick={() => setEdit(true)} className="mt-0.5 block w-full truncate text-left text-[13.5px] disabled:cursor-default">{empty && !display ? <span className="text-muted-foreground/60">{canEdit ? "Add…" : "—"}</span> : shown}</button>
      )}
    </div>
  );
}

function CustomFields({ props, custom, canEdit, onSave }: { props: CrmProperty[]; custom: Record<string, unknown>; canEdit: boolean; onSave: (key: string, v: unknown) => void }) {
  if (!props.length) return null;
  return (
    <div className="mt-2 border-t border-border/70 pt-2">
      <p className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Custom</p>
      {props.map((p) => <Field key={p.id} label={p.label} value={custom?.[p.key]} type={p.type === "url" ? "url" : p.type} options={p.options.map((o) => ({ value: o, label: o }))} canEdit={canEdit} onSave={(v) => onSave(p.key, v)} />)}
    </div>
  );
}

function Side({ title, icon: Icon, count, action, children }: { title: string; icon: typeof Contact; count?: number; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={title} className={cn(glass, "p-4")}>
      <header className="mb-2 flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /><h3 className="flex-1 text-[13.5px] font-semibold">{title}{count !== undefined && <span className="ml-1.5 text-muted-foreground">{count}</span>}</h3>{action}</header>
      {children}
    </section>
  );
}

function Shell({ back, header, left, right, object, id, links }: { back: { href: string; label: string }; header: React.ReactNode; left: React.ReactNode; right: React.ReactNode; object: CrmObject; id: number; links: { contactId?: number; companyId?: number; dealId?: number } }) {
  return (
    <div className="space-y-3">
      <Link href={back.href} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> {back.label}</Link>
      {header}
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_300px]">
        <aside className="space-y-4">{left}</aside>
        <section aria-label="Activity" className={cn(glass, "min-w-0 p-4")}><Timeline object={object} id={id} links={links} /></section>
        <aside className="space-y-4 lg:col-span-2 xl:col-span-1">{right}</aside>
      </div>
    </div>
  );
}

function useRecord<T>(object: CrmObject, id: number) {
  const { uid, ws } = useCrmWs();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: crmKeys.record(uid, object, id), queryFn: () => crmApi.record<T>(uid, object, id), enabled: !!uid && !!id });
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => crmApi.update(uid, object, id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm", uid] }); },
    onError: onErr("Couldn't save."),
  });
  return { uid, ws, ...q, save: (b: Record<string, unknown>) => save.mutate(b) };
}

function DeleteButton({ object, id, name, onDone }: { object: CrmObject; id: number; name: string; onDone: () => void }) {
  const { uid } = useCrmWs();
  const qc = useQueryClient();
  const del = useMutation({ mutationFn: () => crmApi.remove(uid, object, id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm", uid] }); toast.success("Deleted"); onDone(); }, onError: onErr() });
  return <button type="button" onClick={() => window.confirm(`Delete “${name}”? Its activity goes too. This can't be undone.`) && del.mutate()} className={cn(btnGhost, "text-destructive")}><Trash2 className="h-3.5 w-3.5" /> Delete</button>;
}

const Header = ({ mono, title, sub, pills, actions }: { mono: React.ReactNode; title: string; sub?: React.ReactNode; pills?: React.ReactNode; actions?: React.ReactNode }) => (
  <div className={cn(glass, "flex flex-wrap items-center gap-4 p-5")}>
    {mono}
    <span className="min-w-0 flex-1"><h2 className="truncate text-[24px] font-semibold tracking-tight">{title}</h2>{sub && <p className="truncate text-[13px] text-muted-foreground">{sub}</p>}{pills && <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{pills}</div>}</span>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

// ───────────── contact ─────────────
/** Upcoming meetings for a CRM record + a "Schedule" action that invites the contact by email. */
function RecordMeetings({ wsId, contactId, companyId, inviteEmail, inviteName, titleHint, canEdit }: { wsId: number; contactId?: number; companyId?: number; inviteEmail?: string; inviteName?: string; titleHint?: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ["ceo-tower", "crm-meetings", wsId, contactId ?? 0, companyId ?? 0],
    queryFn: () => ceoApi.crmMeetings({ workspaceId: wsId, contactId, companyId }),
    enabled: !!wsId,
  });
  const upcoming = data.filter((m) => !m.cancelledAt);
  return (
    <Side title="Meetings" icon={CalendarClock} count={upcoming.length}
      action={canEdit ? <button type="button" onClick={() => setOpen(true)} aria-label="Schedule a meeting" className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="h-4 w-4" /></button> : undefined}>
      {!upcoming.length ? <p className="text-[12.5px] text-muted-foreground">No meetings scheduled.</p> : (
        <ul className="space-y-1.5">{upcoming.map((m) => (
          <li key={m.id} className="rounded-xl px-1.5 py-1">
            <p className="truncate text-[13px] font-medium">{m.title}</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">{new Date(m.scheduledAt).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
            {m.meetingLink && <a href={m.meetingLink} target="_blank" rel="noreferrer noopener" className="mt-0.5 flex items-center gap-1 text-[11.5px] font-medium text-primary hover:underline"><Video className="h-3 w-3" /> Join</a>}
          </li>
        ))}</ul>
      )}
      {open && <MeetingDialog meeting={null} onClose={() => setOpen(false)} lockPeople crm={{ workspaceId: wsId, contactId, companyId }} presetTitle={titleHint} presetEmails={inviteEmail ? [{ email: inviteEmail, name: inviteName }] : []} />}
    </Side>
  );
}

export function ContactRecord({ id }: { id: number }) {
  const r = useRecord<CrmContact & { deals: (Pick<CrmDeal, "id" | "name" | "amount" | "closeDate"> & { stage: CrmDeal["stage"] })[] }>("contact", id);
  const router = useRouter();
  const qc = useQueryClient();
  const [newDeal, setNewDeal] = useState(false);
  const { uid, ws, data: c } = r;
  const unlink = useMutation({ mutationFn: (dealId: number) => crmApi.linkContact(uid, dealId, id, false), onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", uid] }), onError: onErr() });
  if (r.isLoading || !c || !ws) return <Skeleton className="h-[520px]" />;
  const can = ws.canEdit;
  const props = ws.properties.filter((p) => p.object === "contact");
  return (
    <Shell object="contact" id={id} links={{ contactId: id }} back={{ href: `/crm/${uid}/contacts`, label: "Contacts" }}
      header={<Header mono={<Monogram text={c.firstName} size={56} className="rounded-2xl" />} title={contactName(c)} sub={[c.title, c.company?.name].filter(Boolean).join(" · ") || c.email || undefined}
        pills={<><LifecyclePill value={c.lifecycle} />{c.owner && <span className="flex items-center gap-1 text-[12px] text-muted-foreground"><Avatar user={c.owner} size={18} /> {c.owner.firstName}</span>}</>}
        actions={<>{c.email && <a href={`mailto:${c.email}`} className={btnGhost}><Mail className="h-3.5 w-3.5" /> Email</a>}{c.phone && <a href={`tel:${c.phone}`} className={btnGhost}><Phone className="h-3.5 w-3.5" /> Call</a>}{can && <DeleteButton object="contact" id={id} name={contactName(c)} onDone={() => router.push(`/crm/${uid}/contacts`)} />}</>} />}
      left={<section aria-label="About" className={cn(glass, "p-3")}>
        <p className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">About this contact</p>
        <Field label="First name" value={c.firstName} canEdit={can} onSave={(v) => v && r.save({ firstName: v })} />
        <Field label="Last name" value={c.lastName} canEdit={can} onSave={(v) => r.save({ lastName: v ?? "" })} />
        <Field label="Email" type="email" value={c.email} canEdit={can} onSave={(v) => r.save({ email: v })} />
        <Field label="Phone" value={c.phone} canEdit={can} onSave={(v) => r.save({ phone: v })} />
        <Field label="Job title" value={c.title} canEdit={can} onSave={(v) => r.save({ title: v })} />
        <Field label="Lifecycle stage" type="select" value={c.lifecycle} options={LIFECYCLES.map((l) => ({ value: l, label: LIFECYCLE_LABEL[l] }))} canEdit={can} onSave={(v) => v && r.save({ lifecycle: v })} />
        <Field label="Lead status" type="select" value={c.leadStatus} options={LEAD_STATUSES.map((l) => ({ value: l, label: LEAD_STATUS_LABEL[l] }))} canEdit={can} onSave={(v) => r.save({ leadStatus: v })} />
        <Field label="Source" value={c.source} canEdit={can} onSave={(v) => r.save({ source: v })} />
        <div className="px-2 py-1.5"><p className="mb-0.5 text-[11px] font-medium text-muted-foreground">Owner</p><PersonPick members={ws.members} value={c.ownerId} disabled={!can} onChange={(v) => r.save({ ownerId: v })} /></div>
        <CustomFields props={props} custom={c.custom} canEdit={can} onSave={(k, v) => r.save({ custom: { [k]: v } })} />
        <p className="mt-2 px-2 text-[11px] text-muted-foreground">Created {fmtDate(c.createdAt, { month: "short", day: "numeric", year: "numeric" })}</p>
      </section>}
      right={<>
        <Side title="Company" icon={Building2}>
          {can ? <CompanyPick ws={uid} value={c.company} onChange={(v) => r.save({ companyId: v?.id ?? null })} /> : c.company ? <Link href={`/crm/${uid}/companies/${c.company.id}`} className="text-[13px] font-medium hover:underline">{c.company.name}</Link> : <p className="text-[12.5px] text-muted-foreground">No company.</p>}
          {c.company && can && <Link href={`/crm/${uid}/companies/${c.company.id}`} className="mt-2 inline-block text-[12px] font-semibold text-primary hover:underline">Open company</Link>}
        </Side>
        <Side title="Deals" icon={CircleDollarSign} count={c.deals.length} action={can ? <button type="button" onClick={() => setNewDeal(true)} aria-label="New deal for this contact" className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="h-4 w-4" /></button> : undefined}>
          {!c.deals.length ? <p className="text-[12.5px] text-muted-foreground">No deals yet.</p> : (
            <ul className="space-y-1.5">{c.deals.map((d) => (
              <li key={d.id} className="group flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                <Link href={`/crm/${uid}/deals/${d.id}`} className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{d.name}</span><span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><StagePill stage={d.stage} /> {fmtMoney(d.amount, ws.currency, true)}</span></Link>
                {can && <button type="button" aria-label={`Unlink ${d.name}`} onClick={() => unlink.mutate(d.id)} className="rounded p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"><X className="h-3.5 w-3.5" /></button>}
              </li>
            ))}</ul>
          )}
        </Side>
        <RecordMeetings wsId={ws.id} contactId={id} companyId={c.company?.id} inviteEmail={c.email ?? undefined} inviteName={contactName(c)} titleHint={`Meeting with ${contactName(c)}`} canEdit={can} />
        {newDeal && <CreateRecord kind="deal" onClose={() => setNewDeal(false)} defaults={{ contactId: id, ...(c.company && { companyId: c.company.id, companyName: c.company.name }) }} />}
      </>} />
  );
}

// ───────────── company ─────────────
export function CompanyRecord({ id }: { id: number }) {
  const r = useRecord<CrmCompany & { contacts: Pick<CrmContact, "id" | "firstName" | "lastName" | "email" | "title" | "lifecycle">[]; deals: (Pick<CrmDeal, "id" | "name" | "amount" | "closeDate"> & { stage: CrmDeal["stage"] })[] }>("company", id);
  const router = useRouter();
  const [create, setCreate] = useState<"contact" | "deal" | null>(null);
  const { uid, ws, data: c } = r;
  if (r.isLoading || !c || !ws) return <Skeleton className="h-[520px]" />;
  const can = ws.canEdit;
  const props = ws.properties.filter((p) => p.object === "company");
  const open = c.deals.filter((d) => !d.stage.isWon && !d.stage.isLost);
  return (
    <Shell object="company" id={id} links={{ companyId: id }} back={{ href: `/crm/${uid}/companies`, label: "Companies" }}
      header={<Header mono={<Monogram text={c.name} size={56} className="rounded-2xl" />} title={c.name} sub={[c.domain, c.industry, [c.city, c.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || undefined}
        pills={<><span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[12px] dark:bg-white/[0.06]">{c.contacts.length} contacts</span><span className="rounded-full bg-[#047857]/10 px-2 py-0.5 text-[12px] font-semibold text-[#047857] dark:text-[#34d399]">{fmtMoney(open.reduce((n, d) => n + d.amount, 0), ws.currency, true)} open</span></>}
        actions={<>{c.domain && <a href={`https://${c.domain.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer noopener" className={btnGhost}><Link2 className="h-3.5 w-3.5" /> Website</a>}{can && <DeleteButton object="company" id={id} name={c.name} onDone={() => router.push(`/crm/${uid}/companies`)} />}</>} />}
      left={<section aria-label="About" className={cn(glass, "p-3")}>
        <p className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">About this company</p>
        <Field label="Name" value={c.name} canEdit={can} onSave={(v) => v && r.save({ name: v })} />
        <Field label="Domain" value={c.domain} canEdit={can} onSave={(v) => r.save({ domain: v })} />
        <Field label="Industry" value={c.industry} canEdit={can} onSave={(v) => r.save({ industry: v })} />
        <Field label="Size" type="select" value={c.size} options={["1-10", "11-50", "51-200", "201-1000", "1000+"].map((x) => ({ value: x, label: x }))} canEdit={can} onSave={(v) => r.save({ size: v })} />
        <Field label="Phone" value={c.phone} canEdit={can} onSave={(v) => r.save({ phone: v })} />
        <Field label="City" value={c.city} canEdit={can} onSave={(v) => r.save({ city: v })} />
        <Field label="Country" value={c.country} canEdit={can} onSave={(v) => r.save({ country: v })} />
        <div className="px-2 py-1.5"><p className="mb-0.5 text-[11px] font-medium text-muted-foreground">Owner</p><PersonPick members={ws.members} value={c.ownerId} disabled={!can} onChange={(v) => r.save({ ownerId: v })} /></div>
        <CustomFields props={props} custom={c.custom} canEdit={can} onSave={(k, v) => r.save({ custom: { [k]: v } })} />
      </section>}
      right={<>
        <Side title="Contacts" icon={Contact} count={c.contacts.length} action={can ? <button type="button" aria-label="New contact at this company" onClick={() => setCreate("contact")} className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="h-4 w-4" /></button> : undefined}>
          {!c.contacts.length ? <p className="text-[12.5px] text-muted-foreground">No contacts yet.</p> : <ul className="space-y-1">{c.contacts.map((p) => (
            <li key={p.id}><Link href={`/crm/${uid}/contacts/${p.id}`} className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"><Monogram text={p.firstName} size={26} /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{contactName(p)}</span><span className="block truncate text-[11.5px] text-muted-foreground">{p.title ?? p.email ?? LIFECYCLE_LABEL[p.lifecycle]}</span></span></Link></li>
          ))}</ul>}
        </Side>
        <Side title="Deals" icon={CircleDollarSign} count={c.deals.length} action={can ? <button type="button" aria-label="New deal with this company" onClick={() => setCreate("deal")} className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="h-4 w-4" /></button> : undefined}>
          {!c.deals.length ? <p className="text-[12.5px] text-muted-foreground">No deals yet.</p> : <ul className="space-y-1">{c.deals.map((d) => (
            <li key={d.id}><Link href={`/crm/${uid}/deals/${d.id}`} className="block rounded-xl px-1.5 py-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"><span className="block truncate text-[13px] font-medium">{d.name}</span><span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><StagePill stage={d.stage} /> {fmtMoney(d.amount, ws.currency, true)}</span></Link></li>
          ))}</ul>}
        </Side>
        <RecordMeetings wsId={ws.id} companyId={id} titleHint={`Meeting — ${c.name}`} canEdit={can} />
        {create && <CreateRecord kind={create} onClose={() => setCreate(null)} defaults={{ companyId: id, companyName: c.name }} />}
      </>} />
  );
}

// ───────────── deal ─────────────
function ContactLinker({ dealId, linked }: { dealId: number; linked: number[] }) {
  const { uid } = useCrmWs();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ queryKey: ["crm", uid, "contact-pick", q.trim()], queryFn: () => crmApi.list<CrmContact>(uid, "contact", { q: q.trim(), pageSize: 20 }), enabled: open });
  const link = useMutation({ mutationFn: (cid: number) => crmApi.linkContact(uid, dealId, cid, true), onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm", uid] }); setOpen(false); }, onError: onErr() });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><button type="button" aria-label="Link a contact" className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="h-4 w-4" /></button></PopoverTrigger>
      <PopoverContent align="end" className="w-64 rounded-xl p-1.5">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a contact" aria-label="Find a contact" className={cn(input, "mb-1 h-8")} />
        <ul className="max-h-56 overflow-y-auto">{(data?.rows ?? []).filter((c) => !linked.includes(c.id)).map((c) => <li key={c.id}><button type="button" onClick={() => link.mutate(c.id)} className="flex w-full flex-col rounded-lg px-2 py-1.5 text-left hover:bg-accent"><span className="text-[13px] font-medium">{contactName(c)}</span>{c.email && <span className="text-[11px] text-muted-foreground">{c.email}</span>}</button></li>)}</ul>
      </PopoverContent>
    </Popover>
  );
}

export function DealRecord({ id }: { id: number }) {
  const r = useRecord<CrmDeal & { pipeline: { id: number; name: string; stages: CrmStage[] } }>("deal", id);
  const router = useRouter();
  const qc = useQueryClient();
  const { uid, ws, data: d } = r;
  const [lost, setLost] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const move = useMutation({ mutationFn: (b: { stageId: number; lostReason?: string }) => crmApi.moveDeal(uid, id, b), onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm", uid] }); setLost(null); setReason(""); }, onError: onErr() });
  const unlink = useMutation({ mutationFn: (cid: number) => crmApi.linkContact(uid, id, cid, false), onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", uid] }), onError: onErr() });
  if (r.isLoading || !d || !ws) return <Skeleton className="h-[520px]" />;
  const can = ws.canEdit;
  const props = ws.properties.filter((p) => p.object === "deal");
  const stages = d.pipeline.stages;
  const won = stages.find((s) => s.isWon), lostStage = stages.find((s) => s.isLost);
  const openStages = stages.filter((s) => !s.isWon && !s.isLost);
  const at = openStages.findIndex((s) => s.id === d.stageId);
  const go = (s: CrmStage) => { if (!can || s.id === d.stageId) return; if (s.isLost) setLost(s.id); else move.mutate({ stageId: s.id }); };
  return (
    <>
      <Shell object="deal" id={id} links={{ dealId: id, ...(d.companyId && { companyId: d.companyId }) }} back={{ href: `/crm/${uid}/deals`, label: "Deals" }}
        header={<div className="space-y-3">
          <Header mono={<span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#047857]/10 text-[#047857] dark:text-[#34d399]"><CircleDollarSign className="h-7 w-7" /></span>} title={d.name}
            sub={<><b className="text-foreground">{fmtMoney(d.amount, ws.currency)}</b>{d.company && <> · {d.company.name}</>}{d.closeDate && <> · closes <span className={cn(!d.wonAt && !d.lostAt && isPast(d.closeDate) && "font-semibold text-[#dc2626] dark:text-[#f87171]")}>{fmtDate(d.closeDate, { month: "short", day: "numeric", year: "numeric" })}</span></>}</>}
            pills={<><StagePill stage={d.stage} />{d.lostReason && d.lostAt && <span className="text-[12px] text-muted-foreground">“{d.lostReason}”</span>}</>}
            actions={can ? <>
              {won && !d.wonAt && <button type="button" onClick={() => move.mutate({ stageId: won.id })} className={cn(btnPrimary, "bg-[#047857] dark:bg-[#059669]")}><Trophy className="h-4 w-4" /> Mark won</button>}
              {lostStage && !d.lostAt && <button type="button" onClick={() => setLost(lostStage.id)} className={btnGhost}><XCircle className="h-4 w-4" /> Mark lost</button>}
              <DeleteButton object="deal" id={id} name={d.name} onDone={() => router.push(`/crm/${uid}/deals`)} />
            </> : undefined} />
          {/* stage path */}
          <div className={cn(glass, "overflow-x-auto p-2")}>
            <ol className="flex min-w-max gap-1" aria-label="Stages">
              {openStages.map((s, i) => {
                const done = !!d.wonAt || (at >= 0 && i < at), cur = s.id === d.stageId;
                return <li key={s.id}><button type="button" disabled={!can} onClick={() => go(s)} aria-current={cur ? "step" : undefined}
                  className={cn("flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[12.5px] font-semibold transition", cur ? "bg-forest text-white dark:bg-primary dark:text-primary-foreground" : done ? "bg-[#047857]/12 text-[#047857] dark:text-[#34d399]" : "bg-black/[0.04] text-muted-foreground hover:text-foreground dark:bg-white/[0.06]")}>
                  {s.name}<span className="font-normal opacity-70">{s.probability}%</span></button></li>;
              })}
              {won && <li><button type="button" disabled={!can} onClick={() => go(won)} className={cn("flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[12.5px] font-semibold", d.wonAt ? "bg-[#047857] text-white" : "bg-black/[0.04] text-muted-foreground hover:text-foreground dark:bg-white/[0.06]")}><Trophy className="h-3.5 w-3.5" />{won.name}</button></li>}
              {lostStage && <li><button type="button" disabled={!can} onClick={() => go(lostStage)} className={cn("flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[12.5px] font-semibold", d.lostAt ? "bg-[#dc2626] text-white" : "bg-black/[0.04] text-muted-foreground hover:text-foreground dark:bg-white/[0.06]")}><XCircle className="h-3.5 w-3.5" />{lostStage.name}</button></li>}
            </ol>
          </div>
        </div>}
        left={<section aria-label="About" className={cn(glass, "p-3")}>
          <p className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">About this deal</p>
          <Field label="Deal name" value={d.name} canEdit={can} onSave={(v) => v && r.save({ name: v })} />
          <Field label={`Amount (${ws.currency})`} type="number" value={d.amount} display={fmtMoney(d.amount, ws.currency)} canEdit={can} onSave={(v) => r.save({ amount: Number(v) || 0 })} />
          <Field label="Close date" type="date" value={d.closeDate} canEdit={can} onSave={(v) => r.save({ closeDate: v })} />
          <Field label="Priority" type="select" value={d.priority} options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]} canEdit={can} onSave={(v) => r.save({ priority: v })} />
          <div className="px-2 py-1.5"><p className="mb-0.5 text-[11px] font-medium text-muted-foreground">Owner</p><PersonPick members={ws.members} value={d.ownerId} disabled={!can} onChange={(v) => r.save({ ownerId: v })} /></div>
          <div className="px-2 py-1.5"><p className="mb-0.5 text-[11px] font-medium text-muted-foreground">Pipeline</p><p className="text-[13.5px]">{d.pipeline.name}</p></div>
          <CustomFields props={props} custom={d.custom} canEdit={can} onSave={(k, v) => r.save({ custom: { [k]: v } })} />
          <p className="mt-2 flex items-center gap-1 px-2 text-[11px] text-muted-foreground"><CalendarClock className="h-3 w-3" /> Created {fmtDate(d.createdAt, { month: "short", day: "numeric", year: "numeric" })}</p>
        </section>}
        right={<>
          <Side title="Company" icon={Building2}>
            {can ? <CompanyPick ws={uid} value={d.company} onChange={(v) => r.save({ companyId: v?.id ?? null })} /> : d.company ? <Link href={`/crm/${uid}/companies/${d.company.id}`} className="text-[13px] font-medium hover:underline">{d.company.name}</Link> : <p className="text-[12.5px] text-muted-foreground">No company.</p>}
          </Side>
          <Side title="Contacts" icon={Contact} count={d.contacts.length} action={can ? <ContactLinker dealId={id} linked={d.contacts.map((c) => c.id)} /> : undefined}>
            {!d.contacts.length ? <p className="text-[12.5px] text-muted-foreground">No contacts linked.</p> : <ul className="space-y-1">{d.contacts.map((p) => (
              <li key={p.id} className="group flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                <Link href={`/crm/${uid}/contacts/${p.id}`} className="flex min-w-0 flex-1 items-center gap-2"><Monogram text={p.firstName} size={26} /><span className="min-w-0"><span className="block truncate text-[13px] font-medium">{contactName(p)}</span>{p.email && <span className="block truncate text-[11.5px] text-muted-foreground">{p.email}</span>}</span></Link>
                {can && <button type="button" aria-label={`Unlink ${contactName(p)}`} onClick={() => unlink.mutate(p.id)} className="rounded p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"><X className="h-3.5 w-3.5" /></button>}
              </li>
            ))}</ul>}
          </Side>
        </>} />
      {lost && (
        <Dialog open onOpenChange={(o) => !o && setLost(null)}>
          <DialogContent className="rounded-[24px] sm:max-w-[440px]">
            <DialogTitle>Mark the deal lost</DialogTitle>
            <DialogDescription>Say why, so the team can learn from it.</DialogDescription>
            <div className="flex flex-wrap gap-1.5">{["Price", "Went with a competitor", "No budget", "Bad timing", "No response"].map((x) => <button key={x} type="button" onClick={() => setReason(x)} className={cn("rounded-full border px-2.5 py-1 text-[12px]", reason === x ? "border-primary bg-primary/10 text-primary" : "border-border")}>{x}</button>)}</div>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason" aria-label="Reason" className={cn(input, "h-auto py-2")} />
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setLost(null)} className={btnGhost}>Cancel</button><button type="button" disabled={!reason.trim() || move.isPending} onClick={() => move.mutate({ stageId: lost, lostReason: reason.trim() })} className={cn(btnPrimary, "bg-[#dc2626] dark:bg-[#ef4444]")}>Mark lost</button></div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
