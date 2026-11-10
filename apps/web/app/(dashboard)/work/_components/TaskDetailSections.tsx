"use client";

/* Task-detail sections for the Work drawer: estimate, time tracking, tags,
   checklists, relationships (dependencies) and the comments + history timeline. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AtSign,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Link2,
  ListChecks,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  formatMinutes,
  parseEstimate,
  userName,
  workApi,
  workKeys,
  type WorkActivity,
  type WorkComment,
  type WorkLinkedTask,
  type WorkTaskDetail,
  type WorkTaskMine,
  type WorkUser,
} from "@/services/work.api";
import { Avatar, StatusGlyph } from "./primitives";
import { FileChip } from "./TaskFiles";
import { Reactions } from "./Reactions";
import { Thread } from "./Thread";
import { CommentActions } from "./CommentActions";
import { PersonHover } from "./people";
import { AssigneePicker } from "./pickers";

const errMsg = (e: any) => e?.response?.data?.message?.toString?.() ?? "Something went wrong.";
const TAG_COLORS = ["#047857", "#2563EB", "#DC2626", "#D97706", "#7C3AED", "#DB2777", "#0D9488", "#475569", "#b08d57"];

function useRefreshTask(task: WorkTaskDetail) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["work", "task"] });
    qc.invalidateQueries({ queryKey: workKeys.tasks(task.listId) });
    qc.invalidateQueries({ queryKey: ["work", "activity", task.id] });
  };
}

/* ───────────────────────────── estimate ───────────────────────────── */

export function EstimateField({ task, onSave }: { task: WorkTaskDetail; onSave: (minutes: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const canEdit = task.access.canEdit;
  const label = task.timeEstimate ? formatMinutes(task.timeEstimate) : "Empty";
  if (!canEdit) return <span className={cn("text-[13px]", !task.timeEstimate && "text-muted-foreground")}>{label}</span>;
  const submit = () => {
    const m = parseEstimate(value);
    if (value.trim() && m === null) return toast.error('Try "2h", "90m" or "1h 30m".');
    onSave(m);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setValue(task.timeEstimate ? formatMinutes(task.timeEstimate) : ""); }}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("rounded-md px-1 py-0.5 text-[13px] hover:bg-accent", !task.timeEstimate && "text-muted-foreground")}>{label}</button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 space-y-2 p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Time estimate</p>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="e.g. 2h 30m"
          aria-label="Time estimate"
          className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus:border-primary/40"
        />
        <div className="flex justify-between">
          <button type="button" onClick={() => { onSave(null); setOpen(false); }} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
          <button type="button" onClick={submit} className="rounded-md bg-forest px-2.5 py-1 text-xs font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground">Save</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ─────────────────────────── time tracking ─────────────────────────── */

export function TimeTracker({ task }: { task: WorkTaskDetail }) {
  const refresh = useRefreshTask(task);
  const qc = useQueryClient();
  const running = task.time.myRunning;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  const live = running ? Math.max(0, Math.round((now - new Date(running.startedAt).getTime()) / 1000)) : 0;
  const total = task.time.totalSeconds;

  const toggle = useMutation({
    mutationFn: () => (running ? workApi.stopTimer() : workApi.startTimer(task.id)),
    onSuccess: () => {
      refresh();
      qc.invalidateQueries({ queryKey: ["work", "running"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const [open, setOpen] = useState(false);
  const { data: log } = useQuery({ queryKey: ["work", "time", task.id], queryFn: () => workApi.time(task.id), enabled: open });
  const [manual, setManual] = useState("");
  const addManual = useMutation({
    mutationFn: (minutes: number) =>
      workApi.addTime(task.id, { startedAt: new Date(Date.now() - minutes * 60_000).toISOString(), duration: minutes * 60 }),
    onSuccess: () => {
      setManual("");
      refresh();
      qc.invalidateQueries({ queryKey: ["work", "time", task.id] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const delEntry = useMutation({
    mutationFn: (id: number) => workApi.deleteTime(id),
    onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: ["work", "time", task.id] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <span className="flex items-center gap-2">
      {task.access.canEdit && (
        <button
          type="button"
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
          aria-label={running ? "Stop timer" : "Start timer"}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold transition-colors",
            running ? "bg-destructive/10 text-destructive hover:bg-destructive/15" : "bg-primary/10 text-primary hover:bg-primary/15",
          )}
        >
          {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {running ? <span className="font-mono tabular-nums">{formatDuration(live)}</span> : "Start"}
        </button>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="rounded-md px-1 py-0.5 font-mono text-[12.5px] text-muted-foreground hover:bg-accent hover:text-foreground" title="Time log">
            {formatDuration(total + (running ? live : 0))}
            {task.timeEstimate ? <span className="text-muted-foreground/70"> / {formatMinutes(task.timeEstimate)}</span> : null}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <p className="border-b border-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Time tracked</p>
          <ul className="max-h-56 overflow-y-auto">
            {(log?.entries ?? []).map((e) => (
              <li key={e.id} className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-[12.5px] last:border-b-0">
                <Avatar user={e.user} size={20} />
                <span className="min-w-0 flex-1 truncate">
                  {new Date(e.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {e.note ? <span className="text-muted-foreground"> · {e.note}</span> : null}
                </span>
                <span className={cn("font-mono tabular-nums", e.running && "text-destructive")}>{e.running ? "running" : formatDuration(e.seconds)}</span>
                {!e.running && task.access.canEdit && (
                  <button type="button" aria-label="Delete entry" onClick={() => delEntry.mutate(e.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </li>
            ))}
            {log && log.entries.length === 0 && <li className="px-3 py-3 text-xs text-muted-foreground">No time tracked yet.</li>}
          </ul>
          {task.access.canEdit && (
            <div className="flex items-center gap-2 border-t border-border px-3 py-2">
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const m = parseEstimate(manual);
                  if (!m) return toast.error('Try "45m" or "1h 30m".');
                  addManual.mutate(m);
                }}
                placeholder="Add time, e.g. 1h 15m"
                aria-label="Add time manually"
                className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-[12.5px] outline-none focus:border-primary/40"
              />
              <span className="text-[11px] text-muted-foreground">Enter</span>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </span>
  );
}

/* ─────────────────────────────── tags ─────────────────────────────── */

export function TagsField({ task, spaceId, onSave }: { task: WorkTaskDetail; spaceId: number; onSave: (tagIds: number[]) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data: tags = [] } = useQuery({ queryKey: ["work", "tags", spaceId], queryFn: () => workApi.tags(spaceId), enabled: open });
  const selected = new Set(task.tags.map((t) => t.id));
  const create = useMutation({
    mutationFn: (name: string) => workApi.createTag(spaceId, name, TAG_COLORS[(tags.length + name.length) % TAG_COLORS.length]!),
    onSuccess: (tag) => {
      qc.invalidateQueries({ queryKey: ["work", "tags", spaceId] });
      onSave([...selected, tag.id]);
      setQ("");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const shown = tags.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()));
  const exact = tags.some((t) => t.name.toLowerCase() === q.trim().toLowerCase());
  const chips = (
    <span className="flex flex-wrap items-center gap-1">
      {task.tags.length ? task.tags.map((t) => (
        <span key={t.id} className="rounded px-1.5 py-0.5 text-[11.5px] font-semibold" style={{ background: `${t.color}1f`, color: t.color }}>{t.name}</span>
      )) : <span className="text-[13px] text-muted-foreground">Empty</span>}
    </span>
  );
  if (!task.access.canEdit) return chips;
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <PopoverTrigger asChild><button type="button" className="rounded-md px-1 py-0.5 text-left hover:bg-accent">{chips}</button></PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-0">
        <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && q.trim() && !exact && create.mutate(q.trim())}
            placeholder="Search or create tag"
            aria-label="Tag"
            className="w-full bg-transparent text-[13px] outline-none"
          />
        </div>
        <div className="max-h-56 overflow-y-auto p-1.5">
          {shown.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSave(selected.has(t.id) ? [...selected].filter((x) => x !== t.id) : [...selected, t.id])}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
            >
              <span className="rounded px-1.5 py-0.5 text-[11.5px] font-semibold" style={{ background: `${t.color}1f`, color: t.color }}>{t.name}</span>
              {selected.has(t.id) && <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
          {q.trim() && !exact && (
            <button type="button" onClick={() => create.mutate(q.trim())} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent">
              <Plus className="h-3.5 w-3.5" /> Create “{q.trim()}”
            </button>
          )}
          {!q && shown.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">No tags yet — type to create one.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ───────────────────────────── checklists ───────────────────────────── */

export function ChecklistsSection({ task, members }: { task: WorkTaskDetail; members: WorkUser[] }) {
  const refresh = useRefreshTask(task);
  const canEdit = task.access.canEdit;
  const run = (p: Promise<unknown>) => p.then(refresh).catch((e) => toast.error(errMsg(e)));
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Record<number, string>>({});
  // optimistic ticks: show the new state at once, drop the override once the server agrees (or roll back on error)
  const [ticked, setTicked] = useState<Record<number, boolean>>({});
  useEffect(() => {
    // drop overrides the server has confirmed
    setTicked((t) => {
      const server = new Map(task.checklists.flatMap((c) => c.items.map((i) => [i.id, i.done] as const)));
      const keep = Object.entries(t).filter(([id, v]) => server.get(Number(id)) !== v);
      return keep.length === Object.keys(t).length ? t : Object.fromEntries(keep);
    });
  }, [task.checklists]);
  const toggleItem = (id: number, next: boolean) => {
    setTicked((t) => ({ ...t, [id]: next }));
    workApi
      .updateChecklistItem(id, { done: next })
      .then(refresh)
      .catch((e) => {
        setTicked((t) => { const { [id]: _, ...rest } = t; return rest; });
        toast.error(errMsg(e));
      });
  };

  if (!task.checklists.length && !canEdit) return null;
  return (
    <section className="border-b border-border px-6 py-4">
      <h3 className="mb-2 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        <ListChecks className="h-3.5 w-3.5" /> Checklists
      </h3>
      <div className="space-y-3">
        {task.checklists.map((cl) => {
          const done = cl.items.filter((i) => (i.id in ticked ? ticked[i.id] : i.done)).length;
          return (
            <div key={cl.id} className="overflow-hidden rounded-lg border border-border">
              <div className="flex items-center gap-2 bg-table-head px-3 py-2">
                <span className="flex-1 truncate text-[13px] font-semibold">{cl.name}</span>
                <span className="font-mono text-[11.5px] text-muted-foreground">{done}/{cl.items.length}</span>
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-border">
                  <span className="block h-full rounded-full bg-primary transition-all" style={{ width: `${cl.items.length ? (done / cl.items.length) * 100 : 0}%` }} />
                </span>
                {canEdit && (
                  <button type="button" aria-label="Delete checklist" onClick={() => window.confirm(`Delete checklist "${cl.name}"?`) && run(workApi.deleteChecklist(cl.id))} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <ul>
                {cl.items.map((raw) => {
                  const it = raw.id in ticked ? { ...raw, done: ticked[raw.id]! } : raw;
                  return (
                  <li key={it.id} className="group flex items-center gap-2.5 border-t border-border/70 px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={it.done}
                      disabled={!canEdit}
                      onChange={() => toggleItem(it.id, !it.done)}
                      aria-label={`Done: ${it.name}`}
                      className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                    />
                    <span className={cn("min-w-0 flex-1 truncate text-[13.5px]", it.done && "text-muted-foreground line-through")}>{it.name}</span>
                    <AssigneePicker
                      members={members}
                      value={it.assignee ? [it.assignee] : []}
                      disabled={!canEdit}
                      onChange={(ids) => run(workApi.updateChecklistItem(it.id, { assigneeId: ids.filter((i) => i !== it.assignee?.id)[0] ?? null }))}
                    >
                      <button type="button" aria-label="Assign item" className="shrink-0">
                        {it.assignee ? <Avatar user={it.assignee} size={20} /> : <span className="hidden h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground group-hover:inline-flex"><AtSign className="h-3 w-3" /></span>}
                      </button>
                    </AssigneePicker>
                    {canEdit && (
                      <button type="button" aria-label="Delete item" onClick={() => run(workApi.deleteChecklistItem(it.id))} className="hidden text-muted-foreground hover:text-destructive group-hover:block">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                  );
                })}
                {canEdit && (
                  <li className="flex items-center gap-2 border-t border-border/70 px-3 py-1">
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      value={draft[cl.id] ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [cl.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        const v = (draft[cl.id] ?? "").trim();
                        if (e.key === "Enter" && v) run(workApi.addChecklistItem(cl.id, v)).then(() => setDraft((d) => ({ ...d, [cl.id]: "" })));
                      }}
                      placeholder="Add item, then Enter"
                      aria-label={`New item in ${cl.name}`}
                      className="h-7 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                    />
                  </li>
                )}
              </ul>
            </div>
          );
        })}
        {canEdit && (adding ? (
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) run(workApi.createChecklist(task.id, newName.trim())).then(() => { setNewName(""); setAdding(false); });
              if (e.key === "Escape") setAdding(false);
            }}
            onBlur={() => !newName.trim() && setAdding(false)}
            placeholder="Checklist name, then Enter"
            aria-label="New checklist"
            className="h-8 w-full rounded-md border border-primary/40 bg-background px-2.5 text-[13px] outline-none"
          />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
            <Plus className="h-3.5 w-3.5" /> Create checklist
          </button>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────── relationships / dependencies ────────────────────── */

const LINK_LABEL = { waitingOn: "Waiting on", blocking: "Blocking", linked: "Linked" } as const;

export function RelationshipsSection({ task }: { task: WorkTaskDetail; }) {
  const refresh = useRefreshTask(task);
  const canEdit = task.access.canEdit;
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"WAITING_ON" | "BLOCKING" | "LINKED">("WAITING_ON");
  const [q, setQ] = useState("");
  const { data: candidates = [] } = useQuery({ queryKey: workKeys.tasks(task.listId), queryFn: () => workApi.listTasks(task.listId), enabled: open });
  const already = new Set([task.id, ...task.links.waitingOn, ...task.links.blocking, ...task.links.linked].map((x: any) => (typeof x === "number" ? x : x.task.id)));
  const shown = candidates.filter((c) => !already.has(c.id) && c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const groups = (Object.keys(LINK_LABEL) as (keyof typeof LINK_LABEL)[]).filter((k) => task.links[k].length);

  const add = (otherId: number) =>
    workApi.addLink(task.id, otherId, type).then(() => { refresh(); setOpen(false); setQ(""); }).catch((e) => toast.error(errMsg(e)));
  const remove = (l: WorkLinkedTask) => workApi.removeLink(l.linkId).then(refresh).catch((e) => toast.error(errMsg(e)));

  if (!groups.length && !canEdit) return null;
  return (
    <section className="border-b border-border px-6 py-4">
      <h3 className="mb-2 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        <Link2 className="h-3.5 w-3.5" /> Relationships
      </h3>
      {groups.map((g) => (
        <div key={g} className="mb-2">
          <p className={cn("mb-1 text-[11.5px] font-semibold", g === "waitingOn" ? "text-[#b45309] dark:text-brass-soft" : g === "blocking" ? "text-destructive" : "text-muted-foreground")}>
            {LINK_LABEL[g]}
          </p>
          <ul className="overflow-hidden rounded-lg border border-border">
            {task.links[g].map((l) => (
              <li key={l.linkId} className="group flex items-center gap-2.5 border-b border-border/70 px-3 py-1.5 last:border-b-0">
                <StatusGlyph status={l.task.status} size={13} />
                <span className={cn("min-w-0 flex-1 truncate text-[13px]", l.task.completedAt && "text-muted-foreground line-through")}>{l.task.name}</span>
                <span className="truncate text-[11.5px] text-muted-foreground">{l.task.list.name}</span>
                {canEdit && (
                  <button type="button" aria-label="Remove relationship" onClick={() => remove(l)} className="hidden text-muted-foreground hover:text-destructive group-hover:block"><X className="h-3.5 w-3.5" /></button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {canEdit && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" /> Add relationship</button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <div className="flex gap-1 border-b border-border p-1.5">
              {(["WAITING_ON", "BLOCKING", "LINKED"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setType(t)} className={cn("flex-1 rounded-md px-2 py-1 text-[11.5px] font-semibold", type === t ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}>
                  {t === "WAITING_ON" ? "Waiting on" : t === "BLOCKING" ? "Blocking" : "Linked"}
                </button>
              ))}
            </div>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks in this list" aria-label="Search tasks" className="h-9 w-full border-b border-border bg-transparent px-3 text-[13px] outline-none" />
            <ul className="max-h-56 overflow-y-auto p-1.5">
              {shown.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => add(c.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent">
                    <span className="truncate">{c.name}</span>
                  </button>
                </li>
              ))}
              {shown.length === 0 && <li className="px-2 py-2 text-xs text-muted-foreground">No matching tasks.</li>}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </section>
  );
}

/* ─────────────────── comments + history timeline ─────────────────── */

const ACTION_TEXT: Record<string, string> = {
  created: "created this task",
  automation: "ran automation",
  status: "changed status",
  name: "renamed the task",
  priority: "changed priority",
  start_date: "changed the start date",
  due_date: "changed the due date",
  estimate: "changed the time estimate",
  assignees: "changed assignees",
  tags: "changed tags",
  moved: "moved the task",
  archived: "archived the task",
  link: "added a relationship",
  attachment_added: "attached",
  attachment_removed: "removed the file",
  link_added: "added the link",
  link_removed: "removed the link",
  field: "updated",
};

function fmtValue(action: string, v: unknown, members: WorkUser[] = []) {
  if (v === null || v === undefined || v === "") return "none";
  if (action === "assignees" && Array.isArray(v)) {
    if (!v.length) return "nobody";
    return v.map((id) => { const m = members.find((x) => x.id === id); return m ? userName(m) : "someone"; }).join(", ");
  }
  if (action === "start_date" || action === "due_date") return new Date(String(v)).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (action === "estimate") return formatMinutes(Number(v));
  if (action === "priority") return String(v).charAt(0) + String(v).slice(1).toLowerCase();
  if (Array.isArray(v)) return v.length ? v.join(", ") : "none";
  return String(v);
}

function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) });
}

export function Timeline({
  task,
  comments,
  currentUserId,
  members = [],
  onDeleteComment,
  mode = "all",
  bare = false,
  onOpenThread,
  mine,
  highlight,
}: {
  task: WorkTaskDetail;
  comments: WorkComment[];
  currentUserId?: number;
  members?: WorkUser[];
  onDeleteComment: (id: number) => void;
  /** all = comments + history (toggle); activity = history only */
  mode?: "all" | "activity";
  /** inside the side panel: no heading, day dividers */
  bare?: boolean;
  /** open a comment's thread in the side panel (else replies show inline) */
  onOpenThread?: (commentId: number) => void;
  mine?: WorkTaskMine;
  highlight?: number;
}) {
  const refresh = useRefreshTask(task);
  const qc = useQueryClient();
  const { data: activity = [] } = useQuery({ queryKey: ["work", "activity", task.id], queryFn: () => workApi.activity(task.id) });
  const [showHistory, setShowHistory] = useState(true);
  const items = useMemo(() => {
    const a = showHistory || mode === "activity" ? activity.map((x) => ({ kind: "activity" as const, at: x.createdAt, x })) : [];
    const c = mode === "activity" ? [] : comments.filter((x) => !x.parentId).map((x) => ({ kind: "comment" as const, at: x.createdAt, x }));
    return [...a, ...c].sort((p, q) => new Date(p.at).getTime() - new Date(q.at).getTime());
  }, [activity, comments, showHistory, mode]);

  // the side panel opens at the newest item (unless a linked comment is being shown)
  const end = useRef<HTMLDivElement>(null);
  const settled = useRef(false);
  useEffect(() => {
    if (!bare || highlight || settled.current || !items.length) return;
    settled.current = true;
    end.current?.scrollIntoView({ block: "end" });
  }, [bare, highlight, items.length]);

  const setResolved = (c: WorkComment, resolved: boolean) =>
    (resolved ? workApi.resolveComment(c.id) : workApi.reopenComment(c.id))
      .then(() => { qc.invalidateQueries({ queryKey: workKeys.comments(task.id) }); refresh(); })
      .catch((e) => toast.error(errMsg(e)));

  return (
    <section className={bare ? "px-4 py-3" : "px-6 py-4"}>
      {mode !== "activity" && (
        <div className="mb-3 flex items-center justify-between">
          {!bare ? <h3 className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Activity</h3> : <span />}
          <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} className="accent-[var(--primary)]" />
            Show history
          </label>
        </div>
      )}
      <ul className="space-y-2.5">
        {items.map((it, i) => {
          const prev = items[i - 1];
          const divider = bare && (!prev || new Date(prev.at).toDateString() !== new Date(it.at).toDateString());
          const row =
          it.kind === "activity" ? (
            <ActivityRow key={`a${it.x.id}`} a={it.x} members={members} />
          ) : (
            <CommentCard
              key={`c${it.x.id}`}
              task={task}
              c={it.x}
              members={members}
              currentUserId={currentUserId}
              mine={mine}
              highlight={highlight === it.x.id}
              onDelete={onDeleteComment}
              onResolve={setResolved}
              onOpenThread={onOpenThread}
              replies={comments.filter((r) => r.parentId === it.x.id)}
            />
          );
          if (!divider) return row;
          return [
            <li key={`d${it.kind}${it.x.id}`} aria-hidden className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-border" />
              <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">{dayLabel(it.at)}</span>
              <span className="h-px flex-1 bg-border" />
            </li>,
            row,
          ];
        })}
        {items.length === 0 && <li className="text-[13px] text-muted-foreground">{mode === "activity" ? "No history yet." : "No comments yet. Start the conversation below."}</li>}
      </ul>
      <div ref={end} aria-hidden />
    </section>
  );
}

/** One comment: header, text, files, reactions, assigned box, hover toolbar, thread summary. */
export function CommentCard({
  task,
  c,
  members,
  currentUserId,
  mine,
  highlight,
  onDelete,
  onResolve,
  onOpenThread,
  replies,
  inThread = false,
}: {
  task: WorkTaskDetail;
  c: WorkComment;
  members: WorkUser[];
  currentUserId?: number;
  mine?: WorkTaskMine;
  highlight?: boolean;
  onDelete: (id: number) => void;
  onResolve: (c: WorkComment, resolved: boolean) => void;
  onOpenThread?: (commentId: number) => void;
  replies?: WorkComment[];
  /** shown inside the thread view (no thread summary) */
  inThread?: boolean;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlight]);
  const people = [...new Map((replies ?? []).map((r) => [r.user.id, r.user])).values()].slice(0, 3);
  return (
    <li ref={ref} id={`comment-${c.id}`} className="group/c relative flex gap-2.5">
      <PersonHover user={c.user}><button type="button" aria-label={`${userName(c.user)} profile`} className="h-fit rounded-full"><Avatar user={c.user} size={28} /></button></PersonHover>
      <div className={cn("min-w-0 flex-1 rounded-lg border bg-card px-3 py-2 transition-shadow", c.assignee && !c.resolvedAt ? "border-[#b08d57]/60" : "border-border", highlight && "ring-2 ring-primary/40")}>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <PersonHover user={c.user}><button type="button" className="text-[13px] font-semibold hover:underline">{userName(c.user)}</button></PersonHover>
          <span className="text-[11px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
          {c.user.id === currentUserId && (
            <button type="button" aria-label="Delete comment" onClick={() => onDelete(c.id)} className="ml-auto rounded p-0.5 text-muted-foreground opacity-0 hover:text-destructive group-hover/c:opacity-100 focus:opacity-100">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed">{renderMentions(c.content, members)}</p>
        {!!c.attachments?.length && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.attachments.map((a) => <FileChip key={a.id} a={a} />)}
          </div>
        )}
        <Reactions comment={c} currentUserId={currentUserId} />
        {!inThread && onOpenThread && (replies?.length ?? 0) > 0 && (
          <button type="button" onClick={() => onOpenThread(c.id)} className="mt-1.5 flex items-center gap-1.5 rounded-md py-0.5 text-[12px] font-semibold text-primary hover:underline">
            <span className="flex -space-x-1.5">{people.map((u) => <Avatar key={u.id} user={u} size={16} />)}</span>
            {replies!.length} {replies!.length === 1 ? "reply" : "replies"}
            <span className="font-normal text-muted-foreground">· last reply {timeAgo(replies![replies!.length - 1]!.createdAt)}</span>
          </button>
        )}
        {!inThread && !onOpenThread && <Thread task={task} parent={c} replies={replies ?? []} currentUserId={currentUserId} onDelete={onDelete} />}
        {c.assignee && (
          <div className="mt-2 flex items-center gap-2 border-t border-border/70 pt-2 text-[12px]">
            {c.resolvedAt ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <CircleDashed className="h-3.5 w-3.5 text-[#b08d57]" />}
            <span className="text-muted-foreground">
              {c.resolvedAt ? "Resolved" : "Assigned to"} <strong className="font-semibold text-foreground">{userName(c.assignee)}</strong>
            </span>
            {(c.assignee.id === currentUserId || c.user.id === currentUserId || task.access.canManage) && (
              <button
                type="button"
                onClick={() => onResolve(c, !c.resolvedAt)}
                className={cn("ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold", c.resolvedAt ? "text-muted-foreground hover:bg-muted" : "bg-primary/10 text-primary hover:bg-primary/15")}
              >
                {c.resolvedAt ? <><RotateCcw className="h-3 w-3" /> Reopen</> : <><CheckCircle2 className="h-3 w-3" /> Resolve</>}
              </button>
            )}
          </div>
        )}
      </div>
      <CommentActions
        task={task}
        comment={c}
        members={members}
        currentUserId={currentUserId}
        mine={mine}
        onReply={onOpenThread && !inThread ? () => onOpenThread(c.id) : undefined}
        className="invisible absolute -top-3.5 right-2 z-10 group-hover/c:visible group-focus-within/c:visible has-[[data-state=open]]:visible"
      />
    </li>
  );
}

const escapeRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Highlight "@First Last" mentions of known members. */
function renderMentions(text: string, members: WorkUser[]) {
  const names = members.map((m) => userName(m)).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!names.length || !text.includes("@")) return text;
  const re = new RegExp(`@(${names.map(escapeRe).join("|")})`, "g");
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    out.push(text.slice(last, m.index));
    out.push(<span key={m.index} className="rounded bg-primary/10 px-1 font-medium text-primary">{m[0]}</span>);
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

export function ActivityRow({ a, members }: { a: WorkActivity; members: WorkUser[] }) {
  const text = ACTION_TEXT[a.action] ?? a.action;
  if (["attachment_added", "attachment_removed", "link_added", "link_removed", "field", "automation"].includes(a.action)) {
    const v = a.action.endsWith("added") ? a.toValue : a.fromValue;
    return (
      <li className="flex items-start gap-2.5 pl-1.5 text-[12.5px] text-muted-foreground">
        <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1">
          <strong className="font-semibold text-foreground/80">{userName(a.user)}</strong> {text}{" "}
          <span className="font-medium text-foreground">{Array.isArray(v) ? v.join(", ") : String(v ?? "")}</span>
        </span>
        <span className="shrink-0 text-[11px]">{timeAgo(a.createdAt)}</span>
      </li>
    );
  }
  const showValues = !["created", "archived", "link", "name"].includes(a.action);
  return (
    <li className="flex items-start gap-2.5 pl-1.5 text-[12.5px] text-muted-foreground">
      <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1">
        <strong className="font-semibold text-foreground/80">{userName(a.user)}</strong> {text}
        {showValues && (
          <>
            {" "}from <span className="text-foreground/80">{fmtValue(a.action, a.fromValue, members)}</span> to{" "}
            <span className="font-medium text-foreground">{fmtValue(a.action, a.toValue, members)}</span>
          </>
        )}
        {a.action === "name" && <> to <span className="font-medium text-foreground">{String(a.toValue)}</span></>}
      </span>
      <span className="shrink-0 text-[11px]">{timeAgo(a.createdAt)}</span>
    </li>
  );
}

