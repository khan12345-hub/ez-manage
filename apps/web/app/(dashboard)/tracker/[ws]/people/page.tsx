"use client";

/*
 * EZ Tracker → People: the complete admin user panel (Tracker admins and the Administrator).
 * One org-wide list of everyone in EZ Tracker — their app, consent, tracking, today's hours, activity
 * and Away/working status. Click a person for their full profile: contact, devices (with sign-out),
 * consent, day/week/month tracked vs active time, and a deep link to their screenshot timeline.
 * Add anyone in EZ Manage (picker or by email), make/unmake a Tracker admin, pause tracking, remind,
 * or remove. Members only ever see their own My tracking (no screenshots/apps for themselves).
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpRight, BellRing, Briefcase, CheckCircle2, CircleDashed, Clock, Crown, Images, Loader2, Mail, Monitor, MonitorOff, MoreHorizontal, Phone, Search, ShieldAlert, ShieldCheck, UserMinus, UserPlus, UsersRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { hm, trackerApi, userName, type TrackerLiveRow, type TrackerPerson } from "@/services/tracker.api";
import { fmtDay, useTrackerWs } from "../../_lib/tracker";
import { ActivityBar, Avatar, glass } from "../../_components/bits";

type Filter = "all" | "not-installed" | "no-consent" | "off";
type Status = "working" | "away" | "offline";
const ago = (iso: string | null) => {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return m < 2 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const err = (e: any, f: string) => toast.error(e?.response?.data?.message?.toString?.() ?? f);
const splitEmails = (v: string) => v.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
const STATUS: Record<Status, { dot: string; label: string; text: string }> = {
  working: { dot: "bg-[#059669]", label: "Working", text: "text-[#047857] dark:text-[#34d399]" },
  away: { dot: "bg-[#d97706]", label: "Away", text: "text-[#b45309] dark:text-[#fbbf24]" },
  offline: { dot: "bg-muted-foreground/40", label: "Offline", text: "text-muted-foreground" },
};

function Toggle({ on, onChange, busy, label }: { on: boolean; onChange: (v: boolean) => void; busy?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={busy} onClick={() => onChange(!on)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50", on ? "bg-[#047857] dark:bg-[#059669]" : "bg-muted-foreground/30")}>
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

function StatusChip({ status, awaySince }: { status: Status; awaySince?: string | null }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium", s.text)} title={status === "away" && awaySince ? `Away since ${new Date(awaySince).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : s.label}>
      <span className={cn("h-2 w-2 rounded-full", s.dot)} />{s.label}
    </span>
  );
}

function ConsentPill({ c }: { c: TrackerPerson["consent"] }) {
  if (c.state === "agreed") return <span className="inline-flex items-center gap-1 text-[12px] text-[#047857] dark:text-[#34d399]"><CheckCircle2 className="h-3.5 w-3.5" />{new Date(c.at!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>;
  if (c.state === "outdated") return <span className="inline-flex items-center gap-1 text-[12px] text-[#b45309] dark:text-[#fbbf24]"><ShieldAlert className="h-3.5 w-3.5" />Needs to agree again</span>;
  return <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground"><CircleDashed className="h-3.5 w-3.5" />Not yet</span>;
}

/** add people: pick from anyone in EZ Manage, or type their emails */
function AddPeople({ ws, onClose }: { ws: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: cands = [], isLoading } = useQuery({ queryKey: ["tracker", ws, "candidates"], queryFn: () => trackerApi.candidates(ws) });
  const [picked, setPicked] = useState<number[]>([]);
  const [emails, setEmails] = useState("");
  const [asAdmin, setAsAdmin] = useState(false);
  const [q, setQ] = useState("");
  const add = useMutation({
    mutationFn: () => trackerApi.addPeople(ws, { userIds: picked, emails: splitEmails(emails), role: asAdmin ? "admin" : "member" }),
    onSuccess: (r) => { toast.success(r.added ? `${r.added} added — they got an email with the steps` : "They were already in EZ Tracker"); qc.invalidateQueries({ queryKey: ["tracker"] }); onClose(); },
    onError: (e) => err(e, "Couldn't add them."),
  });
  const term = q.trim().toLowerCase();
  const list = cands.filter((u) => !term || `${userName(u)} ${u.email}`.toLowerCase().includes(term));
  const n = picked.length + splitEmails(emails).filter((e) => e.includes("@")).length;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-[#0369a1]" /> Add people to EZ Tracker</DialogTitle>
        <DialogDescription>Add anyone with an EZ Manage account. They get an in-app notice and an email with the download link and pairing steps.</DialogDescription>
        <label className="flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find anyone by name or email" aria-label="Find a person" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" /></label>
        <ul className="max-h-[260px] space-y-1 overflow-y-auto">
          {isLoading && <li className="h-10 animate-pulse rounded-lg bg-muted" />}
          {list.map((u) => {
            const on = picked.includes(u.id);
            return (
              <li key={u.id}>
                <label className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 ring-1", on ? "bg-[#0369a1]/[0.06] ring-[#0369a1]/25" : "ring-transparent hover:bg-accent/60")}>
                  <input type="checkbox" checked={on} onChange={() => setPicked((p) => (on ? p.filter((x) => x !== u.id) : [...p, u.id]))} className="h-4 w-4 accent-[#0369a1]" aria-label={`Add ${userName(u)}`} />
                  <Avatar user={u} size={28} />
                  <span className="min-w-0"><span className="block truncate text-[13px] font-medium">{userName(u)}</span><span className="block truncate text-[11.5px] text-muted-foreground">{u.email}</span></span>
                </label>
              </li>
            );
          })}
          {!isLoading && !list.length && <li className="px-2 py-4 text-center text-[12.5px] text-muted-foreground">{cands.length ? "Nobody matches." : "Everyone in EZ Manage is already in EZ Tracker."}</li>}
        </ul>
        <label className="block text-[12px] font-medium text-muted-foreground">Or emails (comma or new line)
          <textarea value={emails} onChange={(e) => setEmails(e.target.value)} rows={2} placeholder="name@company.com" className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-[#0369a1]/40" />
        </label>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={asAdmin} onChange={(e) => setAsAdmin(e.target.checked)} className="h-4 w-4 accent-[#0369a1]" /> Make them Tracker admins (they see the whole team here)</label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-xl px-3 text-[13px] text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="button" disabled={!n || add.isPending} onClick={() => add.mutate()} className="flex h-9 items-center gap-1.5 rounded-xl bg-forest px-3.5 text-[13px] font-semibold text-forest-foreground disabled:opacity-40 dark:bg-primary dark:text-primary-foreground">
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add {n || ""}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PeriodCard({ label, tracked, active }: { label: string; tracked: number; active: number }) {
  const pct = tracked ? Math.round((active / tracked) * 100) : 0;
  return (
    <div className="rounded-2xl border border-border/70 bg-card px-3.5 py-3">
      <p className="text-[11.5px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-[22px] font-bold leading-none tabular-nums">{hm(tracked)}</p>
      <p className="mt-1.5 text-[11.5px] text-muted-foreground">Active <b className="font-semibold text-foreground tabular-nums">{hm(active)}</b> · {pct}%</p>
    </div>
  );
}

/** Admin: pick the people this person may monitor (their scoped team). Empty = only their own data. */
function TeamAssign({ ws, managerId }: { ws: string; managerId: number }) {
  const qc = useQueryClient();
  const { data: people = [] } = useQuery({ queryKey: ["tracker", ws, "people"], queryFn: () => trackerApi.people(ws) });
  const { data: team = [], isLoading } = useQuery({ queryKey: ["tracker", ws, "team", managerId], queryFn: () => trackerApi.teamOf(ws, managerId) });
  const [sel, setSel] = useState<Set<number> | null>(null);
  const current = sel ?? new Set(team);
  const save = useMutation({ mutationFn: (ids: number[]) => trackerApi.setTeam(ws, managerId, ids), onSuccess: () => { toast.success("Team saved"); setSel(null); qc.invalidateQueries({ queryKey: ["tracker", ws, "team", managerId] }); }, onError: (e) => err(e, "Couldn't save the team.") });
  const others = people.filter((p) => p.user.id !== managerId);
  const toggle = (id: number) => { const n = new Set(current); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };
  const dirty = sel !== null;
  return (
    <section>
      <h3 className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground"><UsersRound className="h-3.5 w-3.5" /> Monitors these people</h3>
      <p className="mb-2 text-[11.5px] text-muted-foreground">Give this person a team to watch — they'll see only these people's Live, hours, screenshots and attendance, not the whole org. Leave empty = they see only their own.</p>
      {isLoading ? <div className="h-20 animate-pulse rounded-xl bg-muted" /> : (
        <>
          <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-border/60 bg-card p-2 sm:grid-cols-2">
            {others.length ? others.map((p) => (
              <label key={p.user.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] hover:bg-accent/60">
                <input type="checkbox" checked={current.has(p.user.id)} onChange={() => toggle(p.user.id)} className="h-4 w-4 accent-[#0369a1]" />
                <span className="truncate">{userName(p.user)}</span>
              </label>
            )) : <p className="px-2 py-3 text-[12px] text-muted-foreground">No one else in EZ Tracker yet.</p>}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" disabled={!dirty || save.isPending} onClick={() => save.mutate([...current])} className="flex h-9 items-center gap-1.5 rounded-xl bg-[#0369a1] px-3 text-[12.5px] font-semibold text-white disabled:opacity-50">{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save team</button>
            {dirty && <button type="button" onClick={() => setSel(null)} className="text-[12px] text-muted-foreground hover:text-foreground">Reset</button>}
            <span className="ml-auto text-[11.5px] text-muted-foreground">{current.size} selected</span>
          </div>
        </>
      )}
    </section>
  );
}

/** full admin profile for one person */
function PersonProfile({ ws, row, status, activity, awaySince, onClose, admin }: { ws: string; row: TrackerPerson; status: Status; activity: number; awaySince: string | null; onClose: () => void; admin: boolean }) {
  const qc = useQueryClient();
  const uid = row.user.id;
  const { data, isLoading } = useQuery({ queryKey: ["tracker", ws, "person", uid], queryFn: () => trackerApi.person(ws, uid) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["tracker"] });
  const tracking = useMutation({ mutationFn: (on: boolean) => trackerApi.setTracking(ws, uid, on), onSuccess: (_, on) => { toast.success(on ? "Tracking on" : "Tracking paused"); refresh(); }, onError: (e) => err(e, "Couldn't change tracking.") });
  const setRole = useMutation({ mutationFn: (role: "member" | "admin") => trackerApi.setRole(ws, uid, role), onSuccess: (_, role) => { toast.success(role === "admin" ? "Now a Tracker admin" : "Now a member (own data only)"); refresh(); }, onError: (e) => err(e, "Couldn't change the role.") });
  const revoke = useMutation({ mutationFn: (id: number) => trackerApi.revokeDeviceAs(ws, id), onSuccess: () => { toast.success("Computer signed out"); refresh(); }, onError: (e) => err(e, "Couldn't sign it out.") });
  const remind = useMutation({ mutationFn: () => trackerApi.remind(ws, uid), onSuccess: () => { toast.success("Reminder sent"); refresh(); }, onError: (e) => err(e, "Couldn't send the reminder.") });
  const removeP = useMutation({ mutationFn: () => trackerApi.removePerson(ws, uid), onSuccess: () => { toast.success(`${userName(row.user)} removed`); refresh(); onClose(); }, onError: (e) => err(e, "Couldn't remove them.") });

  const u = data?.user;
  const isAdmin = data?.member.role === "admin" || row.role === "admin";
  const isSuper = u?.systemRole === "SUPER_ADMIN";
  const days = (data?.days ?? []).slice(0, 14);
  const maxDay = Math.max(1, ...days.map((d) => d.tracked));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-[640px]">
        {/* header */}
        <div className="flex items-start gap-3.5 border-b border-border/60 p-5">
          <Avatar user={row.user} size={56} />
          <div className="min-w-0 flex-1">
            <DialogTitle className="flex flex-wrap items-center gap-2 text-[17px]">
              {userName(row.user)}
              {isSuper && <span className="inline-flex items-center gap-1 rounded bg-[#b45309]/10 px-1.5 text-[10px] font-semibold text-[#b45309] dark:text-[#fbbf24]"><Crown className="h-3 w-3" />Administrator</span>}
              {isAdmin && !isSuper && <span className="rounded bg-[#0369a1]/10 px-1.5 text-[10px] font-semibold text-[#0369a1] dark:text-[#7dd3fc]">Tracker admin</span>}
            </DialogTitle>
            <DialogDescription className="sr-only">Profile and tracking for {userName(row.user)}</DialogDescription>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
              <StatusChip status={status} awaySince={awaySince} />
              <a href={`mailto:${row.user.email}`} className="inline-flex items-center gap-1 hover:text-foreground"><Mail className="h-3.5 w-3.5" />{row.user.email}</a>
              {u?.phone && <a href={`tel:${u.phone}`} className="inline-flex items-center gap-1 hover:text-foreground"><Phone className="h-3.5 w-3.5" />{u.phone}</a>}
              {u?.jobTitle && <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{u.jobTitle}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[11.5px] text-muted-foreground">{row.tracked ? "Tracking on" : "Paused"}</span>
            <Toggle on={row.tracked} busy={tracking.isPending} label="Tracking" onChange={(on) => tracking.mutate(on)} />
          </div>
        </div>

        <div className="space-y-5 p-5">
          {/* period totals */}
          <div className="grid grid-cols-3 gap-2.5">
            <PeriodCard label="Today" tracked={data?.periods.day.tracked ?? row.todaySeconds} active={data?.periods.day.active ?? 0} />
            <PeriodCard label="This week" tracked={data?.periods.week.tracked ?? 0} active={data?.periods.week.active ?? 0} />
            <PeriodCard label="This month" tracked={data?.periods.month.tracked ?? 0} active={data?.periods.month.active ?? 0} />
          </div>

          {/* actions */}
          <div className="flex flex-wrap gap-2">
            <Link href={`/tracker/${ws}/screenshots?user=${uid}`} className="flex h-9 items-center gap-1.5 rounded-xl bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground"><Images className="h-4 w-4" /> Day timeline & screenshots</Link>
            {admin && <button type="button" onClick={() => setRole.mutate(isAdmin ? "member" : "admin")} disabled={setRole.isPending} className="flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-[12.5px] font-medium hover:bg-accent disabled:opacity-50"><ShieldCheck className="h-4 w-4 text-[#0369a1]" />{isAdmin ? "Make a member" : "Make Tracker admin"}</button>}
            {(!row.installed || row.consent.state !== "agreed") && <button type="button" onClick={() => remind.mutate()} disabled={remind.isPending} className="flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-[12.5px] font-medium hover:bg-accent disabled:opacity-50"><BellRing className="h-4 w-4" /> Remind to set up</button>}
            {admin && <button type="button" onClick={() => { if (window.confirm(`Remove ${userName(row.user)} from EZ Tracker? Their computers are signed out; their tracked history stays.`)) removeP.mutate(); }} disabled={removeP.isPending} className="flex h-9 items-center gap-1.5 rounded-xl border border-destructive/30 px-3 text-[12.5px] font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"><UserMinus className="h-4 w-4" /> Remove</button>}
          </div>

          {/* devices + consent */}
          <div className="grid gap-4 sm:grid-cols-2">
            <section>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Computers</h3>
              {isLoading ? <div className="h-16 animate-pulse rounded-xl bg-muted" /> : data?.devices.length ? (
                <ul className="space-y-1.5">
                  {data.devices.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-2.5 py-2 text-[12.5px]">
                      <Monitor className="h-4 w-4 shrink-0 text-[#047857] dark:text-[#34d399]" />
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{d.name}</span><span className="block truncate text-[11px] text-muted-foreground">{[d.os, d.appVersion && `v${d.appVersion}`].filter(Boolean).join(" · ") || "—"} · seen {ago(d.lastSeenAt)}</span></span>
                      <button type="button" onClick={() => { if (window.confirm(`Sign out "${d.name}"?`)) revoke.mutate(d.id); }} className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Sign out ${d.name}`}><X className="h-3.5 w-3.5" /></button>
                    </li>
                  ))}
                </ul>
              ) : <p className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-3 text-[12.5px] text-muted-foreground"><MonitorOff className="h-4 w-4" /> App not installed yet</p>}
            </section>
            <section>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Consent & access</h3>
              <div className="space-y-2 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-[12.5px]">
                <p className="flex items-center justify-between"><span className="text-muted-foreground">Consent</span><ConsentPill c={row.consent} /></p>
                {data?.consent.acceptedAt && <p className="flex items-center justify-between"><span className="text-muted-foreground">Version</span><span className="tabular-nums">{data.consent.version}</span></p>}
                <p className="flex items-center justify-between"><span className="text-muted-foreground">Added</span><span>{fmtDay(data?.member.addedAt?.slice(0, 10) ?? row.addedAt.slice(0, 10), { month: "short", day: "numeric", year: "numeric" })}</span></p>
                {data?.member.addedBy && <p className="flex items-center justify-between"><span className="text-muted-foreground">Added by</span><span className="truncate">{userName(data.member.addedBy)}</span></p>}
                {data && <p className="flex items-center justify-between"><span className="text-muted-foreground">Idle threshold</span><span>{data.idleMinutes} min</span></p>}
              </div>
            </section>
          </div>

          {/* daily breakdown */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Daily breakdown · tracked vs active</h3>
            {isLoading ? <div className="h-32 animate-pulse rounded-xl bg-muted" /> : !days.length ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-[12.5px] text-muted-foreground">No tracked time in the last 30 days.</p>
            ) : (
              <ul className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60 bg-card">
                {days.map((d) => (
                  <li key={d.day}>
                    <Link href={`/tracker/${ws}/screenshots?user=${uid}&day=${d.day}`} className="flex items-center gap-3 px-3 py-2 text-[12.5px] hover:bg-accent/60">
                      <span className="w-20 shrink-0 font-medium">{fmtDay(d.day, { weekday: "short", month: "short", day: "numeric" })}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-[#047857] dark:bg-[#059669]" style={{ width: `${Math.round((d.tracked / maxDay) * 100)}%` }} />
                      </span>
                      <span className="w-14 shrink-0 text-right font-semibold tabular-nums">{hm(d.tracked)}</span>
                      <span className="w-20 shrink-0 text-right text-muted-foreground tabular-nums">act {hm(d.active)}</span>
                      <span className="w-10 shrink-0 text-right text-muted-foreground tabular-nums">{d.activity}%</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1.5 text-[11px] text-muted-foreground">Active time excludes idle / off-seat blocks (no keyboard or mouse for {data?.idleMinutes ?? 15}+ min). Today activity now: <b className="font-semibold text-foreground">{activity}%</b>.</p>
          </section>

          {/* scoped team: who this person may monitor (full admins only) */}
          {admin && <TeamAssign ws={ws} managerId={uid} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TrackerPeople() {
  const qc = useQueryClient();
  const { ws, ov } = useTrackerWs();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [profile, setProfile] = useState<TrackerPerson | null>(null);
  const { data = [], isLoading, isError } = useQuery({ queryKey: ["tracker", ws, "people"], queryFn: () => trackerApi.people(ws), enabled: !!ws && !!ov?.isManager, refetchInterval: 60_000 });
  const { data: live = [] } = useQuery({ queryKey: ["tracker", ws, "live"], queryFn: () => trackerApi.live(ws), enabled: !!ws && !!ov?.isManager, refetchInterval: 30_000 });
  const liveBy = useMemo(() => new Map<number, TrackerLiveRow>(live.map((r) => [r.user.id, r])), [live]);
  const statusOf = (id: number): Status => (liveBy.get(id)?.status as Status) ?? "offline";
  const refresh = () => { qc.invalidateQueries({ queryKey: ["tracker"] }); };

  // open a person's profile when linked with ?user=<id> (e.g. from Unusual activity)
  useEffect(() => {
    if (typeof window === "undefined" || !data.length) return;
    const uid = Number(new URLSearchParams(window.location.search).get("user"));
    if (uid) { const row = data.find((r) => r.user.id === uid); if (row) { setProfile(row); const u = new URL(window.location.href); u.searchParams.delete("user"); window.history.replaceState({}, "", u.toString()); } }
  }, [data]);

  const tracking = useMutation({ mutationFn: (p: { row: TrackerPerson; on: boolean }) => trackerApi.setTracking(ws, p.row.user.id, p.on), onSuccess: (_, v) => { toast.success(v.on ? `Tracking on for ${userName(v.row.user)}` : `Tracking paused for ${userName(v.row.user)}`); refresh(); }, onError: (e) => err(e, "Couldn't change tracking.") });
  const remind = useMutation({ mutationFn: (row: TrackerPerson) => trackerApi.remind(ws, row.user.id), onSuccess: (_, row) => { toast.success(`Reminder sent to ${userName(row.user)}`); refresh(); }, onError: (e) => err(e, "Couldn't send the reminder.") });
  const revoke = useMutation({ mutationFn: (v: { id: number }) => trackerApi.revokeDeviceAs(ws, v.id), onSuccess: () => { toast.success("Computer signed out"); refresh(); }, onError: (e) => err(e, "Couldn't sign it out.") });
  const setRole = useMutation({ mutationFn: (v: { row: TrackerPerson; role: "member" | "admin" }) => trackerApi.setRole(ws, v.row.user.id, v.role), onSuccess: (_, v) => { toast.success(v.role === "admin" ? `${userName(v.row.user)} is a Tracker admin` : `${userName(v.row.user)} sees only their own data now`); refresh(); }, onError: (e) => err(e, "Couldn't change the role.") });
  const removeP = useMutation({ mutationFn: (row: TrackerPerson) => trackerApi.removePerson(ws, row.user.id), onSuccess: (_, row) => { toast.success(`${userName(row.user)} removed — their computers here were signed out`); refresh(); }, onError: (e) => err(e, "Couldn't remove them.") });

  const term = q.trim().toLowerCase();
  const rows = useMemo(() => data.filter((p) => {
    if (term && !`${userName(p.user)} ${p.user.email}`.toLowerCase().includes(term)) return false;
    if (filter === "not-installed") return !p.installed;
    if (filter === "no-consent") return p.consent.state !== "agreed";
    if (filter === "off") return !p.tracked;
    return true;
  }), [data, term, filter]);
  const count = (f: Filter) => data.filter((p) => (f === "not-installed" ? !p.installed : f === "no-consent" ? p.consent.state !== "agreed" : f === "off" ? !p.tracked : true)).length;

  if (ov && !ov.isManager) {
    return <p className={cn(glass, "px-6 py-12 text-center text-[13px] text-muted-foreground")}>Only Tracker admins and the Administrator see the team. <Link href={`/tracker/${ws}/me`} className="font-semibold text-primary hover:underline">Open My tracking</Link></p>;
  }

  const remindedToday = (p: TrackerPerson) => !!p.lastRemindedAt && Date.now() - new Date(p.lastRemindedAt).getTime() < 86_400_000;
  const workingNow = live.filter((r) => r.status === "working").length;
  const awayNow = live.filter((r) => r.status === "away").length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([["In EZ Tracker", data.length, "across the organization"], ["Working now", workingNow, awayNow ? `${awayNow} away / not on seat` : "live right now"], ["App installed", data.filter((p) => p.installed).length, "at least one computer"], ["Tracked today", data.filter((p) => p.todaySeconds > 0).length, `${hm(data.reduce((n, p) => n + p.todaySeconds, 0))} in all`]] as const).map(([l, v, sub]) => (
          <div key={l} className={cn(glass, "p-4")}><p className="text-[12px] text-muted-foreground">{l}</p><p className="mt-1 text-[26px] font-bold leading-none tabular-nums">{v}</p><p className="mt-1 truncate text-[11.5px] text-muted-foreground">{sub}</p></div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Show" className="flex flex-wrap rounded-xl border border-border bg-card p-0.5 text-[12px]">
          {([["all", "Everyone"], ["not-installed", "Not installed"], ["no-consent", "No consent"], ["off", "Paused"]] as const).map(([f, l]) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={cn("rounded-lg px-2.5 py-1 font-medium", filter === f ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>{l} <span className="tabular-nums opacity-70">{count(f)}</span></button>
          ))}
        </div>
        <span className="flex-1" />
        <label className="flex h-9 w-full items-center gap-2 rounded-xl border border-border bg-card px-3 sm:w-[220px]"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person" aria-label="Find a person" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" /></label>
        {ov?.isAdmin && <button type="button" onClick={() => setAdding(true)} className="flex h-9 items-center gap-1.5 rounded-xl bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground"><UserPlus className="h-4 w-4" /> Add people</button>}
      </div>

      {isLoading ? <div className="h-64 animate-pulse rounded-[24px] bg-muted" /> : isError ? <p className={cn(glass, "px-6 py-10 text-center text-[13px] text-muted-foreground")}>Couldn&apos;t load the people.</p> : !rows.length ? (
        <p className={cn(glass, "px-6 py-12 text-center text-[13px] text-muted-foreground")}>
          {data.length ? "Nobody matches this filter." : <>Nobody is in EZ Tracker yet. <button type="button" onClick={() => setAdding(true)} className="font-semibold text-primary hover:underline">Add people</button></>}
        </p>
      ) : (
        <div className={cn(glass, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-[13px]">
              <thead className="bg-black/[0.02] text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:bg-white/[0.03]">
                <tr><th className="px-4 py-2.5">Person</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">App</th><th className="px-3 py-2.5">Consent</th><th className="px-3 py-2.5">Tracking</th><th className="px-3 py-2.5 text-right">Today</th><th className="px-3 py-2.5">Activity</th><th className="px-3 py-2.5 text-right" aria-label="Actions" /></tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const lr = liveBy.get(p.user.id);
                  const st = statusOf(p.user.id);
                  return (
                    <tr key={p.user.id} className="border-t border-border/60 hover:bg-accent/30">
                      <td className="px-4 py-2.5">
                        <button type="button" onClick={() => setProfile(p)} className="flex items-center gap-2.5 text-left" aria-label={`Open ${userName(p.user)}'s profile`}>
                          <span className="relative"><Avatar user={p.user} size={32} /><span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card", STATUS[st].dot)} /></span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5"><span className="truncate font-semibold hover:underline">{userName(p.user)}</span>{p.role === "admin" && <span className="shrink-0 rounded bg-[#0369a1]/10 px-1.5 text-[10px] font-semibold text-[#0369a1] dark:text-[#7dd3fc]">admin</span>}</span>
                            <span className="block truncate text-[11.5px] text-muted-foreground">{p.user.email}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-3"><StatusChip status={st} awaySince={lr?.awaySince} /></td>
                      <td className="px-3">
                        {p.installed ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button type="button" className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[12px] hover:bg-accent"><Monitor className="h-3.5 w-3.5 text-[#047857] dark:text-[#34d399]" />{p.devices.length} · {ago(p.lastSeenAt)}</button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-72 rounded-xl p-2">
                              <p className="px-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Computers</p>
                              {p.devices.map((d) => (
                                <div key={d.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-[12.5px]">
                                  <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{d.name}</span><span className="block text-[11px] text-muted-foreground">{d.os ?? "—"} · seen {ago(d.lastSeenAt)}</span></span>
                                  <button type="button" onClick={() => { if (window.confirm(`Sign out "${d.name}"? It stops tracking until it is paired again.`)) revoke.mutate({ id: d.id }); }} className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Sign out ${d.name}`}><X className="h-3.5 w-3.5" /></button>
                                </div>
                              ))}
                            </PopoverContent>
                          </Popover>
                        ) : <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground"><MonitorOff className="h-3.5 w-3.5" />Not installed</span>}
                      </td>
                      <td className="px-3"><ConsentPill c={p.consent} /></td>
                      <td className="px-3"><Toggle on={p.tracked} label={`Tracking for ${userName(p.user)}`} busy={tracking.isPending} onChange={(on) => tracking.mutate({ row: p, on })} /></td>
                      <td className="px-3 text-right font-semibold tabular-nums">{p.todaySeconds ? hm(p.todaySeconds) : <span className="font-normal text-muted-foreground">—</span>}</td>
                      <td className="px-3"><ActivityBar pct={lr?.todayActivity ?? 0} className="w-[88px]" /></td>
                      <td className="whitespace-nowrap px-3 text-right">
                        {(!p.installed || p.consent.state !== "agreed") && (
                          <button type="button" disabled={remind.isPending || remindedToday(p)} onClick={() => remind.mutate(p)} title={remindedToday(p) ? "Reminded today" : "Send setup steps (in-app + email)"}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12px] font-semibold hover:bg-accent disabled:opacity-50">
                            {remind.isPending && remind.variables?.user.id === p.user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}{remindedToday(p) ? "Reminded" : "Remind"}
                          </button>
                        )}
                        <button type="button" onClick={() => setProfile(p)} className="ml-1 inline-flex h-8 items-center rounded-lg px-2.5 text-[12px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground">Profile</button>
                        <Popover>
                          <PopoverTrigger asChild><button type="button" aria-label={`More for ${userName(p.user)}`} className="ml-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button></PopoverTrigger>
                          <PopoverContent align="end" className="w-60 rounded-xl p-1.5">
                            <Link href={`/tracker/${ws}/screenshots?user=${p.user.id}`} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-accent"><Images className="h-4 w-4 text-[#047857] dark:text-[#34d399]" />Day timeline & screenshots</Link>
                            <button type="button" onClick={() => setRole.mutate({ row: p, role: p.role === "admin" ? "member" : "admin" })} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-accent"><ShieldCheck className="h-4 w-4 text-[#0369a1]" />{p.role === "admin" ? "Make a member (own data only)" : "Make Tracker admin"}</button>
                            <button type="button" onClick={() => { if (window.confirm(`Remove ${userName(p.user)} from EZ Tracker? Their computers here are signed out; their tracked history stays.`)) removeP.mutate(p); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-destructive hover:bg-destructive/10"><UserMinus className="h-4 w-4" />Remove from EZ Tracker</button>
                          </PopoverContent>
                        </Popover>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="text-[11.5px] text-muted-foreground">Only the people listed here are in EZ Tracker. Members see only their own My tracking — never their own screenshots or apps. Click a person for their full profile.</p>
      {adding && <AddPeople ws={ws} onClose={() => setAdding(false)} />}
      {profile && <PersonProfile ws={ws} row={profile} status={statusOf(profile.user.id)} activity={liveBy.get(profile.user.id)?.todayActivity ?? 0} awaySince={liveBy.get(profile.user.id)?.awaySince ?? null} onClose={() => setProfile(null)} admin={!!ov?.isAdmin} />}
    </div>
  );
}
