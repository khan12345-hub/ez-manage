"use client";

/* Reimbursements / Expenses — inside Accounts & Invoices. Claim → manager → finance (paid). */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, Check, CircleDollarSign, Clock, Copy, Download, FileText,
  GripVertical, LayoutTemplate, Link2, Lock, Plus, Receipt, RotateCcw, Settings2, Trash2, Undo2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/resolveUrl";
import {
  expensesApi, type ExpenseClaim, type ExpenseClaimDetail, type ExpenseStatus,
  type ExpenseFormField, type ExpenseFieldType,
} from "@/services/expenses.api";
import { FormBranding, FieldInput, FormField as FormFieldRow, collect, emptyValues, type FieldValues } from "./ExpenseFormParts";

const money = (n: number, c = "CAD") => new Intl.NumberFormat("en-CA", { style: "currency", currency: c || "CAD" }).format(n);
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : "—");
const initials = (p?: { firstName: string; lastName: string } | null) => (p ? `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase() : "?");

const STATUS: Record<ExpenseStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  submitted: { label: "Awaiting manager", cls: "bg-amber-500/12 text-amber-700 dark:text-amber-400" },
  manager_approved: { label: "Awaiting finance", cls: "bg-blue-500/12 text-blue-700 dark:text-blue-400" },
  approved_paid: { label: "Paid", cls: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" },
  rejected: { label: "Declined", cls: "bg-red-500/12 text-red-700 dark:text-red-400" },
};

function Mini({ p }: { p?: { firstName: string; lastName: string; avatarUrl: string | null } | null }) {
  if (!p) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      {p.avatarUrl ? (
        <img src={resolveUrl(p.avatarUrl)} alt="" className="h-5 w-5 rounded-full object-cover" />
      ) : (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">{initials(p)}</span>
      )}
      <span className="truncate text-[13px]">{p.firstName} {p.lastName}</span>
    </span>
  );
}

type Tab = "mine" | "review" | "pay" | "all";

export default function ExpensesPage({ workspaceId }: { workspaceId: string }) {
  const [tab, setTab] = useState<Tab>("mine");
  const [open, setOpen] = useState<number | "new" | null>(null);
  const [cats, setCats] = useState(false);
  const [builder, setBuilder] = useState(false);
  const qc = useQueryClient();

  const { data: summary } = useQuery({ queryKey: ["expenses", "summary", workspaceId], queryFn: () => expensesApi.summary(workspaceId) });
  const { data: claims = [], isLoading } = useQuery({ queryKey: ["expenses", "list", workspaceId, tab], queryFn: () => expensesApi.list(workspaceId, tab) });
  const isMgr = !!summary?.isManager;

  const TABS: { id: Tab; label: string; badge?: number; mgr?: boolean }[] = [
    { id: "mine", label: "My claims" },
    { id: "review", label: "To review", badge: summary?.toReview, mgr: true },
    { id: "pay", label: "To pay", badge: summary?.toPay, mgr: true },
    { id: "all", label: isMgr ? "All & Paid" : "History" },
  ];

  const exportXlsx = async () => {
    const rows = claims.map((c) => ({
      Title: c.title, Amount: c.amount, Currency: c.currency, Category: c.category?.name ?? "",
      Status: STATUS[c.status].label, Claimant: c.claimant ? `${c.claimant.firstName} ${c.claimant.lastName}` : "",
      "Incurred on": c.incurredOn ? c.incurredOn.slice(0, 10) : "", "Paid on": c.paidAt ? c.paidAt.slice(0, 10) : "",
    }));
    if (!rows.length) return toast.error("Nothing to export.");
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reimbursements");
    XLSX.writeFile(wb, `reimbursements-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Receipt className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-tight">Reimbursements</h1>
          <p className="text-[13px] text-muted-foreground">Claim an expense, a manager approves, finance pays.</p>
        </div>
        {isMgr && <button type="button" onClick={() => setBuilder(true)} className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium hover:bg-accent"><LayoutTemplate className="h-4 w-4" /> Form</button>}
        {isMgr && <button type="button" onClick={() => setCats(true)} className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium hover:bg-accent"><Settings2 className="h-4 w-4" /> Categories</button>}
        {summary?.canSubmit && <button type="button" onClick={() => setOpen("new")} className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground hover:brightness-110"><Plus className="h-4 w-4" /> New claim</button>}
      </div>

      {/* stat tiles */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={CircleDollarSign} label="Paid this month" value={summary ? money(summary.paidThisMonth) : "…"} />
        <Stat icon={Clock} label="Pending" value={summary ? String(summary.pending) : "…"} />
        {isMgr ? <Stat icon={FileText} label="To review" value={summary ? String(summary.toReview) : "…"} tone="amber" /> : <Stat icon={FileText} label="My open claims" value={summary ? String(summary.myOpen) : "…"} />}
        {isMgr ? <Stat icon={Check} label="To pay" value={summary ? String(summary.toPay) : "…"} tone="blue" /> : <Stat icon={Receipt} label="Categories" value={summary ? String(summary.categories.length) : "…"} />}
      </div>

      {/* tabs */}
      <div className="mt-5 flex flex-wrap items-center gap-1 border-b border-border">
        {TABS.filter((t) => !t.mgr || isMgr).map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={cn("relative flex items-center gap-1.5 px-3 py-2 text-[13.5px] font-medium transition-colors", tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
            {!!t.badge && <span className="rounded-full bg-primary/15 px-1.5 text-[11px] font-semibold text-primary">{t.badge}</span>}
            {tab === t.id && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />}
          </button>
        ))}
        <span className="flex-1" />
        {tab === "all" && claims.length > 0 && <button type="button" onClick={exportXlsx} className="mb-1 flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12.5px] font-medium hover:bg-accent"><Download className="h-3.5 w-3.5" /> Export</button>}
      </div>

      {/* list */}
      <div className="mt-3 space-y-2">
        {isLoading && [0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}
        {!isLoading && !claims.length && (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <Receipt className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-2 text-[14px] font-medium">Nothing here yet</p>
            <p className="text-[13px] text-muted-foreground">{tab === "mine" ? "Create a claim to get your money back." : "Claims will show up here."}</p>
          </div>
        )}
        {claims.map((c) => <Row key={c.id} c={c} showClaimant={tab !== "mine"} onOpen={() => setOpen(c.id)} />)}
      </div>

      {open === "new" && <ClaimDrawer workspaceId={workspaceId} onClose={() => setOpen(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["expenses"] }); }} />}
      {typeof open === "number" && <ClaimDetail claimId={open} onClose={() => setOpen(null)} onChanged={() => qc.invalidateQueries({ queryKey: ["expenses"] })} />}
      {cats && <CategoriesDialog workspaceId={workspaceId} onClose={() => { setCats(false); qc.invalidateQueries({ queryKey: ["expenses", "summary"] }); }} />}
      {builder && <FormBuilderDrawer workspaceId={workspaceId} onClose={() => { setBuilder(false); qc.invalidateQueries({ queryKey: ["expenses", "form", workspaceId] }); }} />}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Receipt; label: string; value: string; tone?: "amber" | "blue" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", tone === "amber" ? "bg-amber-500/12 text-amber-600" : tone === "blue" ? "bg-blue-500/12 text-blue-600" : "bg-primary/10 text-primary")}><Icon className="h-4 w-4" /></span>
      <p className="mt-2 text-[20px] font-semibold leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-[11.5px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({ c, showClaimant, onOpen }: { c: ExpenseClaim; showClaimant: boolean; onOpen: () => void }) {
  const s = STATUS[c.status];
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium">{c.title}</span>
          {!!c.receiptCount && <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground"><Receipt className="h-3 w-3" />{c.receiptCount}</span>}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted-foreground">
          {c.category && <span className="rounded bg-muted px-1.5 py-px">{c.category.name}</span>}
          <span>{fmtDate(c.incurredOn ?? c.createdAt)}</span>
          {showClaimant && c.claimant && <><span>·</span><Mini p={c.claimant} /></>}
        </span>
      </span>
      <span className="text-right">
        <span className="block text-[15px] font-semibold tabular-nums">{money(c.amount, c.currency)}</span>
        <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", s.cls)}>{s.label}</span>
      </span>
    </button>
  );
}

/* ───────── new claim drawer (driven by the company's form) ───────── */
function ClaimDrawer({ workspaceId, onClose, onSaved }: { workspaceId: string; onClose: () => void; onSaved: () => void }) {
  const { data: form, isLoading } = useQuery({ queryKey: ["expenses", "form", workspaceId], queryFn: () => expensesApi.getForm(workspaceId) });
  const { data: categories = [] } = useQuery({ queryKey: ["expenses", "categories", workspaceId], queryFn: () => expensesApi.categories(workspaceId) });
  const [values, setValues] = useState<FieldValues>({});
  const [currency, setCurrency] = useState("CAD");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const qc = useQueryClient();
  const fields = form?.fields ?? [];
  const ready = !!form;
  // seed value map once the form loads
  const seeded = useMemo(() => (form ? emptyValues(form.fields) : {}), [form]);
  const vals = Object.keys(values).length ? values : seeded;
  const set = (key: string, v: unknown) => setValues({ ...vals, [key]: v });

  const save = useMutation({
    mutationFn: async (submit: boolean) => {
      const c = collect(fields, vals);
      if (!c.ok) throw new Error(c.error);
      if (submit && !c.files.length) throw new Error("Attach at least one receipt to submit.");
      const claim = await expensesApi.create(workspaceId, {
        title: c.title, amount: c.amount, currency,
        ...(categoryId ? { categoryId: Number(categoryId) } : {}),
        ...(c.description ? { description: c.description } : {}),
        ...(c.incurredOn ? { incurredOn: c.incurredOn } : {}),
        ...(c.paidOn ? { paidOn: c.paidOn } : {}),
        ...(Object.keys(c.custom).length ? { custom: c.custom } : {}),
      });
      for (const f of c.files) await expensesApi.addReceipt(claim.id, f);
      if (submit) await expensesApi.submit(claim.id);
      return claim;
    },
    onSuccess: (_d, submit) => { toast.success(submit ? "Claim submitted" : "Draft saved"); qc.invalidateQueries({ queryKey: ["expenses"] }); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.message ?? "Couldn't save."),
  });

  return (
    <DrawerShell title="New claim" onClose={onClose}>
      {isLoading || !ready ? <div className="h-60 animate-pulse rounded-xl bg-muted" /> : (
        <>
          <FormBranding form={form} />
          <div className="space-y-3.5">
            {fields.map((f, i) => (
              <div key={f.key} className={f.maps === "amount" ? "grid grid-cols-[1fr_92px] gap-2" : ""}>
                <FormFieldRow field={f}><FieldInput field={f} value={vals[f.key]} onChange={(v) => set(f.key, v)} /></FormFieldRow>
                {f.maps === "amount" && (
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-medium text-muted-foreground">Currency</span>
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-[38px] w-full rounded-lg border border-border bg-background px-2.5 text-[13.5px] outline-none focus:border-primary/50">{["CAD", "USD", "EUR", "GBP", "PKR", "AED", "INR"].map((c) => <option key={c}>{c}</option>)}</select>
                  </label>
                )}
              </div>
            ))}
            {!!categories.filter((c) => c.active).length && (
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-muted-foreground">Category</span>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")} className="h-[38px] w-full rounded-lg border border-border bg-background px-2.5 text-[13.5px] outline-none focus:border-primary/50">
                  <option value="">None</option>
                  {categories.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
          </div>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button type="button" onClick={() => save.mutate(false)} disabled={save.isPending} className="h-9 rounded-lg border border-border px-3.5 text-[13px] font-medium hover:bg-accent disabled:opacity-50">Save draft</button>
            <button type="button" onClick={() => save.mutate(true)} disabled={save.isPending} className="h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50">Submit</button>
          </div>
        </>
      )}
    </DrawerShell>
  );
}

/* ───────── claim detail ───────── */
function ClaimDetail({ claimId, onClose, onChanged }: { claimId: number; onClose: () => void; onChanged: () => void }) {
  const { data: c, isLoading } = useQuery({ queryKey: ["expenses", "claim", claimId], queryFn: () => expensesApi.detail(claimId) });
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState(false);
  const qc = useQueryClient();
  const refresh = () => { qc.invalidateQueries({ queryKey: ["expenses", "claim", claimId] }); onChanged(); };

  const act = useMutation<unknown, any, "submit" | "approve" | "pay" | "reject" | "delete" | "recall" | "reopen">({
    mutationFn: (kind) =>
      kind === "submit" ? expensesApi.submit(claimId) : kind === "approve" ? expensesApi.approve(claimId) :
      kind === "pay" ? expensesApi.pay(claimId) : kind === "reject" ? expensesApi.reject(claimId, reason) :
      kind === "recall" ? expensesApi.recall(claimId) : kind === "reopen" ? expensesApi.reopen(claimId, reason) :
      expensesApi.remove(claimId),
    onSuccess: (_d, kind) => {
      toast.success(kind === "delete" ? "Deleted" : kind === "pay" ? "Marked paid" : kind === "approve" ? "Approved" : kind === "reject" ? "Declined" : kind === "recall" ? "Recalled to draft" : kind === "reopen" ? "Reopened" : "Submitted");
      refresh(); if (kind === "delete") onClose(); setRejecting(false); setReopening(false); setReason("");
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't do that."),
  });

  const customEntries = c?.custom ? Object.entries(c.custom).filter(([, v]) => v != null && v !== "") : [];

  return (
    <DrawerShell title="Claim" onClose={onClose}>
      {isLoading || !c ? <div className="h-40 animate-pulse rounded-xl bg-muted" /> : editing ? (
        <ClaimEditForm claim={c} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); refresh(); }} />
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[17px] font-semibold">{c.title}</h3>
              <span className="text-[19px] font-bold tabular-nums">{money(c.amount, c.currency)}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS[c.status].cls)}>{STATUS[c.status].label}</span>
              {c.category && <span className="rounded bg-muted px-1.5 py-px">{c.category.name}</span>}
              <span>{fmtDate(c.incurredOn ?? c.createdAt)}</span>
              {c.paidOn && <span>· paid {fmtDate(c.paidOn)}</span>}
            </div>
            {c.claimant && <div className="mt-2 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">By <Mini p={c.claimant} /></div>}
            {c.description && <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-[13px]">{c.description}</p>}
            {c.status === "rejected" && c.rejectedReason && <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-700 dark:text-red-400"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{c.rejectedReason}</p>}
            {c.locked && <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-muted/60 px-3 py-2 text-[12.5px] text-muted-foreground"><Lock className="h-3.5 w-3.5" /> This claim is {c.status === "approved_paid" ? "paid" : "approved"} and locked. An admin can reopen it to make changes.</p>}
          </div>

          {/* custom fields */}
          {!!customEntries.length && (
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">Details</p>
              <dl className="grid grid-cols-1 gap-1.5 rounded-lg border border-border bg-card p-3 sm:grid-cols-2">
                {customEntries.map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{prettyKey(k)}</dt>
                    <dd className="truncate text-[13px]">{Array.isArray(v) ? (v as unknown[]).join(", ") : String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* receipts */}
          {!!c.receipts.length && (
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">Receipts</p>
              <div className="flex flex-wrap gap-2">
                {c.receipts.map((r) => (
                  <button key={r.id} type="button" onClick={() => setLightbox(resolveUrl(r.fileUrl))} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border">
                    {r.mime.includes("pdf") ? <span className="flex h-full w-full flex-col items-center justify-center bg-muted text-[10px] text-muted-foreground"><FileText className="h-5 w-5" />PDF</span>
                      : <img src={resolveUrl(r.fileUrl)} alt={r.fileName} className="h-full w-full object-cover" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* timeline */}
          <div>
            <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">History</p>
            <ol className="space-y-2 border-l border-border pl-3">
              {c.events.map((e) => (
                <li key={e.id} className="relative text-[12.5px]">
                  <span className="absolute -left-[15px] top-1 h-2 w-2 rounded-full bg-primary" />
                  <span className="font-medium">{EVENT_LABEL[e.action] ?? e.action}</span>
                  {e.actor && <> · {e.actor.firstName} {e.actor.lastName}</>}
                  {e.note && <span className="text-muted-foreground"> — {e.note}</span>}
                  <span className="ml-1 text-muted-foreground">{new Date(e.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* actions */}
          {rejecting || reopening ? (
            <div className="rounded-lg border border-border p-3">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={reopening ? "Why are you reopening this? (required, logged & notified)" : "Reason (the claimant will see this)"} className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-[13px] outline-none" autoFocus />
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => { setRejecting(false); setReopening(false); }} className="h-8 rounded-lg px-3 text-[12.5px] text-muted-foreground hover:text-foreground">Cancel</button>
                <button type="button" onClick={() => act.mutate(reopening ? "reopen" : "reject")} disabled={act.isPending || (reopening && !reason.trim())} className={cn("h-8 rounded-lg px-3 text-[12.5px] font-semibold text-white disabled:opacity-50", reopening ? "bg-primary" : "bg-destructive")}>{reopening ? "Reopen" : "Decline"}</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {(c.canEdit && c.status === "draft") && <button type="button" onClick={() => act.mutate("delete")} className="mr-auto flex h-9 items-center gap-1 rounded-lg px-2.5 text-[13px] text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /> Delete</button>}
              {c.canEdit && <button type="button" onClick={() => setEditing(true)} className="h-9 rounded-lg border border-border px-3.5 text-[13px] font-medium hover:bg-accent">Edit</button>}
              {c.canRecall && <button type="button" onClick={() => act.mutate("recall")} disabled={act.isPending} className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium hover:bg-accent"><Undo2 className="h-4 w-4" /> Recall to draft</button>}
              {(c.canEdit && c.status === "draft") && <button type="button" onClick={() => act.mutate("submit")} disabled={act.isPending} className="h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50">Submit</button>}
              {c.canReopen && <button type="button" onClick={() => { setReopening(true); setReason(""); }} className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium hover:bg-accent"><RotateCcw className="h-4 w-4" /> Reopen</button>}
              {(c.canReview || c.canPay) && <button type="button" onClick={() => { setRejecting(true); setReason(""); }} className="h-9 rounded-lg border border-border px-3.5 text-[13px] font-medium hover:bg-accent">Decline</button>}
              {c.canReview && <button type="button" onClick={() => act.mutate("approve")} disabled={act.isPending} className="h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50">Approve</button>}
              {c.canPay && <button type="button" onClick={() => act.mutate("pay")} disabled={act.isPending} className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-[13px] font-semibold text-white hover:brightness-110 disabled:opacity-50"><Check className="h-4 w-4" /> Mark paid</button>}
            </div>
          )}
        </div>
      )}
      {lightbox && (
        <div onClick={() => setLightbox(null)} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6">
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </DrawerShell>
  );
}

const prettyKey = (k: string) => k.replace(/_/g, " ").replace(/^\w/, (m) => m.toUpperCase());

/* edit an existing claim — fields come from the company's form; receipts are edited only while a draft */
function ClaimEditForm({ claim, onCancel, onSaved }: { claim: ExpenseClaimDetail; onCancel: () => void; onSaved: () => void }) {
  const { data: form, isLoading } = useQuery({ queryKey: ["expenses", "form", claim.workspaceId], queryFn: () => expensesApi.getForm(claim.workspaceId) });
  const fields = (form?.fields ?? []).filter((f) => f.type !== "file");
  const seeded = useMemo(() => {
    const v: FieldValues = {};
    for (const f of form?.fields ?? []) {
      if (f.type === "file") continue;
      v[f.key] =
        f.maps === "title" ? claim.title :
        f.maps === "amount" ? String(claim.amount) :
        f.maps === "description" ? (claim.description ?? "") :
        f.maps === "expenseDate" ? (claim.incurredOn ? claim.incurredOn.slice(0, 10) : "") :
        f.maps === "paymentDate" ? (claim.paidOn ? claim.paidOn.slice(0, 10) : "") :
        (claim.custom?.[f.key] ?? (f.type === "multiselect" ? [] : ""));
    }
    return v;
  }, [form, claim]);
  const [values, setValues] = useState<FieldValues>({});
  const vals = Object.keys(values).length ? values : seeded;
  const set = (key: string, v: unknown) => setValues({ ...vals, [key]: v });
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      const c = collect(form?.fields ?? [], vals, { skipFiles: true });
      if (!c.ok) throw new Error(c.error);
      return expensesApi.edit(claim.id, {
        title: c.title, amount: c.amount,
        description: c.description ?? "",
        ...(c.incurredOn ? { incurredOn: c.incurredOn } : {}),
        ...(c.paidOn ? { paidOn: c.paidOn } : {}),
        custom: c.custom,
      });
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["expenses"] }); onSaved(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.message ?? "Couldn't save."),
  });

  return isLoading || !form ? <div className="h-60 animate-pulse rounded-xl bg-muted" /> : (
    <div>
      <p className="mb-3 text-[12.5px] text-muted-foreground">Editing this claim {claim.status !== "draft" && <>— it is {STATUS[claim.status].label.toLowerCase()}; the change is logged. To change receipts, recall it to a draft first.</>}</p>
      <div className="space-y-3.5">
        {fields.map((f) => <FormFieldRow key={f.key} field={f}><FieldInput field={f} value={vals[f.key]} onChange={(v) => set(f.key, v)} /></FormFieldRow>)}
      </div>
      <div className="mt-5 flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-9 rounded-lg px-3.5 text-[13px] font-medium text-muted-foreground hover:text-foreground">Cancel</button>
        <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50">Save changes</button>
      </div>
    </div>
  );
}

const EVENT_LABEL: Record<string, string> = {
  created: "Created", submitted: "Submitted", manager_approved: "Approved by manager", finance_paid: "Paid by finance", rejected: "Declined", edited: "Edited",
};

/* ───────── categories ───────── */
function CategoriesDialog({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const { data: cats = [] } = useQuery({ queryKey: ["expenses", "categories", workspaceId], queryFn: () => expensesApi.categories(workspaceId) });
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ["expenses", "categories", workspaceId] });

  const add = useMutation({
    mutationFn: () => expensesApi.createCategory(workspaceId, { name: name.trim(), monthlyBudget: budget ? Number(budget) : null }),
    onSuccess: () => { setName(""); setBudget(""); inval(); toast.success("Category added"); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't add."),
  });
  const remove = useMutation({ mutationFn: (id: number) => expensesApi.deleteCategory(id), onSuccess: () => { inval(); } });

  return (
    <DrawerShell title="Categories & budgets" onClose={onClose}>
      <ul className="space-y-2">
        {cats.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-medium">{c.name}</span>
              {c.monthlyBudget != null && (
                <span className={cn("text-[12px]", c.overBudget ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                  {c.overBudget && <AlertTriangle className="mr-0.5 inline h-3 w-3" />}
                  {money(c.spentThisMonth)} / {money(c.monthlyBudget)} this month
                </span>
              )}
            </span>
            <button type="button" onClick={() => remove.mutate(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
        {!cats.length && <li className="py-6 text-center text-[13px] text-muted-foreground">No categories yet.</li>}
      </ul>
      <div className="mt-3 flex items-end gap-2 border-t border-border pt-3">
        <Field label="New category" className="flex-1"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Travel" className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-[13px] outline-none" /></Field>
        <Field label="Monthly budget"><input value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))} placeholder="optional" className="h-9 w-28 rounded-lg border border-border bg-background px-2.5 text-[13px] outline-none" /></Field>
        <button type="button" onClick={() => add.mutate()} disabled={!name.trim() || add.isPending} className="h-9 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50">Add</button>
      </div>
    </DrawerShell>
  );
}

/* ───────── form builder (admin) ───────── */
const TYPE_LABEL: Record<ExpenseFieldType, string> = { text: "Text", textarea: "Paragraph", number: "Number", email: "Email", date: "Date", select: "Dropdown", multiselect: "Multi-select", file: "File / receipt" };
const MAP_LABEL: Record<string, string> = { title: "Title", amount: "Amount", expenseDate: "Expense date", paymentDate: "Payment date", description: "Description" };
const allowedMaps = (t: ExpenseFieldType): string[] =>
  t === "text" ? ["title", "description"] : t === "textarea" ? ["description"] : t === "number" ? ["amount"] : t === "date" ? ["expenseDate", "paymentDate"] : [];

type EditField = { key: string; label: string; type: ExpenseFieldType; required: boolean; maps: string | null; options: string[] };

function FormBuilderDrawer({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const { data: form, isLoading } = useQuery({ queryKey: ["expenses", "form", workspaceId], queryFn: () => expensesApi.getForm(workspaceId) });
  const [init, setInit] = useState(false);
  const [title, setTitle] = useState("Reimbursements");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<EditField[]>([]);
  const qc = useQueryClient();

  if (form && !init) {
    setInit(true);
    setTitle(form.title); setDescription(form.description ?? ""); setActive(form.active);
    setLogoUrl(form.logoUrl); setBannerUrl(form.bannerUrl);
    setFields(form.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, required: f.required, maps: f.maps, options: f.options ?? [] })));
  }

  const setField = (i: number, patch: Partial<EditField>) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, dir: -1 | 1) => setFields((fs) => { const j = i + dir; if (j < 0 || j >= fs.length) return fs; return fs.map((f, k) => (k === i ? fs[j]! : k === j ? fs[i]! : f)); });
  const addField = () => setFields((fs) => [...fs, { key: "", label: "New field", type: "text", required: false, maps: null, options: [] }]);

  const upload = useMutation({
    mutationFn: ({ kind, file }: { kind: "logo" | "banner"; file: File }) => expensesApi.uploadBranding(workspaceId, kind, file),
    onSuccess: (r, v) => { if (v.kind === "logo") setLogoUrl(r.url); else setBannerUrl(r.url); toast.success(`${v.kind === "logo" ? "Logo" : "Banner"} uploaded`); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Upload failed."),
  });

  const save = useMutation({
    mutationFn: () => expensesApi.updateForm(workspaceId, {
      title: title.trim() || "Reimbursements", description: description.trim() || null, active, logoUrl, bannerUrl,
      fields: fields.filter((f) => f.label.trim()).map((f) => ({ key: f.key || undefined, label: f.label.trim(), type: f.type, required: f.required, maps: f.maps, options: f.options })),
    }),
    onSuccess: () => { toast.success("Form saved"); qc.invalidateQueries({ queryKey: ["expenses", "form", workspaceId] }); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't save the form."),
  });

  const shareLink = form ? `${typeof window !== "undefined" ? window.location.origin : ""}/form/expense/${form.shareToken}` : "";
  const hasAmount = fields.some((f) => f.maps === "amount");
  const previewFields: ExpenseFormField[] = fields.filter((f) => f.label.trim()).map((f) => ({ key: f.key || f.label, label: f.label, type: f.type, required: f.required, maps: (f.maps as any) ?? null, options: f.options.length ? f.options : null }));

  return (
    <DrawerShell title="Reimbursement form" onClose={onClose} wide>
      {isLoading || !form ? <div className="h-60 animate-pulse rounded-xl bg-muted" /> : (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* editor */}
          <div className="space-y-4">
            {/* share link */}
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground"><Link2 className="h-3.5 w-3.5" /> Shareable link <span className="ml-1 rounded bg-muted px-1.5 py-px text-[10.5px] font-normal">login required to submit</span></div>
              <div className="mt-2 flex items-center gap-2">
                <input readOnly value={shareLink} className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 text-[12px] outline-none" />
                <button type="button" onClick={() => { navigator.clipboard?.writeText(shareLink); toast.success("Link copied"); }} className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[12px] font-medium hover:bg-accent"><Copy className="h-3.5 w-3.5" /> Copy</button>
              </div>
              <label className="mt-2 flex items-center gap-2 text-[12.5px]">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--primary)]" />
                Form is open for submissions
              </label>
            </div>

            {/* branding */}
            <div className="space-y-3">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Branding</p>
              <div className="flex gap-3">
                <BrandUpload label="Logo" url={logoUrl} onPick={(file) => upload.mutate({ kind: "logo", file })} onClear={() => setLogoUrl(null)} busy={upload.isPending} square />
                <BrandUpload label="Banner" url={bannerUrl} onPick={(file) => upload.mutate({ kind: "banner", file })} onClear={() => setBannerUrl(null)} busy={upload.isPending} />
              </div>
              <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className="h-[38px] w-full rounded-lg border border-border bg-background px-2.5 text-[13.5px] outline-none focus:border-primary/50" /></Field>
              <Field label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full resize-y rounded-lg border border-border bg-background px-2.5 py-2 text-[13.5px] outline-none focus:border-primary/50" placeholder="Shown at the top of the form" /></Field>
            </div>

            {/* fields */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Fields</p>
                <button type="button" onClick={addField} className="flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-[12px] font-medium hover:bg-accent"><Plus className="h-3.5 w-3.5" /> Add field</button>
              </div>
              {!hasAmount && <p className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[12px] text-amber-700 dark:text-amber-400"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />Add a Number field mapped to <b>Amount</b> — claims need an amount.</p>}
              {fields.map((f, i) => {
                const maps = allowedMaps(f.type);
                return (
                  <div key={i} className="rounded-xl border border-border bg-card p-2.5">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <input value={f.label} onChange={(e) => setField(i, { label: e.target.value })} placeholder="Field label" className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-[13px] outline-none focus:border-primary/50" />
                      <div className="flex shrink-0 items-center">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded px-1 text-muted-foreground hover:text-foreground disabled:opacity-30">↑</button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === fields.length - 1} className="rounded px-1 text-muted-foreground hover:text-foreground disabled:opacity-30">↓</button>
                        <button type="button" onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))} className="rounded px-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select value={f.type} onChange={(e) => { const type = e.target.value as ExpenseFieldType; const am = allowedMaps(type); setField(i, { type, maps: f.maps && am.includes(f.maps) ? f.maps : null }); }} className="h-8 rounded-lg border border-border bg-background px-2 text-[12.5px] outline-none">
                        {(Object.keys(TYPE_LABEL) as ExpenseFieldType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                      </select>
                      {maps.length > 0 && (
                        <select value={f.maps ?? ""} onChange={(e) => setField(i, { maps: e.target.value || null })} className="h-8 rounded-lg border border-border bg-background px-2 text-[12.5px] outline-none" title="Save this answer into a claim column">
                          <option value="">Custom field</option>
                          {maps.map((m) => <option key={m} value={m}>→ {MAP_LABEL[m]}</option>)}
                        </select>
                      )}
                      <label className="flex items-center gap-1.5 text-[12.5px]">
                        <input type="checkbox" checked={f.required} onChange={(e) => setField(i, { required: e.target.checked })} className="h-3.5 w-3.5 accent-[var(--primary)]" /> Required
                      </label>
                    </div>
                    {(f.type === "select" || f.type === "multiselect") && (
                      <input value={f.options.join(", ")} onChange={(e) => setField(i, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })} placeholder="Choices, comma-separated" className="mt-2 h-8 w-full rounded-lg border border-border bg-background px-2 text-[12.5px] outline-none focus:border-primary/50" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
              <button type="button" onClick={onClose} className="h-9 rounded-lg px-3.5 text-[13px] font-medium text-muted-foreground hover:text-foreground">Cancel</button>
              <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50">Save form</button>
            </div>
          </div>

          {/* live preview */}
          <div className="lg:border-l lg:border-border lg:pl-5">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
            <div className="rounded-xl border border-border bg-background p-4">
              <FormBranding form={{ title, description: description || null, logoUrl, bannerUrl, company: form.company }} />
              <div className="space-y-3">
                {previewFields.map((f) => <FormFieldRow key={f.key} field={f}><FieldInput field={f} value={f.type === "multiselect" || f.type === "file" ? [] : ""} onChange={() => {}} disabled /></FormFieldRow>)}
                {!previewFields.length && <p className="py-6 text-center text-[13px] text-muted-foreground">Add a field to see it here.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </DrawerShell>
  );
}

function BrandUpload({ label, url, onPick, onClear, busy, square }: { label: string; url: string | null; onPick: (f: File) => void; onClear: () => void; busy?: boolean; square?: boolean }) {
  return (
    <div className={square ? "w-24" : "flex-1"}>
      <span className="mb-1 block text-[12px] font-medium text-muted-foreground">{label}</span>
      {url ? (
        <div className="group relative overflow-hidden rounded-lg border border-border">
          <img src={resolveUrl(url)} alt="" className={cn("w-full object-cover", square ? "h-20" : "h-20")} />
          <button type="button" onClick={onClear} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"><X className="h-3 w-3" /></button>
        </div>
      ) : (
        <label className={cn("flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border text-[11.5px] text-muted-foreground hover:bg-accent/40", square ? "h-20" : "h-20", busy && "opacity-50")}>
          {busy ? "Uploading…" : "Upload"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.currentTarget.value = ""; }} />
        </label>
      )}
    </div>
  );
}

/* ───────── shells ───────── */
function DrawerShell({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={cn("relative flex h-full w-full flex-col overflow-y-auto border-l border-border bg-background shadow-xl", wide ? "max-w-3xl" : "max-w-md")}>
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground sm:hidden"><ArrowLeft className="h-5 w-5" /></button>
          <h2 className="flex-1 text-[15px] font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[12px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
