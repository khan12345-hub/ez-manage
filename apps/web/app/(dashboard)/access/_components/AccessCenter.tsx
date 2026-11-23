"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, Crown, History, Home, MailPlus, Search, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { accessApi, type AccessUser, type MyAccess, type ProductKey } from "@/services/access.api";
import { Confirm, PRODUCT_META, Person, RoleChip, errText } from "./bits";
import { HistoryPage } from "./History";
import { InvitePeople } from "./InvitePeople";
import { UserDrawer } from "./UserDrawer";

const glass = "rounded-[24px] border border-white/70 bg-white/70 shadow-[0_16px_48px_-28px_rgba(11,42,31,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]";
const FILTERS = [["", "Everyone"], ["accounts", "Accounts & Invoices"], ["work", "Company Work"], ["executive", "Administrators"], ["managers", "Access Managers"], ["off", "A product off"]] as const;

/** a product cell: off / not in it / companies with the top role */
function ProductCell({ u, p }: { u: AccessUser; p: ProductKey }) {
  const s: any = (u.products as any)[p];
  if (!s) return <span className="text-muted-foreground">—</span>;
  if (s.explicit && !s.on) return <span className="rounded-md bg-[#dc2626]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#dc2626] dark:text-[#f87171]">Off</span>;
  if (p === "accounts" || p === "work") {
    const cs: { role: string }[] = s.companies;
    if (!cs.length) return <span className="text-[12px] text-muted-foreground">—</span>;
    const order = ["OWNER", "ADMIN", "MEMBER", "LIMITED_MEMBER", "VIEWER", "GUEST"];
    const top = [...cs].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))[0]!;
    return <span className="flex items-center gap-1.5"><RoleChip role={top.role} product={p} />{cs.length > 1 && <span className="text-[11.5px] text-muted-foreground">+{cs.length - 1}</span>}</span>;
  }
  if (p === "tracker") return s.on ? <span className="text-[12px]">{s.trackedCompanies ? `${s.trackedCompanies} co.` : "—"}{s.adminOf ? <span className="ml-1 rounded bg-[#0369a1]/12 px-1 text-[10.5px] font-semibold text-[#0369a1]">admin</span> : null}</span> : <span className="text-[12px] text-muted-foreground">—</span>;
  if (p === "executive") return s.on ? <Crown className="h-4 w-4 text-[#b45309]" aria-label="Administrator" /> : <span className="text-[12px] text-muted-foreground">—</span>;
  return <span className={cn("text-[12px]", s.on ? "text-foreground" : "text-muted-foreground")}>{s.setUp ? "Set up" : s.on ? "On" : "—"}</span>;
}

export function AccessCenter({ me }: { me: MyAccess }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"people" | "history">(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "history" ? "history" : "people"));
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [product, setProduct] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const [inviting, setInviting] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [bulk, setBulk] = useState<{ product: ProductKey; on: boolean } | null>(null);
  useEffect(() => { const t = setTimeout(() => { setDebounced(q); setPage(1); }, 250); return () => clearTimeout(t); }, [q]);
  const { data, isLoading } = useQuery({ queryKey: ["access", "users", debounced, product, status, page], queryFn: () => accessApi.users({ q: debounced, product, status, page, pageSize: 25 }) });
  const { data: companies } = useQuery({ queryKey: ["access", "companies"], queryFn: accessApi.companies, staleTime: 60_000 });
  const users = data?.users ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const cols: ProductKey[] = me.admin ? ["accounts", "work", "tracker", "executive", "vault"] : ["accounts", "work"];
  const setMany = useMutation({
    mutationFn: (b: { product: ProductKey; on: boolean }) => accessApi.setProduct(b.product, [...picked], b.on),
    onSuccess: (_, b) => { toast.success(`${PRODUCT_META[b.product].label} turned ${b.on ? "on" : "off"} for ${picked.size}`); setPicked(new Set()); qc.invalidateQueries({ queryKey: ["access"] }); },
    onError: (e) => toast.error(errText(e)),
  });
  const counts = useMemo(() => ({ total: data?.total ?? 0 }), [data]);

  return (
    <div className="relative min-h-full bg-[#eef3f0] dark:bg-background">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[480px] w-[480px] rounded-full bg-[#34d399]/20 blur-[110px] dark:bg-[#34d399]/10" />
        <div className="absolute -bottom-40 right-[10%] h-[420px] w-[420px] rounded-full bg-[#b08d57]/15 blur-[120px] dark:bg-[#b08d57]/10" />
      </div>
      <div className="relative mx-auto max-w-[1400px] space-y-4 px-4 pb-10 pt-5 sm:px-6">
        {/* header */}
        <header className={cn(glass, "flex flex-wrap items-center gap-3 px-4 py-3")}>
          <Link href="/home" aria-label="EZ Manage home" className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest text-brass-soft"><ShieldCheck className="h-5 w-5" /></Link>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground"><Link href="/home" className="hover:text-foreground"><Home className="inline h-3 w-3" /> EZ Manage</Link><ChevronRight className="h-3 w-3" /> Administration</span>
            <h1 className="text-[22px] font-semibold leading-tight tracking-tight">Access Center</h1>
          </span>
          <span className={cn("hidden rounded-full px-2.5 py-1 text-[11.5px] font-semibold sm:inline-flex", me.admin ? "bg-[#b08d57]/15 text-[#8a6a35] dark:text-[#d9bd8c]" : "bg-primary/10 text-primary")}>{me.admin ? "Administrator" : `Access Manager · ${me.scopes.length} ${me.scopes.length === 1 ? "company" : "companies"}`}</span>
          <button type="button" onClick={() => setInviting(true)} className="flex h-10 items-center gap-1.5 rounded-xl bg-forest px-4 text-[13.5px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(11,42,31,0.8)] hover:brightness-110 dark:bg-primary"><MailPlus className="h-4 w-4" /> Invite people</button>
        </header>

        {/* explainer */}
        <section className={cn(glass, "grid gap-3 p-4 sm:grid-cols-3")}>
          {[
            [ShieldCheck, "Each product keeps its own people", "A role in Accounts & Invoices only counts there. Company Work, EZ Tracker and EZ Vault each have their own."],
            [Users, me.admin ? "You decide which products" : "Your companies only", me.admin ? "Turn a product off for someone and they lose it at once — their companies and roles are kept for later." : "You can invite and manage people in the companies the Administrator gave you. It doesn't give you access to their boards or tasks."],
            [History, "Everything is recorded", "Every invite, role change, removal and product switch is in Access history, and Administrators get a notice."],
          ].map(([Icon, t, d]: any) => (
            <div key={t} className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest/10 text-forest dark:bg-white/10 dark:text-white"><Icon className="h-4 w-4" /></span><span><span className="block text-[13.5px] font-semibold">{t}</span><span className="block text-[12px] leading-snug text-muted-foreground">{d}</span></span></div>
          ))}
        </section>

        <div role="tablist" aria-label="Access Center" className="flex gap-1">
          {([["people", `People${counts.total ? ` · ${counts.total}` : ""}`], ["history", "Access history"]] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("rounded-xl px-3.5 py-2 text-[13px] font-semibold transition", tab === k ? "bg-forest text-white shadow-sm dark:bg-primary" : "text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-white/5")}>{l}</button>
          ))}
        </div>

        {tab === "history" ? <HistoryPage /> : (
          <section aria-label="People" className={cn(glass, "overflow-hidden")}>
            <div className="flex flex-wrap items-center gap-2 border-b border-border/70 p-3">
              <label className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" aria-label="Search people" className="w-full bg-transparent text-[13px] outline-none" /></label>
              <div role="group" aria-label="Filter" className="flex flex-wrap gap-1">
                {FILTERS.filter(([k]) => me.admin || ["", "accounts", "work"].includes(k)).map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={product === k} onClick={() => { setProduct(k); setPage(1); }} className={cn("rounded-lg px-2.5 py-1.5 text-[12px] font-medium", product === k ? "bg-accent text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>{l}</button>
                ))}
              </div>
              {me.admin && (
                <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status" className="h-9 rounded-xl border border-border bg-background px-2.5 text-[12.5px]">
                  <option value="">Any status</option><option value="active">Active</option><option value="disabled">Disabled</option>
                </select>
              )}
            </div>

            {me.admin && picked.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-primary/[0.04] px-3 py-2 text-[12.5px]">
                <b>{picked.size} selected</b><span className="text-muted-foreground">· product for all of them:</span>
                {(["accounts", "work", "tracker", "vault"] as ProductKey[]).map((p) => (
                  <span key={p} className="flex items-center gap-1 rounded-lg border border-border bg-background px-1.5 py-1">
                    <span className="px-1 font-medium">{PRODUCT_META[p].short}</span>
                    <button type="button" onClick={() => setMany.mutate({ product: p, on: true })} className="rounded-md px-1.5 py-0.5 font-semibold text-[#047857] hover:bg-[#047857]/10">On</button>
                    <button type="button" onClick={() => setBulk({ product: p, on: false })} className="rounded-md px-1.5 py-0.5 font-semibold text-[#dc2626] hover:bg-[#dc2626]/10">Off</button>
                  </span>
                ))}
                <button type="button" onClick={() => setPicked(new Set())} className="ml-auto text-muted-foreground hover:text-foreground">Clear</button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[13px]">
                <thead className="sticky top-0 z-[1] bg-white/90 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur dark:bg-[#0f1513]/90">
                  <tr>
                    {me.admin && <th className="w-10 px-3 py-2.5"><input type="checkbox" aria-label="Select all on this page" checked={!!users.length && users.every((u) => picked.has(u.id))} onChange={(e) => setPicked(e.target.checked ? new Set(users.map((u) => u.id)) : new Set())} /></th>}
                    <th className="px-3 py-2.5">Person</th>
                    {cols.map((p) => <th key={p} className="px-3 py-2.5"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: PRODUCT_META[p].color }} />{PRODUCT_META[p].short}</span></th>)}
                    {me.admin && <th className="px-3 py-2.5">Last sign-in</th>}
                  </tr>
                </thead>
                <tbody>
                  {isLoading && [0, 1, 2, 3, 4].map((i) => <tr key={i}><td colSpan={9} className="px-3 py-2"><div className="h-9 animate-pulse rounded-lg bg-muted" /></td></tr>)}
                  {users.map((u) => (
                    <tr key={u.id} onClick={() => setOpen(u.id)} className={cn("cursor-pointer border-t border-border/60 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]", u.status !== "ACTIVE" && "opacity-60")}>
                      {me.admin && <td className="px-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${u.firstName}`} checked={picked.has(u.id)} onChange={(e) => setPicked((s) => { const n = new Set(s); e.target.checked ? n.add(u.id) : n.delete(u.id); return n; })} /></td>}
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <Person p={u} />
                          {u.systemRole === "SUPER_ADMIN" && <Crown className="h-3.5 w-3.5 shrink-0 text-[#b45309]" aria-label="Administrator" />}
                          {!!u.managerScopes?.length && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Access Manager" />}
                          {u.status !== "ACTIVE" && <span className="shrink-0 rounded bg-[#dc2626]/10 px-1.5 text-[10.5px] font-semibold text-[#dc2626]">Disabled</span>}
                        </span>
                      </td>
                      {cols.map((p) => <td key={p} className="px-3"><ProductCell u={u} p={p} /></td>)}
                      {me.admin && <td className="whitespace-nowrap px-3 text-[12px] text-muted-foreground">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "—"}</td>}
                    </tr>
                  ))}
                  {!isLoading && !users.length && <tr><td colSpan={9} className="px-3 py-14 text-center text-[13px] text-muted-foreground">Nobody matches.</td></tr>}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-end gap-2 border-t border-border/70 px-3 py-2 text-[12.5px]">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-8 rounded-lg border border-border px-3 disabled:opacity-40">Previous</button>
                <span className="text-muted-foreground">{page} / {pages}</span>
                <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="h-8 rounded-lg border border-border px-3 disabled:opacity-40">Next</button>
              </div>
            )}
          </section>
        )}
      </div>
      <UserDrawer id={open} me={me} companies={companies} onClose={() => setOpen(null)} />
      <InvitePeople open={inviting} onClose={() => setInviting(false)} me={me} companies={companies} />
      <Confirm open={!!bulk} title={bulk ? `Turn ${PRODUCT_META[bulk.product].label} off for ${picked.size} ${picked.size === 1 ? "person" : "people"}?` : ""}
        body="They lose access right away. Their companies and roles are kept, so turning it back on restores them." action="Turn off" danger
        onClose={() => setBulk(null)} onConfirm={() => { if (bulk) setMany.mutate(bulk); setBulk(null); }} />
    </div>
  );
}
