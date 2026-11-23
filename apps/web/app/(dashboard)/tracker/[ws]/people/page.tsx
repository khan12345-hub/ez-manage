"use client";

/*
 * EZ Tracker → People (Tracker admins and the Administrator). EZ Tracker has its own people per
 * company: add them from the company's members (or by email), make someone a Tracker admin, pause
 * tracking, sign out a computer, send a "please set up" reminder (in-app + email, once a day), or
 * remove them (their computers here are signed out; the history stays).
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, CheckCircle2, CircleDashed, Loader2, Monitor, MonitorOff, MoreHorizontal, Search, ShieldAlert, ShieldCheck, UserMinus, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SOURCE_LABEL, hm, trackerApi, userName, type TrackerPerson } from "@/services/tracker.api";
import { useTrackerWs } from "../../_lib/tracker";
import { Avatar, glass } from "../../_components/bits";

type Filter = "all" | "not-installed" | "no-consent" | "off";
const ago = (iso: string | null) => {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return m < 2 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const err = (e: any, f: string) => toast.error(e?.response?.data?.message?.toString?.() ?? f);
const splitEmails = (v: string) => v.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);

function Toggle({ on, onChange, busy, label }: { on: boolean; onChange: (v: boolean) => void; busy?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={busy} onClick={() => onChange(!on)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50", on ? "bg-[#047857] dark:bg-[#059669]" : "bg-muted-foreground/30")}>
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

function ConsentPill({ c }: { c: TrackerPerson["consent"] }) {
  if (c.state === "agreed") return <span className="inline-flex items-center gap-1 text-[12px] text-[#047857] dark:text-[#34d399]"><CheckCircle2 className="h-3.5 w-3.5" />{new Date(c.at!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>;
  if (c.state === "outdated") return <span className="inline-flex items-center gap-1 text-[12px] text-[#b45309] dark:text-[#fbbf24]"><ShieldAlert className="h-3.5 w-3.5" />Needs to agree again</span>;
  return <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground"><CircleDashed className="h-3.5 w-3.5" />Not yet</span>;
}

/** add people: pick from the company's members, or type emails (they must be in the company) */
function AddPeople({ ws, company, onClose }: { ws: string; company: string; onClose: () => void }) {
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
        <DialogDescription>Only people in {company} can be added. They get an in-app notice and an email with the download link and pairing steps.</DialogDescription>
        <label className="flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find someone in ${company}`} aria-label="Find a member" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" /></label>
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
          {!isLoading && !list.length && <li className="px-2 py-4 text-center text-[12.5px] text-muted-foreground">{cands.length ? "Nobody matches." : `Everyone in ${company} is already in EZ Tracker.`}</li>}
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

export default function TrackerPeople() {
  const qc = useQueryClient();
  const { ws, ov } = useTrackerWs();
  const [scope, setScope] = useState<"company" | "all">("company");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const canAll = !!ov?.isSystemAdmin;
  const key = ["tracker", scope === "all" ? "all" : ws, "people"];
  const { data = [], isLoading, isError } = useQuery({ queryKey: key, queryFn: () => (scope === "all" ? trackerApi.peopleAll() : trackerApi.people(ws)), enabled: !!ws && !!ov?.isManager, refetchInterval: 60_000 });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["tracker"] }); };
  const wsOf = (p: TrackerPerson) => (scope === "all" ? p.company?.key ?? ws : ws);

  const tracking = useMutation({ mutationFn: (p: { row: TrackerPerson; on: boolean }) => trackerApi.setTracking(wsOf(p.row), p.row.user.id, p.on), onSuccess: (_, v) => { toast.success(v.on ? `Tracking on for ${userName(v.row.user)}` : `Tracking paused for ${userName(v.row.user)}`); refresh(); }, onError: (e) => err(e, "Couldn't change tracking.") });
  const remind = useMutation({ mutationFn: (row: TrackerPerson) => trackerApi.remind(wsOf(row), row.user.id), onSuccess: (_, row) => { toast.success(`Reminder sent to ${userName(row.user)}`); refresh(); }, onError: (e) => err(e, "Couldn't send the reminder.") });
  const revoke = useMutation({ mutationFn: (v: { row: TrackerPerson; id: number }) => trackerApi.revokeDeviceAs(wsOf(v.row), v.id), onSuccess: () => { toast.success("Computer signed out"); refresh(); }, onError: (e) => err(e, "Couldn't sign it out.") });
  const setRole = useMutation({ mutationFn: (v: { row: TrackerPerson; role: "member" | "admin" }) => trackerApi.setRole(wsOf(v.row), v.row.user.id, v.role), onSuccess: (_, v) => { toast.success(v.role === "admin" ? `${userName(v.row.user)} is a Tracker admin` : `${userName(v.row.user)} sees only their own data now`); refresh(); }, onError: (e) => err(e, "Couldn't change the role.") });
  const removeP = useMutation({ mutationFn: (row: TrackerPerson) => trackerApi.removePerson(wsOf(row), row.user.id), onSuccess: (_, row) => { toast.success(`${userName(row.user)} removed — their computers here were signed out`); refresh(); }, onError: (e) => err(e, "Couldn't remove them.") });

  const term = q.trim().toLowerCase();
  const rows = useMemo(() => data.filter((p) => {
    if (term && !`${userName(p.user)} ${p.user.email} ${p.company?.name ?? ""}`.toLowerCase().includes(term)) return false;
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
  const company = ov?.workspace?.name ?? "this company";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([["In EZ Tracker", data.length, scope === "all" ? "all companies" : company], ["App installed", data.filter((p) => p.installed).length, "at least one computer"], ["Agreed", data.filter((p) => p.consent.state === "agreed").length, "to the current text"], ["Tracked today", data.filter((p) => p.todaySeconds > 0).length, `${hm(data.reduce((n, p) => n + p.todaySeconds, 0))} in all`]] as const).map(([l, v, sub]) => (
          <div key={l} className={cn(glass, "p-4")}><p className="text-[12px] text-muted-foreground">{l}</p><p className="mt-1 text-[26px] font-bold leading-none tabular-nums">{v}</p><p className="mt-1 truncate text-[11.5px] text-muted-foreground">{sub}</p></div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canAll && (
          <div role="group" aria-label="Scope" className="flex rounded-xl border border-border bg-card p-0.5 text-[12px]">
            {(["company", "all"] as const).map((s) => <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)} className={cn("max-w-[180px] truncate rounded-lg px-2.5 py-1 font-medium", scope === s ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>{s === "company" ? company : "All companies"}</button>)}
          </div>
        )}
        <div role="group" aria-label="Show" className="flex flex-wrap rounded-xl border border-border bg-card p-0.5 text-[12px]">
          {([["all", "Everyone"], ["not-installed", "Not installed"], ["no-consent", "No consent"], ["off", "Paused"]] as const).map(([f, l]) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={cn("rounded-lg px-2.5 py-1 font-medium", filter === f ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>{l} <span className="tabular-nums opacity-70">{count(f)}</span></button>
          ))}
        </div>
        <span className="flex-1" />
        <label className="flex h-9 w-full items-center gap-2 rounded-xl border border-border bg-card px-3 sm:w-[220px]"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person" aria-label="Find a person" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" /></label>
        {scope === "company" && <button type="button" onClick={() => setAdding(true)} className="flex h-9 items-center gap-1.5 rounded-xl bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground"><UserPlus className="h-4 w-4" /> Add people</button>}
      </div>

      {isLoading ? <div className="h-64 animate-pulse rounded-[24px] bg-muted" /> : isError ? <p className={cn(glass, "px-6 py-10 text-center text-[13px] text-muted-foreground")}>Couldn&apos;t load the people.</p> : !rows.length ? (
        <p className={cn(glass, "px-6 py-12 text-center text-[13px] text-muted-foreground")}>
          {data.length ? "Nobody matches this filter." : <>Nobody is in EZ Tracker for {company} yet. <button type="button" onClick={() => setAdding(true)} className="font-semibold text-primary hover:underline">Add people</button></>}
        </p>
      ) : (
        <div className={cn(glass, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-[13px]">
              <thead className="bg-black/[0.02] text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:bg-white/[0.03]">
                <tr><th className="px-4 py-2.5">Person</th><th className="px-3 py-2.5">App</th><th className="px-3 py-2.5">Consent</th><th className="px-3 py-2.5">Tracking</th><th className="px-3 py-2.5 text-right">Today</th><th className="px-3 py-2.5">Last active</th><th className="px-3 py-2.5 text-right" aria-label="Actions" /></tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={`${p.company?.key}-${p.user.id}`} className="border-t border-border/60">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2.5">
                        <Avatar user={p.user} size={32} />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5"><span className="truncate font-semibold">{userName(p.user)}</span>{p.role === "admin" && <span className="shrink-0 rounded bg-[#0369a1]/10 px-1.5 text-[10px] font-semibold text-[#0369a1] dark:text-[#7dd3fc]">Tracker admin</span>}</span>
                          <span className="block truncate text-[11.5px] text-muted-foreground">
                            {scope === "all" && p.company ? <><span className={cn("mr-1 rounded px-1 text-[9.5px] font-semibold uppercase", p.company.source === "boards" ? "bg-product-boards/12 text-product-boards dark:text-[#a5b4fc]" : "bg-product-work/12 text-product-work")}>{p.company.source === "boards" ? "accounts" : "work"}</span>{p.company.name}</> : p.user.email}
                          </span>
                        </span>
                      </span>
                    </td>
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
                                <button type="button" onClick={() => { if (window.confirm(`Sign out "${d.name}"? It stops tracking until it is paired again.`)) revoke.mutate({ row: p, id: d.id }); }} className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Sign out ${d.name}`}><X className="h-3.5 w-3.5" /></button>
                              </div>
                            ))}
                          </PopoverContent>
                        </Popover>
                      ) : <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground"><MonitorOff className="h-3.5 w-3.5" />Not installed</span>}
                    </td>
                    <td className="px-3"><ConsentPill c={p.consent} /></td>
                    <td className="px-3"><Toggle on={p.tracked} label={`Tracking for ${userName(p.user)}`} busy={tracking.isPending} onChange={(on) => tracking.mutate({ row: p, on })} /></td>
                    <td className="px-3 text-right font-semibold tabular-nums">{p.todaySeconds ? hm(p.todaySeconds) : <span className="font-normal text-muted-foreground">—</span>}</td>
                    <td className="px-3 text-[12px] text-muted-foreground">{ago(p.lastActiveAt)}</td>
                    <td className="whitespace-nowrap px-3 text-right">
                      {(!p.installed || p.consent.state !== "agreed") && (
                        <button type="button" disabled={remind.isPending || remindedToday(p)} onClick={() => remind.mutate(p)} title={remindedToday(p) ? "Reminded today" : "Send setup steps (in-app + email)"}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12px] font-semibold hover:bg-accent disabled:opacity-50">
                          {remind.isPending && remind.variables?.user.id === p.user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}{remindedToday(p) ? "Reminded" : "Remind"}
                        </button>
                      )}
                      <Link href={`/tracker/${wsOf(p)}/screenshots?user=${p.user.id}`} className="ml-1 inline-flex h-8 items-center rounded-lg px-2.5 text-[12px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground">Day</Link>
                      <Popover>
                        <PopoverTrigger asChild><button type="button" aria-label={`More for ${userName(p.user)}`} className="ml-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button></PopoverTrigger>
                        <PopoverContent align="end" className="w-60 rounded-xl p-1.5">
                          <button type="button" onClick={() => setRole.mutate({ row: p, role: p.role === "admin" ? "member" : "admin" })} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-accent"><ShieldCheck className="h-4 w-4 text-[#0369a1]" />{p.role === "admin" ? "Make a member (own data only)" : "Make Tracker admin"}</button>
                          <button type="button" onClick={() => { if (window.confirm(`Remove ${userName(p.user)} from EZ Tracker for ${p.company?.name ?? company}? Their computers here are signed out; their tracked history stays.`)) removeP.mutate(p); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-destructive hover:bg-destructive/10"><UserMinus className="h-4 w-4" />Remove from EZ Tracker</button>
                        </PopoverContent>
                      </Popover>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {scope === "company" && ov?.workspace && <p className="text-[11.5px] text-muted-foreground">{SOURCE_LABEL[ov.workspace.source]} · Only the people listed here are in EZ Tracker. Being in the company — even as its owner or admin — doesn&apos;t add anyone.</p>}
      {adding && <AddPeople ws={ws} company={company} onClose={() => setAdding(false)} />}
    </div>
  );
}
