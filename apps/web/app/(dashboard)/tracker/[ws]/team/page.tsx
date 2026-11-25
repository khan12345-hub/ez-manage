"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, Network, UserCog, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackerApi, userName } from "@/services/tracker.api";
import { useTrackerWs } from "../../_lib/tracker";
import { Avatar, glass } from "../../_components/bits";
import { fade, stagger } from "../../_components/charts";

const err = (e: any, m: string) => toast.error(e?.response?.data?.message?.toString?.() ?? m);

/** Teams: who monitors whom. An admin assigns each manager a set of people (their scoped team). */
export default function TrackerTeams() {
  const { ws, ov } = useTrackerWs();
  const reduced = useReducedMotion();
  const qc = useQueryClient();
  const isAdmin = (ov as { isAdmin?: boolean } | undefined)?.isAdmin;

  const { data: teams = [], isLoading } = useQuery({ queryKey: ["tracker", ws, "teams"], queryFn: () => trackerApi.teams(ws), enabled: !!ws && !!isAdmin });
  const { data: people = [] } = useQuery({ queryKey: ["tracker", ws, "people"], queryFn: () => trackerApi.people(ws), enabled: !!ws && !!isAdmin });

  const [manager, setManager] = useState<string>("");
  const managerId = Number(manager) || 0;
  const { data: team = [] } = useQuery({ queryKey: ["tracker", ws, "team", managerId], queryFn: () => trackerApi.teamOf(ws, managerId), enabled: !!ws && !!managerId });
  const [sel, setSel] = useState<Set<number> | null>(null);
  const current = sel ?? new Set(team);
  const dirty = sel !== null;
  const save = useMutation({
    mutationFn: (ids: number[]) => trackerApi.setTeam(ws, managerId, ids),
    onSuccess: () => { toast.success("Team saved"); setSel(null); qc.invalidateQueries({ queryKey: ["tracker", ws, "teams"] }); qc.invalidateQueries({ queryKey: ["tracker", ws, "team", managerId] }); },
    onError: (e) => err(e, "Couldn't save the team."),
  });
  const others = useMemo(() => people.filter((p) => p.user.id !== managerId), [people, managerId]);
  const toggle = (id: number) => { const n = new Set(current); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };

  if (ov && !isAdmin) return <div className={cn(glass, "p-10 text-center text-[13px] text-muted-foreground")}>Only Tracker admins and the Administrator can manage teams.</div>;

  return (
    <motion.div initial={reduced ? false : "hidden"} animate="show" variants={stagger} className="space-y-4">
      <motion.div variants={fade} className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0369a1]/10 text-[#0369a1] dark:text-[#7dd3fc]"><Network className="h-4 w-4" /></span>
        <h1 className="text-[16px] font-semibold">Teams</h1>
        <span className="text-[12.5px] text-muted-foreground">· who monitors whom</span>
      </motion.div>

      {/* existing teams */}
      <motion.section variants={fade} className={cn(glass, "overflow-hidden")}>
        <header className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-2.5 dark:border-white/10"><Users className="h-4 w-4 text-[#0369a1]" /><h2 className="flex-1 text-[14px] font-semibold">Current teams</h2><span className="font-mono text-[11.5px] text-muted-foreground">{teams.length}</span></header>
        {isLoading ? <div className="m-4 h-24 animate-pulse rounded-xl bg-muted" /> : !teams.length ? (
          <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">No teams yet. Assign a manager some people below — they'll then see only those people.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {teams.map((t) => (
              <li key={t.manager.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <span className="flex min-w-0 items-center gap-2 sm:w-56 sm:shrink-0">
                  <Avatar user={t.manager} size={32} />
                  <span className="min-w-0"><span className="block truncate text-[13.5px] font-semibold">{userName(t.manager)}</span><span className="block text-[11px] text-muted-foreground">manages {t.members.length}</span></span>
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {t.members.map((m) => <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-2 py-0.5 text-[11.5px] dark:bg-white/[0.06]">{userName(m)}</span>)}
                </span>
                <button type="button" onClick={() => { setManager(String(t.manager.id)); setSel(null); }} className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium hover:bg-accent">Edit</button>
              </li>
            ))}
          </ul>
        )}
      </motion.section>

      {/* assign / edit a team */}
      <motion.section variants={fade} className={cn(glass, "p-5")}>
        <header className="mb-3 flex items-center gap-2"><UserCog className="h-4 w-4 text-[#0369a1]" /><h2 className="text-[14px] font-semibold">Assign a team</h2></header>
        <p className="mb-3 text-[12.5px] text-muted-foreground">Pick a person to be the manager, then tick who they can monitor. They'll see only those people's Live, hours, screenshots, attendance and unusual activity — not the whole org.</p>
        <select value={manager} onChange={(e) => { setManager(e.target.value); setSel(null); }} aria-label="Manager" className="h-9 w-full max-w-sm rounded-xl border border-border bg-background px-2 text-[13px]">
          <option value="">Choose a manager…</option>
          {people.map((p) => <option key={p.user.id} value={p.user.id}>{userName(p.user)} · {p.user.email}</option>)}
        </select>

        {!!managerId && (
          <div className="mt-3">
            <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-border/60 bg-card p-2 sm:grid-cols-2">
              {others.length ? others.map((p) => (
                <label key={p.user.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] hover:bg-accent/60">
                  <input type="checkbox" checked={current.has(p.user.id)} onChange={() => toggle(p.user.id)} className="h-4 w-4 accent-[#0369a1]" />
                  <Avatar user={p.user} size={22} /><span className="truncate">{userName(p.user)}</span>
                </label>
              )) : <p className="px-2 py-3 text-[12px] text-muted-foreground">No one else in EZ Tracker yet.</p>}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" disabled={!dirty || save.isPending} onClick={() => save.mutate([...current])} className="flex h-9 items-center gap-1.5 rounded-xl bg-[#0369a1] px-3 text-[12.5px] font-semibold text-white disabled:opacity-50">{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save team</button>
              {dirty && <button type="button" onClick={() => setSel(null)} className="text-[12px] text-muted-foreground hover:text-foreground">Reset</button>}
              <span className="ml-auto text-[11.5px] text-muted-foreground">{current.size} selected</span>
            </div>
          </div>
        )}
      </motion.section>
    </motion.div>
  );
}
