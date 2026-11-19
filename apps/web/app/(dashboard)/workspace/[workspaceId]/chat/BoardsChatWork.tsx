"use client";

/*
 * Accounts & Invoices team chat → tasks: the Task / Many tasks composer (with "Split with AI"),
 * task cards and resolved lines in the chat, and the "Chat work" side panel (Tasks + Mentions).
 * Items are real board items; the API checks board permissions. Mirrors Company Work's chat tasks.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AtSign, CalendarDays, Check, CheckCircle2, ChevronDown, CircleDashed, Flag, LayoutGrid, ListChecks, Loader2, MessageSquareReply, Plus, RotateCcw, Sparkles, Trash2, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { workApi, type WorkPriority, type WorkUser } from "@/services/work.api";
import { boardsChatApi, boardsChatKeys, type BChatTask, type BMention, type BMini, type BTarget, type BTaskInput } from "@/services/chat-work.api";
import { Avatar } from "@/app/(dashboard)/work/_components/primitives";
import { PeoplePick, PriorityPick, parseBulk, type BulkRow } from "@/app/(dashboard)/work/_components/chat/ChatTasks";

const err = (e: any, fallback: string) => toast.error(e?.response?.data?.message?.toString?.() ?? fallback);
const asUser = (u: BMini) => ({ ...u, email: "" }) as unknown as WorkUser;
const dueLabel = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null);
const isLate = (t: Pick<BChatTask, "dueDate" | "done">) => !t.done && !!t.dueDate && t.dueDate.slice(0, 10) < new Date().toLocaleDateString("en-CA");

export function useBoardsChatTasks(ws: number, ch: number) {
  return useQuery({ queryKey: boardsChatKeys.tasks(ch), queryFn: () => boardsChatApi.tasks(ws, ch), enabled: !!ws && !!ch, staleTime: 10_000, refetchInterval: 45_000 });
}

/* ───────────── board + group picker ───────────── */

function TargetPick({ targets, value, onChange }: { targets: BTarget[]; value: { boardId: number; groupId: number } | null; onChange: (v: { boardId: number; groupId: number }) => void }) {
  return (
    <label className="relative flex h-8 min-w-0 items-center gap-1.5 rounded-lg border border-border bg-background pl-2 pr-1 text-[12.5px]">
      <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <select aria-label="Board and group for the tasks" value={value ? `${value.boardId}:${value.groupId}` : ""} onChange={(e) => { const [b, g] = e.target.value.split(":").map(Number); if (b && g) onChange({ boardId: b, groupId: g }); }}
        className="min-w-0 max-w-[220px] cursor-pointer appearance-none truncate bg-transparent pr-4 outline-none">
        <option value="">Pick a board…</option>
        {targets.map((b) => <optgroup key={b.id} label={b.name}>{b.groups.map((g) => <option key={g.id} value={`${b.id}:${g.id}`}>{b.name} / {g.name}</option>)}</optgroup>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1 h-3 w-3 text-muted-foreground" />
    </label>
  );
}

/* ───────────── composer: Task / Many tasks ───────────── */

export function BoardsTaskComposer({ ws, ch, mode, me, onCreated }: { ws: number; ch: number; mode: "task" | "bulk"; me?: number; onCreated?: () => void }) {
  const qc = useQueryClient();
  const { data: tasksData } = useBoardsChatTasks(ws, ch);
  const people = useMemo(() => (tasksData?.people ?? []).map(asUser), [tasksData?.people]);
  const { data: tg, isLoading: tgLoading } = useQuery({ queryKey: boardsChatKeys.targets(ch), queryFn: () => boardsChatApi.targets(ws, ch), staleTime: 60_000 });
  const targets = tg?.boards ?? [];
  const [pick, setPick] = useState<{ boardId: number; groupId: number } | null>(null);
  const target = pick ?? tg?.default ?? null;
  const board = targets.find((b) => b.id === target?.boardId) ?? null;
  const isDefault = !!target && tg?.default?.boardId === target.boardId && tg?.default?.groupId === target.groupId;
  const [makeDefault, setMakeDefault] = useState(true);
  // single
  const [name, setName] = useState("");
  const [assignees, setAssignees] = useState<number[]>([]);
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<WorkPriority | null>(null);
  // bulk
  const [text, setText] = useState("");
  const [assignAll, setAssignAll] = useState<number[]>([]);
  const [edits, setEdits] = useState<Record<string, Partial<BulkRow> & { removed?: boolean }>>({});
  const parsed = useMemo(() => parseBulk(text, people), [text, people]);
  const [aiRows, setAiRows] = useState<BulkRow[] | null>(null);
  const { data: aiOn } = useQuery({ queryKey: ["work", "ai-status"], queryFn: () => workApi.aiStatus(), staleTime: 300_000 });
  const rows = (aiRows ?? parsed).map((r) => ({ ...r, ...edits[r.key] })).filter((r) => !r.removed).map((r) => ({ ...r, assigneeIds: r.assigneeIds.length ? r.assigneeIds : assignAll }));

  const split = useMutation({
    mutationFn: () => boardsChatApi.aiSplit(ws, ch, text, Intl.DateTimeFormat().resolvedOptions().timeZone),
    onSuccess: (r) => {
      setEdits({});
      setAiRows(r.tasks.map((t, i) => ({ key: `ai-${i}-${t.name}`, name: t.name, assigneeIds: t.assigneeIds, due: t.dueDate, priority: t.priority })));
      toast.success(`AI found ${r.tasks.length} ${r.tasks.length === 1 ? "task" : "tasks"}. Check them, then create.`);
    },
    onError: (e) => err(e, "AI couldn't split these notes."),
  });
  const create = useMutation({
    mutationFn: async (items: BTaskInput[]) => {
      if (!target) throw new Error("Pick a board first.");
      if (makeDefault && !isDefault) await boardsChatApi.setDefault(ws, ch, target.boardId, target.groupId).catch(() => null);
      return boardsChatApi.create(ws, ch, { boardId: target.boardId, groupId: target.groupId, items });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: boardsChatKeys.tasks(ch) });
      qc.invalidateQueries({ queryKey: boardsChatKeys.targets(ch) });
      toast.success(r.taskIds.length === 1 ? "Task created" : `${r.taskIds.length} tasks created`);
      if (r.missing?.length) toast.message(`This board has no ${r.missing.join(" / ")} column, so that part wasn't saved.`);
      setName(""); setAssignees([]); setDue(""); setPriority(null); setText(""); setEdits({}); setAssignAll([]); setAiRows(null);
      onCreated?.();
    },
    onError: (e: any) => err(e, e?.message ?? "Couldn't create the tasks."),
  });
  const ready = !!target && !create.isPending;
  const missing = board ? [!board.has.person && "person", !board.has.date && "date", !board.has.priority && "priority"].filter(Boolean) as string[] : [];
  const targetRow = (
    <div className="flex flex-wrap items-center gap-2">
      <TargetPick targets={targets} value={target} onChange={setPick} />
      {target && !isDefault && <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted-foreground"><input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} className="accent-[var(--primary)]" /> Use for this chat</label>}
      {isDefault && <span className="text-[11.5px] text-muted-foreground">Default for this chat</span>}
    </div>
  );
  const notes = (
    <>
      {!target && !tgLoading && (targets.length
        ? <p className="text-[12px] text-[#b45309] dark:text-[#fbbf24]">Pick the board and group these tasks go to; it&apos;s remembered for this chat.</p>
        : <p className="text-[12px] text-[#b45309] dark:text-[#fbbf24]">You can&apos;t add items to any board in this workspace. Ask an admin for edit access to a board.</p>)}
      {board && missing.length > 0 && <p className="text-[11.5px] text-muted-foreground">“{board.name}” has no {missing.join(", ")} column, so {missing.length > 1 ? "those are" : "that is"} skipped.</p>}
    </>
  );

  if (mode === "task") {
    const item = (): BTaskInput => ({ name: name.trim(), assigneeIds: assignees, dueDate: due || null, priority });
    return (
      <div className="space-y-2.5 p-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ListChecks className="h-4 w-4" /></span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim() && ready) create.mutate([item()]); }}
            placeholder="Task name — what needs to be done?" aria-label="Task name" maxLength={500} className="h-9 min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeoplePick people={people} value={assignees} onChange={setAssignees} me={me} />
          <label className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2 text-[12.5px]"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /><input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" className="bg-transparent outline-none" /></label>
          {board?.has.priority && <PriorityPick value={priority} onChange={setPriority} />}
          {targetRow}
          <span className="flex-1" />
          <button type="button" disabled={!ready || !name.trim()} onClick={() => create.mutate([item()])} className="flex h-8 items-center gap-1.5 rounded-lg bg-forest px-3.5 text-[12.5px] font-semibold text-forest-foreground disabled:opacity-40 dark:bg-primary dark:text-primary-foreground">
            {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create task
          </button>
        </div>
        {notes}
      </div>
    );
  }

  const who = new Set(rows.flatMap((r) => r.assigneeIds));
  return (
    <div className="space-y-2.5 p-3">
      <textarea value={text} onChange={(e) => { setText(e.target.value); if (aiRows) { setAiRows(null); setEdits({}); } }} rows={4} aria-label="Tasks, one per line, or notes for AI"
        placeholder={"One task per line — @person, a day and !priority are picked up:\nSend March invoices @Rubab fri !high\nReconcile bank account @Ali 25 nov\n…or paste meeting notes and press Split with AI"}
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
        {targetRow}
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
                <tr><th className="w-8 px-2 py-1.5">#</th><th className="px-2 py-1.5">Task</th><th className="px-2 py-1.5">Assignees</th><th className="px-2 py-1.5">Due</th>{board?.has.priority && <th className="w-10 px-1 py-1.5" aria-label="Priority" />}<th className="w-8" aria-label="Remove" /></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key} className="border-t border-border/70">
                    <td className="px-2 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-1"><input value={r.name} onChange={(e) => setEdits((x) => ({ ...x, [r.key]: { ...x[r.key], name: e.target.value } }))} aria-label={`Task ${i + 1} name`} className="h-8 w-full min-w-[160px] rounded-md bg-transparent px-1.5 outline-none focus:bg-background focus:ring-1 focus:ring-primary/30" /></td>
                    <td className="px-1"><PeoplePick compact people={people} value={r.assigneeIds} onChange={(ids) => setEdits((x) => ({ ...x, [r.key]: { ...x[r.key], assigneeIds: ids } }))} me={me} /></td>
                    <td className="px-1"><input type="date" value={r.due ?? ""} onChange={(e) => setEdits((x) => ({ ...x, [r.key]: { ...x[r.key], due: e.target.value || null } }))} aria-label={`Task ${i + 1} due date`} className="h-7 rounded-md bg-transparent px-1 text-[12px] outline-none focus:bg-background" /></td>
                    {board?.has.priority && <td className="px-1"><PriorityPick compact value={r.priority} onChange={(p) => setEdits((x) => ({ ...x, [r.key]: { ...x[r.key], priority: p } }))} /></td>}
                    <td className="px-1"><button type="button" aria-label={`Remove task ${i + 1}`} onClick={() => setEdits((x) => ({ ...x, [r.key]: { ...x[r.key], removed: true } }))} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-muted-foreground">{rows.length ? `${rows.length} ${rows.length === 1 ? "task" : "tasks"} · ${who.size} ${who.size === 1 ? "person" : "people"}${rows.some((r) => !r.assigneeIds.length) ? ` · ${rows.filter((r) => !r.assigneeIds.length).length} unassigned` : ""}` : "Up to 50 at a time."}</span>
        <span className="flex-1" />
        <button type="button" disabled={!ready || !rows.length || rows.length > 50 || rows.some((r) => !r.name.trim())}
          onClick={() => create.mutate(rows.map((r) => ({ name: r.name.trim(), assigneeIds: r.assigneeIds, dueDate: r.due, priority: board?.has.priority ? r.priority : null })))}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-forest px-3.5 text-[12.5px] font-semibold text-forest-foreground disabled:opacity-40 dark:bg-primary dark:text-primary-foreground">
          {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Create {rows.length || ""} {rows.length === 1 ? "task" : "tasks"}
        </button>
      </div>
      {notes}
    </div>
  );
}

/* ───────────── in the message list ───────────── */

function StatusDot({ t }: { t: BChatTask }) {
  return t.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2563eb] dark:text-[#60a5fa]" /> : <CircleDashed className="h-4 w-4 shrink-0" style={{ color: t.status?.color ?? "#9CA3AF" }} />;
}
function Pill({ s }: { s: { label: string; color: string } }) {
  return <span className="ez-tint shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase" style={{ ["--c" as string]: s.color }}>{s.label}</span>;
}

export function BoardsTaskCard({ ws, ch, ids, onOpen }: { ws: number; ch: number; ids: number[]; onOpen: (t: BChatTask) => void }) {
  const { data, refetch } = useBoardsChatTasks(ws, ch);
  const byId = new Map((data?.tasks ?? []).map((t) => [t.id, t]));
  const rows = ids.map((id) => byId.get(id)).filter(Boolean) as BChatTask[];
  const hidden = ids.length - rows.length;
  const asked = useRef(false);
  // a card that just arrived live: fetch the new tasks once
  useEffect(() => { if (data && hidden > 0 && !asked.current) { asked.current = true; void refetch(); } }, [data, hidden, refetch]);
  const done = rows.filter((t) => t.done).length;
  return (
    <div className="mt-1 max-w-[640px] overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(11_42_31/0.05)]">
      <div className="flex items-center gap-2 border-b border-border/70 bg-primary/[0.04] px-3 py-1.5 text-[11.5px] font-semibold text-primary">
        <ListChecks className="h-3.5 w-3.5" /> {ids.length === 1 ? "Task" : `${ids.length} tasks`}
        {rows[0] && <span className="truncate font-medium text-muted-foreground">· {rows[0].board.name}</span>}
        {ids.length > 1 && <span className="ml-auto font-medium text-muted-foreground">{done}/{rows.length} done</span>}
      </div>
      <ul className="divide-y divide-border/60">
        {rows.slice(0, 12).map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => onOpen(t)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-accent/40">
              <StatusDot t={t} />
              <span className={cn("min-w-0 flex-1 truncate text-[13px] font-medium", t.done && "text-muted-foreground line-through")}>{t.name}</span>
              {t.priority && <Flag className="h-3.5 w-3.5 shrink-0" style={{ color: t.priority.color, fill: t.priority.color }} aria-label={`Priority ${t.priority.label}`} />}
              {t.dueDate && <span className={cn("shrink-0 text-[11.5px] tabular-nums", isLate(t) ? "font-semibold text-[#dc2626] dark:text-[#f87171]" : "text-muted-foreground")}>{dueLabel(t.dueDate)}</span>}
              <span className="flex shrink-0 -space-x-1.5">{t.assignees.slice(0, 3).map((u) => <Avatar key={u.id} user={asUser(u)} size={20} className="ring-2 ring-card" />)}</span>
              {t.status && <span className="hidden sm:inline"><Pill s={t.status} /></span>}
            </button>
          </li>
        ))}
        {rows.length > 12 && <li className="px-3 py-1.5 text-[12px] text-muted-foreground">+{rows.length - 12} more in the Tasks panel</li>}
        {!data && <li className="px-3 py-2 text-[12px] text-muted-foreground">Loading…</li>}
        {data && hidden > 0 && <li className="px-3 py-1.5 text-[12px] text-muted-foreground">{hidden === ids.length ? "These tasks were deleted or are on a board you can't see." : `${hidden} more you can't see`}</li>}
      </ul>
    </div>
  );
}

export function ResolvedLine({ who, name, done, at }: { who: string; name: string; done: boolean; at?: string }) {
  return (
    <div className="my-1 flex items-center gap-2">
      <span className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium", done ? "bg-primary/[0.08] text-primary" : "bg-muted text-muted-foreground")}>
        {done ? <Check className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />} {who} {done ? "resolved" : "reopened"} “{name}”
      </span>
      {at && <span className="text-[11px] text-muted-foreground">{new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
    </div>
  );
}

/* ───────────── right-hand panel ───────────── */

export function BoardsChatWorkPanel({ ws, ch, me, onClose, onOpen, onJump, className }: { ws: number; ch: number; me?: number; onClose: () => void; onOpen: (t: BChatTask) => void; onJump?: (m: BMention) => void; className?: string }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"tasks" | "mentions">("tasks");
  const [state, setState] = useState<"open" | "done" | "all">("open");
  const [mine, setMine] = useState(false);
  const { data, isLoading } = useBoardsChatTasks(ws, ch);
  const { data: mentions = [] } = useQuery({ queryKey: boardsChatKeys.mentions(ch), queryFn: () => boardsChatApi.mentions(ws, ch), staleTime: 15_000, refetchInterval: 60_000 });
  const tasks = data?.tasks ?? [];
  const open = tasks.filter((t) => !t.done);
  const shown = tasks.filter((t) => (state === "all" || (state === "open" ? !t.done : t.done)) && (!mine || t.assignees.some((a) => a.id === me)));
  const late = open.filter(isLate).length;
  const mentionsOpen = mentions.filter((m) => !m.done).length;
  const refresh = () => qc.invalidateQueries({ queryKey: boardsChatKeys.tasks(ch) });
  const resolve = useMutation({
    mutationFn: ({ t, done }: { t: BChatTask; done: boolean }) => boardsChatApi.resolve(ws, ch, t.id, done),
    onSuccess: (_r, v) => { refresh(); toast.success(v.done ? `Resolved “${v.t.name}”` : `Reopened “${v.t.name}”`); },
    onError: (e) => err(e, "Couldn't change it."),
  });
  const setStatus = useMutation({
    mutationFn: ({ t, statusId }: { t: BChatTask; statusId: number }) => boardsChatApi.setStatus(ws, ch, t.id, statusId),
    onSuccess: refresh,
    onError: (e) => err(e, "Couldn't change the status."),
  });
  const mDone = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => boardsChatApi.mentionDone(ws, id, done),
    onSuccess: () => qc.invalidateQueries({ queryKey: boardsChatKeys.mentions(ch) }),
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
            {shown.map((t) => {
              const cur = t.statuses.find((s) => s.label === t.status?.label);
              return (
                <li key={t.id} className={cn("rounded-xl border bg-background p-2.5 transition hover:border-primary/30", isLate(t) ? "border-[#dc2626]/30" : "border-border")}>
                  <div className="flex items-start gap-2">
                    <button type="button" disabled={!t.canResolve || resolve.isPending} aria-label={t.done ? `Reopen ${t.name}` : `Resolve ${t.name}`} title={t.canResolve ? (t.done ? "Reopen" : "Resolve") : "Only the people on it, its creator or the channel owner can resolve it"} onClick={() => resolve.mutate({ t, done: !t.done })} className="mt-0.5 rounded-full disabled:cursor-not-allowed"><StatusDot t={t} /></button>
                    <button type="button" onClick={() => onOpen(t)} className={cn("min-w-0 flex-1 text-left text-[13px] font-medium leading-snug hover:text-primary", t.done && "text-muted-foreground line-through")}>{t.name}</button>
                    {t.priority && <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: t.priority.color, fill: t.priority.color }} aria-label={`Priority ${t.priority.label}`} />}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6 text-[11.5px]">
                    <span className="flex -space-x-1.5">{t.assignees.slice(0, 4).map((u) => <Avatar key={u.id} user={asUser(u)} size={18} className="ring-2 ring-background" />)}</span>
                    {!t.assignees.length && <span className="text-muted-foreground">Unassigned</span>}
                    {t.dueDate && <span className={cn("flex items-center gap-0.5 tabular-nums", isLate(t) ? "font-semibold text-[#dc2626] dark:text-[#f87171]" : "text-muted-foreground")}><CalendarDays className="h-3 w-3" />{dueLabel(t.dueDate)}</span>}
                    <span className="flex-1" />
                    {t.statuses.length > 0 && t.canEdit ? (
                      <label className="relative">
                        <span className="sr-only">Status</span>
                        <select value={cur?.id ?? ""} disabled={setStatus.isPending} onChange={(e) => setStatus.mutate({ t, statusId: Number(e.target.value) })} className="ez-tint max-w-[130px] cursor-pointer appearance-none truncate rounded-md py-0.5 pl-1.5 pr-4 text-[10.5px] font-semibold uppercase outline-none" style={{ ["--c" as string]: t.status?.color ?? "#8a8f98" }}>
                          {!cur && <option value="">{t.status?.label ?? "No status"}</option>}
                          {t.statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-0.5 top-1/2 h-3 w-3 -translate-y-1/2 opacity-70" />
                      </label>
                    ) : t.status && <Pill s={t.status} />}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 pl-6">
                    {t.canResolve && (t.done ? (
                      <button type="button" onClick={() => resolve.mutate({ t, done: false })} className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11.5px] font-medium hover:bg-accent"><RotateCcw className="h-3 w-3" /> Reopen</button>
                    ) : (
                      <button type="button" onClick={() => resolve.mutate({ t, done: true })} className="flex items-center gap-1 rounded-md bg-forest px-2 py-0.5 text-[11.5px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground"><Check className="h-3 w-3" /> Resolve</button>
                    ))}
                    <span className="truncate text-[11px] text-muted-foreground">{t.board.name} / {t.group}</span>
                  </div>
                </li>
              );
            })}
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
                <Avatar user={asUser(m.author)} size={18} /><span className="font-semibold">{m.mine ? "You" : m.author.firstName}</span>
                <span className="text-muted-foreground">→</span>
                <span className="min-w-0 truncate font-medium">{m.mentioned.map((x) => (x.user.id === me ? "you" : x.user.firstName)).join(", ")}</span>
                <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{new Date(m.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>
              <p className={cn("mt-1 line-clamp-3 text-[12.5px]", m.done && "text-muted-foreground")}>{m.snippet}</p>
              <div className="mt-1.5 flex items-center gap-2 text-[11.5px]">
                {m.assignee && <span className="rounded-md bg-[#b08d57]/12 px-1.5 py-0.5 font-semibold text-[#8a6a35] dark:text-[#d9bd8c]">Assigned to {m.assignee.id === me ? "you" : m.assignee.firstName}</span>}
                {onJump && <button type="button" onClick={() => onJump(m)} className="flex items-center gap-1 text-primary hover:underline"><MessageSquareReply className="h-3 w-3" /> Go to message</button>}
                <span className="flex-1" />
                {m.canToggle && (
                  <button type="button" onClick={() => mDone.mutate({ id: m.id, done: m.mine ? !m.done : !m.mentioned.find((x) => x.user.id === me)?.done })} className={cn("flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold", m.done ? "bg-muted text-muted-foreground" : "border border-border hover:bg-accent")}>
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

/** composer tabs shown above the message box */
export function ComposeTabs({ mode, onMode }: { mode: "message" | "task" | "bulk"; onMode: (m: "message" | "task" | "bulk") => void }) {
  return (
    <div role="tablist" aria-label="Compose" className="mb-1 flex gap-1 px-1 text-[12.5px]">
      {(["message", "task", "bulk"] as const).map((x) => (
        <button key={x} type="button" role="tab" aria-selected={mode === x} onClick={() => onMode(x)} className={cn("flex items-center gap-1 rounded-md px-2 py-0.5", mode === x ? "border border-border bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {x === "task" && <ListChecks className="h-3.5 w-3.5" />}{x === "bulk" && <Zap className="h-3.5 w-3.5 text-[#b08d57]" />}
          {x === "message" ? "Message" : x === "task" ? "Task" : "Many tasks"}
        </button>
      ))}
    </div>
  );
}

/* ───────────── members-only channels ───────────── */

/** a one-line note in the chat: "added Ali — a task was assigned to them", "joined the channel" */
export function NoteLine({ who, text }: { who: string; text: string }) {
  return (
    <div className="my-1 flex justify-center">
      <span className="rounded-full bg-muted px-3 py-1 text-[12px] text-muted-foreground"><strong className="font-semibold text-foreground/80">{who}</strong> {text}</span>
    </div>
  );
}

/** owners / admins: every channel's name and people (never its messages); join (everyone sees it) or add people */
export function ManageChannels({ ws, members, onJoined }: { ws: number; members: BMini[]; onJoined: (channelId: number) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [joining, setJoining] = useState<number | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const { data, isError } = useQuery({ queryKey: ["boards", "manage-channels", ws], queryFn: () => boardsChatApi.manageChannels(ws), retry: false, staleTime: 30_000 });
  const refresh = () => qc.invalidateQueries({ queryKey: ["boards", "manage-channels", ws] });
  const join = useMutation({
    mutationFn: (ch: number) => boardsChatApi.join(ws, ch),
    onSuccess: (_r, ch) => { refresh(); setJoining(null); setOpen(false); onJoined(ch); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't join."),
  });
  const add = useMutation({
    mutationFn: async (ch: number) => { for (const u of picked) await boardsChatApi.addMember(ws, ch, u); },
    onSuccess: () => { toast.success("People added"); setAdding(null); setPicked([]); refresh(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't add."),
  });
  if (isError || !data) return null; // not an owner / admin
  const others = data.filter((c) => !c.joined);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Manage channels (owners & admins)" className="rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground">Manage</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-label="Manage channels" onClick={() => setOpen(false)}>
          <div className="w-full max-w-[460px] rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2"><h2 className="flex-1 text-[16px] font-semibold">Manage channels</h2><button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button></div>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Channels you are not in. You see their names and how many people are in them — not their messages. Joining shows everyone that you joined.</p>
            <ul className="mt-3 max-h-[50vh] divide-y divide-border/60 overflow-y-auto rounded-xl border border-border">
              {others.map((c) => (
                <li key={c.id} className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-semibold"># {c.name}</span><span className="block text-[11.5px] text-muted-foreground">{c.memberCount} {c.memberCount === 1 ? "person" : "people"}</span></span>
                    <button type="button" onClick={() => { setAdding(adding === c.id ? null : c.id); setPicked([]); }} className="h-7 rounded-md border border-border px-2 text-[12px] hover:bg-accent">Add people</button>
                    <button type="button" onClick={() => setJoining(c.id)} className="h-7 rounded-md bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground">Join</button>
                  </div>
                  {joining === c.id && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-2 text-[12px]">
                      <span className="flex-1">Members will see that you joined.</span>
                      <button type="button" onClick={() => setJoining(null)} className="rounded px-2 py-1 text-muted-foreground hover:bg-accent">Cancel</button>
                      <button type="button" disabled={join.isPending} onClick={() => join.mutate(c.id)} className="rounded bg-primary px-2.5 py-1 font-semibold text-primary-foreground disabled:opacity-50">Join #{c.name}</button>
                    </div>
                  )}
                  {adding === c.id && (
                    <div className="mt-2 rounded-lg border border-border p-1">
                      <ul className="max-h-40 overflow-y-auto">
                        {members.map((m) => {
                          const on = picked.includes(m.id);
                          return (
                            <li key={m.id}><button type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => setPicked(on ? picked.filter((x) => x !== m.id) : [...picked, m.id])} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12.5px] hover:bg-accent">
                              <Avatar user={m as any} size={18} /><span className="flex-1 truncate">{m.firstName} {m.lastName}</span>{on && <Check className="h-3.5 w-3.5 text-primary" />}
                            </button></li>
                          );
                        })}
                      </ul>
                      <div className="flex justify-end p-1"><button type="button" disabled={!picked.length || add.isPending} onClick={() => add.mutate(c.id)} className="rounded bg-primary px-2.5 py-1 text-[12px] font-semibold text-primary-foreground disabled:opacity-50">Add {picked.length || ""}</button></div>
                    </div>
                  )}
                </li>
              ))}
              {!others.length && <li className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">You&apos;re in every channel.</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
