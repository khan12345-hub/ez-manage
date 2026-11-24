"use client";

/*
 * One dense table for Contacts, Companies and Deals: saved views, search and filters in one row,
 * column picker (incl. custom properties), sort, inline edits, bulk actions and pages.
 * On phones the rows become cards.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Bookmark, Check, ChevronLeft, ChevronRight, Columns3, Filter, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  contactName, crmApi, crmKeys, fmtMoney, LIFECYCLES, LIFECYCLE_LABEL, LEAD_STATUS_LABEL,
  type CrmCompany, type CrmContact, type CrmDeal, type CrmObject, type CrmProperty, type Lifecycle, type ListQuery,
} from "@/services/crm.api";
import { ago, btnGhost, dayInput, dayIso, fmtDate, glass, isPast, OBJ, onErr, useCrmWs } from "../_lib/crm";
import { Empty, LifecyclePill, Monogram, PersonPick, Skeleton, StagePill } from "./bits";
import { CreateRecord } from "./CreateRecord";

type Row = CrmContact | CrmCompany | CrmDeal;
type Col = { key: string; label: string; sort?: string; width?: string; render: (r: any) => React.ReactNode; custom?: CrmProperty };
type State = { q: string; owner: string; lifecycle: string; status: string; stageId: string; sort: string; dir: "asc" | "desc"; cols: string[] };

const DEFAULT_COLS: Record<CrmObject, string[]> = {
  contact: ["name", "email", "company", "lifecycle", "owner", "lastActivityAt"],
  company: ["name", "domain", "industry", "contacts", "openValue", "owner", "lastActivityAt"],
  deal: ["name", "amount", "stage", "closeDate", "company", "owner"],
};
const BLANK: Omit<State, "cols"> = { q: "", owner: "", lifecycle: "", status: "", stageId: "", sort: "createdAt", dir: "desc" };
const storeKey = (ws: string, o: CrmObject) => `ezcrm:${ws}:${o}:cols`;

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

/** inline editor for a custom property value */
function CustomCell({ prop, value, canEdit, onSave }: { prop: CrmProperty; value: unknown; canEdit: boolean; onSave: (v: unknown) => void }) {
  const [edit, setEdit] = useState(false);
  const shown = value === undefined || value === null || value === "" ? <span className="text-muted-foreground/60">—</span>
    : prop.type === "bool" ? (value ? "Yes" : "No") : prop.type === "date" ? fmtDate(String(value)) : prop.type === "multiselect" && Array.isArray(value) ? value.join(", ")
    : prop.type === "url" ? <a href={String(value)} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{String(value).replace(/^https?:\/\//, "")}</a> : String(value);
  if (!canEdit) return <span className="truncate">{shown}</span>;
  if (prop.type === "bool") return <input type="checkbox" aria-label={prop.label} checked={!!value} onChange={(e) => onSave(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />;
  if (prop.type === "select") return <select aria-label={prop.label} value={String(value ?? "")} onChange={(e) => onSave(e.target.value || null)} className="h-7 max-w-[160px] rounded-md bg-transparent text-[12.5px] outline-none hover:bg-black/[0.04] dark:hover:bg-white/5"><option value="">—</option>{prop.options.map((o) => <option key={o}>{o}</option>)}</select>;
  if (!edit) return <button type="button" onClick={() => setEdit(true)} className="max-w-full truncate rounded px-1 text-left hover:bg-black/[0.04] dark:hover:bg-white/5">{shown}</button>;
  return (
    <input autoFocus type={prop.type === "number" ? "number" : prop.type === "date" ? "date" : "text"} aria-label={prop.label}
      defaultValue={prop.type === "date" ? dayInput(value as string) : prop.type === "multiselect" && Array.isArray(value) ? value.join(", ") : String(value ?? "")}
      onBlur={(e) => { setEdit(false); const v = e.target.value; onSave(v === "" ? null : prop.type === "number" ? Number(v) : prop.type === "date" ? dayIso(v) : prop.type === "multiselect" ? v.split(",").map((x) => x.trim()).filter(Boolean) : v); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEdit(false); }}
      className="h-7 w-full min-w-[110px] rounded-md border border-primary/40 bg-background px-1.5 text-[12.5px] outline-none" />
  );
}

export function RecordTable({ object }: { object: CrmObject }) {
  const { uid, ws } = useCrmWs();
  const qc = useQueryClient();
  const [s, setS] = useState<State>(() => {
    let cols = DEFAULT_COLS[object];
    try { const saved = typeof window !== "undefined" ? localStorage.getItem(storeKey(uid, object)) : null; if (saved) cols = JSON.parse(saved); } catch {}
    return { ...BLANK, cols };
  });
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [view, setView] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const q = useDebounced(s.q);
  useEffect(() => { try { localStorage.setItem(storeKey(uid, object), JSON.stringify(s.cols)); } catch {} }, [s.cols, uid, object]);
  useEffect(() => { setPage(1); setSel(new Set()); }, [q, s.owner, s.lifecycle, s.status, s.stageId, s.sort, s.dir]);

  const query: ListQuery = { q, owner: s.owner, lifecycle: object === "contact" ? s.lifecycle : undefined, status: object === "deal" ? s.status : undefined, stageId: object === "deal" ? s.stageId : undefined, sort: s.sort, dir: s.dir, page, pageSize: 50 };
  const { data, isLoading } = useQuery({ queryKey: crmKeys.list(uid, object, query), queryFn: () => crmApi.list<Row>(uid, object, query), enabled: !!uid, placeholderData: (p) => p });
  const { data: views = [] } = useQuery({ queryKey: crmKeys.views(uid, object), queryFn: () => crmApi.views(uid, object), enabled: !!uid });
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm", uid] });
  const patch = useMutation({ mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) => crmApi.update(uid, object, id, body), onSuccess: refresh, onError: onErr("Couldn't save.") });
  const move = useMutation({ mutationFn: ({ id, stageId, lostReason }: { id: number; stageId: number; lostReason?: string }) => crmApi.moveDeal(uid, id, { stageId, lostReason }), onSuccess: refresh, onError: onErr("Couldn't move the deal.") });
  const bulk = useMutation({ mutationFn: (b: Parameters<typeof crmApi.bulk>[1]) => crmApi.bulk(uid, b), onSuccess: (r) => { toast.success(`${r.count} updated`); setSel(new Set()); refresh(); }, onError: onErr() });
  const saveView = useMutation({
    mutationFn: (name: string) => crmApi.createView(uid, { object, name, settings: { ...s } }),
    onSuccess: (v) => { qc.invalidateQueries({ queryKey: crmKeys.views(uid, object) }); setView(v.id); toast.success("View saved for everyone in this CRM"); },
    onError: onErr(),
  });
  const delView = useMutation({ mutationFn: (id: number) => crmApi.deleteView(uid, id), onSuccess: () => { qc.invalidateQueries({ queryKey: crmKeys.views(uid, object) }); setView(null); } });

  const canEdit = !!ws?.canEdit;
  const stages = useMemo(() => (ws?.pipelines ?? []).flatMap((p) => p.stages.map((st) => ({ ...st, pipelineId: p.id, pipeline: p.name }))), [ws]);
  const cur = ws?.currency ?? "USD";
  const props = (ws?.properties ?? []).filter((p) => p.object === object);

  const setStage = (d: CrmDeal, stageId: number) => {
    const st = stages.find((x) => x.id === stageId);
    if (st?.isLost) { const why = window.prompt("Why was this deal lost?"); if (!why?.trim()) return; move.mutate({ id: d.id, stageId, lostReason: why.trim() }); }
    else move.mutate({ id: d.id, stageId });
  };

  const all: Col[] = useMemo(() => {
    const ownerCol: Col = { key: "owner", label: "Owner", render: (r: Row) => <PersonPick compact members={ws?.members ?? []} value={r.ownerId} disabled={!canEdit} onChange={(v) => patch.mutate({ id: r.id, body: { ownerId: v } })} /> };
    const last: Col = { key: "lastActivityAt", label: "Last activity", sort: "lastActivityAt", render: (r: Row) => <span className="text-muted-foreground">{r.lastActivityAt ? ago(r.lastActivityAt) : "—"}</span> };
    const created: Col = { key: "createdAt", label: "Created", sort: "createdAt", render: (r: Row) => <span className="text-muted-foreground">{fmtDate(r.createdAt, { month: "short", day: "numeric", year: "numeric" })}</span> };
    const base: Col[] = object === "contact" ? [
      { key: "name", label: "Name", sort: "firstName", render: (r: CrmContact) => <Link href={`/crm/${uid}/contacts/${r.id}`} className="flex min-w-0 items-center gap-2 font-semibold hover:text-primary"><Monogram text={r.firstName} size={26} /><span className="truncate">{contactName(r)}</span></Link> },
      { key: "email", label: "Email", sort: "email", render: (r: CrmContact) => r.email ? <a href={`mailto:${r.email}`} className="truncate hover:underline">{r.email}</a> : <span className="text-muted-foreground/60">—</span> },
      { key: "phone", label: "Phone", render: (r: CrmContact) => r.phone ?? <span className="text-muted-foreground/60">—</span> },
      { key: "title", label: "Job title", render: (r: CrmContact) => r.title ?? <span className="text-muted-foreground/60">—</span> },
      { key: "company", label: "Company", render: (r: CrmContact) => r.company ? <Link href={`/crm/${uid}/companies/${r.company.id}`} className="truncate hover:underline">{r.company.name}</Link> : <span className="text-muted-foreground/60">—</span> },
      { key: "lifecycle", label: "Lifecycle", sort: "lifecycle", render: (r: CrmContact) => canEdit ? <select aria-label="Lifecycle" value={r.lifecycle} onChange={(e) => patch.mutate({ id: r.id, body: { lifecycle: e.target.value } })} className="h-7 rounded-md bg-transparent text-[12.5px] outline-none hover:bg-black/[0.04] dark:hover:bg-white/5">{LIFECYCLES.map((l) => <option key={l} value={l}>{LIFECYCLE_LABEL[l]}</option>)}</select> : <LifecyclePill value={r.lifecycle} /> },
      { key: "leadStatus", label: "Lead status", render: (r: CrmContact) => r.leadStatus ? (LEAD_STATUS_LABEL as any)[r.leadStatus] ?? r.leadStatus : <span className="text-muted-foreground/60">—</span> },
      { key: "deals", label: "Deals", render: (r: CrmContact) => <span className="tabular-nums">{r.deals ?? 0}</span> },
      ownerCol, last, created,
    ] : object === "company" ? [
      { key: "name", label: "Company", sort: "name", render: (r: CrmCompany) => <Link href={`/crm/${uid}/companies/${r.id}`} className="flex min-w-0 items-center gap-2 font-semibold hover:text-primary"><Monogram text={r.name} size={26} /><span className="truncate">{r.name}</span></Link> },
      { key: "domain", label: "Domain", sort: "domain", render: (r: CrmCompany) => r.domain ? <a href={`https://${r.domain.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer noopener" className="truncate hover:underline">{r.domain}</a> : <span className="text-muted-foreground/60">—</span> },
      { key: "industry", label: "Industry", sort: "industry", render: (r: CrmCompany) => r.industry ?? <span className="text-muted-foreground/60">—</span> },
      { key: "size", label: "Size", render: (r: CrmCompany) => r.size ?? <span className="text-muted-foreground/60">—</span> },
      { key: "city", label: "City", render: (r: CrmCompany) => [r.city, r.country].filter(Boolean).join(", ") || <span className="text-muted-foreground/60">—</span> },
      { key: "contacts", label: "Contacts", render: (r: CrmCompany) => <span className="tabular-nums">{r.contacts ?? 0}</span> },
      { key: "openValue", label: "Open deals", render: (r: CrmCompany) => <span className="tabular-nums">{fmtMoney(r.openValue ?? 0, cur, true)}</span> },
      ownerCol, last, created,
    ] : [
      { key: "name", label: "Deal", sort: "name", render: (r: CrmDeal) => <Link href={`/crm/${uid}/deals/${r.id}`} className="truncate font-semibold hover:text-primary">{r.name}</Link> },
      { key: "amount", label: "Amount", sort: "amount", render: (r: CrmDeal) => <span className="font-semibold tabular-nums">{fmtMoney(r.amount, cur)}</span> },
      { key: "stage", label: "Stage", render: (r: CrmDeal) => canEdit ? <select aria-label="Stage" value={r.stageId} onChange={(e) => setStage(r, Number(e.target.value))} className="h-7 max-w-[170px] rounded-md bg-transparent text-[12.5px] outline-none hover:bg-black/[0.04] dark:hover:bg-white/5">{stages.filter((st) => st.pipelineId === r.pipelineId).map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}</select> : <StagePill stage={r.stage} /> },
      { key: "closeDate", label: "Close date", sort: "closeDate", render: (r: CrmDeal) => r.closeDate ? <span className={cn(!r.wonAt && !r.lostAt && isPast(r.closeDate) && "font-semibold text-[#dc2626] dark:text-[#f87171]")}>{fmtDate(r.closeDate, { month: "short", day: "numeric", year: "numeric" })}</span> : <span className="text-muted-foreground/60">—</span> },
      { key: "company", label: "Company", render: (r: CrmDeal) => r.company ? <Link href={`/crm/${uid}/companies/${r.company.id}`} className="truncate hover:underline">{r.company.name}</Link> : <span className="text-muted-foreground/60">—</span> },
      { key: "contacts", label: "Contacts", render: (r: CrmDeal) => r.contacts.length ? <span className="truncate">{r.contacts.map(contactName).join(", ")}</span> : <span className="text-muted-foreground/60">—</span> },
      { key: "priority", label: "Priority", render: (r: CrmDeal) => r.priority ? <span className="capitalize">{r.priority}</span> : <span className="text-muted-foreground/60">—</span> },
      ownerCol, last, created,
    ];
    return [...base, ...props.map((p) => ({ key: `p:${p.key}`, label: p.label, custom: p, render: (r: Row) => <CustomCell prop={p} value={(r.custom ?? {})[p.key]} canEdit={canEdit} onSave={(v) => patch.mutate({ id: r.id, body: { custom: { [p.key]: v } } })} /> }))];
  }, [object, uid, ws, canEdit, props, stages, cur, patch]); // eslint-disable-line react-hooks/exhaustive-deps

  const cols = all.filter((c) => c.key === "name" || s.cols.includes(c.key));
  const rows = (data?.rows ?? []) as Row[];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 50));
  const allSel = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const filters = (s.owner ? 1 : 0) + (s.lifecycle ? 1 : 0) + (s.status ? 1 : 0) + (s.stageId ? 1 : 0);
  const applyView = (v: { id: number; settings: Record<string, any> } | null) => { setView(v?.id ?? null); setS(v ? { ...BLANK, cols: s.cols, ...v.settings } as State : { ...BLANK, cols: s.cols }); };

  return (
    <div className="space-y-3">
      {/* saved views */}
      <div className="flex items-center gap-1 overflow-x-auto">
        <button type="button" onClick={() => applyView(null)} className={cn("shrink-0 rounded-xl px-3 py-1.5 text-[13px] font-medium", view === null ? "bg-card shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>All {OBJ[object].many.toLowerCase()}</button>
        {views.map((v) => (
          <span key={v.id} className={cn("group flex shrink-0 items-center rounded-xl", view === v.id ? "bg-card shadow-sm ring-1 ring-border" : "")}>
            <button type="button" onClick={() => applyView(v)} className={cn("px-3 py-1.5 text-[13px] font-medium", view === v.id ? "" : "text-muted-foreground hover:text-foreground")}>{v.name}</button>
            {view === v.id && canEdit && <button type="button" aria-label={`Delete view ${v.name}`} onClick={() => delView.mutate(v.id)} className="mr-1 rounded p-0.5 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>}
          </span>
        ))}
        {canEdit && <button type="button" onClick={() => { const n = window.prompt("Name this view (everyone in this CRM will see it)"); if (n?.trim()) saveView.mutate(n.trim()); }} className="flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"><Bookmark className="h-3.5 w-3.5" /> Save view</button>}
      </div>

      {/* one row: search, filters, columns, create */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 sm:max-w-[320px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={s.q} onChange={(e) => setS({ ...s, q: e.target.value })} placeholder={`Search ${OBJ[object].many.toLowerCase()}`} aria-label={`Search ${OBJ[object].many}`} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
          {s.q && <button type="button" aria-label="Clear search" onClick={() => setS({ ...s, q: "" })}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
        </label>
        <Popover>
          <PopoverTrigger asChild><button type="button" className={cn(btnGhost, filters && "border-primary/40 text-primary")}><Filter className="h-3.5 w-3.5" /> Filters{filters ? ` · ${filters}` : ""}</button></PopoverTrigger>
          <PopoverContent align="start" className="w-72 space-y-3 rounded-2xl p-3">
            <label className="block text-[12px] font-medium text-muted-foreground">Owner
              <select value={s.owner} onChange={(e) => setS({ ...s, owner: e.target.value })} className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-2 text-[13px] text-foreground">
                <option value="">Anyone</option><option value="me">Me</option><option value="none">Nobody</option>
                {(ws?.members ?? []).map((m) => <option key={m.user.id} value={m.user.id}>{`${m.user.firstName ?? ""} ${m.user.lastName ?? ""}`.trim()}</option>)}
              </select>
            </label>
            {object === "contact" && <label className="block text-[12px] font-medium text-muted-foreground">Lifecycle stage
              <select value={s.lifecycle} onChange={(e) => setS({ ...s, lifecycle: e.target.value })} className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-2 text-[13px] text-foreground"><option value="">Any</option>{LIFECYCLES.map((l) => <option key={l} value={l}>{LIFECYCLE_LABEL[l as Lifecycle]}</option>)}</select>
            </label>}
            {object === "deal" && <>
              <label className="block text-[12px] font-medium text-muted-foreground">Status
                <select value={s.status} onChange={(e) => setS({ ...s, status: e.target.value })} className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-2 text-[13px] text-foreground"><option value="">All</option><option value="open">Open</option><option value="won">Won</option><option value="lost">Lost</option></select>
              </label>
              <label className="block text-[12px] font-medium text-muted-foreground">Stage
                <select value={s.stageId} onChange={(e) => setS({ ...s, stageId: e.target.value })} className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-2 text-[13px] text-foreground"><option value="">Any</option>{stages.map((st) => <option key={st.id} value={st.id}>{(ws?.pipelines.length ?? 0) > 1 ? `${st.pipeline} · ` : ""}{st.name}</option>)}</select>
              </label>
            </>}
            {filters > 0 && <button type="button" onClick={() => setS({ ...s, owner: "", lifecycle: "", status: "", stageId: "" })} className="text-[12.5px] font-semibold text-primary hover:underline">Clear filters</button>}
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild><button type="button" className={btnGhost}><Columns3 className="h-3.5 w-3.5" /> Columns</button></PopoverTrigger>
          <PopoverContent align="start" className="w-64 rounded-2xl p-1.5">
            <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Show columns</p>
            <ul className="max-h-72 overflow-y-auto">
              {all.filter((c) => c.key !== "name").map((c) => { const on = s.cols.includes(c.key); return (
                <li key={c.key}><button type="button" onClick={() => setS({ ...s, cols: on ? s.cols.filter((k) => k !== c.key) : [...s.cols, c.key] })} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-accent">
                  <span className={cn("flex h-4 w-4 items-center justify-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{on && <Check className="h-3 w-3" />}</span>{c.label}{c.custom && <span className="ml-auto text-[10.5px] text-muted-foreground">custom</span>}
                </button></li>
              ); })}
            </ul>
          </PopoverContent>
        </Popover>
        <span className="flex-1" />
        <span className="text-[12.5px] tabular-nums text-muted-foreground">{total.toLocaleString()} {total === 1 ? OBJ[object].one.toLowerCase() : OBJ[object].many.toLowerCase()}</span>
        {canEdit && <button type="button" onClick={() => setCreating(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-forest px-3.5 text-[13px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground"><Plus className="h-4 w-4" /> New {OBJ[object].one.toLowerCase()}</button>}
      </div>

      {/* bulk bar */}
      {sel.size > 0 && canEdit && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-forest px-3 py-2 text-[13px] text-white dark:bg-primary dark:text-primary-foreground">
          <b>{sel.size} selected</b>
          <span className="flex-1" />
          <div className="w-44 rounded-lg bg-white text-foreground"><PersonPick members={ws?.members ?? []} value={null} onChange={(v) => bulk.mutate({ object, ids: [...sel], action: "owner", ownerId: v })} label="Assign owner" /></div>
          {object === "contact" && <select aria-label="Set lifecycle" value="" onChange={(e) => e.target.value && bulk.mutate({ object, ids: [...sel], action: "lifecycle", lifecycle: e.target.value })} className="h-9 rounded-lg bg-white px-2 text-[13px] text-foreground"><option value="">Set lifecycle…</option>{LIFECYCLES.map((l) => <option key={l} value={l}>{LIFECYCLE_LABEL[l]}</option>)}</select>}
          {object === "deal" && <select aria-label="Move to stage" value="" onChange={(e) => e.target.value && bulk.mutate({ object, ids: [...sel], action: "stage", stageId: Number(e.target.value) })} className="h-9 rounded-lg bg-white px-2 text-[13px] text-foreground"><option value="">Move to stage…</option>{stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}</select>}
          <button type="button" onClick={() => { if (window.confirm(`Delete ${sel.size} ${OBJ[object].many.toLowerCase()}? This can't be undone.`)) bulk.mutate({ object, ids: [...sel], action: "delete" }); }} className="flex h-9 items-center gap-1 rounded-lg bg-white/15 px-3 font-semibold hover:bg-white/25"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
          <button type="button" aria-label="Clear selection" onClick={() => setSel(new Set())} className="rounded-lg p-1.5 hover:bg-white/15"><X className="h-4 w-4" /></button>
        </div>
      )}

      {isLoading ? <Skeleton className="h-[420px]" /> : !rows.length ? (
        <div className={glass}><Empty icon={Search} title={q || filters ? "Nothing matches" : `No ${OBJ[object].many.toLowerCase()} yet`} body={q || filters ? "Try another search or clear the filters." : `Add your first ${OBJ[object].one.toLowerCase()} to get started.`} action={canEdit && !q && !filters ? <button type="button" onClick={() => setCreating(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-forest px-3.5 text-[13px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground"><Plus className="h-4 w-4" /> New {OBJ[object].one.toLowerCase()}</button> : undefined} /></div>
      ) : (
        <>
          {/* desktop table */}
          <div className={cn(glass, "hidden overflow-hidden sm:block")}>
            <div className="max-h-[calc(100vh-290px)] overflow-auto">
              <table className="w-full min-w-[760px] text-[13px]">
                <thead className="sticky top-0 z-[1] bg-white/90 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground backdrop-blur dark:bg-[#151a18]/95">
                  <tr>
                    {canEdit && <th className="w-10 px-3 py-2.5"><input type="checkbox" aria-label="Select all on this page" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(rows.map((r) => r.id)))} className="h-4 w-4 accent-[var(--primary)]" /></th>}
                    {cols.map((c) => (
                      <th key={c.key} className="whitespace-nowrap px-3 py-2.5">
                        {c.sort ? <button type="button" onClick={() => setS({ ...s, sort: c.sort!, dir: s.sort === c.sort && s.dir === "desc" ? "asc" : "desc" })} className="flex items-center gap-1 uppercase hover:text-foreground">{c.label}{s.sort === c.sort && (s.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</button> : c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={cn("border-t border-border/60 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]", sel.has(r.id) && "bg-primary/[0.05]")}>
                      {canEdit && <td className="px-3 py-2"><input type="checkbox" aria-label={`Select ${"name" in r ? r.name : contactName(r as CrmContact)}`} checked={sel.has(r.id)} onChange={() => setSel((x) => { const n = new Set(x); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })} className="h-4 w-4 accent-[var(--primary)]" /></td>}
                      {cols.map((c) => <td key={c.key} className={cn("max-w-[260px] px-3 py-2", c.key === "name" && "max-w-[300px]")}>{c.render(r)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* phone cards */}
          <ul className="space-y-2 sm:hidden">
            {rows.map((r) => (
              <li key={r.id} className={cn(glass, "p-3.5")}>
                {all[0]!.render(r)}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                  {object === "contact" && <><LifecyclePill value={(r as CrmContact).lifecycle} />{(r as CrmContact).company?.name}{(r as CrmContact).email}</>}
                  {object === "company" && <>{(r as CrmCompany).domain}<span>{(r as CrmCompany).contacts ?? 0} contacts</span></>}
                  {object === "deal" && <><b className="text-foreground">{fmtMoney((r as CrmDeal).amount, cur)}</b><StagePill stage={(r as CrmDeal).stage} />{(r as CrmDeal).closeDate && fmtDate((r as CrmDeal).closeDate)}</>}
                </div>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 text-[12.5px]">
              <span className="text-muted-foreground">Page {page} of {pages}</span>
              <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={cn(btnGhost, "h-8 w-8 p-0")}><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className={cn(btnGhost, "h-8 w-8 p-0")}><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
        </>
      )}
      {creating && <CreateRecord kind={object} onClose={() => setCreating(false)} />}
    </div>
  );
}

