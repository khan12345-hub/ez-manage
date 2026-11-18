"use client";

/*
 * Chat → tasks (ClickUp-style): the Task / Bulk composer, task cards in the message list, and the
 * right-hand "Chat work" panel (Tasks from this chat + Mentions) with status changes and Resolve.
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AtSign, CalendarDays, Check, CheckCircle2, ChevronDown, CircleDashed, Flag, FolderTree, ListChecks, Loader2, MessageSquareReply, Plus, RotateCcw, Sparkles, Trash2, UsersRound, X, Zap } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PRIORITY_META, userName, workApi, workKeys, type ChatDefaultList, type ChatMentionRow, type ChatTaskInput, type ChatTaskRow, type WorkPriority, type WorkUser } from "@/services/work.api";
import { Avatar, PriorityFlag } from "../primitives";
import { addOwnMessage, chatSidebarKey, messagesKey, useChatEvents } from "./useChat";

export const chatTasksKey = (uid: string) => ["work", "chat-tasks", uid] as const;
export const chatMentionsKey = (uid: string) => ["work", "chat-mentions", uid] as const;
/** a task card / panel row was clicked: the page that hosts the chat opens the task */
export const CHAT_OPEN_TASK_EVENT = "ez:work-chat-open-task";
export const openChatTask = (t: { id: number; uid: string; name: string }) => window.dispatchEvent(new CustomEvent(CHAT_OPEN_TASK_EVENT, { detail: t }));
const err = (e: any, fallback: string) => toast.error(e?.response?.data?.message?.toString?.() ?? fallback);

/** tasks of this chat, kept fresh by live chat events */
export function useChatTasks(uid: string) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: chatTasksKey(uid), queryFn: () => workApi.chatTasks(uid), enabled: !!uid, staleTime: 15_000, refetchInterval: 60_000 });
  useChatEvents((e) => {
    if (e.channelUid !== uid) return;
    if (e.type === "chat_tasks" || (e.type === "message" && ["task", "system"].includes(e.message?.kind))) qc.invalidateQueries({ queryKey: chatTasksKey(uid) });
    if (e.type === "message" || e.type === "message_updated") qc.invalidateQueries({ queryKey: chatMentionsKey(uid) });
  });
  return q;
}

/* ───────────── date + bulk parsing ───────────── */

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** a yyyy-mm-dd day → the ISO time we store (local noon, so it never slips a day) */
export const dueIso = (day: string | null | undefined) => (day ? new Date(`${day}T12:00:00`).toISOString() : null);

/** "today", "tomorrow", "fri", "next week", "nov 25", "25 nov", "2026-11-25" → yyyy-mm-dd (and the text it matched) */
function findDate(line: string): { day: string; match: string } | null {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tries: [RegExp, (m: RegExpMatchArray) => Date | null][] = [
    [/\b(\d{4})-(\d{2})-(\d{2})\b/, (m) => new Date(+m[1]!, +m[2]! - 1, +m[3]!)],
    [/\b(?:due\s+)?(today)\b/i, () => base],
    [/\b(?:due\s+)?(tomorrow|tmrw|tmr)\b/i, () => new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1)],
    [/\b(?:due\s+)?next\s+week\b/i, () => new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7)],
    [/\b(?:due\s+)?(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i, (m) => monthDay(+m[1]!, m[2]!)],
    [/\b(?:due\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/i, (m) => monthDay(+m[2]!, m[1]!)],
    [/\b(?:due\s+)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i, (m) => {
      const want = DAYS.indexOf(m[1]!.slice(0, 3).toLowerCase());
      const diff = (want - base.getDay() + 7) % 7;
      return new Date(base.getFullYear(), base.getMonth(), base.getDate() + diff);
    }],
  ];
  function monthDay(day: number, mon: string) {
    const mi = MONTHS.indexOf(mon.slice(0, 3).toLowerCase());
    if (mi < 0 || day < 1 || day > 31) return null;
    let d = new Date(base.getFullYear(), mi, day);
    if (+d < +base - 60 * 86_400_000) d = new Date(base.getFullYear() + 1, mi, day); // "jan 5" in December = next year
    return d;
  }
  for (const [re, make] of tries) {
    const m = line.match(re);
    if (!m) continue;
    const d = make(m);
    if (d && !isNaN(+d)) return { day: ymd(d), match: m[0] };
  }
  return null;
}

export type BulkRow = { key: string; name: string; assigneeIds: number[]; due: string | null; priority: WorkPriority | null; description?: string | null };

/** one task per line: "Landing page copy @Rubab Haider fri !high" */
export function parseBulk(text: string, people: WorkUser[]): BulkRow[] {
  const byName = [...people].map((p) => ({ id: p.id, full: userName(p).toLowerCase(), first: (p.firstName ?? "").toLowerCase() })).sort((a, b) => b.full.length - a.full.length);
  return text.split("\n").map((raw, i) => {
    let line = raw.replace(/^\s*(?:[-•*]|\d+[.)]|\[\s?\])\s+/, "").trim();
    if (!line) return null;
    const ids: number[] = [];
    // @Full Name first (longest), then @First
    for (const p of byName) {
      for (const n of [p.full, p.first]) {
        if (!n) continue;
        const re = new RegExp(`(^|\\s)@${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$|[,.;])`, "i");
        if (re.test(line)) { line = line.replace(re, " "); if (!ids.includes(p.id)) ids.push(p.id); }
      }
    }
    let priority: WorkPriority | null = null;
    const pm = line.match(/(^|\s)!(urgent|high|normal|low)\b/i);
    if (pm) { priority = pm[2]!.toUpperCase() as WorkPriority; line = line.replace(pm[0], " "); }
    const dm = findDate(line);
    if (dm) line = line.replace(dm.match, " ");
    const name = line.replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").trim().replace(/^[,;:–-]\s*|[,;:–-]\s*$/g, "");
    return name ? { key: `${i}-${name}`, name, assigneeIds: ids, due: dm?.day ?? null, priority } : null;
  }).filter(Boolean) as BulkRow[];
}

/* ───────────── small pickers ───────────── */

export function PeoplePick({ people, value, onChange, label = "Assign", compact = false, me }: { people: WorkUser[]; value: number[]; onChange: (ids: number[]) => void; label?: string; compact?: boolean; me?: number }) {
  const [q, setQ] = useState("");
  const chosen = people.filter((p) => value.includes(p.id));
  const list = people.filter((p) => userName(p).toLowerCase().includes(q.toLowerCase()));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={chosen.length ? `Assigned to ${chosen.map(userName).join(", ")}` : label} className={cn("flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2 text-[12.5px] hover:bg-accent", compact && "h-7 border-transparent bg-transparent px-1")}>
          {chosen.length ? (
            <span className="flex -space-x-1.5">{chosen.slice(0, 3).map((u) => <Avatar key={u.id} user={u} size={20} className="ring-2 ring-background" />)}{chosen.length > 3 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-semibold ring-2 ring-background">+{chosen.length - 3}</span>}</span>
          ) : <UsersRound className="h-3.5 w-3.5 text-muted-foreground" />}
          {!compact && <span className={cn("max-w-[140px] truncate", !chosen.length && "text-muted-foreground")}>{chosen.length === 1 ? userName(chosen[0]!) : chosen.length ? `${chosen.length} people` : label}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" aria-label="Search people" className="mb-1 h-8 w-full rounded-md border border-border bg-background px-2 text-[12.5px] outline-none" />
        <ul className="max-h-60 overflow-y-auto">
          {list.map((u) => {
            const on = value.includes(u.id);
            return (
              <li key={u.id}>
                <button type="button" onClick={() => onChange(on ? value.filter((x) => x !== u.id) : [...value, u.id])} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent">
                  <Avatar user={u} size={20} /> <span className="flex-1 truncate">{userName(u)}{u.id === me ? " (you)" : ""}</span>
                  <span className={cn("flex h-4 w-4 items-center justify-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{on && <Check className="h-3 w-3" />}</span>
                </button>
              </li>
            );
          })}
          {!list.length && <li className="px-2 py-2 text-[12px] text-muted-foreground">Nobody matches.</li>}
        </ul>
        {value.length > 0 && <button type="button" onClick={() => onChange([])} className="mt-1 w-full rounded-md border-t border-border px-2 pt-1.5 text-left text-[12px] text-muted-foreground hover:text-foreground">Clear</button>}
      </PopoverContent>
    </Popover>
  );
}

function PriorityPick({ value, onChange, compact = false }: { value: WorkPriority | null; onChange: (p: WorkPriority | null) => void; compact?: boolean }) {
  return (
    <label className={cn("relative flex h-8 items-center gap-1 rounded-lg border border-border bg-background pl-2 pr-1 text-[12.5px]", compact && "h-7 border-transparent bg-transparent pl-1")}>
      <Flag className="h-3.5 w-3.5" style={{ color: value ? PRIORITY_META[value].color : undefined, fill: value ? PRIORITY_META[value].color : "none" }} />
      <select aria-label="Priority" value={value ?? ""} onChange={(e) => onChange((e.target.value || null) as WorkPriority | null)} className={cn("cursor-pointer appearance-none bg-transparent pr-4 outline-none", compact && "w-[18px] text-transparent")}>
        <option value="">{compact ? "—" : "Priority"}</option>
        {(Object.keys(PRIORITY_META) as WorkPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
      </select>
      {!compact && <ChevronDown className="pointer-events-none absolute right-1 h-3 w-3 text-muted-foreground" />}
    </label>
  );
}

/** a Work list to put the tasks in (grouped by Space / Folder) */
function ListPick({ ws, value, onChange }: { ws: string; value: number | null; onChange: (id: number) => void }) {
  const { data: tree } = useQuery({ queryKey: workKeys.tree(ws), queryFn: () => workApi.tree(ws), enabled: !!ws, staleTime: 30_000 });
  const groups = (tree?.spaces ?? []).map((s) => ({ space: s.name, lists: [...s.lists.map((l) => ({ id: l.id, name: l.name })), ...s.folders.flatMap((f) => f.lists.map((l) => ({ id: l.id, name: `${f.name} / ${l.name}` })))] })).filter((g) => g.lists.length);
  return (
    <label className="relative flex h-8 min-w-0 items-center gap-1.5 rounded-lg border border-border bg-background pl-2 pr-1 text-[12.5px]">
      <FolderTree className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <select aria-label="List for the tasks" value={value ?? ""} onChange={(e) => e.target.value && onChange(Number(e.target.value))} className="min-w-0 max-w-[200px] cursor-pointer appearance-none truncate bg-transparent pr-4 outline-none">
        <option value="">Pick a list…</option>
        {groups.map((g) => <optgroup key={g.space} label={g.space}>{g.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</optgroup>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1 h-3 w-3 text-muted-foreground" />
    </label>
  );
}

/* ───────────── composer: Task / Bulk ───────────── */

export function ChatTaskComposer({ channelUid, ws, mode, people, me, onCreated }: { channelUid: string; ws: string; mode: "task" | "bulk"; people: WorkUser[]; me?: number; onCreated?: () => void }) {
  const qc = useQueryClient();
  const { data } = useChatTasks(channelUid);
  const def = data?.defaultList ?? null;
  const [listId, setListId] = useState<number | null>(null);
  const list = listId ?? def?.id ?? null;
  const [makeDefault, setMakeDefault] = useState(true);
  // single task
  const [name, setName] = useState("");
  const [assignees, setAssignees] = useState<number[]>([]);
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<WorkPriority | null>(null);
  // bulk
  const [text, setText] = useState("");
  const [assignAll, setAssignAll] = useState<number[]>([]);
  const [edits, setEdits] = useState<Record<string, Partial<BulkRow> & { removed?: boolean }>>({});
  const parsed = useMemo(() => parseBulk(text, people), [text, people]);
  // "Split with AI": the AI's rows replace the line-by-line ones until the text is edited again
  const [aiRows, setAiRows] = useState<BulkRow[] | null>(null);
  const { data: aiOn } = useQuery({ queryKey: ["work", "ai-status"], queryFn: () => workApi.aiStatus(), staleTime: 300_000 });
  const split = useMutation({
    mutationFn: () => workApi.aiSplitTasks(channelUid, text, Intl.DateTimeFormat().resolvedOptions().timeZone),
    onSuccess: (r) => {
      setEdits({});
      setAiRows(r.tasks.map((t, i) => ({ key: `ai-${i}-${t.name}`, name: t.name, assigneeIds: t.assigneeIds, due: t.dueDate, priority: t.priority, description: t.description })));
      toast.success(`AI found ${r.tasks.length} ${r.tasks.length === 1 ? "task" : "tasks"}. Check them, then create.`);
    },
    onError: (e) => err(e, "AI couldn't split these notes."),
  });
  const rows = (aiRows ?? parsed).map((r) => ({ ...r, ...edits[r.key] })).filter((r) => !r.removed).map((r) => ({ ...r, assigneeIds: r.assigneeIds.length ? r.assigneeIds : assignAll }));

  const create = useMutation({
    mutationFn: async (items: ChatTaskInput[]) => {
      if (list && makeDefault && list !== def?.id) await workApi.chatDefaultList(channelUid, list).catch(() => null);
      return workApi.createChatTasks(channelUid, { ...(list ? { listId: list } : {}), items });
    },
    onSuccess: (r) => {
      addOwnMessage(qc, channelUid, r.message);
      qc.invalidateQueries({ queryKey: chatTasksKey(channelUid) });
      qc.invalidateQueries({ queryKey: chatSidebarKey(ws) });
      qc.invalidateQueries({ queryKey: messagesKey(channelUid) });
      toast.success(r.taskIds.length === 1 ? "Task created" : `${r.taskIds.length} tasks created`);
      setName(""); setAssignees([]); setDue(""); setPriority(null); setText(""); setEdits({}); setAssignAll([]); setAiRows(null);
      onCreated?.();
    },
    onError: (e) => err(e, "Couldn't create the tasks."),
  });
  const ready = !!list && !create.isPending;
  const listRow = (
    <div className="flex flex-wrap items-center gap-2">
      <ListPick ws={ws} value={list} onChange={setListId} />
      {list && list !== def?.id && (
        <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted-foreground"><input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} className="accent-[var(--primary)]" /> Use for this chat</label>
      )}
      {def && list === def.id && <span className="text-[11.5px] text-muted-foreground">Default for this chat</span>}
    </div>
  );

  if (mode === "task") {
    return (
      <div className="space-y-2.5 p-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ListChecks className="h-4 w-4" /></span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim() && ready) create.mutate([{ name: name.trim(), assigneeIds: assignees, dueDate: dueIso(due), ...(priority ? { priority } : {}) }]); }}
            placeholder="Task name — what needs to be done?" aria-label="Task name" maxLength={500} className="h-9 min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeoplePick people={people} value={assignees} onChange={setAssignees} me={me} />
          <label className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2 text-[12.5px]"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /><input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" className="bg-transparent outline-none" /></label>
          <PriorityPick value={priority} onChange={setPriority} />
          {listRow}
          <span className="flex-1" />
          <button type="button" disabled={!ready || !name.trim()} onClick={() => create.mutate([{ name: name.trim(), assigneeIds: assignees, dueDate: dueIso(due), ...(priority ? { priority } : {}) }])} className="flex h-8 items-center gap-1.5 rounded-lg bg-forest px-3.5 text-[12.5px] font-semibold text-forest-foreground disabled:opacity-40 dark:bg-primary dark:text-primary-foreground">
            {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create task
          </button>
        </div>
        {!list && <p className="text-[12px] text-[#b45309] dark:text-[#fbbf24]">Pick the list these tasks go to — it&apos;s remembered for this chat.</p>}
      </div>
    );
  }

  const people2 = new Set(rows.flatMap((r) => r.assigneeIds));
  return (
    <div className="space-y-2.5 p-3">
      <textarea value={text} onChange={(e) => { setText(e.target.value); if (aiRows) { setAiRows(null); setEdits({}); } }} rows={4} aria-label="Tasks, one per line, or notes for AI"
        placeholder={"One task per line — @person, a day and !priority are picked up:\nLanding page copy @Rubab fri !high\nAds budget final @Ali 25 nov\n…or paste meeting notes and press Split with AI"}
        className="block max-h-56 min-h-[96px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-[12.5px] leading-relaxed outline-none focus:border-primary/40" />
      <div className="flex flex-wrap items-center gap-2">
        {aiOn?.configured && (
          <button type="button" disabled={text.trim().length < 3 || split.isPending} onClick={() => split.mutate()} title="Turn meeting notes into separate tasks"
            className="flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#b08d57] to-[#8a6a35] px-3 text-[12.5px] font-semibold text-white shadow-[0_6px_14px_-8px_rgba(138,106,53,0.9)] transition hover:brightness-110 disabled:opacity-40">
            {split.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {split.isPending ? "Reading notes…" : "Split with AI"}
          </button>
        )}
        <span className="text-[12px] text-muted-foreground">No @ on a line?</span>
        <PeoplePick people={people} value={assignAll} onChange={setAssignAll} label="Assign all to…" me={me} />
        {listRow}
      </div>
      {aiRows && (
        <p className="flex items-center gap-2 rounded-lg bg-[#b08d57]/10 px-3 py-1.5 text-[12px] text-[#8a6a35] dark:text-[#d9bd8c]">
          <Sparkles className="h-3.5 w-3.5 shrink-0" /> AI split your notes into {aiRows.length} tasks. Check names, people and dates; nothing is created until you press Create.
          <button type="button" onClick={() => { setAiRows(null); setEdits({}); }} className="ml-auto shrink-0 font-semibold underline-offset-2 hover:underline">Use lines instead</button>
        </p>
      )}
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="max-h-[280px] overflow-y-auto">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 z-[1] bg-muted/70 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                <tr><th className="w-8 px-2 py-1.5">#</th><th className="px-2 py-1.5">Task</th><th className="px-2 py-1.5">Assignees</th><th className="px-2 py-1.5">Due</th><th className="w-10 px-1 py-1.5" aria-label="Priority" /><th className="w-8" aria-label="Remove" /></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key} className="border-t border-border/70">
                    <td className="px-2 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-1"><input value={r.name} onChange={(e) => setEdits((x) => ({ ...x, [r.key]: { ...x[r.key], name: e.target.value } }))} aria-label={`Task ${i + 1} name`} className="h-8 w-full min-w-[160px] rounded-md bg-transparent px-1.5 outline-none focus:bg-background focus:ring-1 focus:ring-primary/30" /></td>
                    <td className="px-1"><PeoplePick compact people={people} value={r.assigneeIds} onChange={(ids) => setEdits((x) => ({ ...x, [r.key]: { ...x[r.key], assigneeIds: ids } }))} me={me} /></td>
                    <td className="px-1"><input type="date" value={r.due ?? ""} onChange={(e) => setEdits((x) => ({ ...x, [r.key]: { ...x[r.key], due: e.target.value || null } }))} aria-label={`Task ${i + 1} due date`} className="h-7 rounded-md bg-transparent px-1 text-[12px] outline-none focus:bg-background" /></td>
                    <td className="px-1"><PriorityPick compact value={r.priority} onChange={(p) => setEdits((x) => ({ ...x, [r.key]: { ...x[r.key], priority: p } }))} /></td>
                    <td className="px-1"><button type="button" aria-label={`Remove task ${i + 1}`} onClick={() => setEdits((x) => ({ ...x, [r.key]: { ...x[r.key], removed: true } }))} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-muted-foreground">{rows.length ? `${rows.length} ${rows.length === 1 ? "task" : "tasks"} · ${people2.size} ${people2.size === 1 ? "person" : "people"}${rows.some((r) => !r.assigneeIds.length) ? ` · ${rows.filter((r) => !r.assigneeIds.length).length} unassigned` : ""}` : "Up to 50 at a time."}</span>
        <span className="flex-1" />
        <button type="button" disabled={!ready || !rows.length || rows.length > 50 || rows.some((r) => !r.name.trim())}
          onClick={() => create.mutate(rows.map((r) => ({ name: r.name.trim(), assigneeIds: r.assigneeIds, dueDate: dueIso(r.due), ...(r.priority ? { priority: r.priority } : {}), ...(r.description ? { description: r.description } : {}) })))}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-forest px-3.5 text-[12.5px] font-semibold text-forest-foreground disabled:opacity-40 dark:bg-primary dark:text-primary-foreground">
          {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Create {rows.length || ""} {rows.length === 1 ? "task" : "tasks"}
        </button>
      </div>
      {!list && <p className="text-[12px] text-[#b45309] dark:text-[#fbbf24]">Pick the list these tasks go to — it&apos;s remembered for this chat.</p>}
    </div>
  );
}

/* ───────────── task card in the message list ───────────── */

const dueLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null);
const isLate = (t: Pick<ChatTaskRow, "dueDate" | "completedAt">) => !t.completedAt && !!t.dueDate && new Date(t.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));

function StatusDot({ t }: { t: ChatTaskRow }) {
  const done = t.status?.category === "DONE" || !!t.completedAt;
  return done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2563eb] dark:text-[#60a5fa]" /> : <CircleDashed className="h-4 w-4 shrink-0" style={{ color: t.status?.color ?? "#9CA3AF" }} />;
}

export function TaskCard({ channelUid, ids, onOpenTask }: { channelUid: string; ids: number[]; onOpenTask?: (t: ChatTaskRow) => void }) {
  const { data } = useChatTasks(channelUid);
  const byId = new Map((data?.tasks ?? []).map((t) => [t.id, t]));
  const rows = ids.map((id) => byId.get(id)).filter(Boolean) as ChatTaskRow[];
  const hidden = ids.length - rows.length;
  const done = rows.filter((t) => t.completedAt).length;
  return (
    <div className="mt-1 max-w-[640px] overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(11_42_31/0.05)]">
      <div className="flex items-center gap-2 border-b border-border/70 bg-primary/[0.04] px-3 py-1.5 text-[11.5px] font-semibold text-primary">
        <ListChecks className="h-3.5 w-3.5" /> {ids.length === 1 ? "Task" : `${ids.length} tasks`}
        {ids.length > 1 && <span className="ml-auto font-medium text-muted-foreground">{done}/{rows.length} done</span>}
      </div>
      <ul className="divide-y divide-border/60">
        {rows.slice(0, 12).map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => (onOpenTask ?? openChatTask)(t)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-accent/40">
              <StatusDot t={t} />
              <span className={cn("min-w-0 flex-1 truncate text-[13px] font-medium", t.completedAt && "text-muted-foreground line-through")}>{t.name}</span>
              {t.priority && <PriorityFlag priority={t.priority} />}
              {t.dueDate && <span className={cn("shrink-0 text-[11.5px] tabular-nums", isLate(t) ? "font-semibold text-[#dc2626] dark:text-[#f87171]" : "text-muted-foreground")}>{dueLabel(t.dueDate)}</span>}
              <span className="flex shrink-0 -space-x-1.5">{t.assignees.slice(0, 3).map((u) => <Avatar key={u.id} user={u} size={20} className="ring-2 ring-card" />)}</span>
              {t.status && <span className="hidden shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase sm:inline ez-tint" style={{ ["--c" as string]: t.status.color }}>{t.status.name}</span>}
            </button>
          </li>
        ))}
        {rows.length > 12 && <li className="px-3 py-1.5 text-[12px] text-muted-foreground">+{rows.length - 12} more in the Tasks panel</li>}
        {!data && <li className="px-3 py-2 text-[12px] text-muted-foreground">Loading…</li>}
        {data && hidden > 0 && <li className="px-3 py-1.5 text-[12px] text-muted-foreground">{hidden === ids.length ? "These tasks were deleted or are in a space you can't see." : `${hidden} more you can't see`}</li>}
      </ul>
    </div>
  );
}

/* ───────────── the right-hand panel ───────────── */

export function ChatWorkPanel({ channelUid, me, onClose, onOpenTask, onJump, className }: { channelUid: string; me?: number; onClose: () => void; onOpenTask?: (t: ChatTaskRow) => void; onJump?: (m: ChatMentionRow) => void; className?: string }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"tasks" | "mentions">("tasks");
  const [state, setState] = useState<"open" | "done" | "all">("open");
  const [mine, setMine] = useState(false);
  const { data, isLoading } = useChatTasks(channelUid);
  const { data: mentions = [] } = useQuery({ queryKey: chatMentionsKey(channelUid), queryFn: () => workApi.chatMentions(channelUid), enabled: tab === "mentions" || true, staleTime: 15_000 });
  const tasks = data?.tasks ?? [];
  const open = tasks.filter((t) => !t.completedAt);
  const shown = tasks.filter((t) => (state === "all" || (state === "open" ? !t.completedAt : !!t.completedAt)) && (!mine || t.assignees.some((a) => a.id === me)));
  const late = open.filter(isLate).length;
  const mentionsOpen = mentions.filter((m) => !m.done).length;

  const resolve = useMutation({
    mutationFn: ({ t, done }: { t: ChatTaskRow; done: boolean }) => workApi.resolveChatTask(channelUid, t.id, done),
    onSuccess: (_r, v) => { qc.invalidateQueries({ queryKey: chatTasksKey(channelUid) }); qc.invalidateQueries({ queryKey: messagesKey(channelUid) }); toast.success(v.done ? `Resolved “${v.t.name}”` : `Reopened “${v.t.name}”`); },
    onError: (e) => err(e, "Couldn't change it."),
  });
  const setStatus = useMutation({
    mutationFn: ({ t, statusId }: { t: ChatTaskRow; statusId: number }) => workApi.updateTask(t.id, { statusId } as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatTasksKey(channelUid) }),
    onError: (e) => err(e, "Couldn't change the status."),
  });
  const mDone = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => workApi.chatMentionDone(id, done),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatMentionsKey(channelUid) }),
    onError: (e) => err(e, "Couldn't update it."),
  });

  return (
    <aside aria-label="Chat work" className={cn("flex w-[352px] shrink-0 flex-col border-l border-border bg-card", className)}>
      <header className="border-b border-border px-4 pb-0 pt-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-forest text-brass-soft dark:bg-primary/20 dark:text-primary"><ListChecks className="h-3.5 w-3.5" /></span>
          <h2 className="flex-1 text-[14px] font-semibold">Chat work</h2>
          {late > 0 && <span className="rounded-full bg-[#dc2626]/10 px-2 py-0.5 text-[11px] font-semibold text-[#dc2626] dark:text-[#f87171]">{late} late</span>}
          <button type="button" aria-label="Hide panel" title="Hide panel" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div role="tablist" aria-label="Chat work" className="mt-2 flex gap-4 text-[13px]">
          {([["tasks", "Tasks", open.length], ["mentions", "Mentions", mentionsOpen]] as const).map(([id, label, n]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("-mb-px flex items-center gap-1.5 border-b-2 pb-2 font-medium transition", tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {id === "tasks" ? <ListChecks className="h-3.5 w-3.5" /> : <AtSign className="h-3.5 w-3.5" />} {label}
              {n > 0 && <span className="rounded-full bg-muted px-1.5 text-[10.5px] font-semibold tabular-nums">{n}</span>}
            </button>
          ))}
        </div>
      </header>

      {tab === "tasks" ? (
        <>
          <div className="flex items-center gap-1.5 border-b border-border/70 px-3 py-2">
            <div role="group" aria-label="Which tasks" className="flex rounded-lg bg-muted/60 p-0.5 text-[12px]">
              {(["open", "done", "all"] as const).map((s) => <button key={s} type="button" aria-pressed={state === s} onClick={() => setState(s)} className={cn("rounded-md px-2 py-0.5 capitalize", state === s ? "bg-card font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}>{s}</button>)}
            </div>
            <span className="flex-1" />
            <button type="button" aria-pressed={mine} onClick={() => setMine(!mine)} className={cn("rounded-md px-2 py-0.5 text-[12px]", mine ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:text-foreground")}>Assigned to me</button>
          </div>
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {isLoading && [0, 1, 2].map((i) => <li key={i} className="h-[74px] animate-pulse rounded-xl bg-muted" />)}
            {shown.map((t) => (
              <li key={t.id} className={cn("rounded-xl border bg-background p-2.5 transition hover:border-primary/30", isLate(t) ? "border-[#dc2626]/30" : "border-border")}>
                <div className="flex items-start gap-2">
                  <button type="button" disabled={!t.canResolve || resolve.isPending} aria-label={t.completedAt ? `Reopen ${t.name}` : `Resolve ${t.name}`} title={t.canResolve ? (t.completedAt ? "Reopen" : "Resolve") : "Only the people on it, its creator or the channel owner can resolve it"} onClick={() => resolve.mutate({ t, done: !t.completedAt })} className="mt-0.5 rounded-full disabled:cursor-not-allowed">
                    <StatusDot t={t} />
                  </button>
                  <button type="button" onClick={() => (onOpenTask ?? openChatTask)(t)} className={cn("min-w-0 flex-1 text-left text-[13px] font-medium leading-snug hover:text-primary", t.completedAt && "text-muted-foreground line-through")}>{t.name}</button>
                  {t.priority && <PriorityFlag priority={t.priority} />}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6 text-[11.5px]">
                  <span className="flex -space-x-1.5">{t.assignees.slice(0, 4).map((u) => <Avatar key={u.id} user={u} size={18} className="ring-2 ring-background" />)}</span>
                  {!t.assignees.length && <span className="text-muted-foreground">Unassigned</span>}
                  {t.dueDate && <span className={cn("flex items-center gap-0.5 tabular-nums", isLate(t) ? "font-semibold text-[#dc2626] dark:text-[#f87171]" : "text-muted-foreground")}><CalendarDays className="h-3 w-3" />{dueLabel(t.dueDate)}</span>}
                  <span className="flex-1" />
                  {t.status && (
                    <label className="relative">
                      <span className="sr-only">Status</span>
                      <select value={t.status.id} disabled={setStatus.isPending} onChange={(e) => setStatus.mutate({ t, statusId: Number(e.target.value) })} className="ez-tint cursor-pointer appearance-none rounded-md py-0.5 pl-1.5 pr-4 text-[10.5px] font-semibold uppercase outline-none" style={{ ["--c" as string]: t.status.color }}>
                        {t.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-0.5 top-1/2 h-3 w-3 -translate-y-1/2 opacity-70" />
                    </label>
                  )}
                </div>
                {t.canResolve && (
                  <div className="mt-2 flex items-center gap-1.5 pl-6">
                    {t.completedAt ? (
                      <button type="button" onClick={() => resolve.mutate({ t, done: false })} className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11.5px] font-medium hover:bg-accent"><RotateCcw className="h-3 w-3" /> Reopen</button>
                    ) : (
                      <button type="button" onClick={() => resolve.mutate({ t, done: true })} className="flex items-center gap-1 rounded-md bg-forest px-2 py-0.5 text-[11.5px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground"><Check className="h-3 w-3" /> Resolve</button>
                    )}
                    <span className="truncate text-[11px] text-muted-foreground">{t.list.space} / {t.list.name}</span>
                  </div>
                )}
              </li>
            ))}
            {!isLoading && !shown.length && (
              <li className="flex flex-col items-center px-4 py-10 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10"><Sparkles className="h-5 w-5 text-primary" /></span>
                <p className="mt-2 text-[13px] font-semibold">{tasks.length ? "Nothing here" : "No tasks from this chat yet"}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">{tasks.length ? "Try another filter." : "Use the Task or Many tasks tab under the message box to turn chat into work."}</p>
              </li>
            )}
          </ul>
        </>
      ) : (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {mentions.map((m) => (
            <li key={m.id} className={cn("rounded-xl border bg-background p-2.5", m.forMe && !m.done ? "border-primary/30 bg-primary/[0.03]" : "border-border")}>
              <div className="flex items-center gap-1.5 text-[12px]">
                <Avatar user={m.author} size={18} /><span className="font-semibold">{m.mine ? "You" : m.author.firstName}</span>
                <span className="text-muted-foreground">→</span>
                <span className="flex min-w-0 items-center gap-1 truncate">{[...m.mentioned.map((x) => x.user), ...(m.assignee ? [m.assignee] : [])].filter((u, i, a) => a.findIndex((v) => v.id === u.id) === i).map((u) => <span key={u.id} className="truncate font-medium">{u.id === me ? "you" : u.firstName}</span>).reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, ", ", el] : [el]), [])}</span>
                <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{new Date(m.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>
              <p className={cn("mt-1 line-clamp-3 text-[12.5px]", m.done && "text-muted-foreground")}>{m.snippet}</p>
              <div className="mt-1.5 flex items-center gap-2 text-[11.5px]">
                {m.assignee && <span className={cn("rounded-md px-1.5 py-0.5 font-semibold", m.resolvedAt ? "bg-muted text-muted-foreground" : "bg-[#b08d57]/12 text-[#8a6a35] dark:text-[#d9bd8c]")}>{m.resolvedAt ? "Resolved" : `Assigned to ${m.assignee.id === me ? "you" : m.assignee.firstName}`}</span>}
                {onJump && <button type="button" onClick={() => onJump(m)} className="flex items-center gap-1 text-primary hover:underline"><MessageSquareReply className="h-3 w-3" /> Go to message</button>}
                <span className="flex-1" />
                {m.canToggle && m.mentioned.length > 0 && (
                  <button type="button" onClick={() => mDone.mutate({ id: m.id, done: !m.mentioned.find((x) => x.user.id === me)?.done && !(m.mine && m.mentioned.every((x) => x.done)) })} className={cn("flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold", m.done ? "bg-muted text-muted-foreground" : "border border-border hover:bg-accent")}>
                    <Check className="h-3 w-3" /> {m.done ? "Done" : "Mark done"}
                  </button>
                )}
              </div>
            </li>
          ))}
          {!mentions.length && (
            <li className="flex flex-col items-center px-4 py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10"><AtSign className="h-5 w-5 text-primary" /></span>
              <p className="mt-2 text-[13px] font-semibold">No mentions yet</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">When someone @mentions or assigns a message here, it shows up so nothing gets lost.</p>
            </li>
          )}
        </ul>
      )}
    </aside>
  );
}

/** remember whether the panel is open (per browser; storage can be blocked) */
export function usePanelPref(key = "ez.chatWorkPanel") {
  const read = () => { try { const v = window.localStorage.getItem(key); return v === null ? true : v === "1"; } catch { return true; } };
  const [open, setOpenState] = useState<boolean>(() => (typeof window === "undefined" ? true : read()));
  const setOpen = (v: boolean) => { setOpenState(v); try { window.localStorage.setItem(key, v ? "1" : "0"); } catch {} };
  return [open, setOpen] as const;
}

export type { ChatDefaultList };
