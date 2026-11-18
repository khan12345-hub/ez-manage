"use client";

/*
 * Executive Hub → Channels: the Administrator's Work chats across every company, with the same
 * Message / Post / Task / Many tasks composer and the Tasks & Mentions panel as Company Work,
 * plus "Assigned by me" — every task they gave out and whether it got done.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ClipboardList, Hash, Lock, MessagesSquare, Plus, Search, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { ceoApi, type CeoAssignedTask, type CeoCompany, type CeoMini } from "@/services/ceo-tower.api";
import { workApi, workKeys } from "@/services/work.api";
import { Avatar } from "../../work/_components/primitives";
import { ChannelView } from "../../work/_components/chat/ChannelView";
import { WorkWsContext } from "../../work/_components/chat/useChat";
import { PeoplePick } from "../../work/_components/chat/ChatTasks";
import { useTaskPopup } from "./TaskPopup";

const mini = (u: CeoMini) => ({ ...u, email: "" }) as any;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—");
const name = (u: CeoMini) => `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
const LAST_KEY = "ez.exec.channel";

/** a ring that fills to `pct` (done share), forest on a soft track */
function Ring({ pct, size = 54 }: { pct: number; size?: number }) {
  const reduced = useReducedMotion();
  const r = (size - 8) / 2, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${pct}% done`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" className="stroke-black/[0.07] dark:stroke-white/10" />
      <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-[#047857] dark:stroke-[#34d399]"
        strokeDasharray={c} initial={{ strokeDashoffset: reduced ? c * (1 - pct / 100) : c }} animate={{ strokeDashoffset: c * (1 - pct / 100) }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle" className="fill-foreground text-[12px] font-bold">{pct}%</text>
    </svg>
  );
}

/** "You assigned N · M done · K overdue" — also the Dashboard card */
export function AssignedSummary({ onOpen, compact = false }: { onOpen?: () => void; compact?: boolean }) {
  const { data } = useQuery({ queryKey: ["ceo-tower", "assigned", "summary"], queryFn: () => ceoApi.assigned(), staleTime: 30_000, refetchInterval: 60_000 });
  const s = data?.summary;
  const pct = s && s.total ? Math.round((s.done / s.total) * 100) : 0;
  return (
    <button type="button" onClick={onOpen} className={cn("flex w-full items-center gap-4 rounded-[22px] border border-white/70 bg-white/70 p-4 text-left shadow-[0_12px_32px_-24px_rgba(11,42,31,0.45)] backdrop-blur-xl transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/[0.04]", compact && "rounded-2xl p-3")}>
      <Ring pct={pct} size={compact ? 46 : 58} />
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-medium text-muted-foreground">Assigned by you</span>
        <span className="mt-0.5 block text-[15px] font-semibold leading-snug">
          {s ? <>You assigned <b>{s.total}</b> · <span className="text-[#047857] dark:text-[#34d399]">{s.done} done</span>{s.overdue > 0 && <> · <span className="text-[#dc2626] dark:text-[#f87171]">{s.overdue} overdue</span></>}</> : "…"}
        </span>
        {!compact && s && <span className="mt-0.5 block text-[11.5px] text-muted-foreground">{s.open} still open · {s.doneWeek} finished this week</span>}
      </span>
      <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function AssignedTable() {
  const showTask = useTaskPopup((s) => s.show);
  const [person, setPerson] = useState<number | "">("");
  const [company, setCompany] = useState("");
  const [state, setState] = useState<"all" | "open" | "done" | "overdue">("all");
  const { data, isLoading } = useQuery({ queryKey: ["ceo-tower", "assigned", person, company, state], queryFn: () => ceoApi.assigned({ person: person || undefined, company: company || undefined, state }), refetchInterval: 60_000 });
  const tasks = data?.tasks ?? [];
  return (
    <div className="space-y-3">
      {data && data.people.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {data.people.slice(0, 8).map((p, i) => {
            const pct = p.assigned ? Math.round((p.done / p.assigned) * 100) : 0;
            return (
              <motion.button key={p.user.id} type="button" onClick={() => setPerson(person === p.user.id ? "" : p.user.id)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className={cn("rounded-2xl border bg-white/70 p-3 text-left transition dark:bg-white/[0.04]", person === p.user.id ? "border-primary/50 ring-2 ring-primary/15" : "border-white/70 hover:border-primary/30 dark:border-white/10")}>
                <span className="flex items-center gap-2"><Avatar user={mini(p.user)} size={26} /><span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{name(p.user)}</span><span className="text-[11.5px] tabular-nums text-muted-foreground">{p.done}/{p.assigned}</span></span>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted"><motion.span className="block h-full rounded-full bg-[#047857] dark:bg-[#34d399]" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} /></span>
                <span className="mt-1.5 flex gap-2 text-[11px] text-muted-foreground">
                  <span>{p.open} open</span>
                  {p.overdue > 0 && <span className="font-semibold text-[#dc2626] dark:text-[#f87171]">{p.overdue} late</span>}
                  {p.avgHoursToDone !== null && <span className="ml-auto">~{p.avgHoursToDone < 48 ? `${p.avgHoursToDone}h` : `${Math.round(p.avgHoursToDone / 24)}d`} to finish</span>}
                </span>
              </motion.button>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Which tasks" className="flex rounded-xl bg-white/60 p-1 ring-1 ring-black/[0.04] dark:bg-white/5">
          {(["all", "open", "done", "overdue"] as const).map((s) => <button key={s} type="button" aria-pressed={state === s} onClick={() => setState(s)} className={cn("rounded-lg px-2.5 py-1 text-[12.5px] font-semibold capitalize transition", state === s ? "bg-white text-foreground shadow-sm dark:bg-white/15" : "text-muted-foreground hover:text-foreground")}>{s}</button>)}
        </div>
        <select aria-label="Person" value={person} onChange={(e) => setPerson(e.target.value ? Number(e.target.value) : "")} className="h-9 rounded-xl border border-border bg-background px-2.5 text-[12.5px]">
          <option value="">Everyone</option>
          {(data?.people ?? []).map((p) => <option key={p.user.id} value={p.user.id}>{name(p.user)}</option>)}
        </select>
        <select aria-label="Company" value={company} onChange={(e) => setCompany(e.target.value)} className="h-9 rounded-xl border border-border bg-background px-2.5 text-[12.5px]">
          <option value="">All companies</option>
          {(data?.companies ?? []).map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
        </select>
        <span className="ml-auto text-[12px] text-muted-foreground">{tasks.length} {tasks.length === 1 ? "task" : "tasks"}</span>
      </div>
      <div className="overflow-x-auto rounded-[20px] border border-white/70 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
        <table className="w-full min-w-[860px] text-[13px]">
          <thead className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <tr className="border-b border-border/70"><th className="px-4 py-2.5">Task</th><th className="px-3 py-2.5">Person</th><th className="px-3 py-2.5">Company · from</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Due</th><th className="px-3 py-2.5">Finished</th></tr>
          </thead>
          <tbody>
            {isLoading && [0, 1, 2, 3].map((i) => <tr key={i}><td colSpan={6} className="px-4 py-2"><div className="h-8 animate-pulse rounded-lg bg-muted" /></td></tr>)}
            {tasks.map((t: CeoAssignedTask) => (
              <tr key={t.id} className="border-b border-border/50 last:border-0 hover:bg-white/60 dark:hover:bg-white/[0.03]">
                <td className="max-w-[320px] px-4 py-2.5"><button type="button" onClick={() => showTask("work", t.id)} className={cn("block max-w-full truncate text-left font-medium hover:text-primary hover:underline", t.completedAt && "text-muted-foreground line-through")}>{t.name}</button><span className="block truncate text-[11.5px] text-muted-foreground">{t.where}</span></td>
                <td className="px-3 py-2.5"><span className="flex items-center gap-1.5"><span className="flex -space-x-1.5">{t.assignees.slice(0, 3).map((u) => <Avatar key={u.id} user={mini(u)} size={22} className="ring-2 ring-card" />)}</span><span className="max-w-[120px] truncate text-[12.5px]">{t.assignees.length === 1 ? name(t.assignees[0]!) : `${t.assignees.length} people`}</span></span></td>
                <td className="px-3 py-2.5 text-[12.5px]"><span className="block truncate font-medium">{t.company.name}</span><span className="block truncate text-[11.5px] text-muted-foreground">{t.channel ? t.channel.name : "Task list"}</span></td>
                <td className="px-3 py-2.5">{t.status && <span className="ez-tint whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase" style={{ ["--c" as string]: t.status.color }}>{t.status.name}</span>}</td>
                <td className={cn("whitespace-nowrap px-3 py-2.5 text-[12.5px] tabular-nums", t.overdue ? "font-semibold text-[#dc2626] dark:text-[#f87171]" : "text-muted-foreground")}>{t.overdue && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />}{fmt(t.dueDate)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px]">{t.completedAt ? <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-[#2563eb] dark:text-[#60a5fa]" />{fmt(t.completedAt)}{t.completedBy && <span className="truncate text-muted-foreground">· {t.completedBy.firstName}</span>}</span> : <span className="text-muted-foreground">—</span>}</td>
              </tr>
            ))}
            {!isLoading && !tasks.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-[13px] text-muted-foreground">Nothing here. Tasks you create for people — in a chat or a list — show up with their progress.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewChannelDialog({ companies, onClose, onCreated }: { companies: CeoCompany[]; onClose: () => void; onCreated: (uid: string, companyUid: string) => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const work = companies.filter((c) => c.source === "work");
  const [company, setCompany] = useState(work[0]?.uid ?? "");
  const [chName, setChName] = useState("");
  const [isPrivate, setPrivate] = useState(true);
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [listId, setListId] = useState<number | null>(null);
  const { data: dir } = useQuery({ queryKey: ["work", "directory", company], queryFn: () => workApi.directory(company), enabled: !!company });
  const { data: tree } = useQuery({ queryKey: workKeys.tree(company), queryFn: () => workApi.tree(company), enabled: !!company });
  const people = (dir?.people ?? []).map((p) => p.user).filter((u) => u.id !== user?.id);
  useEffect(() => { setMemberIds([]); setListId(null); }, [company]);
  const create = useMutation({
    mutationFn: async () => {
      const ch = await workApi.createChannel(company, { name: chName.trim(), isPrivate, memberIds });
      if (listId) await workApi.chatDefaultList(ch.uid, listId).catch(() => null);
      return ch;
    },
    onSuccess: (ch) => { qc.invalidateQueries({ queryKey: ["ceo-tower", "channels"] }); toast.success(`#${ch.name} created — only the people you added can see it`); onCreated(ch.uid, company); },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't create the channel."),
  });
  const lists = (tree?.spaces ?? []).flatMap((s) => [...s.lists.map((l) => ({ id: l.id, label: `${s.name} / ${l.name}` })), ...s.folders.flatMap((f) => f.lists.map((l) => ({ id: l.id, label: `${s.name} / ${f.name} / ${l.name}` })))]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogTitle className="flex items-center gap-2"><MessagesSquare className="h-5 w-5 text-[#b08d57]" /> New channel</DialogTitle>
        <DialogDescription>It is created inside the company you pick. Only the people you add see it — in their own Company Work chat.</DialogDescription>
        <div className="space-y-3 text-[13px]">
          <label className="block"><span className="text-[12px] font-medium text-muted-foreground">Company</span>
            <select value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3">
              {work.map((c) => <option key={c.uid} value={c.uid}>{c.name} · Work</option>)}
              {companies.filter((c) => c.source === "boards").map((c) => <option key={c.uid} disabled value="">{c.name} · Accounts (coming next)</option>)}
            </select>
          </label>
          <label className="block"><span className="text-[12px] font-medium text-muted-foreground">Channel name</span>
            <span className="mt-1 flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3"><Hash className="h-4 w-4 text-muted-foreground" /><input autoFocus value={chName} onChange={(e) => setChName(e.target.value)} placeholder="q4-launch" maxLength={80} className="w-full bg-transparent outline-none" /></span>
          </label>
          <div><span className="text-[12px] font-medium text-muted-foreground">People</span>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <PeoplePick people={people} value={memberIds} onChange={setMemberIds} label="Add people" me={user?.id} />
              <span className="text-[12px] text-muted-foreground">{memberIds.length ? `${memberIds.length} + you` : "Just you so far"}</span>
            </div>
          </div>
          <label className="block"><span className="text-[12px] font-medium text-muted-foreground">Tasks from this chat go to</span>
            <select value={listId ?? ""} onChange={(e) => setListId(e.target.value ? Number(e.target.value) : null)} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3">
              <option value="">Pick later</option>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} className="accent-[var(--primary)]" /> <Lock className="h-3.5 w-3.5" /> Private — only the people added can see it</label>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-xl px-3 text-[13px] text-muted-foreground hover:bg-accent">Cancel</button>
          <button type="button" disabled={!company || !chName.trim() || create.isPending} onClick={() => create.mutate()} className="h-9 rounded-xl bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-40 dark:bg-primary dark:text-primary-foreground">Create channel</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ChannelsView({ companies, tab, onTab }: { companies: CeoCompany[]; tab: "chat" | "assigned"; onTab: (t: "chat" | "assigned") => void }) {
  const showTask = useTaskPopup((s) => s.show);
  const { data: groups = [], isLoading } = useQuery({ queryKey: ["ceo-tower", "channels"], queryFn: ceoApi.channels, refetchInterval: 30_000 });
  const [sel, setSel] = useState<{ uid: string; company: string } | null>(null);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const all = useMemo(() => groups.flatMap((g) => g.channels.map((c) => ({ ...c, company: g.company }))), [groups]);
  // open the last channel (or the newest one)
  useEffect(() => {
    if (sel || !all.length) return;
    let last: string | null = null;
    try { last = window.localStorage.getItem(LAST_KEY); } catch {}
    const pick = all.find((c) => c.uid === last) ?? all[0]!;
    setSel({ uid: pick.uid, company: pick.company.uid });
  }, [all, sel]);
  const open = (uid: string, company: string) => { setSel({ uid, company }); onTab("chat"); try { window.localStorage.setItem(LAST_KEY, uid); } catch {} };
  const title = (c: (typeof all)[number]) => (c.kind === "channel" ? c.name ?? "channel" : c.people.map((p) => p.firstName).join(", ") || "Just you");
  const term = q.trim().toLowerCase();

  return (
    <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
      <aside aria-label="Channels" className="flex flex-col gap-3">
        <AssignedSummary onOpen={() => onTab("assigned")} compact />
        <section className="flex min-h-0 flex-col rounded-[24px] border border-white/70 bg-white/65 p-3 shadow-[0_16px_48px_-28px_rgba(11,42,31,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] xl:max-h-[calc(100vh-260px)]">
          <header className="mb-2 flex items-center gap-2 px-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-forest text-brass-soft"><MessagesSquare className="h-4 w-4" /></span>
            <span className="flex-1 text-[15px] font-semibold">Channels</span>
            <button type="button" onClick={() => setCreating(true)} className="flex h-8 items-center gap-1 rounded-xl bg-forest px-2.5 text-[12px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground"><Plus className="h-3.5 w-3.5" /> New</button>
          </header>
          <label className="mb-2 flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-2.5"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a chat" aria-label="Find a chat" className="w-full bg-transparent text-[13px] outline-none" /></label>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading && [0, 1, 2].map((i) => <div key={i} className="mb-1.5 h-9 animate-pulse rounded-xl bg-muted" />)}
            {groups.map((g) => {
              const list = g.channels.filter((c) => !term || title({ ...c, company: g.company }).toLowerCase().includes(term));
              if (!list.length && term) return null;
              return (
                <div key={g.company.key} className="mb-3">
                  <p className="mb-1 flex items-center gap-1.5 px-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"><span className="truncate">{g.company.name}</span><span className="rounded bg-product-work/12 px-1 py-px text-[9px] text-product-work">work</span></p>
                  <ul className="space-y-0.5">
                    {list.map((c) => {
                      const on = sel?.uid === c.uid;
                      return (
                        <li key={c.uid}>
                          <button type="button" onClick={() => open(c.uid, g.company.uid)} aria-current={on ? "page" : undefined}
                            className={cn("flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[13px] transition", on ? "bg-forest text-white shadow-[0_8px_20px_-12px_rgba(11,42,31,0.8)] dark:bg-primary dark:text-primary-foreground" : "text-foreground/80 hover:bg-white/70 dark:hover:bg-white/5")}>
                            {c.kind === "channel" ? (c.isPrivate ? <Lock className="h-3.5 w-3.5 shrink-0 opacity-70" /> : <Hash className="h-3.5 w-3.5 shrink-0 opacity-70" />) : c.people[0] ? <Avatar user={mini(c.people[0])} size={18} /> : <Users className="h-3.5 w-3.5 shrink-0" />}
                            <span className={cn("min-w-0 flex-1 truncate", c.unread && !on && "font-semibold text-foreground")}>{title({ ...c, company: g.company })}</span>
                            {c.openTasks > 0 && <span className={cn("rounded-full px-1.5 text-[10.5px] font-semibold tabular-nums", on ? "bg-white/15" : "bg-primary/10 text-primary")} title={`${c.openTasks} open tasks`}>{c.openTasks}</span>}
                            {c.unread && !on && <span className="h-2 w-2 shrink-0 rounded-full bg-[#b08d57]" aria-label="Unread" />}
                          </button>
                        </li>
                      );
                    })}
                    {!list.length && <li className="px-2.5 py-1 text-[12px] text-muted-foreground">No chats yet.</li>}
                  </ul>
                </div>
              );
            })}
            {!isLoading && !groups.length && <p className="px-2 py-6 text-center text-[12.5px] text-muted-foreground">You don&apos;t own a Company Work workspace yet.</p>}
          </div>
        </section>
      </aside>

      <section className="min-w-0">
        <div role="tablist" aria-label="Channels views" className="mb-3 flex items-center gap-1 rounded-2xl bg-white/60 p-1 ring-1 ring-black/[0.04] dark:bg-white/5 sm:w-fit">
          {([["chat", "Chat", MessagesSquare], ["assigned", "Assigned by me", ClipboardList]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => onTab(id)} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[13px] font-semibold transition sm:flex-none", tab === id ? "bg-white text-foreground shadow-sm dark:bg-white/15" : "text-muted-foreground hover:text-foreground")}><Icon className="h-4 w-4" /> {label}</button>
          ))}
        </div>
        {tab === "assigned" ? <AssignedTable /> : sel ? (
          <div className="h-[calc(100vh-210px)] min-h-[560px] overflow-hidden rounded-[24px] border border-white/70 bg-card shadow-[0_16px_48px_-28px_rgba(11,42,31,0.4)] dark:border-white/10">
            <WorkWsContext.Provider value={sel.company}>
              <ChannelView key={sel.uid} uid={sel.uid} hideHeaderExtras onOpenTask={(t) => showTask("work", t.id)} />
            </WorkWsContext.Provider>
          </div>
        ) : (
          <div className="flex h-[420px] flex-col items-center justify-center rounded-[24px] border border-dashed border-border bg-white/40 text-center dark:bg-white/[0.02]">
            <MessagesSquare className="h-8 w-8 text-[#b08d57]" />
            <p className="mt-2 text-[15px] font-semibold">Start a channel with your team</p>
            <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">Create it here, pick the people — they see it in their Company Work chat. Give tasks right from the chat and watch them get done.</p>
            <button type="button" onClick={() => setCreating(true)} className="mt-3 flex h-9 items-center gap-1.5 rounded-xl bg-forest px-3.5 text-[13px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground"><Plus className="h-4 w-4" /> New channel</button>
          </div>
        )}
      </section>
      {creating && <NewChannelDialog companies={companies} onClose={() => setCreating(false)} onCreated={(uid, company) => { setCreating(false); open(uid, company); }} />}
    </div>
  );
}
