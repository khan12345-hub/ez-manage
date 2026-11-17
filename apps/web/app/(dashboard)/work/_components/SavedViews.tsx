"use client";

/*
 * Saved views (ClickUp style): every list / folder / space has named views shared with everyone
 * who can open it. Tabs here; rename, duplicate, move, delete from the tab's ⋯ menu; "+ View" adds.
 */

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity, BarChart3, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, ClipboardList, Columns3, Copy, ExternalLink, FileText,
  FolderOpen, GanttChartSquare, Gauge, GitFork, Globe, LayoutGrid, List as ListIcon, Map as MapIcon, MoreHorizontal, Pencil, Table2, Trash2, Users,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { workApi, type SavedView, type ViewLocation } from "@/services/work.api";
import { AddViewMenu, type WorkModule } from "./AddViewMenu";
import { EmbedFrame, type EmbedKind } from "./MoreViews";
import { DocEditor } from "./DocEditor";
import { FormEditor, linkOf, type FormRow } from "./FormEditor";

export const KIND_META: Record<string, { label: string; icon: typeof ListIcon; color: string }> = {
  list: { label: "List", icon: ListIcon, color: "#475569" },
  board: { label: "Board", icon: Columns3, color: "#2563EB" },
  calendar: { label: "Calendar", icon: CalendarDays, color: "#EA580C" },
  table: { label: "Table", icon: Table2, color: "#16A34A" },
  gallery: { label: "Gallery", icon: LayoutGrid, color: "#7C3AED" },
  dashboard: { label: "Dashboard", icon: BarChart3, color: "#9333EA" },
  gantt: { label: "Gantt", icon: GanttChartSquare, color: "#DC2626" },
  timeline: { label: "Timeline", icon: CalendarRange, color: "#EA580C" },
  workload: { label: "Workload", icon: Gauge, color: "#0D9488" },
  activity: { label: "Activity", icon: Activity, color: "#0284C7" },
  mindmap: { label: "Mind Map", icon: GitFork, color: "#DB2777" },
  team: { label: "Team", icon: Users, color: "#9333EA" },
  map: { label: "Map", icon: MapIcon, color: "#EA580C" },
  collection: { label: "Files", icon: FolderOpen, color: "#EA580C" },
  embed: { label: "Embed", icon: Globe, color: "#475569" },
  doc: { label: "Doc", icon: FileText, color: "#2563EB" },
  form: { label: "Form", icon: ClipboardList, color: "#7C3AED" },
};
/** what a space / folder can show (it spans several lists) */
export const LOCATION_KINDS = ["list", "board", "calendar", "team", "dashboard", "embed", "doc"];
const errMsg = (e: any, f: string) => e?.response?.data?.message?.toString?.() ?? f;

export const viewsKey = (type: ViewLocation, ref: string) => ["work", "views", type, ref] as const;
export function useSavedViews(type: ViewLocation, ref: string | undefined) {
  const q = useQuery({ queryKey: viewsKey(type, ref ?? ""), queryFn: () => workApi.views(type, ref!), enabled: !!ref, staleTime: 15_000 });
  return { views: q.data?.views ?? [], canEdit: !!q.data?.canEdit, isLoading: q.isLoading, refetch: q.refetch };
}

/** where a new doc / form of this location goes */
export type ViewHome = { ws: string; type: ViewLocation; ref: string; name: string; spaceId: number; folderId?: number | null; listId?: number | null };

export function SavedViewTabs({ home, views, canEdit, activeUid, onSelect, leading }: { home: ViewHome; views: SavedView[]; canEdit: boolean; activeUid: string | null; onSelect: (uid: string) => void; leading?: React.ReactNode }) {
  const qc = useQueryClient();
  const key = viewsKey(home.type, home.ref);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const run = async (fn: () => Promise<unknown>, fail: string) => { try { await fn(); await refresh(); } catch (e) { toast.error(errMsg(e, fail)); } };
  // drag a tab to reorder: it lands between its new neighbours (shared with everyone)
  const [dragUid, setDragUid] = useState<string | null>(null);
  const [overUid, setOverUid] = useState<string | null>(null);
  const dropOn = (targetUid: string) => {
    const from = dragUid;
    setDragUid(null); setOverUid(null);
    if (!from || from === targetUid) return;
    const rest = views.filter((x) => x.uid !== from);
    const at = rest.findIndex((x) => x.uid === targetUid);
    const fromIdx = views.findIndex((x) => x.uid === from), toIdx = views.findIndex((x) => x.uid === targetUid);
    // dropping on a tab to the right puts it after that tab, to the left puts it before
    const insert = toIdx > fromIdx ? at + 1 : at;
    const prev = rest[insert - 1], next = rest[insert];
    const position = prev && next ? (prev.position + next.position) / 2 : prev ? prev.position + 1000 : next ? next.position / 2 : 1000;
    const moved = views.find((x) => x.uid === from)!;
    const order = [...rest.slice(0, insert), { ...moved, position }, ...rest.slice(insert)];
    qc.setQueryData(key, (old: any) => (old ? { ...old, views: order } : old));
    void run(() => workApi.updateView(from, { position }), "Couldn't move it.");
  };

  const add = async (kind: string, extra: { name?: string; settings?: Record<string, unknown> } = {}) => {
    try {
      const v = await workApi.createView({ type: home.type, ref: home.ref, kind, name: extra.name ?? KIND_META[kind]?.label ?? kind, settings: extra.settings });
      await refresh();
      onSelect(v.uid);
    } catch (e) { toast.error(errMsg(e, "Couldn't add the view.")); }
  };
  const addModule = async (m: WorkModule) => {
    try {
      if (m === "doc") {
        const loc = home.type === "list" ? { listId: home.listId } : home.type === "folder" ? { folderId: home.folderId } : { spaceId: home.spaceId };
        const d = (await api.post<{ uid: string }>(`/work/workspaces/${home.ws}/docs`, { title: `${home.name} doc`, ...loc })).data;
        await add("doc", { name: "Doc", settings: { docUid: d.uid } });
      } else if (m === "form" && home.listId) {
        const f = (await api.post<{ uid: string }>(`/work/workspaces/${home.ws}/forms`, { name: `${home.name} form`, listId: home.listId })).data;
        await add("form", { name: "Form", settings: { formUid: f.uid } });
      } else if (m === "whiteboard") {
        const b = (await api.post<{ uid: string }>(`/work/workspaces/${home.ws}/whiteboards`, { title: `${home.name} whiteboard` })).data;
        window.location.href = `/work/${home.ws}/whiteboards?board=${b.uid}`;
      }
    } catch (e) { toast.error(errMsg(e, "Couldn't create it.")); }
  };

  return (
    <div className="-mb-px mt-2 flex items-center gap-1 overflow-x-auto">
      <div role="tablist" aria-label="Views" className="flex gap-1">
        {leading}
        {views.map((v) => {
          const meta = KIND_META[v.kind] ?? KIND_META.list!;
          const on = v.uid === activeUid;
          if (renaming === v.uid) {
            return (
              <form key={v.uid} onSubmit={(e) => { e.preventDefault(); setRenaming(null); if (name.trim() && name.trim() !== v.name) void run(() => workApi.updateView(v.uid, { name: name.trim() }), "Couldn't rename it."); }} className="flex items-center px-1">
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={(e) => e.currentTarget.form?.requestSubmit()} onKeyDown={(e) => e.key === "Escape" && setRenaming(null)} aria-label="View name" className="h-8 w-32 rounded-md border border-primary/40 bg-background px-2 text-[13px] outline-none" />
              </form>
            );
          }
          return (
            <div key={v.uid} className={cn("group/tab relative flex rounded-t-md", dragUid === v.uid && "opacity-40", overUid === v.uid && dragUid && dragUid !== v.uid && "bg-primary/10")}
              draggable={canEdit}
              onDragStart={(e) => { setDragUid(v.uid); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => { if (dragUid) { e.preventDefault(); setOverUid(v.uid); } }}
              onDragLeave={() => setOverUid((o) => (o === v.uid ? null : o))}
              onDrop={(e) => { e.preventDefault(); dropOn(v.uid); }}
              onDragEnd={() => { setDragUid(null); setOverUid(null); }}
              title={canEdit ? "Drag to reorder" : undefined}>
              <button role="tab" aria-selected={on} type="button" onClick={() => onSelect(v.uid)} onDoubleClick={() => { if (canEdit) { setName(v.name); setRenaming(v.uid); } }}
                className={cn("flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors", on ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground", canEdit && "pr-7")}>
                <meta.icon className="h-4 w-4" style={{ color: meta.color }} />
                <span className="max-w-[160px] truncate">{v.name}</span>
              </button>
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" aria-label={`${v.name} view options`} className={cn("absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:block", on ? "block" : "hidden group-hover/tab:block")}>
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    <DropdownMenuItem onClick={() => { setName(v.name); setRenaming(v.uid); }}><Pencil className="mr-2 h-3.5 w-3.5" /> Rename</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => run(async () => { const c = await workApi.duplicateView(v.uid); onSelect(c.uid); }, "Couldn't duplicate it.")}><Copy className="mr-2 h-3.5 w-3.5" /> Duplicate</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => run(() => workApi.moveView(v.uid, "left"), "Couldn't move it.")}><ChevronLeft className="mr-2 h-3.5 w-3.5" /> Move left</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => run(() => workApi.moveView(v.uid, "right"), "Couldn't move it.")}><ChevronRight className="mr-2 h-3.5 w-3.5" /> Move right</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" disabled={views.length <= 1} onClick={() => window.confirm(`Delete the view "${v.name}" for everyone?`) && run(async () => { await workApi.deleteView(v.uid); if (on) onSelect(views.find((x) => x.uid !== v.uid)!.uid); }, "Couldn't delete it.")}><Trash2 className="mr-2 h-3.5 w-3.5" /> Delete view</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>
      {canEdit && (
        <>
          <span aria-hidden className="mx-1 h-4 w-px bg-border" />
          <AddViewMenu
            only={home.type === "list" ? undefined : [...LOCATION_KINDS]}
            onAdd={(k) => void add(k)}
            onModule={(m) => void addModule(m)}
            onEmbed={(e) => void add("embed", { name: e.name, settings: { url: e.url, embedKind: e.kind } })}
          />
        </>
      )}
    </div>
  );
}

/** pick the view to show: ?v=<uid>, or an old ?view=<kind> link, or the first one */
export function pickView(views: SavedView[], v: string | null, legacyKind: string | null) {
  return views.find((x) => x.uid === v) ?? (legacyKind ? views.find((x) => x.kind === legacyKind) : undefined) ?? views[0] ?? null;
}

/** a view whose content isn't a task view: embed, doc, form */
export function ModuleView({ view, home, canEdit }: { view: SavedView; home: ViewHome; canEdit: boolean }) {
  const s = view.settings ?? {};
  if (view.kind === "embed") return s.url ? <EmbedFrame view={{ id: view.uid, kind: (s.embedKind ?? "web") as EmbedKind, name: view.name, url: String(s.url) }} /> : <p className="py-16 text-center text-[13px] text-muted-foreground">This embed has no link.</p>;
  if (view.kind === "doc") {
    if (!s.docUid) return <p className="py-16 text-center text-[13px] text-muted-foreground">This doc view has no doc.</p>;
    return (
      <section aria-label={view.name} className="overflow-hidden rounded-2xl border border-border bg-card">
        <DocEditor key={String(s.docUid)} uid={String(s.docUid)} ws={home.ws} onSubPage={() => (window.location.href = `/work/${home.ws}/docs?doc=${s.docUid}`)} onOpen={(u) => (window.location.href = `/work/${home.ws}/docs?doc=${u}`)} onArchived={() => toast("Doc archived. You can delete this view from its ⋯ menu.")} />
      </section>
    );
  }
  if (view.kind === "form") return <FormViewPanel ws={home.ws} formUid={String(s.formUid ?? "")} canEdit={canEdit} />;
  return null;
}

function FormViewPanel({ ws, formUid, canEdit }: { ws: string; formUid: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const key = ["work", "forms", ws];
  const { data: forms = [], isLoading } = useQuery({ queryKey: key, queryFn: async () => (await api.get<FormRow[]>(`/work/workspaces/${ws}/forms`)).data });
  const [editing, setEditing] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const form = forms.find((f) => f.uid === formUid);
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => { setFrameKey((k) => k + 1); }, [form?.fields, form?.name]);
  if (isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;
  if (!form) return <p className="py-16 text-center text-[13px] text-muted-foreground">This form was deleted, or you can&apos;t open it.</p>;
  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <aside className="h-fit space-y-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <h2 className="text-[16px] font-semibold">{form.name}</h2>
          {form.description && <p className="mt-1 text-[13px] text-muted-foreground">{form.description}</p>}
        </div>
        <dl className="grid grid-cols-2 gap-2 text-[12.5px]">
          <div className="rounded-lg bg-muted/50 p-2"><dt className="text-muted-foreground">Answers</dt><dd className="text-[18px] font-semibold">{form.submissions}</dd></div>
          <div className="rounded-lg bg-muted/50 p-2"><dt className="text-muted-foreground">Status</dt><dd className={cn("text-[14px] font-semibold", form.active ? "text-primary" : "text-muted-foreground")}>{form.active ? "Open" : "Closed"}</dd></div>
        </dl>
        <p className="text-[12.5px] text-muted-foreground">{form.fields.length} questions · every answer becomes a task in <b className="text-foreground">{form.list?.name ?? "the list"}</b>.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => navigator.clipboard.writeText(linkOf(form.uid)).then(() => toast.success("Form link copied"))} className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12.5px] hover:bg-accent"><Copy className="h-3.5 w-3.5" /> Copy link</button>
          <a href={`/wf/${form.uid}`} target="_blank" rel="noreferrer" className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12.5px] hover:bg-accent"><ExternalLink className="h-3.5 w-3.5" /> Open</a>
          {canEdit && <button type="button" onClick={() => setEditing(true)} className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground"><Pencil className="h-3.5 w-3.5" /> Edit form</button>}
        </div>
      </aside>
      <section aria-label="Form preview" className="overflow-hidden rounded-2xl border border-border bg-card">
        <p className="border-b border-border px-4 py-2 text-[12px] font-medium text-muted-foreground">Preview (what people see)</p>
        <iframe ref={ref} key={frameKey} title={`${form.name} preview`} src={`/wf/${form.uid}`} className="h-[calc(100vh-320px)] min-h-[480px] w-full bg-white" />
      </section>
      {editing && <FormEditor ws={ws} form={form} onClose={() => setEditing(false)} onSaved={() => qc.invalidateQueries({ queryKey: key })} />}
    </div>
  );
}
