"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Activity, AlertTriangle, CheckCircle2, Clock, Copy, Download, KeyRound, Laptop, Printer, Repeat, RotateCcw, Search, ShieldAlert, ShieldCheck, TrendingUp, Trash2, Users } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { downloadCsv, printReport } from "@/lib/report";
import * as C from "@/lib/vault/vault-crypto";
import { canReveal, canWrite, errMsg, lockMinutes, setLockMinutes, typeLabel, useVault, type Item } from "../_lib/session";
import { ago, copySecret, ItemIcon, StrengthBar } from "./bits";
import { ResetVault } from "./Auth";
import { fade, GLASS, GlassPage, stagger, TILE } from "./ui";

// ───────── Security check ─────────

export function SecurityView({ onOpen }: { onOpen: (uid: string) => void }) {
  const { items } = useVault();
  const [breached, setBreached] = useState<Record<string, number> | null>(null);
  const [checking, setChecking] = useState(false);
  const logins = items.filter((i) => i.data.type === "login" && i.data.password);
  const groups = useMemo(() => {
    const byPw = new Map<string, Item[]>();
    for (const i of logins) byPw.set(i.data.password!, [...(byPw.get(i.data.password!) ?? []), i]);
    const yearAgo = Date.now() - 365 * 86400_000;
    return {
      weak: logins.filter((i) => C.strength(i.data.password!) <= 1),
      reused: logins.filter((i) => (byPw.get(i.data.password!)?.length ?? 0) > 1),
      old: logins.filter((i) => +new Date(i.data.passwordUpdatedAt ?? i.createdAt) < yearAgo),
      no2fa: logins.filter((i) => !i.data.totp),
    };
  }, [logins]);
  const pwned = breached ? logins.filter((i) => (breached[i.uid] ?? 0) > 0) : [];
  const issues = new Set([...groups.weak, ...groups.reused, ...groups.old, ...pwned].map((i) => i.uid)).size;
  const score = logins.length ? Math.round(100 * (1 - issues / logins.length)) : 100;
  const tone = score >= 80 ? "#0b6b4f" : score >= 50 ? "#b45309" : "#dc2626";

  const check = async () => {
    setChecking(true);
    const out: Record<string, number> = {};
    const cache = new Map<string, number>();
    try {
      for (const i of logins) {
        const pw = i.data.password!;
        if (!cache.has(pw)) cache.set(pw, await C.breachCount(pw));
        out[i.uid] = cache.get(pw)!;
      }
      setBreached(out);
    } catch { toast.error("Couldn't reach the breach check service."); } finally { setChecking(false); }
  };

  const Group = ({ title, icon: Icon, tone, list, why }: { title: string; icon: typeof ShieldAlert; tone: string; list: Item[]; why: (i: Item) => string }) => (
    <motion.section variants={fade} aria-label={title} className={cn(GLASS, "overflow-hidden")}>
      <header className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-3 dark:border-white/10">
        <Icon className="h-4 w-4" style={{ color: tone }} />
        <h2 className="flex-1 text-[14px] font-semibold">{title}</h2>
        <span className="font-mono text-[13px]" style={{ color: list.length ? tone : undefined }}>{list.length}</span>
      </header>
      {list.length ? (
        <ul>{list.slice(0, 50).map((i) => (
          <li key={i.uid}><button type="button" onClick={() => onOpen(i.uid)} className="flex w-full items-center gap-3 border-b border-border/50 px-4 py-2 text-left last:border-b-0 hover:bg-accent/40"><ItemIcon item={i} size={28} /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{i.data.title}</span><span className="block truncate text-[11.5px] text-muted-foreground">{why(i)}</span></span></button></li>
        ))}</ul>
      ) : <p className="flex items-center gap-2 px-4 py-3 text-[12.5px] text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-[#0b6b4f]" /> All good</p>}
    </motion.section>
  );

  return (
    <GlassPage title="Watchtower" hint="Your security score, and passwords that are weak, reused, old, missing 2FA, or found in known data breaches. Everything is checked in your browser." max="max-w-3xl">
      <motion.div variants={fade} className={cn(GLASS, "mb-5 flex flex-wrap items-center gap-5 p-5")}>
        <div className="relative h-20 w-20 shrink-0">
          <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90"><circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--muted)" strokeWidth="3" /><motion.circle cx="18" cy="18" r="15.9" fill="none" stroke={tone} strokeWidth="3" strokeLinecap="round" initial={{ strokeDasharray: "0 100" }} animate={{ strokeDasharray: `${score} 100` }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} /></svg>
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[20px]">{score}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{issues ? `${issues} login${issues > 1 ? "s" : ""} need attention` : "Your passwords look healthy"}</p>
          <p className="text-[12.5px] text-muted-foreground">{logins.length} logins checked.</p>
        </div>
        <button type="button" onClick={check} disabled={checking || !logins.length} className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[13px] hover:bg-accent disabled:opacity-50"><ShieldCheck className="h-4 w-4" /> {checking ? "Checking…" : breached ? "Check breaches again" : "Check for breaches"}</button>
      </motion.div>
      <p className="mb-4 text-[11.5px] text-muted-foreground">The breach check uses Have I Been Pwned: only the first 5 characters of each password&apos;s fingerprint (SHA-1) are sent, never the password.</p>
      <motion.div variants={stagger} className="grid gap-4">
        {breached && <Group title="Found in data breaches" icon={AlertTriangle} tone="#dc2626" list={pwned} why={(i) => `Seen ${breached[i.uid]!.toLocaleString()} times in breaches — change it now`} />}
        <Group title="Weak passwords" icon={ShieldAlert} tone="#ea580c" list={groups.weak} why={() => "Easy to guess"} />
        <Group title="Reused passwords" icon={Repeat} tone="#ca8a04" list={groups.reused} why={(i) => `Same password as ${logins.filter((x) => x.uid !== i.uid && x.data.password === i.data.password).map((x) => x.data.title).slice(0, 3).join(", ")}`} />
        <Group title="Not changed in over a year" icon={Clock} tone="#475569" list={groups.old} why={(i) => `Changed ${ago(i.data.passwordUpdatedAt ?? i.createdAt)}`} />
        <Group title="No one-time code (2FA) saved" icon={KeyRound} tone="#64748b" list={groups.no2fa} why={() => "If the site supports 2FA, turn it on and save the code here"} />
      </motion.div>
    </GlassPage>
  );
}

// ───────── Unusual activity (shared by the Activity panel and its own page) ─────────
export type Flag = { id: string; person: string; reason: string; detail: string; at: string; high: boolean };
export function unusualFlags(data: Ev[]): Flag[] {
  const flags: Flag[] = [];
  const SENS = ["revealed", "copied", "exported"];
  const byUser = new Map<string, Ev[]>();
  for (const e of data) { const n = name(e.user); byUser.set(n, [...(byUser.get(n) ?? []), e]); }
  for (const [person, evs] of byUser) {
    const sorted = [...evs].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    const sens = sorted.filter((e) => SENS.includes(e.action));
    for (let i = 0; i < sens.length; ) {
      const t0 = +new Date(sens[i]!.createdAt);
      let j = i; while (j < sens.length && +new Date(sens[j]!.createdAt) - t0 <= 10 * 60000) j++;
      if (j - i >= 8) { flags.push({ id: `burst-${person}-${i}`, person, reason: "Many secrets opened fast", detail: `${j - i} reveals/copies/exports within 10 minutes`, at: sens[i]!.createdAt, high: true }); i = j; } else i++;
    }
    const exp = sorted.filter((e) => e.action === "exported");
    if (exp.length >= 3) flags.push({ id: `exp-${person}`, person, reason: "Bulk export", detail: `${exp.length} items exported`, at: exp[exp.length - 1]!.createdAt, high: true });
    const odd = sens.filter((e) => { const h = new Date(e.createdAt).getHours(); return h >= 1 && h < 5; });
    if (odd.length >= 3) flags.push({ id: `odd-${person}`, person, reason: "Late-night access", detail: `${odd.length} secrets opened between 1–5 AM`, at: odd[odd.length - 1]!.createdAt, high: false });
    const blk = sorted.filter((e) => e.action === "blocked" || !!e.meta?.tried);
    if (blk.length >= 3) flags.push({ id: `blk-${person}`, person, reason: "Repeated blocked attempts", detail: `${blk.length} tries to show/copy/export without permission`, at: blk[blk.length - 1]!.createdAt, high: true });
  }
  return flags.sort((a, b) => (a.high === b.high ? 0 : a.high ? -1 : 1) || +new Date(b.at) - +new Date(a.at));
}

/** a dedicated page for the Administrator / vault owner to watch for risky behaviour */
export function AlertsView() {
  const { vaults } = useVault();
  const [vault, setVault] = useState("");
  const { data = [], isLoading } = useQuery({ queryKey: ["vault", "events", vault], queryFn: async () => (await api.get<Ev[]>("/vault/events", { params: vault ? { vault } : {} })).data });
  const flags = useMemo(() => unusualFlags(data), [data]);
  const ownedShared = vaults.filter((v) => v.role === "owner" && v.kind === "shared");
  const high = flags.filter((f) => f.high).length;

  return (
    <GlassPage title="Unusual activity" hint="Risky behaviour spotted in the vault's activity — bursts of secrets opened, bulk exports, late-night access and repeated blocked attempts. Found in your browser from the (non-secret) event log." max="max-w-3xl">
      <motion.div variants={fade} className={cn(TILE, "mb-4 flex flex-wrap items-center gap-2 p-3")}>
        <select value={vault} onChange={(e) => setVault(e.target.value)} aria-label="Whose activity" className="h-9 rounded-lg border border-border bg-background px-2 text-[13px] font-medium">
          <option value="">My activity</option>
          {ownedShared.map((v) => <option key={v.uid} value={v.uid}>Everyone in {v.name}</option>)}
        </select>
        <span className="ml-auto text-[12.5px] text-muted-foreground">{high} high · {flags.length - high} to review</span>
      </motion.div>
      <motion.section variants={fade} className={cn(GLASS, "overflow-hidden")}>
        <header className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-2.5 dark:border-white/10"><ShieldAlert className="h-4 w-4 text-[#dc2626]" /><h2 className="flex-1 text-[13.5px] font-semibold">Alerts</h2><span className="font-mono text-[11.5px] text-muted-foreground">{flags.length}</span></header>
        {isLoading ? <div className="m-4 h-40 animate-pulse rounded-xl bg-muted" /> : !flags.length ? <p className="flex items-center justify-center gap-2 py-12 text-center text-[13px] text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-[#0b6b4f]" /> Nothing unusual right now.</p> : (
          <ul className="divide-y divide-border/50">
            {flags.map((f) => (
              <li key={f.id} className="flex items-start gap-3 px-4 py-2.5 text-[13px]">
                <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", f.high ? "bg-[#dc2626]" : "bg-[#b45309]")} />
                <span className="min-w-0 flex-1"><strong className="font-semibold">{f.person}</strong> · <span className={cn("font-medium", f.high ? "text-[#dc2626]" : "text-[#b45309]")}>{f.reason}</span><span className="block text-[12px] text-muted-foreground">{f.detail}</span></span>
                <span className="shrink-0 text-[11.5px] text-muted-foreground">{ago(f.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </motion.section>
    </GlassPage>
  );
}

// ───────── Activity ─────────

type Ev = { id: number; action: string; createdAt: string; meta: any; user: { firstName: string; lastName: string } | null; member: { firstName: string; lastName: string } | null; itemUid: string | null; vaultUid: string | null };
const ACTION: Record<string, string> = {
  setup: "set up EZ Vault", created: "added", updated: "edited", moved: "moved", deleted: "moved to trash", restored: "restored", purged: "deleted for good",
  viewed: "opened", revealed: "showed a secret of", copied: "copied a secret of", filled: "filled in", exported: "exported",
  vault_created: "created a vault", vault_renamed: "renamed a vault", vault_deleted: "deleted a vault", member_added: "gave access to", member_removed: "removed", member_role: "changed the role of", left: "left a vault",
  master_changed: "changed their master password", reset: "reset EZ Vault", extension_connected: "connected a browser extension", extension_removed: "removed a browser extension",
  shared_outside: "shared outside the company with", blocked: "was stopped from showing or copying", rekeyed: "gave a vault a new key", password_changed_marked: "marked as changed",
  recovery_requested: "asked for vault recovery", recovery_approved: "approved vault recovery for", recovery_declined: "declined vault recovery for", recovery_completed: "recovered their vault with a new master password", recovery_cancelled: "cancelled their recovery request",
  recovery_key_created: "set up admin recovery", company_setting: "changed a company vault setting", vault_admin_added: "made a Vault admin:", vault_admin_removed: "removed Vault admin",
};
const USED = ["viewed", "revealed", "copied", "filled", "exported"];
const CHANGES = ["created", "updated", "moved", "deleted", "restored", "purged", "password_changed_marked"];
const SHARING = ["member_added", "member_removed", "member_role", "shared_outside", "left", "vault_created", "vault_renamed", "vault_deleted", "rekeyed"];
const SECURITY = ["blocked", "master_changed", "reset", "extension_connected", "extension_removed", "recovery_requested", "recovery_approved", "recovery_declined", "recovery_completed", "recovery_cancelled", "recovery_key_created"];
const KINDS: Record<string, string[]> = { used: USED, changes: CHANGES, sharing: SHARING, security: SECURITY };
const KIND_LABEL: [string, string][] = [["all", "Everything"], ["used", "Opened & copied"], ["changes", "Added & edited"], ["sharing", "Sharing & roles"], ["security", "Security"]];
const RANGE: [string, string, number][] = [["all", "All time", 0], ["today", "Today", 1], ["week", "Last 7 days", 7], ["month", "Last 30 days", 30]];
const name = (p: { firstName: string; lastName: string } | null) => (p ? `${p.firstName} ${p.lastName}` : "Someone");

export function ActivityView() {
  const { vaults, items, trash } = useVault();
  const [vault, setVault] = useState("");
  const [kind, setKind] = useState("all");
  const [who, setWho] = useState("");
  const [range, setRange] = useState("all");
  const [q, setQ] = useState("");
  const { data = [], isLoading } = useQuery({ queryKey: ["vault", "events", vault], queryFn: async () => (await api.get<Ev[]>("/vault/events", { params: vault ? { vault } : {} })).data });
  const title = (uid: string | null) => [...items, ...trash].find((i) => i.uid === uid)?.data.title;

  const people = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of data) { const n = name(e.user); m.set(n, (m.get(n) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const filtered = useMemo(() => {
    const since = (RANGE.find((r) => r[0] === range)?.[2] ?? 0) * 86400_000;
    const term = q.trim().toLowerCase();
    return data.filter((e) => {
      if (kind !== "all" && !KINDS[kind]?.includes(e.action)) return false;
      if (who && name(e.user) !== who) return false;
      if (since && Date.now() - +new Date(e.createdAt) > since) return false;
      if (term) { const t = `${name(e.user)} ${ACTION[e.action] ?? e.action} ${title(e.itemUid) ?? ""}`.toLowerCase(); if (!t.includes(term)) return false; }
      return true;
    });
  }, [data, kind, who, range, q]); // eslint-disable-line react-hooks/exhaustive-deps

  // summaries (over the filtered window)
  const mostUsed = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of filtered) if (USED.includes(e.action) && e.itemUid) m.set(e.itemUid, (m.get(e.itemUid) ?? 0) + 1);
    return [...m.entries()].map(([uid, n]) => ({ uid, n, title: title(uid) })).filter((x) => x.title).sort((a, b) => b.n - a.n).slice(0, 5);
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps
  const mostActive = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of filtered) m.set(name(e.user), (m.get(name(e.user)) ?? 0) + 1);
    return [...m.entries()].map(([n, c]) => ({ name: n, c })).sort((a, b) => b.c - a.c).slice(0, 5);
  }, [filtered]);
  const maxUsed = Math.max(1, ...mostUsed.map((x) => x.n));
  const maxActive = Math.max(1, ...mostActive.map((x) => x.c));
  const ownedShared = vaults.filter((v) => v.role === "owner" && v.kind === "shared");

  const unusual = useMemo(() => unusualFlags(data), [data]);

  const whoLabel = vault ? `Everyone in ${ownedShared.find((v) => v.uid === vault)?.name ?? "vault"}` : "My activity";
  const repHeaders = ["When", "Who", "Action", "Item", "Via"];
  const repRows = () => filtered.map((e) => [
    new Date(e.createdAt).toLocaleString(), name(e.user), ACTION[e.action] ?? e.action,
    e.itemUid ? (title(e.itemUid) ?? "an item") : "", e.meta?.via === "extension" ? "extension" : "web",
  ]);
  const exportCsv = () => downloadCsv(`EZ Vault activity — ${whoLabel}`, repHeaders, repRows());
  const printPdf = () => printReport({ title: "EZ Vault — Activity", subtitle: `${whoLabel} · ${filtered.length} events`, headers: repHeaders, rows: repRows(), footer: "Secrets are never logged — only which item and the action." });

  return (
    <GlassPage title="Activity" hint="Who did what, and when. Secrets themselves are never logged — only which item, and the action.">
      {/* scope + filters */}
      <motion.div variants={fade} className={cn(TILE, "mb-4 flex flex-wrap items-center gap-2 p-3")}>
        <select value={vault} onChange={(e) => { setVault(e.target.value); setWho(""); }} aria-label="Whose activity" className="h-9 rounded-lg border border-border bg-background px-2 text-[13px] font-medium">
          <option value="">My activity</option>
          {ownedShared.map((v) => <option key={v.uid} value={v.uid}>Everyone in {v.name}</option>)}
        </select>
        <span className="hidden h-6 w-px bg-border sm:block" />
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type of action" className="h-9 rounded-lg border border-border bg-background px-2 text-[13px]">{KIND_LABEL.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        {vault && people.length > 1 && <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Who" className="h-9 rounded-lg border border-border bg-background px-2 text-[13px]"><option value="">Everyone</option>{people.map(([n]) => <option key={n} value={n}>{n}</option>)}</select>}
        <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="When" className="h-9 rounded-lg border border-border bg-background px-2 text-[13px]">{RANGE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <label className="ml-auto flex h-9 min-w-[160px] flex-1 items-center gap-2 rounded-lg border border-border bg-background px-2.5 sm:max-w-[240px]"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search activity" aria-label="Search activity" className="w-full bg-transparent text-[13px] outline-none" /></label>
        <button type="button" onClick={exportCsv} disabled={!filtered.length} title="Download as CSV" className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[12.5px] font-semibold hover:bg-accent disabled:opacity-40"><Download className="h-3.5 w-3.5" /> CSV</button>
        <button type="button" onClick={printPdf} disabled={!filtered.length} title="Print or save as PDF" className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[12.5px] font-semibold hover:bg-accent disabled:opacity-40"><Printer className="h-3.5 w-3.5" /> PDF</button>
      </motion.div>

      {/* unusual activity */}
      {!isLoading && unusual.length > 0 && (
        <motion.section variants={fade} aria-label="Unusual activity" className={cn(GLASS, "mb-4 overflow-hidden ring-1 ring-[#dc2626]/20")}>
          <header className="flex items-center gap-2 border-b border-[#dc2626]/15 bg-[#dc2626]/[0.04] px-4 py-2.5">
            <ShieldAlert className="h-4 w-4 text-[#dc2626]" /><h2 className="flex-1 text-[13.5px] font-semibold">Unusual activity</h2>
            <span className="rounded-full bg-[#dc2626]/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#dc2626]">{unusual.length}</span>
          </header>
          <ul className="divide-y divide-border/50">
            {unusual.slice(0, 8).map((f) => (
              <li key={f.id} className="flex items-start gap-3 px-4 py-2.5 text-[13px]">
                <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", f.high ? "bg-[#dc2626]" : "bg-[#b45309]")} />
                <span className="min-w-0 flex-1">
                  <strong className="font-semibold">{f.person}</strong> · <span className={cn("font-medium", f.high ? "text-[#dc2626]" : "text-[#b45309]")}>{f.reason}</span>
                  <span className="block text-[12px] text-muted-foreground">{f.detail}</span>
                </span>
                <span className="shrink-0 text-[11.5px] text-muted-foreground">{ago(f.at)}</span>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      {/* summaries */}
      {!isLoading && filtered.length > 0 && (
        <motion.div variants={stagger} className="mb-4 grid gap-4 sm:grid-cols-2">
          <motion.section variants={fade} aria-label="Most-used items" className={cn(GLASS, "p-5")}>
            <h2 className="mb-3 flex items-center gap-2 text-[14px] font-semibold"><TrendingUp className="h-4 w-4 text-product-vault" /> Most-used items</h2>
            {mostUsed.length ? <ul className="space-y-2.5">{mostUsed.map((x) => (
              <li key={x.uid}><div className="flex items-baseline gap-2 text-[12.5px]"><span className="min-w-0 flex-1 truncate font-medium">{x.title}</span><span className="tabular-nums text-muted-foreground">{x.n}×</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><motion.span className="block h-full rounded-full bg-product-vault" initial={{ width: 0 }} animate={{ width: `${(x.n / maxUsed) * 100}%` }} transition={{ duration: 0.7 }} /></div></li>
            ))}</ul> : <p className="py-4 text-center text-[12.5px] text-muted-foreground">No opens or copies in this window.</p>}
          </motion.section>
          <motion.section variants={fade} aria-label="Most-active people" className={cn(GLASS, "p-5")}>
            <h2 className="mb-3 flex items-center gap-2 text-[14px] font-semibold"><Users className="h-4 w-4 text-product-vault" /> Most-active {vault ? "people" : "actions"}</h2>
            <ul className="space-y-2.5">{mostActive.map((x) => (
              <li key={x.name}><div className="flex items-baseline gap-2 text-[12.5px]"><span className="min-w-0 flex-1 truncate font-medium">{x.name}</span><span className="tabular-nums text-muted-foreground">{x.c}</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><motion.span className="block h-full rounded-full bg-[#b08d57]" initial={{ width: 0 }} animate={{ width: `${(x.c / maxActive) * 100}%` }} transition={{ duration: 0.7 }} /></div></li>
            ))}</ul>
          </motion.section>
        </motion.div>
      )}

      {/* feed */}
      <motion.section variants={fade} aria-label="Activity feed" className={cn(GLASS, "overflow-hidden")}>
        <header className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-2.5 dark:border-white/10"><Activity className="h-4 w-4 text-product-vault" /><h2 className="flex-1 text-[13.5px] font-semibold">Timeline</h2><span className="font-mono text-[11.5px] text-muted-foreground">{filtered.length}</span></header>
        {isLoading ? <div className="m-4 h-40 animate-pulse rounded-xl bg-muted" /> : !filtered.length ? <p className="py-12 text-center text-[13px] text-muted-foreground">{data.length ? "Nothing matches these filters." : "Nothing yet."}</p> : (
          <ul className="divide-y divide-border/50">
            {filtered.slice(0, 200).map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-4 py-2.5 text-[13px]">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: USED.includes(e.action) ? "#0b6b4f" : e.action === "blocked" ? "#dc2626" : SHARING.includes(e.action) ? "#2563eb" : "#b08d57" }} />
                <span className="min-w-0 flex-1">
                  <strong className="font-semibold">{name(e.user)}</strong> {ACTION[e.action] ?? e.action}
                  {e.member && <> <strong className="font-semibold">{e.member.firstName} {e.member.lastName}</strong></>}
                  {e.itemUid && <> <span className="font-medium text-foreground">{title(e.itemUid) ?? "an item"}</span></>}
                  {e.meta?.field && <span className="text-muted-foreground"> ({e.meta.field})</span>}
                  {e.meta?.tried && <span className="text-muted-foreground"> (tried to {e.meta.tried === "revealed" ? "show" : e.meta.tried === "copied" ? "copy" : "export"})</span>}
                  {e.meta?.via === "extension" && <span className="ml-1.5 rounded bg-muted px-1.5 py-px text-[10.5px] text-muted-foreground">extension</span>}
                </span>
                <span className="shrink-0 text-[11.5px] text-muted-foreground">{ago(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </motion.section>
    </GlassPage>
  );
}

// ───────── Trash ─────────

export function TrashView() {
  const { trash, vaults } = useVault();
  const act = async (i: Item, forever: boolean) => {
    if (forever && !window.confirm(`Delete "${i.data.title}" for good? This can't be undone.`)) return;
    try {
      if (forever) await api.delete(`/vault/items/${i.uid}`, { params: { forever: 1 } });
      else await api.post(`/vault/items/${i.uid}/restore`);
      await useVault.getState().reload();
      toast.success(forever ? "Deleted" : "Restored");
    } catch (e) { toast.error(errMsg(e, "Couldn't do that.")); }
  };
  return (
    <GlassPage title="Trash" hint="Items you deleted. Restore them, or delete them for good." max="max-w-3xl">
      {!trash.length ? <motion.p variants={fade} className={cn(GLASS, "py-16 text-center text-[13px] text-muted-foreground")}>The trash is empty.</motion.p> : (
        <motion.ul variants={fade} className={cn(GLASS, "divide-y divide-border/50 overflow-hidden")}>
          {trash.map((i) => {
            const canEdit = canWrite(vaults.find((v) => v.uid === i.vaultUid)?.role);
            return (
              <li key={i.uid} className="flex items-center gap-3 px-4 py-2.5">
                <ItemIcon item={i} size={30} />
                <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-medium">{i.data.title}</span><span className="block text-[11.5px] text-muted-foreground">{typeLabel[i.data.type]} · deleted {ago(i.deletedAt!)}</span></span>
                {canEdit && <>
                  <button type="button" onClick={() => act(i, false)} className="flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-[12.5px] hover:bg-accent"><RotateCcw className="h-3.5 w-3.5" /> Restore</button>
                  <button type="button" aria-label={`Delete ${i.data.title} for good`} onClick={() => act(i, true)} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </>}
              </li>
            );
          })}
        </motion.ul>
      )}
    </GlassPage>
  );
}

// ───────── Settings ─────────

type Tok = { id: number; name: string; createdAt: string; lastUsedAt: string | null };
const inputCls = "h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13.5px] outline-none focus:border-primary/50";

export function SettingsView() {
  const qc = useQueryClient();
  const { me, items } = useVault();
  const [mins, setMins] = useState(lockMinutes());
  const { data: tokens = [] } = useQuery({ queryKey: ["vault", "tokens"], queryFn: async () => (await api.get<Tok[]>("/vault/tokens")).data });
  const [code, setCode] = useState<string | null>(null);
  const [old, setOld] = useState(""); const [nw, setNw] = useState(""); const [nw2, setNw2] = useState(""); const [acct, setAcct] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [exportPw, setExportPw] = useState("");

  const connect = async () => {
    try {
      const ua = navigator.userAgent;
      const nm = `${/Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : "Browser"} on ${/Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Android/.test(ua) ? "Android" : /Linux/.test(ua) ? "Linux" : "this device"}`;
      const r = (await api.post<{ id: number; token: string }>("/vault/tokens", { name: nm })).data;
      setCode(r.token);
      const apiBase = String(api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");
      window.postMessage({ type: "EZVAULT_CONNECT", token: r.token, api: apiBase }, window.location.origin);
      await qc.invalidateQueries({ queryKey: ["vault", "tokens"] });
      toast.success("Connect code ready. If the extension is installed it connects by itself.");
    } catch (e) { toast.error(errMsg(e, "Couldn't connect.")); }
  };
  const revoke = async (id: number) => { await api.delete(`/vault/tokens/${id}`).catch(() => null); await qc.invalidateQueries({ queryKey: ["vault", "tokens"] }); };

  const change = async () => {
    if (!me?.keys || nw !== nw2 || nw.length < 10) return;
    setBusy(true);
    try {
      const fields = await C.changeMasterPassword(old, nw, me.keys);
      await api.post("/vault/master-password", { ...fields, accountPassword: acct });
      useVault.getState().setMe({ ...me, keys: { ...me.keys, ...fields } });
      setOld(""); setNw(""); setNw2(""); setAcct("");
      toast.success("Master password changed");
    } catch (e) { toast.error(errMsg(e, "Couldn't change it.")); } finally { setBusy(false); }
  };

  const exportAll = async () => {
    if (!me?.keys) return;
    try { await C.unlockUserKeys(exportPw, me.keys); } catch { toast.error("That master password isn't right."); return; }
    const { vaults } = useVault.getState();
    const rows = items.filter((i) => canReveal(vaults.find((v) => v.uid === i.vaultUid)?.role)).map((i) => ({ type: i.data.type, title: i.data.title, username: i.data.username ?? "", password: i.data.password ?? "", urls: (i.data.urls ?? []).join(" "), totp: i.data.totp ?? "", notes: i.data.notes ?? "", tags: (i.data.tags ?? []).join(","), card: i.data.card ?? null, identity: i.data.identity ?? null }));
    const blob = new Blob([JSON.stringify({ app: "EZ Vault", exportedAt: new Date().toISOString(), items: rows }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `ez-vault-export-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
    if (items[0]) void api.post("/vault/events", { itemUid: items[0].uid, action: "exported" }).catch(() => null);
    setExportPw("");
    toast.success("Exported. The file is NOT encrypted — keep it safe and delete it when done.");
  };

  if (resetting) return <GlassPage title="Reset EZ Vault" max="max-w-3xl"><div className={cn(GLASS, "p-5")}><ResetVault onBack={() => setResetting(false)} /></div></GlassPage>;
  return (
    <GlassPage title="Settings" max="max-w-3xl">
      <motion.section variants={fade} className={cn(GLASS, "p-5")}>
        <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Laptop className="h-4 w-4 text-product-vault" /> Browser extension</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">The EZ Vault extension fills in logins on websites and offers to save new ones. Install it, then connect it here.</p>
        <button type="button" onClick={connect} className="mt-3 h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground">Connect this browser</button>
        {code && (
          <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-[12px] text-muted-foreground">Connect code (shown once). If the extension didn&apos;t connect by itself, paste this into it:</p>
            <div className="mt-1.5 flex items-center gap-2"><code className="min-w-0 flex-1 truncate font-mono text-[12px]">{code}</code><button type="button" aria-label="Copy connect code" onClick={() => copySecret(code, "Connect code")} className="rounded-md p-1.5 hover:bg-accent"><Copy className="h-4 w-4" /></button></div>
          </div>
        )}
        {!!tokens.length && (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                <span className="min-w-0 flex-1"><span className="block font-medium">{t.name}</span><span className="block text-[11.5px] text-muted-foreground">Connected {ago(t.createdAt)}{t.lastUsedAt ? ` · last used ${ago(t.lastUsedAt)}` : ""}</span></span>
                <button type="button" onClick={() => revoke(t.id)} className="rounded-md border border-border px-2.5 py-1 text-[12px] hover:border-destructive/40 hover:text-destructive">Sign out</button>
              </li>
            ))}
          </ul>
        )}
      </motion.section>

      <motion.section variants={fade} className={cn(GLASS, "mt-5 p-5")}>
        <h2 className="text-[15px] font-semibold">Auto-lock</h2>
        <label className="mt-2 flex items-center gap-2 text-[13px]">Lock EZ Vault after
          <select value={mins} onChange={(e) => { setMins(Number(e.target.value)); setLockMinutes(Number(e.target.value)); }} className="h-8 rounded-md border border-border bg-background px-2 text-[13px]" aria-label="Auto-lock minutes">
            {[1, 5, 15, 30, 60, 240].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>)}
          </select> without activity</label>
      </motion.section>

      <motion.section variants={fade} className={cn(GLASS, "mt-5 p-5")}>
        <h2 className="text-[15px] font-semibold">Change master password</h2>
        <form onSubmit={(e) => { e.preventDefault(); void change(); }} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="text-[12px] text-muted-foreground">Current master password</span><input type="password" className={inputCls} value={old} onChange={(e) => setOld(e.target.value)} autoComplete="current-password" /></label>
          <label><span className="text-[12px] text-muted-foreground">New master password</span><input type="password" className={inputCls} value={nw} onChange={(e) => setNw(e.target.value)} autoComplete="new-password" /></label>
          <label><span className="text-[12px] text-muted-foreground">New again</span><input type="password" className={inputCls} value={nw2} onChange={(e) => setNw2(e.target.value)} autoComplete="new-password" /></label>
          {nw && <div className="sm:col-span-2"><StrengthBar value={C.strength(nw)} /></div>}
          <label className="sm:col-span-2"><span className="text-[12px] text-muted-foreground">Your EZ Manage account password (to confirm it&apos;s you)</span><input type="password" className={inputCls} value={acct} onChange={(e) => setAcct(e.target.value)} autoComplete="off" /></label>
          <div className="sm:col-span-2 flex justify-end"><button type="submit" disabled={busy || !old || !acct || nw.length < 10 || nw !== nw2 || C.strength(nw) < 2} className="h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Changing…" : "Change master password"}</button></div>
        </form>
      </motion.section>

      <motion.section variants={fade} className={cn(GLASS, "mt-5 p-5")}>
        <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Download className="h-4 w-4" /> Export</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Download all items as a readable (not encrypted) file. Enter your master password to confirm.</p>
        <form onSubmit={(e) => { e.preventDefault(); void exportAll(); }} className="mt-3 flex gap-2">
          <input type="password" className={inputCls} value={exportPw} onChange={(e) => setExportPw(e.target.value)} placeholder="Master password" aria-label="Master password to export" autoComplete="off" />
          <button type="submit" disabled={!exportPw} className="h-9 shrink-0 rounded-lg border border-border bg-background px-3 text-[13px] hover:bg-accent disabled:opacity-50">Export</button>
        </form>
      </motion.section>

      <motion.section variants={fade} className={cn(GLASS, "mt-5 border-destructive/30 p-5")}>
        <h2 className="text-[15px] font-semibold text-destructive">Reset EZ Vault</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Only if you forgot your master password. Your personal items are deleted.</p>
        <button type="button" onClick={() => setResetting(true)} className="mt-3 h-9 rounded-lg border border-destructive/40 px-3 text-[13px] text-destructive hover:bg-destructive/5">Reset…</button>
      </motion.section>
    </GlassPage>
  );
}
