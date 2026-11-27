"use client";

/*
 * Executive Hub → Channels: the Administrator's Company Work and Accounts & Invoices chats across every company, with the same
 * Message / Post / Task / Many tasks composer and the Tasks & Mentions panel as Company Work,
 * plus "Assigned by me" — every task they gave out and whether it got done.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ClipboardList, Hash, Lock, MessagesSquare, Plus, Search, Sparkles, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { ceoApi, type CeoAssignedTask, type CeoCompany, type CeoMini } from "@/services/ceo-tower.api";
import type { CeoSource } from "@/services/ceo-tower.api";
import { workApi, workKeys } from "@/services/work.api";
import { Avatar } from "../../work/_components/primitives";
import { ChannelView } from "../../work/_components/chat/ChannelView";
import { WorkWsContext } from "../../work/_components/chat/useChat";
import { PeoplePick } from "../../work/_components/chat/ChatTasks";
import { useTaskPopup } from "./TaskPopup";
import { BoardsChannelEmbed } from "./BoardsChannelEmbed";
import { ChannelAiPanel } from "./ChannelAiPanel";
import { createChannel as createBoardsChannel, getAllChatUsers } from "@/services/chat.api";
import { getBoards, getBoardGroups } from "@/services/boards.api";
import { boardsChatApi } from "@/services/chat-work.api";

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
export function AssignedSummary({ onOpen, compact = false, source = "all", scope = null }: { onOpen?: () => void; compact?: boolean; source?: CeoSource; scope?: string | null }) {
  const src = source === "all" ? undefined : source;
  const { data } = useQuery({ queryKey: ["ceo-tower", "assigned", "summary", src ?? "all", scope], queryFn: () => ceoApi.assigned({ source: src, company: scope ?? undefined }), staleTime: 30_000, refetchInterval: 60_000 });
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

function AssignedTable({ source = "all", scope = null }: { source?: CeoSource; scope?: string | null }) {
  const showTask = useTaskPopup((s) => s.show);
  const [person, setPerson] = useState<number | "">("");
  const [picked, setCompany] = useState("");
  const company = scope ?? picked;
  const src = source === "all" ? undefined : source;
  const [state, setState] = useState<"all" | "open" | "done" | "overdue">("all");
  const { data, isLoading } = useQuery({ queryKey: ["ceo-tower", "assigned", person, company, state, src ?? "all"], queryFn: () => ceoApi.assigned({ person: person || undefined, company: company || undefined, state, source: src }), refetchInterval: 60_000 });
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
              <tr key={`${t.source ?? "work"}-${t.id}`} className="border-b border-border/50 last:border-0 hover:bg-white/60 dark:hover:bg-white/[0.03]">
                <td className="max-w-[320px] px-4 py-2.5"><button type="button" onClick={() => showTask(t.source ?? "work", t.id)} className={cn("block max-w-full truncate text-left font-medium hover:text-primary hover:underline", t.completedAt && "text-muted-foreground line-through")}>{t.name}</button><span className="block truncate text-[11.5px] text-muted-foreground">{t.where}</span></td>
                <td className="px-3 py-2.5"><span className="flex items-center gap-1.5"><span className="flex -space-x-1.5">{t.assignees.slice(0, 3).map((u) => <Avatar key={u.id} user={mini(u)} size={22} className="ring-2 ring-card" />)}</span><span className="max-w-[120px] truncate text-[12.5px]">{t.assignees.length === 1 ? name(t.assignees[0]!) : `${t.assignees.length} people`}</span></span></td>
                <td className="px-3 py-2.5 text-[12.5px]"><span className="block truncate font-medium">{t.company.name}</span><span className="block truncate text-[11.5px] text-muted-foreground">{t.channel ? t.channel.name : t.source === "boards" ? "Board" : "Task list"}</span></td>
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

function NewChannelDialog({ companies, scope = null, onClose, onCreated }: { companies: CeoCompany[]; scope?: string | null; onClose: () => void; onCreated: (sel: Sel) => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const work = companies.filter((c) => c.source === "work");
  const acc = companies.filter((c) => c.source === "boards");
  const [company, setCompany] = useState(companies.find((c) => c.key === scope)?.uid ?? work[0]?.uid ?? acc[0]?.uid ?? "");
  const picked = companies.find((c) => c.uid === company);
  const isAcc = picked?.source === "boards";
  const [mode, setMode] = useState<"channel" | "dm">("channel");
  const [dmPerson, setDmPerson] = useState<number | null>(null);
  const [dmQuery, setDmQuery] = useState("");
  const { data: allTeam = [] } = useQuery({ queryKey: ["ceo-tower", "team", "all", null], queryFn: () => ceoApi.team("all"), enabled: mode === "dm" });
  const dmPeople = allTeam.map((t) => t.user).filter((u) => u.id !== user?.id && (!dmQuery.trim() || `${u.firstName} ${u.lastName}`.toLowerCase().includes(dmQuery.trim().toLowerCase())));
  const dm = useMutation({
    mutationFn: () => ceoApi.openDm(dmPerson!),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["ceo-tower", "channels"] }); toast.success(`Chat with ${r.name} opened`); onCreated({ uid: r.uid, company: r.companyUid, source: r.source, wsId: r.wsId }); },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't open the chat."),
  });
  const [chName, setChName] = useState("");
  const [isPrivate, setPrivate] = useState(true);
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [listId, setListId] = useState<number | null>(null);
  const { data: dir } = useQuery({ queryKey: ["work", "directory", company], queryFn: () => workApi.directory(company), enabled: !!company && !isAcc });
  const { data: tree } = useQuery({ queryKey: workKeys.tree(company), queryFn: () => workApi.tree(company), enabled: !!company && !isAcc });
  // Accounts & Invoices: its members, and a board + group for the tasks
  const { data: accUsers } = useQuery({ queryKey: ["boards", "chat-users", picked?.id], queryFn: () => getAllChatUsers(picked!.id), enabled: !!isAcc && !!picked });
  const { data: accBoards } = useQuery({ queryKey: ["boards", "list", picked?.id], queryFn: () => getBoards(picked!.id) as Promise<{ id: number; name: string }[]>, enabled: !!isAcc && !!picked });
  const [boardId, setBoardId] = useState<number | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const { data: accGroups } = useQuery({ queryKey: ["boards", "groups", boardId], queryFn: () => getBoardGroups(boardId!), enabled: !!boardId });
  const people = (isAcc ? (accUsers ?? []).map((u) => ({ ...u.user, email: u.user.email ?? "" })) : (dir?.people ?? []).map((p) => p.user)).filter((u) => u.id !== user?.id) as any[];
  useEffect(() => { setMemberIds([]); setListId(null); setBoardId(null); setGroupId(null); }, [company]);
  useEffect(() => { setGroupId(accGroups?.[0]?.id ?? null); }, [accGroups]);
  const create = useMutation({
    mutationFn: async (): Promise<Sel & { name: string }> => {
      if (isAcc) {
        const ch = await createBoardsChannel(picked!.id, chName.trim(), undefined, memberIds);
        if (boardId && groupId) await boardsChatApi.setDefault(picked!.id, ch.id, boardId, groupId).catch(() => null);
        return { uid: String(ch.id), company: company, source: "boards", wsId: picked!.id, name: ch.name ?? chName.trim() };
      }
      const ch = await workApi.createChannel(company, { name: chName.trim(), isPrivate, memberIds });
      if (listId) await workApi.chatDefaultList(ch.uid, listId).catch(() => null);
      return { uid: ch.uid, company, source: "work", name: ch.name ?? chName.trim() };
    },
    onSuccess: (ch) => { qc.invalidateQueries({ queryKey: ["ceo-tower", "channels"] }); toast.success(`#${ch.name} created — only the people you added can see it`); onCreated(ch); },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't create the channel."),
  });
  const lists = (tree?.spaces ?? []).flatMap((s) => [...s.lists.map((l) => ({ id: l.id, label: `${s.name} / ${l.name}` })), ...s.folders.flatMap((f) => f.lists.map((l) => ({ id: l.id, label: `${s.name} / ${f.name} / ${l.name}` })))]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogTitle className="flex items-center gap-2"><MessagesSquare className="h-5 w-5 text-[#b08d57]" /> New {mode === "dm" ? "direct message" : "channel"}</DialogTitle>
        <DialogDescription>{mode === "dm" ? "Message anyone in your companies directly — no company to pick. It opens a private chat with them." : `It is created inside the company you pick. Only the people you add see it — in their own ${isAcc ? "Accounts & Invoices" : "Company Work"} chat.`}</DialogDescription>
        <div className="mb-3 flex gap-1 rounded-lg bg-muted/60 p-0.5 text-[12.5px]">
          {(["channel", "dm"] as const).map((m) => <button key={m} type="button" onClick={() => setMode(m)} className={cn("flex-1 rounded-md py-1.5 font-medium transition", mode === m ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>{m === "dm" ? "Direct message" : "Channel"}</button>)}
        </div>
        {mode === "dm" ? (
          <div className="space-y-2 text-[13px]">
            <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3"><Search className="h-4 w-4 text-muted-foreground" /><input autoFocus value={dmQuery} onChange={(e) => setDmQuery(e.target.value)} placeholder="Find a person" className="w-full bg-transparent outline-none" /></label>
            <ul className="max-h-64 overflow-y-auto rounded-xl border border-border">
              {dmPeople.map((u) => <li key={u.id}><button type="button" onClick={() => setDmPerson(u.id)} className={cn("flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent", dmPerson === u.id && "bg-accent font-semibold")}><Avatar user={mini(u)} size={24} /><span className="min-w-0 flex-1 truncate">{u.firstName} {u.lastName}</span>{dmPerson === u.id && <CheckCircle2 className="h-4 w-4 text-primary" />}</button></li>)}
              {!dmPeople.length && <li className="px-3 py-3 text-[12.5px] text-muted-foreground">No one matches.</li>}
            </ul>
          </div>
        ) : (
        <div className="space-y-3 text-[13px]">
          <label className="block"><span className="text-[12px] font-medium text-muted-foreground">Company</span>
            <select value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3">
              {work.length > 0 && <optgroup label="Company Work">{work.map((c) => <option key={c.uid} value={c.uid}>{c.name} · Work</option>)}</optgroup>}
              {acc.length > 0 && <optgroup label="Accounts & Invoices">{acc.map((c) => <option key={c.uid} value={c.uid}>{c.name} · Accounts</option>)}</optgroup>}
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
          {isAcc ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block"><span className="text-[12px] font-medium text-muted-foreground">Tasks from this chat go to board</span>
                <select value={boardId ?? ""} onChange={(e) => setBoardId(e.target.value ? Number(e.target.value) : null)} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3">
                  <option value="">Pick later</option>
                  {(accBoards ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              <label className="block"><span className="text-[12px] font-medium text-muted-foreground">Group</span>
                <select value={groupId ?? ""} disabled={!boardId} onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 disabled:opacity-50">
                  {!boardId && <option value="">—</option>}
                  {(accGroups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
            </div>
          ) : (
            <label className="block"><span className="text-[12px] font-medium text-muted-foreground">Tasks from this chat go to</span>
              <select value={listId ?? ""} onChange={(e) => setListId(e.target.value ? Number(e.target.value) : null)} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3">
                <option value="">Pick later</option>
                {lists.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
          )}
          {isAcc ? (
            <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Private — only the people added see it in their chat list.</p>
          ) : (
            <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} className="accent-[var(--primary)]" /> <Lock className="h-3.5 w-3.5" /> Private — only the people added can see it</label>
          )}
        </div>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-xl px-3 text-[13px] text-muted-foreground hover:bg-accent">Cancel</button>
          {mode === "dm"
            ? <button type="button" disabled={!dmPerson || dm.isPending} onClick={() => dm.mutate()} className="h-9 rounded-xl bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-40 dark:bg-primary dark:text-primary-foreground">Open chat</button>
            : <button type="button" disabled={!company || !chName.trim() || create.isPending} onClick={() => create.mutate()} className="h-9 rounded-xl bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-40 dark:bg-primary dark:text-primary-foreground">Create channel</button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Sel = { uid: string; company: string; source: "work" | "boards"; wsId?: number };

export function ChannelsView({ companies, tab, onTab, source = "all", scope = null }: { companies: CeoCompany[]; tab: "chat" | "assigned"; onTab: (t: "chat" | "assigned") => void; source?: CeoSource; scope?: string | null }) {
  const showTask = useTaskPopup((s) => s.show);
  const { data: allGroups = [], isLoading } = useQuery({ queryKey: ["ceo-tower", "channels"], queryFn: ceoApi.channels, refetchInterval: 30_000 });
  // only the product and company picked in the tower's sidebar
  const groups = useMemo(() => allGroups.filter((g) => (source === "all" || (g.company.source ?? "work") === source) && (!scope || g.company.key === scope)), [allGroups, source, scope]);
  const [sel, setSel] = useState<Sel | null>(null);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const all = useMemo(() => groups.flatMap((g) => g.channels.map((c) => ({ ...c, company: g.company }))), [groups]);
  // open the last channel (or the newest one)
  useEffect(() => {
    if (sel || !all.length) return;
    let last: string | null = null;
    try { last = window.localStorage.getItem(LAST_KEY); } catch {}
    const pick = all.find((c) => c.uid === last) ?? all[0]!;
    setSel({ uid: pick.uid, company: pick.company.uid, source: pick.company.source ?? "work", wsId: pick.company.id });
  }, [all, sel]);
  useEffect(() => { if (sel && !all.some((c) => c.uid === sel.uid && (c.company.source ?? "work") === sel.source)) setSel(null); }, [all, sel]);
  const open = (next: Sel) => { setSel(next); onTab("chat"); try { window.localStorage.setItem(LAST_KEY, next.uid); } catch {} };
  const selRow = sel ? all.find((c) => c.uid === sel.uid && (c.company.source ?? "work") === sel.source) : undefined;
  const title = (c: (typeof all)[number]) => (c.kind === "channel" ? c.name ?? "channel" : c.people.map((p) => p.firstName).join(", ") || "Just you");
  const term = q.trim().toLowerCase();

  // inline "Ask AI about this chat" panel, scoped to the open channel
  const [aiOpen, setAiOpen] = useState(false);
  const aiContext = selRow ? (() => {
    const names = (selRow.people ?? []).map((p) => `${p.firstName}${p.lastName ? " " + p.lastName : ""}`).join(", ");
    const product = (selRow.company.source ?? "work") === "boards" ? "Accounts & Invoices" : "Company Work";
    return `The CEO is asking about ONE chat only: "${title(selRow)}" in ${selRow.company.name} (${product}). People in it: ${names || "just the CEO"}. Focus only on these people and this company — have they been active / replied, is the work the CEO gave done, who is behind. If the CEO asks to remind or re-send, propose a message to the people here.`;
  })() : "";
  const aiSuggest = ["Have the people here replied or been active lately?", "Is the work I gave in this chat done?", "Draft a reminder for whoever hasn't done their part."];

  return (
    <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
      <aside aria-label="Channels" className="flex flex-col gap-3">
        <AssignedSummary onOpen={() => onTab("assigned")} compact source={source} scope={scope} />
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
              // Hide companies that have no channels at all (and ones filtered
              // empty by search) — don't clutter the sidebar with "No chats yet".
              if (!list.length) return null;
              return (
                <div key={g.company.key} className="mb-3">
                  <p className="mb-1 flex items-center gap-1.5 px-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"><span className="truncate">{g.company.name}</span>{g.company.key === "dms" ? null : g.company.source === "boards" ? <span className="rounded bg-product-boards/12 px-1 py-px text-[9px] text-product-boards dark:text-[#a5b4fc]">accounts</span> : <span className="rounded bg-product-work/12 px-1 py-px text-[9px] text-product-work">work</span>}</p>
                  <ul className="space-y-0.5">
                    {list.map((c) => {
                      const on = sel?.uid === c.uid && sel.source === (g.company.source ?? "work");
                      return (
                        <li key={`${g.company.key}-${c.uid}`}>
                          <button type="button" onClick={() => open({ uid: c.uid, company: g.company.uid, source: g.company.source ?? "work", wsId: g.company.id })} aria-current={on ? "page" : undefined}
                            className={cn("flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[13px] transition", on ? "bg-forest text-white shadow-[0_8px_20px_-12px_rgba(11,42,31,0.8)] dark:bg-primary dark:text-primary-foreground" : "text-foreground/80 hover:bg-white/70 dark:hover:bg-white/5")}>
                            {c.kind === "channel" ? (c.isPrivate ? <Lock className="h-3.5 w-3.5 shrink-0 opacity-70" /> : <Hash className="h-3.5 w-3.5 shrink-0 opacity-70" />) : c.people[0] ? <Avatar user={mini(c.people[0])} size={18} /> : <Users className="h-3.5 w-3.5 shrink-0" />}
                            <span className={cn("min-w-0 flex-1 truncate", c.unread && !on && "font-semibold text-foreground")}>{title({ ...c, company: g.company })}</span>
                            {c.openTasks > 0 && <span className={cn("rounded-full px-1.5 text-[10.5px] font-semibold tabular-nums", on ? "bg-white/15" : "bg-primary/10 text-primary")} title={`${c.openTasks} open tasks`}>{c.openTasks}</span>}
                            {c.unread && !on && <span className="h-2 w-2 shrink-0 rounded-full bg-[#b08d57]" aria-label="Unread" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            {!isLoading && !groups.some((g) => g.channels.length) && <p className="px-2 py-6 text-center text-[12.5px] text-muted-foreground">No chats yet — hit <span className="font-semibold text-foreground">New</span> to start a channel or direct message.</p>}
          </div>
        </section>
      </aside>

      <section className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div role="tablist" aria-label="Channels views" className="flex items-center gap-1 rounded-2xl bg-white/60 p-1 ring-1 ring-black/[0.04] dark:bg-white/5 sm:w-fit">
            {([["chat", "Chat", MessagesSquare], ["assigned", "Assigned by me", ClipboardList]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => onTab(id)} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[13px] font-semibold transition sm:flex-none", tab === id ? "bg-white text-foreground shadow-sm dark:bg-white/15" : "text-muted-foreground hover:text-foreground")}><Icon className="h-4 w-4" /> {label}</button>
            ))}
          </div>
          {tab === "chat" && sel && <button type="button" onClick={() => setAiOpen((o) => !o)} aria-pressed={aiOpen} className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold transition", aiOpen ? "bg-forest text-white dark:bg-primary dark:text-primary-foreground" : "border border-border hover:bg-accent")}><Sparkles className="h-4 w-4" /> Ask AI</button>}
        </div>
        {tab === "assigned" ? <AssignedTable source={source} scope={scope} /> : sel ? (
          <div className="flex h-[calc(100vh-210px)] min-h-[560px] gap-3">
            <div className="min-w-0 flex-1 overflow-hidden rounded-[24px] border border-white/70 bg-card shadow-[0_16px_48px_-28px_rgba(11,42,31,0.4)] dark:border-white/10">
              {sel.source === "boards" && sel.wsId ? (
                <BoardsChannelEmbed key={`b-${sel.uid}`} ws={sel.wsId} ch={Number(sel.uid)} isDm={selRow?.kind === "dm"}
                  title={selRow ? title(selRow) : "Chat"} onOpenTask={(t) => showTask("boards", t.id)} />
              ) : (
                <WorkWsContext.Provider value={sel.company}>
                  <ChannelView key={sel.uid} uid={sel.uid} hideHeaderExtras onOpenTask={(t) => showTask("work", t.id)} />
                </WorkWsContext.Provider>
              )}
            </div>
            {aiOpen && (
              <div className="hidden w-[360px] shrink-0 overflow-hidden rounded-[24px] border border-white/70 bg-card shadow-[0_16px_48px_-28px_rgba(11,42,31,0.4)] lg:block dark:border-white/10">
                <ChannelAiPanel key={sel.uid} context={aiContext} suggestions={aiSuggest} onClose={() => setAiOpen(false)} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-[420px] flex-col items-center justify-center rounded-[24px] border border-dashed border-border bg-white/40 text-center dark:bg-white/[0.02]">
            <MessagesSquare className="h-8 w-8 text-[#b08d57]" />
            <p className="mt-2 text-[15px] font-semibold">Start a channel with your team</p>
            <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">Create it here, pick the people — they see it in their own chat (Company Work or Accounts &amp; Invoices). Give tasks right from the chat and watch them get done.</p>
            <button type="button" onClick={() => setCreating(true)} className="mt-3 flex h-9 items-center gap-1.5 rounded-xl bg-forest px-3.5 text-[13px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground"><Plus className="h-4 w-4" /> New channel</button>
          </div>
        )}
      </section>
      {creating && <NewChannelDialog scope={scope} companies={companies} onClose={() => setCreating(false)} onCreated={(next) => { setCreating(false); open(next); }} />}
    </div>
  );
}
