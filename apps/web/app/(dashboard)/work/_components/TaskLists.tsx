"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronRight, Folder, Home, ListChecks, ListX, MoreHorizontal, Plus, Search, SquareArrowOutUpRight } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { workApi, workKeys, type WorkListNode, type WorkTaskDetail } from "@/services/work.api";

const RECENT_KEY = "ez:work:recentLists";
const errMsg = (e: any) => e?.response?.data?.message?.toString?.() ?? "Something went wrong.";

function recent(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
}
function remember(id: number) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recent().filter((x) => x !== id)].slice(0, 5)));
  } catch {}
}

export type PickMode = "move" | "add";

function useTaskListActions(task: WorkTaskDetail) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: workKeys.task(task.uid) });
    qc.invalidateQueries({ queryKey: ["work", "tasks"] });
    qc.invalidateQueries({ queryKey: ["work", "tree"] });
    qc.invalidateQueries({ queryKey: ["work", "my"] });
  };
  const move = useMutation({
    mutationFn: (listId: number) => workApi.updateTask(task.id, { listId }),
    onSuccess: () => { refresh(); toast.success("Task moved"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const add = useMutation({
    mutationFn: (listId: number) => workApi.addTaskToList(task.id, listId),
    onSuccess: () => { refresh(); toast.success("Added to the list"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: (listId: number) => workApi.removeTaskFromList(task.id, listId),
    onSuccess: () => { refresh(); toast.success("Removed from the list"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const home = useMutation({
    mutationFn: (listId: number) => workApi.setTaskHome(task.id, listId),
    onSuccess: () => { refresh(); toast.success("Home list changed"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return { move, add, remove, home };
}

/** "Move task / Add to List" picker: recents + browse every space, folder and list. */
export function ListPicker({
  task,
  open,
  onOpenChange,
  mode,
  onModeChange,
  children,
}: {
  task: WorkTaskDetail;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: PickMode;
  onModeChange: (m: PickMode) => void;
  children: React.ReactNode;
}) {
  const { workspaceId: ws } = useParams<{ workspaceId: string }>();
  const { data: tree } = useQuery({ queryKey: workKeys.tree(ws), queryFn: () => workApi.tree(ws), enabled: open && !!ws });
  const { move, add } = useTaskListActions(task);
  const [q, setQ] = useState("");
  const [shut, setShut] = useState<Record<string, boolean>>({});
  const inList = new Set([task.listId, ...(task.otherLists ?? []).map((l) => l.id)]);
  const all = useMemo(() => {
    const out: (WorkListNode & { path: string })[] = [];
    for (const s of tree?.spaces ?? []) {
      for (const l of s.lists) out.push({ ...l, path: s.name });
      for (const f of s.folders) for (const l of f.lists) out.push({ ...l, path: `${s.name} / ${f.name}` });
    }
    return out;
  }, [tree]);
  const recents = recent().map((id) => all.find((l) => l.id === id)).filter(Boolean).slice(0, 3) as typeof all;
  const pick = (id: number) => {
    if (mode === "move" ? id === task.listId : inList.has(id)) return;
    remember(id);
    (mode === "move" ? move : add).mutate(id);
    onOpenChange(false);
  };
  const row = (l: WorkListNode, depth: number, path?: string) => {
    const here = mode === "move" ? l.id === task.listId : inList.has(l.id);
    return (
      <button
        key={`${path ?? ""}${l.id}`}
        type="button"
        role="option"
        aria-selected={here}
        onClick={() => pick(l.id)}
        className={cn("flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-[13px] hover:bg-accent", here && "bg-accent/60")}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <ListChecks className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{l.name}</span>
        {path && <span className="max-w-[45%] truncate text-[11px] text-muted-foreground">{path}</span>}
        {here && <Check className="h-3.5 w-3.5 text-primary" />}
      </button>
    );
  };
  const hits = q.trim() ? all.filter((l) => l.name.toLowerCase().includes(q.trim().toLowerCase())) : null;

  return (
    <Popover open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setQ(""); }}>
      {children}
      <PopoverContent align="start" className="w-72 p-0">
        <div className="p-2">
          <div className="flex h-8 items-center gap-2 rounded-md border border-border px-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search lists" className="h-full flex-1 bg-transparent text-[13px] outline-none" />
          </div>
        </div>
        <div role="tablist" className="flex gap-4 border-b border-border px-3">
          {(["move", "add"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => onModeChange(m)} className={cn("-mb-px border-b-2 pb-1.5 text-[12.5px] font-medium", mode === m ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {m === "move" ? "Move task" : "Add to List"}
            </button>
          ))}
        </div>
        <div role="listbox" aria-label="Lists" className="max-h-80 overflow-y-auto p-1.5">
          {hits ? (
            hits.length ? hits.map((l) => row(l, 0, l.path)) : <p className="px-2 py-3 text-[12.5px] text-muted-foreground">No list matches.</p>
          ) : (
            <>
              {recents.length > 0 && (
                <>
                  <p className="px-2 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">Recents</p>
                  {recents.map((l) => row(l, 0, l.path))}
                </>
              )}
              <p className="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">Browse</p>
              {(tree?.spaces ?? []).map((s) => {
                const closed = shut[`s${s.id}`] ?? s.id !== task.list.spaceId;
                return (
                  <div key={s.id}>
                    <button type="button" onClick={() => setShut({ ...shut, [`s${s.id}`]: !closed })} aria-expanded={!closed} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium hover:bg-accent">
                      <span className="flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold text-white" style={{ background: s.color }}>{s.name.slice(0, 1).toUpperCase()}</span>
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      {closed ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                    {!closed && (
                      <>
                        {s.folders.map((f) => {
                          const fc = shut[`f${f.id}`] ?? false;
                          return (
                            <div key={f.id}>
                              <button type="button" onClick={() => setShut({ ...shut, [`f${f.id}`]: !fc })} className="flex w-full items-center gap-2 rounded-md py-1.5 pl-[22px] pr-2 text-left text-[13px] hover:bg-accent">
                                <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                                {fc ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                              </button>
                              {!fc && f.lists.map((l) => row(l, 2))}
                            </div>
                          );
                        })}
                        {s.lists.map((l) => row(l, 1))}
                      </>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Breadcrumb tail: "+" to add / move, and "+N" for the other lists the task is in. */
export function TaskListsControl({ task, picker, setPicker, mode, setMode }: { task: WorkTaskDetail; picker: boolean; setPicker: (o: boolean) => void; mode: PickMode; setMode: (m: PickMode) => void }) {
  const { workspaceId: ws } = useParams<{ workspaceId: string }>();
  const { remove, home } = useTaskListActions(task);
  const others = task.otherLists ?? [];
  const canEdit = task.access.canEdit;
  const [chip, setChip] = useState(false);
  return (
    <ListPicker task={task} open={picker} onOpenChange={setPicker} mode={mode} onModeChange={setMode}>
      <PopoverAnchor asChild>
        <span className="inline-flex items-center gap-1 align-middle">
          {others.length > 0 ? (
            <Popover open={chip} onOpenChange={setChip}>
              <PopoverTrigger asChild>
                <button type="button" aria-label={`In ${others.length} other ${others.length === 1 ? "list" : "lists"}`} className="flex h-5 items-center gap-0.5 rounded-md bg-muted px-1.5 font-mono text-[10.5px] normal-case tracking-normal text-foreground hover:bg-accent">
                  +{others.length} <ChevronDown className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 p-1.5">
                <p className="px-2 pb-1 pt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Other lists</p>
                {others.map((l) => (
                  <div key={l.id} className="group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-accent/60">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white" style={{ background: l.space.color }}>{l.space.name.slice(0, 1).toUpperCase()}</span>
                    <span className="text-muted-foreground">/</span>
                    {l.folder && <><Folder className="h-3.5 w-3.5 text-muted-foreground" /><span className="truncate text-muted-foreground">{l.folder.name}</span><span className="text-muted-foreground">/</span></>}
                    <ListChecks className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-medium">{l.name}</span>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <button type="button" aria-label={`Options for ${l.name}`} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" side="right" className="w-56">
                        {canEdit && (
                          <DropdownMenuItem onClick={() => { home.mutate(l.id); setChip(false); }}>
                            <Home className="mr-2 h-4 w-4" />
                            <span className="flex flex-col"><span>Set as home List</span><span className="text-[11px] text-muted-foreground">Use statuses from this List</span></span>
                          </DropdownMenuItem>
                        )}
                        {canEdit && <DropdownMenuItem onClick={() => remove.mutate(l.id)}><ListX className="mr-2 h-4 w-4" /> Remove task from this List</DropdownMenuItem>}
                        <DropdownMenuItem asChild>
                          <Link href={`/work/${ws}/list/${l.uid}`}><SquareArrowOutUpRight className="mr-2 h-4 w-4" /> Go to the List</Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
                {canEdit && (
                  <button type="button" onClick={() => { setChip(false); setMode("add"); setPicker(true); }} className="mt-1 flex w-full items-center gap-2 border-t border-border px-2 pb-1 pt-2 text-left text-[13px] text-muted-foreground hover:text-foreground">
                    <Plus className="h-3.5 w-3.5" /> Add to another List
                  </button>
                )}
              </PopoverContent>
            </Popover>
          ) : (
            canEdit &&
            !task.parentId && (
              <button type="button" aria-label="Add to another list or move" title="Add to List / Move" onClick={() => { setMode("add"); setPicker(true); }} className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                <Plus className="h-3.5 w-3.5" />
              </button>
            )
          )}
        </span>
      </PopoverAnchor>
    </ListPicker>
  );
}
