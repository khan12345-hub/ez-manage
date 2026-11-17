"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, ChevronDown, ChevronRight, ExternalLink, Folder, Hash, ListChecks, Lock, MessageSquarePlus, Search, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { workApi, workKeys, type ChatLocationType, type LocationTask, type LocationTasks, type SavedView } from "@/services/work.api";
import { Avatar, PriorityFlag } from "../primitives";
import { SpaceIcon } from "../SpaceIcon";
import { TaskDrawer } from "../TaskDrawer";
import { TaskTable } from "../TaskTable";
import { TaskMonthCalendar } from "./DmTabs";
import { CreateChannelDialog } from "./ChatSidebar";
import { ChannelView } from "./ChannelView";
import { useProfilePanel } from "../people";
import { useWs } from "./useChat";

export type PickedLocation = { type: ChatLocationType; id: number; label: string };

/** pick a Space, Folder or List (ClickUp "Add a List" in Create Channel) */
export function LocationPicker({ value, onChange }: { value: PickedLocation | null; onChange: (v: PickedLocation | null) => void }) {
  const ws = useWs();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data: tree } = useQuery({ queryKey: workKeys.tree(ws), queryFn: () => workApi.tree(ws) });
  const term = q.trim().toLowerCase();
  const hit = (n: string) => !term || n.toLowerCase().includes(term);
  const pick = (v: PickedLocation) => { onChange(v); setOpen(false); };
  const row = (v: PickedLocation, icon: React.ReactNode, depth: number, name: string) => (
    <li key={`${v.type}-${v.id}`}>
      <button type="button" role="option" aria-selected={value?.type === v.type && value.id === v.id} onClick={() => pick(v)} style={{ paddingLeft: 8 + depth * 18 }} className="flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-[13px] hover:bg-accent">
        {icon}<span className="flex-1 truncate">{name}</span>{value?.type === v.type && value.id === v.id && <Check className="h-3.5 w-3.5 text-primary" />}
      </button>
    </li>
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Location" className="mt-2 flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-left text-[13px] hover:bg-accent/40">
          {value ? <><LocIcon type={value.type} /> <span className="flex-1 truncate">{value.label}</span></> : <span className="flex-1 text-muted-foreground">Choose a Space, Folder or List…</span>}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] min-w-[300px] p-1.5">
        <label className="flex h-8 items-center gap-2 rounded-md border border-border px-2"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search locations" className="w-full bg-transparent text-[13px] outline-none" /></label>
        <p className="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">Browse</p>
        <ul role="listbox" aria-label="Locations" className="max-h-72 overflow-y-auto">
          {(tree?.spaces ?? []).map((s) => {
            const folders = s.folders.filter((f) => hit(f.name) || hit(s.name) || f.lists.some((l) => hit(l.name)));
            const lists = s.lists.filter((l) => hit(l.name) || hit(s.name));
            if (!hit(s.name) && !folders.length && !lists.length) return null;
            return [
              row({ type: "space", id: s.id, label: s.name }, <SpaceIcon name={s.name} color={s.color} icon={s.icon} size={18} />, 0, s.name),
              ...folders.flatMap((f) => [
                row({ type: "folder", id: f.id, label: `${s.name} / ${f.name}` }, <Folder className="h-3.5 w-3.5 text-muted-foreground" />, 1, f.name),
                ...f.lists.filter((l) => hit(l.name) || hit(f.name) || hit(s.name)).map((l) => row({ type: "list", id: l.id, label: `${s.name} / ${f.name} / ${l.name}` }, <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />, 2, l.name)),
              ]),
              ...lists.map((l) => row({ type: "list", id: l.id, label: `${s.name} / ${l.name}` }, <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />, 1, l.name)),
            ];
          })}
        </ul>
        {value && <button type="button" onClick={() => { onChange(null); setOpen(false); }} className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-[12.5px] text-muted-foreground hover:bg-accent">Remove location</button>}
      </PopoverContent>
    </Popover>
  );
}

export function LocIcon({ type, className = "h-3.5 w-3.5 text-muted-foreground" }: { type: ChatLocationType; className?: string }) {
  return type === "list" ? <ListChecks className={className} /> : type === "folder" ? <Folder className={className} /> : <Users className={className} />;
}

export const locationHref = (ws: string, loc: { type: ChatLocationType; uid: string }) => `/work/${ws}/${loc.type}/${loc.uid}`;

/** where location tasks come from: a channel attached to a location, or the Space / Folder / List itself */
export type LocSrc = { channelUid: string } | { type: ChatLocationType; uid: string };
const srcKey = (s: LocSrc) => ("channelUid" in s ? `ch:${s.channelUid}` : `${s.type}:${s.uid}`);
function useLocationTasks(src: LocSrc) {
  const ws = useWs();
  return useQuery({
    queryKey: ["work", "loc-tasks", srcKey(src)],
    queryFn: () => ("channelUid" in src ? workApi.locationTasks(src.channelUid) : workApi.locationTasksByRef(ws, src.type, src.uid)),
    enabled: "channelUid" in src || !!ws,
  });
}
const loadWindow = (ws: string, src: LocSrc, from: string, to: string) =>
  ("channelUid" in src ? workApi.locationTasks(src.channelUid, { from, to }) : workApi.locationTasksByRef(ws, src.type, src.uid, { from, to })).then((r) => r.tasks);

function Due({ t }: { t: LocationTask }) {
  if (!t.dueDate) return <span className="text-muted-foreground">—</span>;
  const d = new Date(t.dueDate);
  const late = !t.completedAt && d < new Date(new Date().setHours(0, 0, 0, 0));
  return <span className={late ? "font-semibold text-destructive" : "text-muted-foreground"}>{d.toLocaleDateString([], { month: "short", day: "numeric" })}</span>;
}

/** "List": every task of the location in one table, grouped by status (same look as a list's List view) */
export function LocationList({ src }: { src: LocSrc }) {
  const ws = useWs();
  const { data, isLoading, isError } = useLocationTasks(src);
  const [open, setOpen] = useState<string | null>(null);
  const groups = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, { name: string; color: string; rank: number; items: LocationTask[] }>();
    const add = (st: St) => { const k = st.name.toLowerCase(); if (!m.has(k)) m.set(k, { name: st.name, color: st.color, rank: catRank(st.category) * 100 + m.size, items: [] }); };
    for (const l of data.lists) l.statuses.forEach(add);
    for (const t of data.tasks) if (t.status) add(t.status);
    for (const t of data.tasks) if (!t.parentId) (m.get((t.status?.name ?? "").toLowerCase()) ?? (add({ id: 0, name: "No status", color: "#8a8f98", category: "open" }), m.get("no status")!)).items.push(t);
    return [...m.values()].filter((g) => g.items.length).sort((a, b) => a.rank - b.rank);
  }, [data]);
  if (isError) return <p className="p-10 text-center text-[13px] text-muted-foreground">You don&apos;t have access to this location.</p>;
  if (isLoading || !data) return <div className="p-6"><div className="h-40 animate-pulse rounded-xl bg-muted" /></div>;
  const listOf = (t: LocationTask) => data.lists.find((l) => l.id === t.listId);
  return (
    <div className="min-h-0 flex-1 overflow-auto py-1">
      <TaskTable
        whereLabel="List"
        empty={data.lists.length ? "No tasks here yet." : "No lists here yet."}
        onOpen={setOpen}
        groups={groups.map((g) => ({ name: g.name, color: g.color, items: g.items.map((t) => { const l = listOf(t); return { ...t, where: l ? { label: `${l.folder ? `${l.folder.name} / ` : ""}${l.name}`, href: `/work/${ws}/list/${l.uid}` } : undefined }; }) }))}
      />
      <TaskDrawer taskUid={open} onClose={() => setOpen(null)} onOpenTask={setOpen} />
    </div>
  );
}

const CATEGORY_ORDER = ["not_started", "open", "active", "in_progress", "done", "closed"];
const catRank = (c?: string) => (CATEGORY_ORDER.indexOf((c ?? "").toLowerCase()) + 1 || 3);
type St = { id: number; name: string; color: string; category: string };

/** tasks grouped by their status, in the list's own order when it has one, else by category */
function statusGroups(tasks: LocationTask[], own: St[]) {
  const m = new Map<number, { st: St; items: LocationTask[] }>();
  for (const t of tasks) {
    const st = t.status ?? { id: 0, name: "No status", color: "#8a8f98", category: "open" };
    if (!m.has(st.id)) m.set(st.id, { st, items: [] });
    m.get(st.id)!.items.push(t);
  }
  const pos = (st: St) => { const i = own.findIndex((o) => o.id === st.id); return i >= 0 ? i : 1000 + catRank(st.category) * 10; };
  return [...m.values()].sort((a, b) => pos(a.st) - pos(b.st));
}

/** channel tab "Board": tasks of every list as columns by status */
export function LocationBoard({ src, view, canEdit = false }: { src: LocSrc; view?: SavedView | null; canEdit?: boolean }) {
  const { data, isLoading, isError } = useLocationTasks(src);
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [localGroup, setLocalGroup] = useState<string | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const group = String(localGroup ?? view?.settings?.boardGroup ?? "status"); // status | assignee | priority | field:<id>
  const spaceId = data?.location.spaceId;
  // the space's custom fields (every list in a space / folder shares them) and their values per list
  const { data: fields = [] } = useQuery({ queryKey: ["work", "fields", spaceId ?? 0], queryFn: () => workApi.fields(spaceId!), enabled: !!spaceId, staleTime: 30_000 });
  const listIds = useMemo(() => (data?.lists ?? []).map((l) => l.id), [data]);
  const { data: values = {} } = useQuery({
    queryKey: ["work", "loc-field-values", listIds.join(",")],
    queryFn: async () => Object.assign({}, ...(await Promise.all(listIds.map((id) => workApi.listFieldValues(id).catch(() => ({})))))) as Record<number, Record<number, unknown>>,
    enabled: listIds.length > 0 && fields.length > 0,
  });
  const groupFields = fields.filter((f) => f.type === "dropdown" || f.type === "labels");
  const groupField = group.startsWith("field:") ? groupFields.find((f) => f.id === Number(group.slice(6))) : undefined;
  const setGroup = async (g: string) => {
    setLocalGroup(g);
    // a saved view keeps it for everyone (people who can edit the location)
    if (view && canEdit) {
      try { await workApi.updateView(view.uid, { settings: { ...(view.settings ?? {}), boardGroup: g } }); await qc.invalidateQueries({ queryKey: ["work", "views"] }); } catch { /* stays local */ }
    }
  };
  type Col = { key: string; name: string; color: string; rank: number; items: LocationTask[] };
  const columns = useMemo<Col[]>(() => {
    if (!data) return [];
    const m = new Map<string, Col>();
    const top = data.tasks.filter((t) => !t.parentId);
    if (group === "priority") {
      ([["URGENT", "Urgent", "#DC2626"], ["HIGH", "High", "#D97706"], ["NORMAL", "Normal", "#2563EB"], ["LOW", "Low", "#9CA3AF"], ["", "No priority", "#9CA3AF"]] as const).forEach(([k, name, color], i) => m.set(k, { key: k, name, color, rank: i, items: [] }));
      for (const t of top) m.get(t.priority && t.priority !== "NONE" ? t.priority : "")?.items.push(t);
      return [...m.values()];
    }
    if (group === "assignee") {
      for (const t of top) {
        if (!t.assignees.length) { if (!m.has("none")) m.set("none", { key: "none", name: "Unassigned", color: "#9CA3AF", rank: 9999, items: [] }); m.get("none")!.items.push(t); }
        for (const a of t.assignees) { const k = `u${a.id}`; if (!m.has(k)) m.set(k, { key: k, name: `${a.firstName} ${a.lastName}`.trim(), color: `hsl(${Math.round((a.id * 137.508) % 360)} 58% 40%)`, rank: m.size, items: [] }); m.get(k)!.items.push(t); }
      }
      return [...m.values()].sort((a, b) => a.rank - b.rank);
    }
    if (groupField) {
      (groupField.config?.options ?? []).forEach((o, i) => m.set(o.id, { key: o.id, name: o.name, color: o.color, rank: i, items: [] }));
      m.set("", { key: "", name: `No ${groupField.name}`, color: "#9CA3AF", rank: 9999, items: [] });
      for (const t of top) {
        const v = values[t.id]?.[groupField.id];
        const ids = Array.isArray(v) ? (v as string[]) : v ? [String(v)] : [];
        if (!ids.length) m.get("")!.items.push(t);
        for (const id of ids) m.get(id)?.items.push(t);
      }
      return [...m.values()].sort((a, b) => a.rank - b.rank);
    }
    const add = (st: St) => { const k = st.name.toLowerCase(); if (!m.has(k)) m.set(k, { key: k, name: st.name, color: st.color, rank: catRank(st.category) * 100 + m.size, items: [] }); };
    for (const l of data.lists) l.statuses.forEach(add);
    for (const t of top) if (t.status) add(t.status);
    for (const t of top) m.get((t.status?.name ?? "").toLowerCase())?.items.push(t);
    return [...m.values()].sort((a, b) => a.rank - b.rank);
  }, [data, group, groupField, values]);

  /** dropping a card on a column sets that column's value on the task */
  const drop = async (col: Col) => {
    const t = data?.tasks.find((x) => x.id === dragId);
    setDragId(null); setOverCol(null);
    if (!t || !canEdit) return;
    try {
      if (group === "status") {
        const st = data!.lists.find((l) => l.id === t.listId)?.statuses.find((x) => x.name.toLowerCase() === col.key);
        if (!st) { toast.error(`"${t.list.name}" has no "${col.name}" status.`); return; }
        if (st.id === t.status?.id) return;
        await workApi.updateTask(t.id, { statusId: st.id });
      } else if (group === "priority") {
        await workApi.updateTask(t.id, { priority: (col.key || null) as any });
      } else if (group === "assignee") {
        await workApi.updateTask(t.id, { assigneeIds: col.key === "none" ? [] : [Number(col.key.slice(1))] });
      } else if (groupField) {
        await workApi.setFieldValue(t.id, groupField.id, col.key ? (groupField.type === "labels" ? [col.key] : col.key) : null);
        await qc.invalidateQueries({ queryKey: ["work", "loc-field-values"] });
      }
      await qc.invalidateQueries({ queryKey: ["work", "loc-tasks"] });
    } catch (e: any) { toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't move it."); }
  };

  if (isError) return <p className="p-10 text-center text-[13px] text-muted-foreground">You don&apos;t have access to this channel&apos;s location.</p>;
  if (isLoading || !data) return <div className="p-6"><div className="h-40 animate-pulse rounded-xl bg-muted" /></div>;
  const shownFields = fields.filter((f) => f.id !== groupField?.id).slice(0, 8);
  const fieldRows = (t: LocationTask) => shownFields.map((f) => ({ f, v: values[t.id]?.[f.id] })).filter((x) => x.v !== undefined && x.v !== null && x.v !== "" && !(Array.isArray(x.v) && !x.v.length)).slice(0, 4);
  const showVal = (f: (typeof fields)[number], v: unknown) => {
    const opts = f.config?.options ?? [];
    if (f.type === "dropdown") { const o = opts.find((x) => x.id === v); return o ? <span className="rounded px-1.5 py-px text-[11px] font-semibold text-white" style={{ background: o.color }}>{o.name}</span> : null; }
    if (f.type === "labels") return <span className="flex flex-wrap gap-1">{(v as string[]).map((id) => opts.find((x) => x.id === id)).filter(Boolean).map((o) => <span key={o!.id} className="rounded px-1.5 py-px text-[11px] font-semibold" style={{ background: `${o!.color}22`, color: o!.color }}>{o!.name}</span>)}</span>;
    if (f.type === "checkbox") return <Check className="h-3.5 w-3.5 text-primary" />;
    if (f.type === "date") return <span>{new Date(String(v)).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>;
    if (f.type === "location") return <span className="truncate">{String((v as any)?.address ?? "")}</span>;
    if (f.type === "people") return <span>{(v as number[]).length} people</span>;
    return <span className="truncate">{String(v)}</span>;
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex items-center gap-2 px-4 pt-3">
      <label className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[12.5px] font-medium text-muted-foreground">
        Group:
        <select aria-label="Group board by" value={group} onChange={(e) => void setGroup(e.target.value)} className="bg-transparent text-foreground outline-none">
          <option value="status">Status</option><option value="assignee">Assignee</option><option value="priority">Priority</option>
          {groupFields.map((f) => <option key={f.id} value={`field:${f.id}`}>{f.name}</option>)}
        </select>
      </label>
      {canEdit && <span className="text-[12px] text-muted-foreground">Drag a card to another column to change it.</span>}
    </div>
    <div className="flex min-h-0 flex-1 gap-3 overflow-auto p-4">
      {columns.filter((c) => c.items.length || columns.length <= 6 || groupField).map((c) => (
        <section key={c.key || c.name} aria-label={c.name}
          onDragOver={(e) => { if (dragId != null && canEdit) { e.preventDefault(); setOverCol(c.key); } }}
          onDragLeave={() => setOverCol((o) => (o === c.key ? null : o))}
          onDrop={(e) => { e.preventDefault(); void drop(c); }}
          className={cn("flex min-w-[236px] max-w-[340px] shrink-0 grow basis-[236px] flex-col rounded-xl border bg-table-head transition-colors", overCol === c.key && dragId != null ? "border-primary/60 ring-2 ring-primary/15" : "border-border")} style={{ borderTopColor: c.color, borderTopWidth: 3 }}>
          <header className="flex items-center gap-2 px-3 py-2.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} /><span className="truncate text-[12.5px] font-bold uppercase tracking-[0.05em]" style={{ color: c.color }}>{c.name}</span><span className="ml-auto text-[12px] text-muted-foreground">{c.items.length}</span></header>
          <ul className="flex max-h-[calc(100vh-300px)] min-h-[60px] flex-col gap-2 overflow-y-auto px-2.5 pb-2.5">
            {c.items.map((t) => (
              <li key={`${c.key}-${t.id}`}>
                <button type="button" draggable={canEdit} onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setOverCol(null); }} onClick={() => setOpen(t.uid)}
                  className={cn("block w-full rounded-lg border border-border bg-card p-3 text-left shadow-[0_1px_2px_rgb(11_42_31/0.05)] transition hover:border-primary/30 hover:shadow-md", canEdit && "cursor-grab active:cursor-grabbing", dragId === t.id && "opacity-50")}>
                  <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    <span className="truncate">{t.list.name}</span>
                    {group !== "status" && t.status && <span className="ml-auto shrink-0 rounded px-1.5 py-px text-[10.5px] font-bold uppercase text-white" style={{ background: t.status.color }}>{t.status.name}</span>}
                  </span>
                  <span className={cn("mt-0.5 block text-[13.5px] font-medium leading-snug", t.completedAt && "text-muted-foreground line-through")}>{t.name}</span>
                  {fieldRows(t).length > 0 && (
                    <span className="mt-2 block space-y-1 text-[12px] text-muted-foreground">
                      {fieldRows(t).map(({ f, v }) => <span key={f.id} className="flex min-w-0 items-center gap-1.5"><span className="w-[72px] shrink-0 truncate text-[11px]">{f.name}</span><span className="min-w-0 truncate text-foreground">{showVal(f, v)}</span></span>)}
                    </span>
                  )}
                  <span className="mt-2.5 flex items-center gap-2.5 text-[12px]"><span className="flex -space-x-1.5">{t.assignees.slice(0, 3).map((a) => <Avatar key={a.id} user={a} size={22} />)}</span>{t.dueDate && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /><Due t={t} /></span>}<span className="ml-auto">{t.priority && <PriorityFlag priority={t.priority as any} />}</span></span>
                </button>
              </li>
            ))}
            {!c.items.length && <li className="flex h-14 items-center justify-center rounded-lg border border-dashed border-border text-[12px] text-muted-foreground">{dragId != null && canEdit ? "Drop here" : "No tasks"}</li>}
          </ul>
        </section>
      ))}
      <TaskDrawer taskUid={open} onClose={() => setOpen(null)} onOpenTask={setOpen} />
    </div>
    </div>
  );
}

/** channel tab "Calendar" for the location */
export function LocationCalendar({ src }: { src: LocSrc }) {
  const ws = useWs();
  return <TaskMonthCalendar queryKey={["work", "loc-cal", srcKey(src)]} load={(from, to) => loadWindow(ws, src, from, to)} />;
}

const DAY = 86_400_000;
const isOverdue = (t: LocationTask) => !!t.dueDate && !t.completedAt && new Date(t.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
const isActive = (t: LocationTask) => !t.completedAt && (t.status?.category ?? "").toUpperCase() === "ACTIVE";
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
function Bar({ value, className }: { value: number; className?: string }) {
  return <span className={cn("block h-1.5 overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span className="block h-full rounded-full bg-primary" style={{ width: `${value}%` }} /></span>;
}
function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "bad" | "good" }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-serif text-[28px] leading-none", tone === "bad" && "text-destructive", tone === "good" && "text-primary")}>{value}</p>
    </div>
  );
}

/** Overview: totals, progress per list, what is overdue */
export function LocationOverview({ src }: { src: LocSrc }) {
  const ws = useWs();
  const { data, isLoading, isError } = useLocationTasks(src);
  const [open, setOpen] = useState<string | null>(null);
  if (isError) return <p className="p-10 text-center text-[13px] text-muted-foreground">You don&apos;t have access to this location.</p>;
  if (isLoading || !data) return <div className="p-6"><div className="h-40 animate-pulse rounded-xl bg-muted" /></div>;
  const t = data.tasks;
  const done = t.filter((x) => x.completedAt).length;
  const weekAgo = Date.now() - 7 * DAY;
  const overdue = t.filter(isOverdue).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  return (
    <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Open" value={t.length - done} />
        <Stat label="In progress" value={t.filter(isActive).length} />
        <Stat label="Overdue" value={overdue.length} tone={overdue.length ? "bad" : undefined} />
        <Stat label="Done · 7 days" value={t.filter((x) => x.completedAt && +new Date(x.completedAt) >= weekAgo).length} tone="good" />
        <Stat label="Progress" value={`${pct(done, t.length)}%`} />
      </div>
      <section aria-label="Progress by list" className="mt-4 rounded-xl border border-border bg-card">
        <h3 className="border-b border-border px-4 py-2.5 text-[13px] font-semibold">Progress by list</h3>
        <ul className="divide-y divide-border">
          {data.lists.map((l) => {
            const lt = t.filter((x) => x.listId === l.id);
            const ld = lt.filter((x) => x.completedAt).length;
            const lo = lt.filter(isOverdue).length;
            return (
              <li key={l.id} className="flex items-center gap-4 px-4 py-2.5">
                <Link href={`/work/${ws}/list/${l.uid}`} className="w-48 shrink-0 truncate text-[13px] font-medium hover:underline">{l.name}</Link>
                <Bar value={pct(ld, lt.length)} className="flex-1" />
                <span className="w-12 text-right font-mono text-[12px]">{pct(ld, lt.length)}%</span>
                <span className="w-28 text-right font-mono text-[11.5px] text-muted-foreground">{ld}/{lt.length} done</span>
                <span className={cn("w-20 text-right font-mono text-[11.5px]", lo ? "text-destructive" : "text-muted-foreground")}>{lo} overdue</span>
              </li>
            );
          })}
          {!data.lists.length && <li className="px-4 py-3 text-[12.5px] text-muted-foreground">No lists here yet.</li>}
        </ul>
      </section>
      <section aria-label="Overdue" className="mt-4 rounded-xl border border-border bg-card">
        <h3 className="border-b border-border px-4 py-2.5 text-[13px] font-semibold">Overdue <span className="font-mono font-normal text-muted-foreground">{overdue.length}</span></h3>
        {!overdue.length ? <p className="px-4 py-3 text-[12.5px] text-muted-foreground">Nothing overdue. 👏</p> : (
          <ul className="divide-y divide-border">
            {overdue.slice(0, 12).map((x) => (
              <li key={x.id}><button type="button" onClick={() => setOpen(x.uid)} className="flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] hover:bg-accent/40"><span className="min-w-0 flex-1 truncate">{x.name}</span><span className="truncate text-[11.5px] text-muted-foreground">{x.list.name}</span><span className="flex -space-x-1.5">{x.assignees.slice(0, 3).map((a) => <Avatar key={a.id} user={a} size={20} />)}</span><span className="w-16 text-right font-mono text-[11.5px] font-semibold text-destructive">{new Date(x.dueDate!).toLocaleDateString([], { month: "short", day: "numeric" })}</span></button></li>
            ))}
          </ul>
        )}
      </section>
      <TaskDrawer taskUid={open} onClose={() => setOpen(null)} onOpenTask={setOpen} />
    </div>
  );
}

/** Team: who works here and how far along they are */
export function LocationTeam({ src }: { src: LocSrc }) {
  const { data, isLoading, isError } = useLocationTasks(src);
  const openProfile = useProfilePanel((s) => s.open);
  const [open, setOpen] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const people = useMemo(() => {
    if (!data) return [];
    const m = new Map<number, { user: LocationTask["assignees"][number]; tasks: LocationTask[] }>();
    for (const t of data.tasks) for (const a of t.assignees) {
      if (!m.has(a.id)) m.set(a.id, { user: a, tasks: [] });
      m.get(a.id)!.tasks.push(t);
    }
    const weekAgo = Date.now() - 7 * DAY;
    return [...m.values()].map((p) => {
      const done = p.tasks.filter((t) => t.completedAt);
      return { ...p, open: p.tasks.length - done.length, active: p.tasks.filter(isActive), overdue: p.tasks.filter(isOverdue), doneWeek: done.filter((t) => +new Date(t.completedAt!) >= weekAgo).length, progress: pct(done.length, p.tasks.length) };
    }).sort((a, b) => b.open - a.open);
  }, [data]);
  if (isError) return <p className="p-10 text-center text-[13px] text-muted-foreground">You don&apos;t have access to this location.</p>;
  if (isLoading || !data) return <div className="p-6"><div className="h-40 animate-pulse rounded-xl bg-muted" /></div>;
  const unassigned = data.tasks.filter((t) => !t.assignees.length && !t.completedAt).length;
  return (
    <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
      <ul aria-label="Team" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {people.map((p) => (
          <li key={p.user.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <Avatar user={p.user} size={34} />
              <button type="button" onClick={() => openProfile(p.user.id)} className="min-w-0 flex-1 text-left"><span className="block truncate text-[14px] font-semibold hover:underline">{p.user.firstName} {p.user.lastName}</span><span className="block text-[11.5px] text-muted-foreground">{p.tasks.length} {p.tasks.length === 1 ? "task" : "tasks"} here</span></button>
              <span className="font-serif text-[22px]">{p.progress}%</span>
            </div>
            <Bar value={p.progress} className="mt-3" />
            <dl className="mt-3 grid grid-cols-4 gap-1 text-center">
              {([["Open", p.open, ""], ["Working on", p.active.length, ""], ["Overdue", p.overdue.length, p.overdue.length ? "text-destructive" : ""], ["Done 7d", p.doneWeek, "text-primary"]] as const).map(([l, v, c]) => (
                <div key={l}><dt className="font-mono text-[9.5px] uppercase tracking-wide text-muted-foreground">{l}</dt><dd className={cn("text-[16px] font-semibold", c)}>{v}</dd></div>
              ))}
            </dl>
            {(p.active.length > 0 || p.overdue.length > 0) && (
              <button type="button" aria-expanded={expanded === p.user.id} onClick={() => setExpanded(expanded === p.user.id ? null : p.user.id)} className="mt-2 text-[12px] font-medium text-primary hover:underline">{expanded === p.user.id ? "Hide" : "Show"} what they&apos;re on</button>
            )}
            {expanded === p.user.id && (
              <ul className="mt-1.5 space-y-0.5">
                {[...p.overdue, ...p.active.filter((t) => !p.overdue.includes(t))].slice(0, 10).map((t) => (
                  <li key={t.id}><button type="button" onClick={() => setOpen(t.uid)} className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[12.5px] hover:bg-accent"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.status?.color ?? "#8a8f98" }} /><span className="min-w-0 flex-1 truncate">{t.name}</span>{isOverdue(t) && <span className="font-mono text-[10.5px] font-semibold text-destructive">overdue</span>}</button></li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {!people.length && <p className="py-10 text-center text-[13px] text-muted-foreground">Nobody is assigned to tasks here yet.</p>}
      {unassigned > 0 && <p className="mt-3 text-[12.5px] text-muted-foreground">{unassigned} open {unassigned === 1 ? "task has" : "tasks have"} nobody assigned.</p>}
      <TaskDrawer taskUid={open} onClose={() => setOpen(null)} onOpenTask={setOpen} />
    </div>
  );
}

/** the "Channel" tab on a Space / Folder / List page */
export function LocationChannelTab({ type, uid, locationId, label }: { type: ChatLocationType; uid: string; locationId: number; label: string }) {
  const ws = useWs();
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["work", "loc-channels", type, uid], queryFn: () => workApi.locationChannels(ws, type, uid), enabled: !!ws });
  const chans = data?.channels ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const current = chans.find((c) => c.uid === picked) ?? chans[0];
  if (current) {
    return (
      <div className="flex h-[calc(100vh-232px)] min-h-[520px] flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-1.5 text-[12px]">
          {chans.length > 1 ? (
            <div role="tablist" aria-label="Location channels" className="flex gap-1">
              {chans.map((c) => <button key={c.uid} type="button" role="tab" aria-selected={c.uid === current.uid} onClick={() => setPicked(c.uid)} className={cn("flex items-center gap-1 rounded-md px-2 py-0.5", c.uid === current.uid ? "bg-card font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}>{c.isPrivate ? <Lock className="h-3 w-3" /> : <Hash className="h-3 w-3" />}{c.name}</button>)}
            </div>
          ) : <span className="text-muted-foreground">Channel for this {type}</span>}
          <span className="flex-1" />
          <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-1 rounded-md px-2 py-0.5 font-medium text-primary hover:bg-accent"><MessageSquarePlus className="h-3.5 w-3.5" /> New channel</button>
          <Link href={`/work/${ws}/chat/${current.uid}`} className="flex items-center gap-1 rounded-md px-2 py-0.5 font-medium text-primary hover:bg-accent"><ExternalLink className="h-3.5 w-3.5" /> Open full page</Link>
        </div>
        <div className="min-h-0 flex-1"><ChannelView key={current.uid} uid={current.uid} embedded /></div>
        {creating && <CreateChannelDialog onClose={() => setCreating(false)} initialLocation={{ type, id: locationId, label }} suggestedName={label} />}
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-[720px] py-6">
      {isLoading ? <div className="h-24 animate-pulse rounded-xl bg-muted" /> : (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10"><Hash className="h-6 w-6 text-primary" /></span>
          <h2 className="mt-3 text-[16px] font-semibold">Chat about {label}</h2>
          <p className="mt-1 max-w-[420px] text-[13px] text-muted-foreground">Create a channel for this {type}. It shows this {type}&apos;s tasks as List, Board and Calendar right next to the conversation.</p>
          <button type="button" onClick={() => setCreating(true)} className="mt-4 h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground">Create channel</button>
        </div>
      )}
      {creating && <CreateChannelDialog onClose={() => setCreating(false)} initialLocation={{ type, id: locationId, label }} suggestedName={label} />}
    </div>
  );
}

/** List page header: open this list's channel, or create one */
export function LocationChannelButton({ type, uid, locationId, label }: { type: ChatLocationType; uid: string; locationId: number; label: string }) {
  const ws = useWs();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const { data } = useQuery({ queryKey: ["work", "loc-channels", type, uid], queryFn: () => workApi.locationChannels(ws, type, uid), enabled: !!ws });
  const chans = data?.channels ?? [];
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Channel" className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-[12.5px] font-medium hover:bg-accent"><Hash className="h-3.5 w-3.5" /> Channel{chans.length > 0 && <span className="font-mono text-[11px] text-muted-foreground">{chans.length}</span>}</button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-1.5">
          {chans.map((c) => (
            <Link key={c.uid} href={`/work/${ws}/chat/${c.uid}`} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-accent">{c.isPrivate ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <Hash className="h-3.5 w-3.5 text-muted-foreground" />}<span className="flex-1 truncate">{c.name}</span></Link>
          ))}
          {!chans.length && <p className="px-2 py-1.5 text-[12.5px] text-muted-foreground">No channel for this {type} yet.</p>}
          <button type="button" onClick={() => { setOpen(false); setCreating(true); }} className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-primary hover:bg-accent"><MessageSquarePlus className="h-3.5 w-3.5" /> Create channel</button>
        </PopoverContent>
      </Popover>
      {creating && <CreateChannelDialog onClose={() => setCreating(false)} initialLocation={{ type, id: locationId, label }} suggestedName={label} />}
    </>
  );
}

export type { LocationTasks };
