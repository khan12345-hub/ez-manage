"use client";

/* Reimbursements / Expenses — inside Accounts & Invoices. Claim → manager → finance (paid). */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, Check, CircleDollarSign, Clock, Download, FileText,
  Image as ImageIcon, Plus, Receipt, Settings2, Trash2, Upload, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/resolveUrl";
import { expensesApi, type ExpenseClaim, type ExpenseClaimDetail, type ExpenseStatus } from "@/services/expenses.api";

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

/* ───────── new claim drawer ───────── */
function ClaimDrawer({ workspaceId, onClose, onSaved }: { workspaceId: string; onClose: () => void; onSaved: () => void }) {
  const { data: categories = [] } = useQuery({ queryKey: ["expenses", "categories", workspaceId], queryFn: () => expensesApi.categories(workspaceId) });
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("CAD");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [incurredOn, setIncurredOn] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: async (submit: boolean) => {
      const amt = Number(amount);
      if (!title.trim()) throw new Error("Add a title.");
      if (!(amt > 0)) throw new Error("Enter an amount.");
      if (submit && !files.length) throw new Error("Attach at least one receipt to submit.");
      const claim = await expensesApi.create(workspaceId, {
        title: title.trim(), amount: amt, currency, ...(categoryId ? { categoryId: Number(categoryId) } : {}),
        ...(incurredOn ? { incurredOn } : {}), ...(description.trim() ? { description: description.trim() } : {}),
      });
      for (const f of files) await expensesApi.addReceipt(claim.id, f);
      if (submit) await expensesApi.submit(claim.id);
      return claim;
    },
    onSuccess: (_d, submit) => { toast.success(submit ? "Claim submitted" : "Draft saved"); qc.invalidateQueries({ queryKey: ["expenses"] }); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.message ?? "Couldn't save."),
  });

  return (
    <DrawerShell title="New claim" onClose={onClose}>
      <div className="space-y-3.5">
        <Field label="What was it for?"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Client lunch, office supplies" className="h-[38px] w-full rounded-lg border border-border bg-background px-2.5 text-[13.5px] outline-none focus:border-primary/50" autoFocus /></Field>
        <div className="grid grid-cols-[1fr_90px] gap-2">
          <Field label="Amount"><input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="0.00" className="h-[38px] w-full rounded-lg border border-border bg-background px-2.5 text-[13.5px] outline-none focus:border-primary/50" /></Field>
          <Field label="Currency">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-[38px] w-full rounded-lg border border-border bg-background px-2.5 text-[13.5px] outline-none focus:border-primary/50">{["CAD", "USD", "EUR", "GBP", "PKR", "AED", "INR"].map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Category">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")} className="h-[38px] w-full rounded-lg border border-border bg-background px-2.5 text-[13.5px] outline-none focus:border-primary/50">
              <option value="">None</option>
              {categories.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Date"><input type="date" value={incurredOn} onChange={(e) => setIncurredOn(e.target.value)} className="h-[38px] w-full rounded-lg border border-border bg-background px-2.5 text-[13.5px] outline-none focus:border-primary/50" /></Field>
        </div>
        <Field label="Notes (optional)"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="h-[38px] w-full rounded-lg border border-border bg-background px-2.5 text-[13.5px] outline-none focus:border-primary/50 h-auto resize-y py-2" placeholder="Anything the approver should know" /></Field>
        <Field label="Receipts">
          <ReceiptPicker files={files} onChange={setFiles} />
        </Field>
      </div>
      <div className="mt-5 flex items-center justify-end gap-2">
        <button type="button" onClick={() => save.mutate(false)} disabled={save.isPending} className="h-9 rounded-lg border border-border px-3.5 text-[13px] font-medium hover:bg-accent disabled:opacity-50">Save draft</button>
        <button type="button" onClick={() => save.mutate(true)} disabled={save.isPending} className="h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50">Submit</button>
      </div>
    </DrawerShell>
  );
}

function ReceiptPicker({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const [over, setOver] = useState(false);
  const add = (list: FileList | null) => { if (!list) return; onChange([...files, ...Array.from(list)].slice(0, 10)); };
  return (
    <div>
      <label onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        className={cn("flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center transition-colors", over ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40")}>
        <Upload className="h-5 w-5 text-muted-foreground" />
        <span className="text-[12.5px] text-muted-foreground">Drop receipts or <span className="font-medium text-primary">browse</span> · images or PDF, up to 10MB</span>
        <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => add(e.target.files)} />
      </label>
      {!!files.length && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12.5px]">
              {f.type.includes("pdf") ? <FileText className="h-4 w-4 text-muted-foreground" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────── claim detail ───────── */
function ClaimDetail({ claimId, onClose, onChanged }: { claimId: number; onClose: () => void; onChanged: () => void }) {
  const { data: c, isLoading } = useQuery({ queryKey: ["expenses", "claim", claimId], queryFn: () => expensesApi.detail(claimId) });
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const qc = useQueryClient();
  const refresh = () => { qc.invalidateQueries({ queryKey: ["expenses", "claim", claimId] }); onChanged(); };

  const act = useMutation<unknown, any, "submit" | "approve" | "pay" | "reject" | "delete">({
    mutationFn: (kind) =>
      kind === "submit" ? expensesApi.submit(claimId) : kind === "approve" ? expensesApi.approve(claimId) :
      kind === "pay" ? expensesApi.pay(claimId) : kind === "reject" ? expensesApi.reject(claimId, reason) : expensesApi.remove(claimId),
    onSuccess: (_d, kind) => { toast.success(kind === "delete" ? "Deleted" : kind === "pay" ? "Marked paid" : kind === "approve" ? "Approved" : kind === "reject" ? "Declined" : "Submitted"); refresh(); if (kind === "delete") onClose(); setRejecting(false); setReason(""); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't do that."),
  });

  return (
    <DrawerShell title="Claim" onClose={onClose}>
      {isLoading || !c ? <div className="h-40 animate-pulse rounded-xl bg-muted" /> : (
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
            </div>
            {c.claimant && <div className="mt-2 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">By <Mini p={c.claimant} /></div>}
            {c.description && <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-[13px]">{c.description}</p>}
            {c.status === "rejected" && c.rejectedReason && <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-700 dark:text-red-400"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{c.rejectedReason}</p>}
          </div>

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
          {rejecting ? (
            <div className="rounded-lg border border-border p-3">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (the claimant will see this)" className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-[13px] outline-none" autoFocus />
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setRejecting(false)} className="h-8 rounded-lg px-3 text-[12.5px] text-muted-foreground hover:text-foreground">Cancel</button>
                <button type="button" onClick={() => act.mutate("reject")} disabled={act.isPending} className="h-8 rounded-lg bg-destructive px-3 text-[12.5px] font-semibold text-white disabled:opacity-50">Decline</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {c.canEdit && <button type="button" onClick={() => act.mutate("delete")} className="mr-auto flex h-9 items-center gap-1 rounded-lg px-2.5 text-[13px] text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /> Delete</button>}
              {c.canEdit && <button type="button" onClick={() => act.mutate("submit")} disabled={act.isPending} className="h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50">Submit</button>}
              {(c.canReview || c.canPay) && <button type="button" onClick={() => setRejecting(true)} className="h-9 rounded-lg border border-border px-3.5 text-[13px] font-medium hover:bg-accent">Decline</button>}
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

/* ───────── shells ───────── */
function DrawerShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-background shadow-xl">
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
