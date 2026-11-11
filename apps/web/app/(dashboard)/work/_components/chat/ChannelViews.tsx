"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Columns3, ExternalLink, FileText, List as ListIcon, ListChecks, Lock, MessageSquare, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { userName, workApi, workKeys, type ChannelViewKind, type ChannelViewTab, type WorkUser } from "@/services/work.api";
import { ListView } from "../ListView";
import { BoardView } from "../BoardView";
import { TaskDrawer } from "../TaskDrawer";
import { useListTasks, useWorkList } from "../hooks";
import { DEFAULT_VIEW, type ViewSettings } from "../viewSettings";
import { RichText } from "./ChatMessages";
import { useWs } from "./useChat";

export const channelViewsKey = (uid: string) => ["work", "chat-views", uid] as const;
export function useChannelViews(uid: string) {
  return useQuery({ queryKey: channelViewsKey(uid), queryFn: () => workApi.channelViews(uid), enabled: !!uid });
}

const KIND: Record<ChannelViewKind, { label: string; icon: typeof ListIcon; hint: string }> = {
  list: { label: "List", icon: ListIcon, hint: "Tasks of a list, right in the channel" },
  board: { label: "Board", icon: Columns3, hint: "A list's tasks as a board" },
  doc: { label: "Doc", icon: FileText, hint: "Notes, agendas and decisions" },
};
const err = (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Something went wrong.");

/** tab bar under the channel header: Chat + List / Board / Doc views (ClickUp "Channel Views") */
export function ChannelViewTabs({ uid, views, active, canEdit, onSelect, builtins = [] }: { uid: string; views: ChannelViewTab[]; active: number | string | null; canEdit: boolean; onSelect: (id: number | string | null) => void; builtins?: { id: string; label: string; icon: typeof ListIcon }[] }) {
  const ws = useWs();
  const qc = useQueryClient();
  const [adding, setAdding] = useState<ChannelViewKind | null>(null);
  const [renaming, setRenaming] = useState<ChannelViewTab | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: channelViewsKey(uid) });
  const remove = useMutation({ mutationFn: (id: number) => workApi.deleteChannelView(id), onSuccess: (_, id) => { if (active === id) onSelect(null); refresh(); toast.success("View removed"); }, onError: err });
  const reorder = useMutation({ mutationFn: (ids: number[]) => workApi.reorderChannelViews(uid, ids), onSuccess: (rows) => qc.setQueryData(channelViewsKey(uid), rows), onError: err });
  const move = (i: number, d: -1 | 1) => {
    const ids = views.map((v) => v.id);
    const [x] = ids.splice(i, 1);
    ids.splice(i + d, 0, x!);
    reorder.mutate(ids);
  };
  const tab = (id: number | string | null, label: string, Icon: typeof ListIcon, locked?: boolean) => (
    <button type="button" role="tab" aria-selected={active === id} onClick={() => onSelect(id)} className={cn("-mb-px flex h-9 items-center gap-1.5 border-b-2 px-2.5 text-[12.5px] font-medium", active === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
      <Icon className="h-3.5 w-3.5" /> <span className="max-w-[160px] truncate">{label}</span> {locked && <Lock className="h-3 w-3" aria-label="No access" />}
    </button>
  );
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border bg-card px-4">
      <div role="tablist" aria-label="Channel views" className="flex items-center gap-0.5">
        {tab(null, "Chat", MessageSquare)}
        {builtins.map((b) => <span key={b.id}>{tab(b.id, b.label, b.icon)}</span>)}
        {views.map((v, i) => (
          <div key={v.id} className="group flex items-center">
            {tab(v.id, v.name, KIND[v.kind].icon, v.locked)}
            {canEdit && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label={`${v.name} view options`} className={cn("rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:visible", active === v.id ? "visible" : "invisible group-hover:visible")}><MoreHorizontal className="h-3.5 w-3.5" /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onClick={() => setRenaming(v)}><Pencil className="mr-2 h-4 w-4" /> Rename</DropdownMenuItem>
                  {i > 0 && <DropdownMenuItem onClick={() => move(i, -1)}><ArrowLeft className="mr-2 h-4 w-4" /> Move left</DropdownMenuItem>}
                  {i < views.length - 1 && <DropdownMenuItem onClick={() => move(i, 1)}><ArrowRight className="mr-2 h-4 w-4" /> Move right</DropdownMenuItem>}
                  {v.list && <DropdownMenuItem asChild><Link href={`/work/${ws}/list/${v.list.uid}`}><ExternalLink className="mr-2 h-4 w-4" /> Open list</Link></DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => window.confirm(`Remove the "${v.name}" view from this channel?${v.kind === "doc" ? " The doc is deleted." : " The list itself is not changed."}`) && remove.mutate(v.id)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Remove view</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Add view" title="Add view" className="ml-1 flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="h-3.5 w-3.5" /> View</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {(Object.keys(KIND) as ChannelViewKind[]).map((k) => {
              const K = KIND[k];
              return (
                <DropdownMenuItem key={k} onClick={() => setAdding(k)}>
                  <K.icon className="mr-2 h-4 w-4" />
                  <span><span className="block">{K.label}</span><span className="block text-[11px] text-muted-foreground">{K.hint}</span></span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {adding && <AddViewDialog uid={uid} kind={adding} onClose={() => setAdding(null)} onAdded={(v) => { qc.setQueryData<ChannelViewTab[]>(channelViewsKey(uid), (rows) => [...(rows ?? []).filter((r) => r.id !== v.id), v]); onSelect(v.id); refresh(); }} />}
      {renaming && <RenameViewDialog uid={uid} view={renaming} onClose={() => setRenaming(null)} />}
    </div>
  );
}

function AddViewDialog({ uid, kind, onClose, onAdded }: { uid: string; kind: ChannelViewKind; onClose: () => void; onAdded: (v: ChannelViewTab) => void }) {
  const ws = useWs();
  const { data: tree } = useQuery({ queryKey: workKeys.tree(ws), queryFn: () => workApi.tree(ws), enabled: kind !== "doc" });
  const [q, setQ] = useState("");
  const [listId, setListId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const lists = useMemo(() => (tree?.spaces ?? []).flatMap((s) => [...s.lists.map((l) => ({ id: l.id, name: l.name, path: s.name })), ...s.folders.flatMap((f) => f.lists.map((l) => ({ id: l.id, name: l.name, path: `${s.name} / ${f.name}` })))]), [tree]);
  const shown = lists.filter((l) => `${l.path} ${l.name}`.toLowerCase().includes(q.toLowerCase()));
  const add = useMutation({
    mutationFn: () => workApi.addChannelView(uid, { kind, name: name.trim() || undefined, ...(kind !== "doc" ? { listId: listId! } : {}) }),
    onSuccess: (v) => { toast.success(`${KIND[kind].label} view added`); onAdded(v); onClose(); },
    onError: err,
  });
  const ready = kind === "doc" || !!listId;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogTitle>Add {KIND[kind].label} view</DialogTitle>
        <DialogDescription>{kind === "doc" ? "A shared doc everyone in the channel can read. People with Edit access can change it." : "Show a Work list in this channel. People still need access to the list to see its tasks."}</DialogDescription>
        <input autoFocus={kind === "doc"} value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "doc" ? "Doc name, e.g. Meeting notes" : "View name (optional, defaults to the list name)"} aria-label="View name" maxLength={60} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[14px] outline-none focus:border-primary/50" />
        {kind !== "doc" && (
          <>
            <label className="flex h-9 items-center gap-2 rounded-lg border border-border px-2.5"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a list" aria-label="Find a list" className="w-full bg-transparent text-[13px] outline-none" /></label>
            <ul role="listbox" aria-label="Lists" className="max-h-56 overflow-y-auto rounded-lg border border-border p-1">
              {shown.map((l) => (
                <li key={l.id}>
                  <button type="button" role="option" aria-selected={listId === l.id} onClick={() => setListId(l.id)} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent", listId === l.id && "bg-primary/10 font-medium")}>
                    <ListChecks className="h-3.5 w-3.5 text-muted-foreground" /> <span className="flex-1 truncate">{l.name}</span> <span className="truncate text-[11px] text-muted-foreground">{l.path}</span>
                  </button>
                </li>
              ))}
              {!shown.length && <li className="px-2 py-3 text-[12.5px] text-muted-foreground">{tree ? "No list matches." : "Loading…"}</li>}
            </ul>
          </>
        )}
        <div className="flex justify-end">
          <button type="button" disabled={!ready || add.isPending} onClick={() => add.mutate()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">Add view</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RenameViewDialog({ uid, view, onClose }: { uid: string; view: ChannelViewTab; onClose: () => void }) {
  const qc = useQueryClient();
  const [v, setV] = useState(view.name);
  const save = useMutation({
    mutationFn: () => workApi.updateChannelView(view.id, { name: v.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: channelViewsKey(uid) }); toast.success("View renamed"); onClose(); },
    onError: err,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogTitle>Rename view</DialogTitle>
        <DialogDescription className="sr-only">New view name</DialogDescription>
        <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && v.trim() && save.mutate()} aria-label="New view name" maxLength={60} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[14px] outline-none focus:border-primary/50" />
        <div className="flex justify-end"><button type="button" disabled={!v.trim() || save.isPending} onClick={() => save.mutate()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">Save</button></div>
      </DialogContent>
    </Dialog>
  );
}

/** the body of a view tab */
export function ChannelViewPanel({ uid, view, canEdit, members }: { uid: string; view: ChannelViewTab; canEdit: boolean; members: WorkUser[] }) {
  if (view.locked || (view.kind !== "doc" && !view.list)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
        <Lock className="h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-[14px] font-semibold">You don&apos;t have access to this list</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">Ask a Work admin to share it with you, or the list was archived.</p>
      </div>
    );
  }
  if (view.kind === "doc") return <DocView key={view.id} uid={uid} view={view} canEdit={canEdit} members={members} />;
  return <EmbeddedList key={view.id} listUid={view.list!.uid} kind={view.kind} />;
}

function EmbeddedList({ listUid, kind }: { listUid: string; kind: "list" | "board" }) {
  const ws = useWs();
  const { data: list, isError } = useWorkList(listUid);
  const { data: tasks = [] } = useListTasks(list?.id);
  const [vs, setVs] = useState<ViewSettings>(DEFAULT_VIEW);
  const [taskUid, setTaskUid] = useState<string | null>(null);
  if (isError) return <p className="p-10 text-center text-[13px] text-muted-foreground">This list isn&apos;t available.</p>;
  if (!list) return <div className="p-6"><div className="h-40 animate-pulse rounded-xl bg-muted" /></div>;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-5 py-2 text-[12px] text-muted-foreground">
        <span className="truncate">{list.space.name}{list.folder ? ` / ${list.folder.name}` : ""} / <strong className="text-foreground">{list.name}</strong></span>
        <span className="font-mono">· {tasks.filter((t) => !t.parentId && !t.completedAt).length} open</span>
        <Link href={`/work/${ws}/list/${list.uid}${kind === "board" ? "?view=board" : ""}`} className="ml-auto flex items-center gap-1 font-medium text-primary hover:underline"><ExternalLink className="h-3 w-3" /> Open list</Link>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-4">
        {kind === "board" ? <BoardView list={list} tasks={tasks} onOpenTask={setTaskUid} /> : <ListView list={list} tasks={tasks} view={vs} onView={setVs} onOpenTask={setTaskUid} />}
      </div>
      <TaskDrawer taskUid={taskUid} onClose={() => setTaskUid(null)} onOpenTask={setTaskUid} />
    </div>
  );
}

/** a shared markdown doc: editors type (auto-saved), everyone reads it formatted */
function DocView({ uid, view, canEdit, members }: { uid: string; view: ChannelViewTab; canEdit: boolean; members: WorkUser[] }) {
  const qc = useQueryClient();
  const [text, setText] = useState(view.content ?? "");
  const [editing, setEditing] = useState(canEdit && !(view.content ?? "").trim());
  const [status, setStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // someone else saved: take their text unless we are mid-edit
  useEffect(() => { if (!dirty.current) setText(view.content ?? ""); }, [view.content]);
  const save = useMutation({
    mutationFn: (content: string) => workApi.updateChannelView(view.id, { content }),
    onMutate: () => setStatus("saving"),
    onSuccess: (v) => { dirty.current = false; setStatus("saved"); qc.setQueryData<ChannelViewTab[]>(channelViewsKey(uid), (rows) => rows?.map((r) => (r.id === v.id ? v : r))); },
    onError: (e) => { setStatus("unsaved"); err(e); },
  });
  const flush = () => { if (timer.current) clearTimeout(timer.current); if (dirty.current) save.mutate(text); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const onChange = (v: string) => {
    setText(v);
    dirty.current = true;
    setStatus("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save.mutate(v), 900);
  };
  const by = view.updatedBy ? userName(view.updatedBy) : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-6 py-2 text-[12px] text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        <span aria-live="polite">{status === "saving" ? "Saving…" : status === "unsaved" ? "Unsaved changes" : by ? `Last edited by ${by} · ${new Date(view.updatedAt).toLocaleString()}` : "Saved"}</span>
        {canEdit && (
          <div role="group" aria-label="Doc mode" className="ml-auto flex rounded-md border border-border p-0.5">
            <button type="button" aria-pressed={editing} onClick={() => setEditing(true)} className={cn("rounded px-2 py-0.5 font-medium", editing ? "bg-accent text-foreground" : "hover:text-foreground")}>Edit</button>
            <button type="button" aria-pressed={!editing} onClick={() => { flush(); setEditing(false); }} className={cn("rounded px-2 py-0.5 font-medium", !editing ? "bg-accent text-foreground" : "hover:text-foreground")}>Preview</button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-[820px] px-8 py-6">
          <h2 className="mb-3 font-serif text-[26px] leading-tight">{view.name}</h2>
          {editing ? (
            <textarea autoFocus value={text} onChange={(e) => onChange(e.target.value)} onBlur={flush} aria-label="Doc content" placeholder={"Start writing… Markdown works: **bold**, _italic_, - lists, 1. numbered, > quotes, ``` code"} className="min-h-[55vh] w-full resize-none rounded-lg border border-border bg-background p-4 font-mono text-[13px] leading-relaxed outline-none focus:border-primary/50" />
          ) : text.trim() ? (
            <article aria-label="Doc" className="text-[14px] leading-relaxed"><RichText text={text} members={members} /></article>
          ) : (
            <p className="text-[13px] text-muted-foreground">This doc is empty.{canEdit ? " Click Edit to start writing." : ""}</p>
          )}
        </div>
      </div>
    </div>
  );
}
