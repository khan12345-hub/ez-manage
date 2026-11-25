"use client";

/* Vault managers: one item's history, and "Passwords to change" after someone left a vault. */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, Copy, Download, Eye, History, KeyRound, Loader2, ShieldAlert, ShieldCheck, Users, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { errMsg, useVault } from "../_lib/session";
import { ago } from "./bits";
import { fade, GLASS, GlassPage, stagger, TILE } from "./ui";

type Ev = { id: number; action: string; createdAt: string; meta: any; user: { firstName: string; lastName: string } | null };
const SAID: Record<string, string> = {
  created: "added it", updated: "edited it", moved: "moved it", deleted: "moved it to the trash", restored: "restored it",
  viewed: "opened it", revealed: "showed a secret", copied: "copied a secret", filled: "signed in with it", exported: "exported it",
  blocked: "was stopped from showing / copying it", password_changed_marked: "marked its password as changed",
};

/** who opened / copied / filled this item (managers only) */
export function ItemHistory({ itemUid }: { itemUid: string }) {
  const [open, setOpen] = useState(false);
  const { data = [], isLoading } = useQuery({ queryKey: ["vault", "events", "item", itemUid], queryFn: async () => (await api.get<Ev[]>("/vault/events", { params: { item: itemUid } })).data, enabled: open });
  return (
    <section className="mt-4 rounded-xl border border-border bg-card">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-semibold">
        <History className="h-4 w-4 text-product-vault" /> History of this item
        <ChevronDown className={cn("ml-auto h-4 w-4 text-muted-foreground transition", open && "rotate-180")} />
      </button>
      {open && (
        isLoading ? <div className="mx-4 mb-3 h-16 animate-pulse rounded-lg bg-muted" /> : !data.length ? <p className="px-4 pb-3 text-[12.5px] text-muted-foreground">Nothing recorded yet.</p> : (
          <ul className="max-h-64 divide-y divide-border/60 overflow-y-auto border-t border-border">
            {data.map((e) => (
              <li key={e.id} className="flex items-center gap-2 px-4 py-2 text-[12.5px]">
                <span className="min-w-0 flex-1"><strong className="font-semibold">{e.user ? `${e.user.firstName} ${e.user.lastName}` : "Someone"}</strong> {SAID[e.action] ?? e.action}{e.meta?.via === "extension" && <span className="ml-1.5 rounded bg-muted px-1.5 py-px text-[10.5px] text-muted-foreground">extension</span>}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{ago(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}

// ───────── Team monitoring (managers: watch their company's vault activity — never a secret) ─────────

type Person = { id: number; firstName: string | null; lastName: string | null; email: string; avatarUrl: string | null };
type Co = { source: "work" | "boards"; workspaceId: number; name: string };
type TeamRow = { user: Person; admin: boolean; vaults: number; total: number; counts: Record<string, number>; lastActiveAt: string | null; flags: string[] };
type TeamResp = { days: number; companyVaults: number; people: TeamRow[] };
type MemberEv = { id: number; action: string; createdAt: string; meta: any; itemUid: string | null; vaultUid: string | null };

const FLAG: Record<string, { label: string; high: boolean }> = {
  blocked: { label: "Blocked attempts", high: true },
  bulk: { label: "Bulk secrets opened", high: true },
  exported: { label: "Exported items", high: false },
  off_hours: { label: "Off-hours access", high: false },
};
const fullName = (p: Person) => [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email;
const initials = (p: Person) => (fullName(p).split(" ").map((s) => s[0]).slice(0, 2).join("") || "?").toUpperCase();

function Avatar({ p }: { p: Person }) {
  return p.avatarUrl
    ? <img src={p.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
    : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-product-vault/15 text-[11px] font-bold text-product-vault">{initials(p)}</span>;
}

/** A manager's team monitor: who in the company is doing what in the vault, and who to look at. */
export function TeamView() {
  const { data: companies = [], isLoading: loadingCos } = useQuery({ queryKey: ["vault", "admin", "companies"], queryFn: async () => (await api.get<Co[]>("/vault/admin/companies")).data });
  const [scope, setScope] = useState("");
  const [days, setDays] = useState(30);
  const [open, setOpen] = useState<{ co: Co; person: Person } | null>(null);

  const co = useMemo(() => companies.find((c) => `${c.source}:${c.workspaceId}` === scope) ?? companies[0], [companies, scope]);
  const { data, isLoading } = useQuery({
    queryKey: ["vault", "admin", "team", co?.source, co?.workspaceId, days],
    queryFn: async () => (await api.get<TeamResp>("/vault/admin/team", { params: { source: co!.source, workspaceId: co!.workspaceId, days } })).data,
    enabled: !!co,
  });

  const rows = data?.people ?? [];
  const flagged = rows.filter((r) => r.flags.length).length;

  return (
    <GlassPage title="Team" hint="Watch your company's vault activity — who opened, copied or exported which login, and when. Secrets themselves are never shown; this is the (non-secret) event log, so you can see who to check on.">
      <motion.div variants={fade} className={cn(TILE, "mb-4 flex flex-wrap items-center gap-2 p-3")}>
        <Users className="h-4 w-4 text-product-vault" />
        <select value={co ? `${co.source}:${co.workspaceId}` : ""} onChange={(e) => setScope(e.target.value)} aria-label="Company" className="h-9 rounded-lg border border-border bg-background px-2 text-[13px] font-medium">
          {companies.map((c) => <option key={`${c.source}:${c.workspaceId}`} value={`${c.source}:${c.workspaceId}`}>{c.name}</option>)}
        </select>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Time range" className="h-9 rounded-lg border border-border bg-background px-2 text-[13px] font-medium">
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
        </select>
        <span className="ml-auto text-[12.5px] text-muted-foreground">{data?.companyVaults ?? 0} company vault{(data?.companyVaults ?? 0) === 1 ? "" : "s"} · <span className={cn(flagged && "font-semibold text-[#dc2626]")}>{flagged} to check</span></span>
      </motion.div>

      {loadingCos || isLoading ? <div className={cn(GLASS, "h-72 animate-pulse")} /> :
        !companies.length ? <div className={cn(GLASS, "p-10 text-center text-[13px] text-muted-foreground")}>You don't manage any company vaults yet.</div> :
        !rows.length ? <div className={cn(GLASS, "p-10 text-center text-[13px] text-muted-foreground")}>No one is in this company yet.</div> : (
        <motion.section variants={stagger} initial="hidden" animate="show" className={cn(GLASS, "overflow-hidden")}>
          <header className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-black/[0.06] px-4 py-2.5 text-[12px] font-semibold text-muted-foreground dark:border-white/10">
            <span>Person</span><span className="hidden sm:block">Activity · last {days} days</span>
          </header>
          <ul className="divide-y divide-border/50">
            {rows.map((r) => (
              <li key={r.user.id}>
                <button type="button" onClick={() => co && setOpen({ co, person: r.user })} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                  <Avatar p={r.user} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                      <span className="truncate">{fullName(r.user)}</span>
                      {r.admin && <span className="inline-flex items-center gap-0.5 rounded bg-product-vault/12 px-1.5 py-px text-[10px] font-semibold text-product-vault"><ShieldCheck className="h-2.5 w-2.5" />admin</span>}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><KeyRound className="h-3 w-3" />{r.vaults} vault{r.vaults === 1 ? "" : "s"}</span>
                      <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{r.counts.viewed ?? 0} opened</span>
                      <span className="inline-flex items-center gap-1"><Copy className="h-3 w-3" />{(r.counts.copied ?? 0) + (r.counts.revealed ?? 0)} copied</span>
                      {(r.counts.exported ?? 0) > 0 && <span className="inline-flex items-center gap-1 text-[#b45309]"><Download className="h-3 w-3" />{r.counts.exported} exported</span>}
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{r.lastActiveAt ? ago(r.lastActiveAt) : "no activity"}</span>
                    </span>
                    {r.flags.length > 0 && (
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.flags.map((f) => (
                          <span key={f} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", FLAG[f]?.high ? "bg-[#dc2626]/10 text-[#dc2626]" : "bg-[#b45309]/10 text-[#b45309]")}>
                            <ShieldAlert className="h-2.5 w-2.5" />{FLAG[f]?.label ?? f}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-[12px] text-muted-foreground">{r.total}</span>
                </button>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      {open && <MemberDrawer co={open.co} person={open.person} onClose={() => setOpen(null)} />}
    </GlassPage>
  );
}

/** one team member's recent vault activity (metadata only — item titles only if you share the vault). */
function MemberDrawer({ co, person, onClose }: { co: Co; person: Person; onClose: () => void }) {
  const items = useVault((s) => s.items);
  const { data = [], isLoading } = useQuery({
    queryKey: ["vault", "admin", "team", "member", co.source, co.workspaceId, person.id],
    queryFn: async () => (await api.get<MemberEv[]>("/vault/admin/team/member", { params: { source: co.source, workspaceId: co.workspaceId, userId: person.id } })).data,
  });
  const title = (uid: string | null) => items.find((i) => i.uid === uid)?.data.title ?? "an item";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center gap-3 border-b border-border px-5 py-4">
          <Avatar p={person} />
          <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold">{fullName(person)}</p><p className="truncate text-[12px] text-muted-foreground">{person.email}</p></div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-accent"><X className="h-4 w-4" /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Recent activity in {co.name}</p>
          {isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> :
            !data.length ? <p className="py-10 text-center text-[13px] text-muted-foreground">No vault activity recorded.</p> : (
            <ul className="divide-y divide-border/60">
              {data.map((e) => (
                <li key={e.id} className="flex items-start gap-2 py-2.5 text-[12.5px]">
                  <span className="min-w-0 flex-1">{SAID[e.action] ?? e.action} <strong className="font-semibold">{title(e.itemUid)}</strong>{e.meta?.via === "extension" && <span className="ml-1.5 rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">extension</span>}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{ago(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="border-t border-border px-5 py-3 text-[11.5px] text-muted-foreground">Activity only — secrets are never shown here. Titles appear only for vaults you're a member of.</footer>
      </motion.aside>
    </div>
  );
}

type Rot = { id: number; removedAt: string; removed: { firstName: string; lastName: string } | null; by: { firstName: string; lastName: string } | null; items: { itemId: number; itemUid: string | null; gone: boolean; seen: string[]; resolved: boolean; editedSince: boolean }[] };

/** after someone left / was removed: the passwords they could open, to be changed */
export function RotationsPanel({ vaultUid, onOpen }: { vaultUid: string; onOpen: (itemUid: string) => void }) {
  const qc = useQueryClient();
  const items = useVault((s) => s.items);
  const { data = [] } = useQuery({ queryKey: ["vault", "rotations", vaultUid], queryFn: async () => (await api.get<Rot[]>(`/vault/vaults/${vaultUid}/rotations`)).data });
  const [open, setOpen] = useState(false);
  const todo = data.flatMap((r) => r.items.filter((i) => !i.resolved && !i.gone).map((i) => ({ ...i, rot: r })));
  if (!todo.length) return null;
  const title = (uid: string | null) => items.find((i) => i.uid === uid)?.data.title ?? "An item";
  const mark = async (rotId: number, itemId: number) => {
    try { await api.patch(`/vault/rotations/${rotId}`, { itemId, resolved: true }); await qc.invalidateQueries({ queryKey: ["vault", "rotations", vaultUid] }); toast.success("Marked as changed"); }
    catch (e) { toast.error(errMsg(e, "Couldn't save.")); }
  };
  return (
    <div className="border-b border-[#b45309]/25 bg-[#b45309]/[0.06]">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-4 py-2 text-left text-[12.5px]">
        <AlertTriangle className="h-4 w-4 shrink-0 text-[#b45309]" />
        <span className="min-w-0 flex-1"><strong>{todo.length} password{todo.length > 1 ? "s" : ""} to change</strong> — someone who left could open {todo.length > 1 ? "them" : "it"}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="max-h-72 overflow-y-auto border-t border-[#b45309]/20 bg-card">
          {todo.map((i) => (
            <li key={`${i.rot.id}-${i.itemId}`} className="flex items-center gap-2 border-b border-border/60 px-4 py-2 last:border-b-0">
              <button type="button" onClick={() => i.itemUid && onOpen(i.itemUid)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[13px] font-medium">{title(i.itemUid)}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {i.rot.removed ? `${i.rot.removed.firstName} ${i.rot.removed.lastName}` : "Someone"} left {ago(i.rot.removedAt)}
                  {i.seen.length ? ` · they ${i.seen.map((s) => (s === "revealed" ? "showed" : s === "filled" ? "used" : s)).join(", ")} it` : " · could open it"}
                  {i.editedSince && " · edited since"}
                </span>
              </button>
              {i.seen.some((s) => s === "revealed" || s === "copied") && <span className="rounded-full bg-[#dc2626]/10 px-2 py-0.5 text-[10.5px] font-semibold text-[#dc2626]">seen</span>}
              <button type="button" onClick={() => mark(i.rot.id, i.itemId)} className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-border px-2 text-[11.5px] hover:bg-accent"><CheckCircle2 className="h-3.5 w-3.5" /> Changed</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
