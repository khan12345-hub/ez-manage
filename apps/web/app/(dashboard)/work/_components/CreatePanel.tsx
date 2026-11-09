"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDot,
  FileText,
  Flag,
  LayoutDashboard,
  ListChecks,
  PenTool,
  Search,
  Tag as TagIcon,
  Users,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getRecentLists, pushRecentList, useWorkCreate } from "@/store/work-create";
import { userName, workApi, workKeys, type WorkPriority, type WorkTree, type WorkUser } from "@/services/work.api";
import { AssigneePicker, DatePicker, PriorityPicker, StatusPicker } from "./pickers";
import { ReminderForm } from "./ReminderForm";
import { AvatarStack, DueLabel, PriorityFlag, StatusGlyph } from "./primitives";

type Mode = "open" | "another" | "duplicate";
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "open", label: "Create and open", hint: "Open the new task" },
  { id: "another", label: "Create and start another", hint: "Keep the panel open, clear the form" },
  { id: "duplicate", label: "Create and duplicate", hint: "Keep the panel open with the same fields" },
];
const MODE_KEY = "ez:work:createMode";

const TABS = [
  { id: "task", label: "Task", icon: ListChecks, ready: true },
  { id: "doc", label: "Doc", icon: FileText, ready: false },
  { id: "reminder", label: "Reminder", icon: Bell, ready: true },
  { id: "whiteboard", label: "Whiteboard", icon: PenTool, ready: false },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, ready: false },
] as const;

type FlatList = { uid: string; id: number; name: string; path: string; color: string | null; spaceColor: string };

function flatten(tree: WorkTree | undefined): FlatList[] {
  if (!tree) return [];
  const out: FlatList[] = [];
  for (const s of tree.spaces) {
    for (const l of s.lists) out.push({ uid: l.uid, id: l.id, name: l.name, path: s.name, color: l.color, spaceColor: s.color });
    for (const f of s.folders)
      for (const l of f.lists) out.push({ uid: l.uid, id: l.id, name: l.name, path: `${s.name} / ${f.name}`, color: l.color, spaceColor: s.color });
  }
  return out;
}

const errMsg = (e: any) => e?.response?.data?.message?.toString?.() ?? "Something went wrong.";

/** ClickUp-style Create panel: Task tab (list picker, fields, three create modes). */
export function CreatePanel({ ws }: { ws: string }) {
  const { open, listUid: preset, setOpen } = useWorkCreate();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: tree } = useQuery({ queryKey: workKeys.tree(ws), queryFn: () => workApi.tree(ws), enabled: !!ws && open, staleTime: 30_000 });
  const lists = useMemo(() => flatten(tree), [tree]);

  const [listUid, setListUid] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [statusId, setStatusId] = useState<number | null>(null);
  const [assignees, setAssignees] = useState<WorkUser[]>([]);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [priority, setPriority] = useState<WorkPriority | null>(null);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [mode, setMode] = useState<Mode>("open");
  const [tab, setTab] = useState<"task" | "reminder">("task");

  useEffect(() => {
    if (!open) return;
    try {
      const m = localStorage.getItem(MODE_KEY) as Mode | null;
      if (m && MODES.some((x) => x.id === m)) setMode(m);
    } catch {}
  }, [open]);

  // pick the preset list, else the most recent one, else the first list
  useEffect(() => {
    if (!open || !lists.length) return;
    setListUid((cur) => {
      if (preset && lists.some((l) => l.uid === preset)) return preset;
      if (cur && lists.some((l) => l.uid === cur)) return cur;
      const recent = getRecentLists(ws).find((u) => lists.some((l) => l.uid === u));
      return recent ?? lists[0]!.uid;
    });
  }, [open, preset, lists, ws]);

  const { data: list } = useQuery({ queryKey: workKeys.list(listUid ?? ""), queryFn: () => workApi.getList(listUid!), enabled: !!listUid && open, staleTime: 30_000 });
  const { data: tags = [] } = useQuery({ queryKey: ["work", "tags", list?.spaceId], queryFn: () => workApi.tags(list!.spaceId), enabled: !!list?.spaceId && open });

  // a different list may have other statuses, members and tags
  useEffect(() => {
    setStatusId(null);
    setTagIds([]);
    setAssignees((a) => (list ? a.filter((u) => list.members.some((m) => m.id === u.id)) : a));
  }, [list?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setName("");
    setDescription("");
    setStatusId(null);
    setAssignees([]);
    setDueDate(null);
    setPriority(null);
    setTagIds([]);
  };

  const create = useMutation({
    mutationFn: () =>
      workApi.createTask(list!.id, {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(statusId ? { statusId } : {}),
        ...(assignees.length ? { assigneeIds: assignees.map((a) => a.id) } : {}),
        ...(dueDate ? { dueDate } : {}),
        ...(priority ? { priority } : {}),
        ...(tagIds.length ? { tagIds } : {}),
      }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: workKeys.tasks(list!.id) });
      qc.invalidateQueries({ queryKey: ["work", "my"] });
      qc.invalidateQueries({ queryKey: workKeys.tree(ws) });
      pushRecentList(ws, list!.uid);
      if (mode === "open") {
        setOpen(false);
        resetForm();
        router.push(`/work/${ws}/list/${list!.uid}?task=${t.uid}`);
      } else if (mode === "another") {
        resetForm();
        toast.success(`Created "${t.name}"`);
      } else {
        toast.success(`Created "${t.name}". Fields kept for the next one.`);
      }
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const chooseMode = (m: Mode) => {
    setMode(m);
    try { localStorage.setItem(MODE_KEY, m); } catch {}
  };
  const canSubmit = !!list?.access.canEdit && !!name.trim() && !create.isPending;
  const submit = () => canSubmit && create.mutate();
  const current = lists.find((l) => l.uid === listUid);
  const status = list?.statuses.find((s) => s.id === statusId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[760px]" showCloseButton>
        <DialogTitle className="sr-only">Create</DialogTitle>
        <DialogDescription className="sr-only">Create a task in a list</DialogDescription>

        {/* tabs */}
        <div role="tablist" aria-label="Create" className="flex gap-1 overflow-x-auto border-b border-border bg-table-head px-4 pt-3 pr-12">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={t.id === tab}
              disabled={!t.ready}
              onClick={() => (t.id === "task" || t.id === "reminder") && setTab(t.id)}
              title={t.ready ? undefined : "Coming soon"}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium",
                t.id === tab ? "border-primary text-primary" : t.ready ? "border-transparent text-muted-foreground hover:text-foreground" : "border-transparent text-muted-foreground/60",
              )}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
              {!t.ready && <span className="rounded bg-muted px-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">soon</span>}
            </button>
          ))}
        </div>

        {tab === "reminder" && <ReminderForm ws={ws} onDone={() => setOpen(false)} />}
        <form
          hidden={tab !== "task"}
          className="px-5 pb-4 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {/* list picker */}
          <ListPicker lists={lists} ws={ws} value={current} onChange={setListUid} />

          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Task name"
            aria-label="Task name"
            maxLength={500}
            className="mt-3 w-full bg-transparent font-serif text-[28px] leading-tight tracking-tight outline-none placeholder:text-muted-foreground/50"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description…"
            aria-label="Description"
            rows={3}
            className="mt-2 w-full resize-none rounded-lg border border-transparent bg-transparent px-0 py-1 text-[14px] leading-relaxed outline-none placeholder:text-muted-foreground/70 focus:border-border focus:px-2 [field-sizing:content] max-h-48"
          />

          {/* field chips */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusPicker statuses={list?.statuses ?? []} value={statusId ?? list?.statuses[0]?.id ?? null} disabled={!list} onChange={(id) => setStatusId(id)}>
              <button type="button" className={chip(!!status)}>
                {status ? <StatusGlyph status={status} size={13} /> : <CircleDot className="h-3.5 w-3.5" />}
                {status?.name ?? list?.statuses[0]?.name ?? "Status"}
              </button>
            </StatusPicker>
            <AssigneePicker members={list?.members ?? []} value={assignees} disabled={!list} onChange={(ids) => setAssignees((list?.members ?? []).filter((m) => ids.includes(m.id)))}>
              <button type="button" className={chip(assignees.length > 0)}>
                {assignees.length ? <AvatarStack users={assignees} size={18} /> : <Users className="h-3.5 w-3.5" />}
                {assignees.length === 1 ? userName(assignees[0]!) : assignees.length ? `${assignees.length} people` : "Assignee"}
              </button>
            </AssigneePicker>
            <DatePicker label="Due date" value={dueDate} onChange={setDueDate}>
              <button type="button" className={chip(!!dueDate)}>
                <CalendarDays className="h-3.5 w-3.5" />
                {dueDate ? <DueLabel task={{ dueDate, completedAt: null }} /> : "Due date"}
              </button>
            </DatePicker>
            <PriorityPicker value={priority} onChange={setPriority}>
              <button type="button" className={chip(!!priority)}>
                {priority ? <PriorityFlag priority={priority} showLabel /> : <><Flag className="h-3.5 w-3.5" /> Priority</>}
              </button>
            </PriorityPicker>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className={chip(tagIds.length > 0)} disabled={!list}>
                  <TagIcon className="h-3.5 w-3.5" />
                  {tagIds.length ? tags.filter((t) => tagIds.includes(t.id)).map((t) => t.name).join(", ") : "Tags"}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-1">
                {tags.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">No tags in this space yet. Add them from a task.</p>}
                {tags.map((t) => {
                  const on = tagIds.includes(t.id);
                  return (
                    <button key={t.id} type="button" onClick={() => setTagIds(on ? tagIds.filter((x) => x !== t.id) : [...tagIds, t.id])} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent">
                      <span className="rounded px-1.5 py-px text-[11.5px] font-semibold" style={{ background: `${t.color}1f`, color: t.color }}>{t.name}</span>
                      {on && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          </div>

          {list && !list.access.canEdit && <p className="mt-3 text-[12.5px] text-destructive">You can view this list but not add tasks to it.</p>}

          {/* footer */}
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-3">
            <span className="hidden text-[12px] text-muted-foreground sm:block">Enter to create · Esc to close</span>
            <div className="ml-auto flex">
              <button
                type="submit"
                disabled={!canSubmit}
                title={MODES.find((m) => m.id === mode)!.label}
                className="h-9 rounded-l-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground hover:bg-forest/90 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"
              >
                {create.isPending ? "Creating…" : "Create Task"}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label="Create options" className="h-9 rounded-r-lg border-l border-white/20 bg-forest px-2 text-forest-foreground hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground">
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {MODES.map((m) => (
                    <DropdownMenuItem key={m.id} onClick={() => chooseMode(m.id)} className="flex items-start gap-2">
                      <span className="mt-0.5 w-4">{mode === m.id && <Check className="h-3.5 w-3.5 text-primary" />}</span>
                      <span>
                        <span className="block text-[13px] font-medium">{m.label}</span>
                        <span className="block text-[11.5px] text-muted-foreground">{m.hint}</span>
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const chip = (active?: boolean) =>
  cn(
    "flex h-8 max-w-[220px] items-center gap-1.5 truncate rounded-md border px-2.5 text-[12.5px] font-medium transition-colors disabled:opacity-50",
    active ? "border-primary/30 bg-accent/60 text-foreground" : "border-dashed border-border text-muted-foreground hover:border-solid hover:text-foreground",
  );

function ListPicker({ lists, ws, value, onChange }: { lists: FlatList[]; ws: string; value: FlatList | undefined; onChange: (uid: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const recents = useMemo(() => (open ? getRecentLists(ws).map((u) => lists.find((l) => l.uid === u)).filter(Boolean) as FlatList[] : []), [open, ws, lists]);
  const term = q.trim().toLowerCase();
  const found = term ? lists.filter((l) => `${l.path} ${l.name}`.toLowerCase().includes(term)) : lists;
  const byPath = new Map<string, FlatList[]>();
  for (const l of found) byPath.set(l.path, [...(byPath.get(l.path) ?? []), l]);
  const pick = (uid: string) => {
    onChange(uid);
    setOpen(false);
    setQ("");
  };
  const Item = ({ l, showPath }: { l: FlatList; showPath?: boolean }) => (
    <button type="button" onClick={() => pick(l.uid)} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent", value?.uid === l.uid && "bg-accent/60 font-medium")}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: l.color ?? l.spaceColor }} />
      <span className="truncate">{l.name}</span>
      {showPath && <span className="ml-auto truncate text-[11px] text-muted-foreground">{l.path}</span>}
    </button>
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Choose list" className="flex h-8 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-[12.5px] font-medium hover:bg-accent">
          <span className="h-2 w-2 rounded-full" style={{ background: value?.color ?? value?.spaceColor ?? "var(--muted-foreground)" }} />
          {value ? <><span className="text-muted-foreground">{value.path} /</span> {value.name}</> : "Choose a list"}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <label className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lists" aria-label="Search lists" className="w-full bg-transparent text-[13px] outline-none" />
        </label>
        <div className="max-h-72 overflow-y-auto p-1">
          {!term && recents.length > 0 && (
            <>
              <p className="px-2 pb-0.5 pt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Recents</p>
              {recents.map((l) => <Item key={`r${l.uid}`} l={l} showPath />)}
            </>
          )}
          {[...byPath.entries()].map(([path, ls]) => (
            <div key={path}>
              <p className="px-2 pb-0.5 pt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{path}</p>
              {ls.map((l) => <Item key={l.uid} l={l} />)}
            </div>
          ))}
          {found.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">No lists match.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
