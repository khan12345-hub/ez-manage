"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { BarChart3, CalendarDays, Columns3, LayoutGrid, List as ListIcon, Plus, Table2, X, GanttChartSquare, CalendarRange, Gauge, Activity, GitFork, Users, Map as MapIcon, FolderOpen, Globe } from "lucide-react";
import { ActivityView, CollectionView, EmbedFrame, MapView, MindMapView, type EmbedView } from "../../../_components/MoreViews";
import { LocationTeam } from "../../../_components/chat/LocationChannel";
import { api } from "@/lib/api";
import { LocationDashboard } from "../../../_components/Dashboard";
import { trackPlace } from "../../../_components/recent";
import { AutomateButton } from "../../../_components/Automations";
import { LocationChannelButton } from "../../../_components/chat/LocationChannel";
import { ShareListButton } from "../../../_components/ShareAndEmail";
import { GalleryView } from "../../../_components/GalleryView";
import { AddViewMenu, type WorkModule, type WorkView } from "../../../_components/AddViewMenu";
import { pushRecentList, useWorkCreate } from "@/store/work-create";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { ListView } from "../../../_components/ListView";
import { BoardView } from "../../../_components/BoardView";
import { CalendarView } from "../../../_components/CalendarView";
import { GanttView, WorkloadView } from "../../../_components/GanttView";
import { TaskDrawer } from "../../../_components/TaskDrawer";
import { useListTasks, useWorkList } from "../../../_components/hooks";
import { ListToolbar } from "../../../_components/ListToolbar";
import { ALL_COLUMNS, DEFAULT_VIEW, cfCol, filterTasks, loadView, sameView, saveView, type ViewSettings } from "../../../_components/viewSettings";
import { CreateFieldDialog, useListFieldValues, useSetFieldValue, useSpaceFields } from "../../../_components/CustomFields";

type View = WorkView;
const VIEW_META: Record<View, { label: string; icon: typeof ListIcon }> = {
  list: { label: "List", icon: ListIcon },
  board: { label: "Board", icon: Columns3 },
  calendar: { label: "Calendar", icon: CalendarDays },
  table: { label: "Table", icon: Table2 },
  gallery: { label: "Gallery", icon: LayoutGrid },
  dashboard: { label: "Dashboard", icon: BarChart3 },
  gantt: { label: "Gantt", icon: GanttChartSquare },
  timeline: { label: "Timeline", icon: CalendarRange },
  workload: { label: "Workload", icon: Gauge },
  activity: { label: "Activity", icon: Activity },
  mindmap: { label: "Mind Map", icon: GitFork },
  team: { label: "Team", icon: Users },
  map: { label: "Map", icon: MapIcon },
  collection: { label: "Files", icon: FolderOpen },
};
const BASE_VIEWS: View[] = ["list", "board", "calendar"];
const viewsKey = (uid: string) => `ez:work:views:${uid}`;
const embedsKey = (uid: string) => `ez:work:embeds:${uid}`;

function ListPageInner() {
  const { listUid, workspaceId } = useParams<{ workspaceId: string; listUid: string }>();
  const openCreate = useWorkCreate((st) => st.openCreate);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { user } = useAuth();
  const view = (Object.keys(VIEW_META).includes(sp.get("view") ?? "") ? sp.get("view") : "list") as View;
  // views added with "+ View" are remembered per list
  const [extraViews, setExtraViews] = useState<View[]>([]);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(viewsKey(listUid)) ?? "[]");
      setExtraViews(Array.isArray(v) ? v.filter((x: string) => x in VIEW_META && !BASE_VIEWS.includes(x as View)) : []);
    } catch {
      setExtraViews([]);
    }
  }, [listUid]);
  // embedded views (any website, YouTube, Figma, Google Docs / Sheets / Calendar), remembered per list
  const [embeds, setEmbeds] = useState<EmbedView[]>([]);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(embedsKey(listUid)) ?? "[]"); setEmbeds(Array.isArray(v) ? v.filter((x) => x?.id && typeof x.url === "string" && /^https:\/\//.test(x.url)) : []); } catch { setEmbeds([]); }
  }, [listUid]);
  const saveEmbeds = (v: EmbedView[]) => {
    setEmbeds(v);
    try { localStorage.setItem(embedsKey(listUid), JSON.stringify(v)); } catch {}
  };
  const embedId = sp.get("view") === "embed" ? sp.get("embed") : null;
  const activeEmbed = embeds.find((e) => e.id === embedId) ?? null;
  const saveExtra = (v: View[]) => {
    setExtraViews(v);
    try { localStorage.setItem(viewsKey(listUid), JSON.stringify(v)); } catch {}
  };
  const tabs: View[] = [...BASE_VIEWS, ...extraViews, ...(BASE_VIEWS.includes(view) || extraViews.includes(view) ? [] : [view])];
  const taskUid = sp.get("task");

  const { data: list, isLoading, isError } = useWorkList(listUid);
  useEffect(() => {
    if (list) {
      pushRecentList(workspaceId, list.uid);
      trackPlace({ kind: "list", uid: list.uid, name: list.name, parent: list.folder?.name ?? list.space.name, spaceUid: list.space.uid, folderUid: list.folder?.uid ?? null });
    }
  }, [list?.uid, workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: tasks = [], isLoading: tasksLoading } = useListTasks(list?.id);
  const { data: fields = [] } = useSpaceFields(list?.spaceId);
  const { data: fieldValues = {} } = useListFieldValues(list?.id);
  const setField = useSetFieldValue(list?.id ?? 0);
  const [creatingField, setCreatingField] = useState(false);
  const onFieldChange = (taskId: number, fieldId: number, value: unknown) => setField.mutate({ taskId, fieldId, value });
  const [q, setQ] = useState("");
  const [meMode, setMeMode] = useState(false);
  // view settings: the saved copy (localStorage) and the working copy
  const [saved, setSaved] = useState<ViewSettings>(DEFAULT_VIEW);
  const [vs, setVs] = useState<ViewSettings>(DEFAULT_VIEW);
  useEffect(() => {
    const v = loadView(listUid);
    setSaved(v);
    setVs(v);
  }, [listUid]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    value === null ? next.delete(key) : next.set(key, value);
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };
  const openTask = (uid: string) => setParam("task", uid);
  const goView = (v: string | null, embed?: string) => {
    const next = new URLSearchParams(sp.toString());
    v === null ? next.delete("view") : next.set("view", v);
    embed ? next.set("embed", embed) : next.delete("embed");
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };
  /** "+ View" → Doc / Form / Whiteboard: made for this list's space and opened */
  const openModule = async (m: WorkModule) => {
    if (!list) return;
    try {
      if (m === "form") router.push(`/work/${workspaceId}/forms?new=1&list=${list.id}`);
      else if (m === "doc") router.push(`/work/${workspaceId}/docs?doc=${(await api.post<{ uid: string }>(`/work/workspaces/${workspaceId}/docs`, { title: `${list.name} doc`, spaceId: list.spaceId })).data.uid}`);
      else router.push(`/work/${workspaceId}/whiteboards?board=${(await api.post<{ uid: string }>(`/work/workspaces/${workspaceId}/whiteboards`, { title: `${list.name} whiteboard` })).data.uid}`);
    } catch (e: any) { toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't create it."); }
  };

  // Search + "Me mode" (only my tasks). Keep a subtask's parent visible when the subtask matches.
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = list ? filterTasks(tasks, vs, list.statuses) : tasks;
    if (!term && !meMode) return base;
    const match = (t: (typeof tasks)[number]) =>
      (!term || t.name.toLowerCase().includes(term)) && (!meMode || t.assignees.some((a) => a.id === user?.id));
    const keep = new Set<number>();
    for (const t of base) if (match(t)) {
      keep.add(t.id);
      if (t.parentId) keep.add(t.parentId);
    }
    return base.filter((t) => keep.has(t.id));
  }, [tasks, list, vs, q, meMode, user?.id]);

  if (isError) {
    return <div className="p-10 text-center text-sm text-muted-foreground">This list doesn&apos;t exist, was archived, or you don&apos;t have access.</div>;
  }

  const open = tasks.filter((t) => !t.parentId && !t.completedAt).length;
  const doneCount = tasks.filter((t) => !t.parentId && t.completedAt).length;

  return (
    <div className="flex min-h-full flex-col">
      {/* header */}
      <div className="relative mx-4 mt-4 overflow-hidden rounded-[20px] border border-black/[0.05] bg-card shadow-[0_1px_2px_rgba(11,42,31,0.04)] dark:border-white/10 px-4 pb-0 pt-4 sm:px-6">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px]" style={{ background: "linear-gradient(90deg, var(--primary) 0%, var(--brass) 60%, transparent 100%)" }} />
        <p className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-product-work" aria-hidden />
          Work
          {list && (
            <>
              <span aria-hidden>/</span>
              <span className="normal-case tracking-normal">{list.space.name}</span>
              {list.folder && (
                <>
                  <span aria-hidden>/</span>
                  <span className="normal-case tracking-normal">{list.folder.name}</span>
                </>
              )}
            </>
          )}
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-serif text-[30px] font-normal leading-tight tracking-tight sm:text-[34px]">{list?.name ?? (isLoading ? "…" : "")}</h1>
          {list && (
            <div className="flex items-center gap-3 pb-1.5">
              <p className="font-mono text-[12px] text-muted-foreground">
                {open} open · {doneCount} done
              </p>
              <LocationChannelButton type="list" uid={list.uid} locationId={list.id} label={list.name} />
              <ShareListButton listId={list.id} listUid={list.uid} ws={workspaceId} canEdit={list.access.canEdit} />
              {list.access.canEdit && <AutomateButton scope={{ spaceId: list.spaceId, folderId: list.folderId, listId: list.id, listUid: list.uid, label: list.name }} />}
              {list.access.canEdit && (
                <button
                  type="button"
                  onClick={() => openCreate(list.uid)}
                  className="flex h-8 items-center gap-1.5 rounded-md bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground shadow-sm hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Task
                </button>
              )}
            </div>
          )}
        </div>
        {/* views */}
        <div className="-mb-px mt-2 flex items-center gap-1 overflow-x-auto">
          <div role="tablist" aria-label="Views" className="flex gap-1">
            {tabs.map((id) => {
              const { label, icon: Icon } = VIEW_META[id];
              const removable = !BASE_VIEWS.includes(id);
              return (
                <div key={id} className="group/tab relative flex">
                  <button
                    role="tab"
                    aria-selected={view === id && !activeEmbed}
                    type="button"
                    onClick={() => goView(id === "list" ? null : id)}
                    className={cn(
                      "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                      view === id && !activeEmbed ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                      removable && "pr-6",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                  {removable && (
                    <button
                      type="button"
                      aria-label={`Remove ${label} view`}
                      title="Remove view"
                      onClick={() => {
                        saveExtra(extraViews.filter((x) => x !== id));
                        if (view === id) goView(null);
                      }}
                      className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground group-hover/tab:block"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
            {embeds.map((e) => (
              <div key={e.id} className="group/tab relative flex">
                <button role="tab" aria-selected={activeEmbed?.id === e.id} type="button" onClick={() => goView("embed", e.id)} className={cn("flex items-center gap-1.5 border-b-2 px-3 py-2.5 pr-6 text-sm font-medium transition-colors", activeEmbed?.id === e.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  <Globe className="h-4 w-4" />
                  <span className="max-w-[140px] truncate">{e.name}</span>
                </button>
                <button type="button" aria-label={`Remove ${e.name} view`} title="Remove view" onClick={() => { saveEmbeds(embeds.filter((x) => x.id !== e.id)); if (activeEmbed?.id === e.id) goView(null); }} className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground group-hover/tab:block">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <span aria-hidden className="mx-1 h-4 w-px bg-border" />
          <AddViewMenu
            onAdd={(v) => {
              if (!BASE_VIEWS.includes(v) && !extraViews.includes(v)) saveExtra([...extraViews, v]);
              goView(v === "list" ? null : v);
            }}
            onModule={list?.access.canEdit ? (m) => void openModule(m) : undefined}
            onEmbed={(e) => {
              const id = Math.random().toString(36).slice(2, 10);
              saveEmbeds([...embeds, { id, ...e }]);
              goView("embed", id);
            }}
          />
        </div>
      </div>

      {/* toolbar */}
      {list && !activeEmbed && !["dashboard", "activity", "collection", "team"].includes(view) && (
        <div className="px-4 pt-4 sm:px-6">
          <ListToolbar
            list={list}
            tasks={tasks}
            view={vs}
            onView={setVs}
            dirty={!sameView(vs, saved)}
            onSave={() => {
              saveView(listUid, vs);
              setSaved(vs);
              toast.success("View saved");
            }}
            onReset={() => setVs(saved)}
            q={q}
            onQ={setQ}
            meMode={meMode}
            onMeMode={setMeMode}
            showListControls={view === "list"}
            fields={fields}
            onCreateField={list.access.canManage ? () => setCreatingField(true) : undefined}
          />
        </div>
      )}

      <div className="flex-1 px-4 py-4 sm:px-6">
        {(isLoading || tasksLoading || !list) ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-card" />)}
          </div>
        ) : activeEmbed ? (
          <EmbedFrame view={activeEmbed} />
        ) : view === "activity" ? (
          <ActivityView listUid={list.uid} members={list.members} onOpenTask={openTask} />
        ) : view === "mindmap" ? (
          <MindMapView list={list} tasks={shown} canEdit={list.access.canEdit} onOpenTask={openTask} />
        ) : view === "team" ? (
          <div className="-mx-4 -my-4"><LocationTeam src={{ type: "list", uid: list.uid }} /></div>
        ) : view === "map" ? (
          <MapView list={list} tasks={shown} fields={fields} fieldValues={fieldValues} canEdit={list.access.canEdit} onFieldChange={onFieldChange} onOpenTask={openTask} />
        ) : view === "collection" ? (
          <CollectionView listUid={list.uid} onOpenTask={openTask} />
        ) : view === "board" ? (
          <BoardView list={list} tasks={shown} onOpenTask={openTask} />
        ) : view === "calendar" ? (
          <CalendarView list={list} tasks={shown} onOpenTask={openTask} />
        ) : view === "dashboard" ? (
          <LocationDashboard kind="list" uid={listUid} onOpenTask={openTask} />
        ) : view === "gantt" || view === "timeline" ? (
          <GanttView list={list} tasks={shown} onOpenTask={openTask} groupByPerson={view === "timeline"} />
        ) : view === "workload" ? (
          <WorkloadView list={list} tasks={shown} onOpenTask={openTask} />
        ) : view === "gallery" ? (
          <GalleryView list={list} tasks={shown} onOpenTask={openTask} />
        ) : view === "table" ? (
          // Table: one flat sheet with every column, subtasks shown
          <ListView list={list} tasks={shown} view={{ ...vs, groupBy: "none", columns: [...ALL_COLUMNS, ...fields.map((f) => cfCol(f.id))], subtasks: "expanded" }} onView={(v) => setVs({ ...vs, sort: v.sort })} onOpenTask={openTask} fields={fields} fieldValues={fieldValues} onFieldChange={onFieldChange} />
        ) : (
          <ListView list={list} tasks={shown} view={vs} onView={setVs} onOpenTask={openTask} fields={fields} fieldValues={fieldValues} onFieldChange={onFieldChange} />
        )}
      </div>

      <TaskDrawer taskUid={taskUid} onClose={() => setParam("task", null)} onOpenTask={openTask} />
      {list && (
        <CreateFieldDialog
          open={creatingField}
          onOpenChange={setCreatingField}
          spaceId={list.spaceId}
          onCreated={(f) => setVs({ ...vs, columns: [...vs.columns, cfCol(f.id)] })}
        />
      )}
    </div>
  );
}

export default function WorkListPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-28 animate-pulse rounded-xl bg-muted" /></div>}>
      <ListPageInner />
    </Suspense>
  );
}
