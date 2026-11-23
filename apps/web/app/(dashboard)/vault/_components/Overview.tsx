"use client";

/*
 * EZ Vault → Overview: everything at a glance. Stat tiles (items, passwords that
 * need attention, shared vaults, items used this week), a health ring, recently
 * used items and quick jumps. All computed in this browser from already-decrypted
 * items + your own activity log — no secrets leave the tab.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Clock3, KeyRound, Layers, ShieldAlert, ShieldCheck, Star, Users } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import * as C from "@/lib/vault/vault-crypto";
import { useVault, type Item } from "../_lib/session";
import type { Nav } from "./VaultMain";
import { ago, ItemIcon } from "./bits";
import { CountUp, fade, GLASS, GlassPage, stagger, StatTile, TILE } from "./ui";

type Ev = { id: number; action: string; createdAt: string; itemUid: string | null };
const USED = new Set(["viewed", "revealed", "copied", "filled", "exported"]);

/** weak / reused / old, exactly as the Security check counts them */
export function securityStats(items: Item[]) {
  const logins = items.filter((i) => i.data.type === "login" && i.data.password);
  const byPw = new Map<string, number>();
  for (const i of logins) byPw.set(i.data.password!, (byPw.get(i.data.password!) ?? 0) + 1);
  const yearAgo = Date.now() - 365 * 86400_000;
  const weak = logins.filter((i) => C.strength(i.data.password!) <= 1);
  const reused = logins.filter((i) => (byPw.get(i.data.password!) ?? 0) > 1);
  const old = logins.filter((i) => +new Date(i.data.passwordUpdatedAt ?? i.createdAt) < yearAgo);
  const issues = new Set([...weak, ...reused, ...old].map((i) => i.uid));
  const score = logins.length ? Math.round(100 * (1 - issues.size / logins.length)) : 100;
  return { logins: logins.length, weak: weak.length, reused: reused.length, old: old.length, issues: issues.size, score };
}

export function OverviewView({ onOpen, onNav }: { onOpen: (uid: string) => void; onNav: (n: Nav) => void }) {
  const { items, vaults, me } = useVault();
  const reduced = useReducedMotion();
  const sec = useMemo(() => securityStats(items), [items]);
  const shared = vaults.filter((v) => v.kind === "shared").length;
  const favorites = items.filter((i) => i.data.favorite).length;

  // my own usage this week (viewed / copied / filled …) — distinct items
  const { data: events = [] } = useQuery({ queryKey: ["vault", "events", ""], queryFn: async () => (await api.get<Ev[]>("/vault/events")).data });
  const weekAgo = Date.now() - 7 * 86400_000;
  const usedThisWeek = useMemo(() => new Set(events.filter((e) => USED.has(e.action) && e.itemUid && +new Date(e.createdAt) >= weekAgo).map((e) => e.itemUid)).size, [events]); // eslint-disable-line react-hooks/exhaustive-deps
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: { item: Item; at: string }[] = [];
    for (const e of events) {
      if (!USED.has(e.action) || !e.itemUid || seen.has(e.itemUid)) continue;
      const item = items.find((i) => i.uid === e.itemUid);
      if (!item) continue;
      seen.add(e.itemUid); out.push({ item, at: e.createdAt });
      if (out.length >= 6) break;
    }
    return out;
  }, [events, items]);

  const ringColor = sec.score >= 80 ? "#0b6b4f" : sec.score >= 50 ? "#b45309" : "#dc2626";
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <GlassPage title="" hint="">
      {/* hero */}
      <motion.section variants={fade} aria-label="Overview" className="relative mb-4 overflow-hidden rounded-[28px] bg-forest p-6 text-white shadow-[0_28px_70px_-34px_rgba(11,42,31,0.95)] sm:p-7 dark:bg-[#0d2a20]">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(rgb(255 255 255 / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.04) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <motion.div aria-hidden className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-brass/30 blur-3xl" animate={reduced ? undefined : { scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
        <div className="relative grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-center">
          <div>
            <p className="text-[12.5px] font-medium text-white/60">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
            <h1 className="mt-1 text-[30px] font-semibold leading-tight tracking-tight sm:text-[34px]">{hello}, <span className="text-brass-soft">{me?.user.firstName ?? "there"}</span></h1>
            <p className="mt-2 max-w-xl text-[14px] text-white/75">
              {items.length} item{items.length === 1 ? "" : "s"} across {vaults.length} vault{vaults.length === 1 ? "" : "s"}.{" "}
              {sec.issues ? <>{sec.issues} password{sec.issues === 1 ? "" : "s"} could be stronger.</> : "Your passwords look healthy."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => onNav({ kind: "security" })} className="flex h-10 items-center gap-1.5 rounded-xl bg-brass px-4 text-[13.5px] font-semibold text-forest transition hover:brightness-110"><ShieldCheck className="h-4 w-4" /> Security check</button>
              <button type="button" onClick={() => onNav({ kind: "activity" })} className="flex h-10 items-center gap-1.5 rounded-xl bg-white/10 px-4 text-[13.5px] font-semibold ring-1 ring-white/20 transition hover:bg-white/15"><Clock3 className="h-4 w-4" /> Activity</button>
            </div>
          </div>
          {/* health ring */}
          <div className="flex items-center gap-4 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
            <div className="relative h-24 w-24 shrink-0">
              <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90"><circle cx="18" cy="18" r="15.9" fill="none" stroke="rgb(255 255 255 / 0.15)" strokeWidth="3" /><motion.circle cx="18" cy="18" r="15.9" fill="none" stroke={ringColor} strokeWidth="3" strokeLinecap="round" initial={reduced ? false : { strokeDasharray: "0 100" }} animate={{ strokeDasharray: `${sec.score} 100` }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} /></svg>
              <span className="absolute inset-0 flex items-center justify-center text-[22px] font-bold"><CountUp value={sec.score} /></span>
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/60">Vault health</p>
              <p className="mt-1 text-[14px] font-semibold">{sec.score >= 80 ? "Looking strong" : sec.score >= 50 ? "Room to improve" : "Needs attention"}</p>
              <p className="mt-0.5 text-[12px] text-white/70">{sec.logins} login{sec.logins === 1 ? "" : "s"} checked in your browser</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* stat tiles */}
      <motion.div variants={stagger} className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="list" aria-label="Key numbers">
        <StatTile icon={Layers} label="Total items" value={items.length} sub={`${favorites} favorite${favorites === 1 ? "" : "s"}`} tone="#0b6b4f" onClick={() => onNav({ kind: "all" })} />
        <StatTile icon={ShieldAlert} label="Need attention" value={sec.issues} sub={`${sec.weak} weak · ${sec.reused} reused · ${sec.old} old`} tone={sec.issues ? "#dc2626" : "#0b6b4f"} onClick={() => onNav({ kind: "security" })} />
        <StatTile icon={Users} label="Shared vaults" value={shared} sub={shared ? "team passwords" : "none yet"} tone="#2563eb" onClick={() => onNav({ kind: "people" })} />
        <StatTile icon={Clock3} label="Used this week" value={usedThisWeek} sub="items you opened or filled" tone="#b45309" onClick={() => onNav({ kind: "activity" })} />
      </motion.div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        {/* recently used */}
        <motion.section variants={fade} aria-label="Recently used" className={cn(GLASS, "p-5")}>
          <header className="mb-3 flex items-center gap-2"><Clock3 className="h-4 w-4 text-product-vault" /><h2 className="flex-1 text-[15px] font-semibold">Recently used</h2><button type="button" onClick={() => onNav({ kind: "activity" })} className="text-[12.5px] font-semibold text-primary hover:underline">All activity</button></header>
          {!recent.length ? <p className="py-10 text-center text-[13px] text-muted-foreground">Nothing yet. Open or fill an item and it shows up here.</p> : (
            <ul className="divide-y divide-border/60">
              {recent.map(({ item, at }) => (
                <li key={item.uid}>
                  <button type="button" onClick={() => onOpen(item.uid)} className="group flex w-full items-center gap-3 rounded-xl px-1.5 py-2 text-left transition hover:bg-accent/40">
                    <ItemIcon item={item} size={34} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-semibold">{item.data.title}</span><span className="block truncate text-[11.5px] text-muted-foreground">{item.data.username || C.hostOf(item.data.urls?.[0] ?? "") || "—"}</span></span>
                    <span className="shrink-0 text-[11.5px] text-muted-foreground">{ago(at)}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        {/* attention + categories */}
        <motion.div variants={fade} className="flex flex-col gap-4">
          <section aria-label="Attention" className={cn(GLASS, "p-5")}>
            <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold"><ShieldAlert className="h-4 w-4 text-[#b45309]" /> Passwords to improve</h2>
            {sec.issues ? (
              <ul className="space-y-1.5">
                {([["Weak", sec.weak, "#dc2626"], ["Reused", sec.reused, "#ca8a04"], ["Not changed in a year", sec.old, "#64748b"]] as const).filter(([, n]) => n > 0).map(([label, n, tone]) => (
                  <li key={label}><button type="button" onClick={() => onNav({ kind: "security" })} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-[13px] transition hover:bg-accent/50"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tone }} /><span className="flex-1">{label}</span><span className="font-mono text-[13px] font-semibold" style={{ color: tone }}>{n}</span><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /></button></li>
                ))}
              </ul>
            ) : <p className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground"><ShieldCheck className="h-4 w-4 text-[#0b6b4f]" /> Everything looks healthy.</p>}
          </section>
          <section aria-label="Favorites quick jump" className={cn(TILE, "p-5")}>
            <h2 className="mb-2 flex items-center gap-2 text-[14px] font-semibold"><Star className="h-4 w-4 text-[#b08d57]" /> Favorites</h2>
            {favorites ? (
              <div className="flex flex-wrap gap-1.5">
                {items.filter((i) => i.data.favorite).slice(0, 8).map((i) => <button key={i.uid} type="button" onClick={() => onOpen(i.uid)} className="flex items-center gap-1.5 rounded-full bg-white/60 py-1 pl-1.5 pr-2.5 text-[12px] font-medium ring-1 ring-black/[0.04] transition hover:bg-white/90 dark:bg-white/5 dark:ring-white/10"><ItemIcon item={i} size={20} /><span className="max-w-[120px] truncate">{i.data.title}</span></button>)}
              </div>
            ) : <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><KeyRound className="h-3.5 w-3.5" /> Star an item to pin it here.</p>}
          </section>
        </motion.div>
      </div>
    </GlassPage>
  );
}
