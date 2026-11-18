"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Folder, Plus } from "lucide-react";
import { ActivityView, CollectionView, MapView, MindMapView } from "../../../_components/MoreViews";
import { LocationTeam } from "../../../_components/chat/LocationChannel";
import { LocationDashboard } from "../../../_components/Dashboard";
import { trackPlace } from "../../../_components/recent";
import { AutomateButton } from "../../../_components/Automations";
import { LocationChannelButton } from "../../../_components/chat/LocationChannel";
import { ShareListButton } from "../../../_components/ShareAndEmail";
import { GalleryView } from "../../../_components/GalleryView";
import { ModuleView, SavedViewTabs, pickView, useSavedViews, viewsKey } from "../../../_components/SavedViews";
import { SpaceIcon } from "../../../_components/SpaceIcon";
import { pushRecentList, useWorkCreate } from "@/store/work-create";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import { workApi } from "@/services/work.api";
import { ListView } from "../../../_components/ListView";
import { BoardView, boardGroupOptions, type BoardGroup } from "../../../_components/BoardView";
import { CalendarView } from "../../../_components/CalendarView";
import { GanttView, WorkloadView } from "../../../_components/GanttView";
import { TaskDrawer } from "../../../_components/TaskDrawer";
import { useListTasks, useWorkList } from "../../../_components/hooks";
import { ListToolbar } from "../../../_components/ListToolbar";
import { ALL_COLUMNS, DEFAULT_VIEW, cfCol, filterTasks, loadView, sameView, type ViewSettings } from "../../../_components/viewSettings";
import { CreateFieldDialog, useListFieldValues, useSetFieldValue, useSpaceFields } from "../../../_components/CustomFields";

/** the old per-browser views (before views were saved for everyone) */
const oldViewsKey = (uid: string) => `ez:work:views:${uid}`;
const oldEmbedsKey = (uid: string) => `ez:work:embeds:${uid}`;
const NO_TOOLBAR = ["dashboard", "activity", "collection", "team", "embed", "doc", "form"];
const asSettings = (raw: Record<string, any> | null | undefined, fallback: ViewSettings): ViewSettings =>
  raw && raw.filters ? { ...DEFAULT_VIEW, ...raw, filters: { ...DEFAULT_VIEW.filters, ...(raw.filters ?? {}) } } as ViewSettings : { ...fallback, ...(raw?.boardGroup ? { boardGroup: raw.boardGroup } : {}) };

function ListPageInner() {
  const { listUid, workspaceId } = useParams<{ workspaceId: string; listUid: string }>();
  const openCreate = useWorkCreate((st) => st.openCreate);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { views, canEdit: canEditViews, isLoading: viewsLoading } = useSavedViews("list", listUid);
  const active = pickView(views, sp.get("v"), sp.get("view"));
  const view = (active?.kind ?? "list") as string;
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
  // view settings: the copy saved on the view (shared) and the working copy
  const [saved, setSaved] = useState<ViewSettings>(DEFAULT_VIEW);
  const [vs, setVs] = useState<ViewSettings>(DEFAULT_VIEW);
  useEffect(() => {
    if (!active) return;
    // the first List view takes over this browser's old saved settings
    const first = views.find((v) => v.kind === "list")?.uid === active.uid;
    const v = asSettings(active.settings, first ? loadView(listUid) : DEFAULT_VIEW);
    setSaved(v);
    setVs(v);
  }, [active?.uid, active?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // once: this browser's old extra views and embeds become saved views for everyone
  const migrated = useRef(false);
  useEffect(() => {
    if (migrated.current || viewsLoading || !canEditViews || !views.length) return;
    migrated.current = true;
    let kinds: string[] = [], embeds: { name: string; url: string; kind: string }[] = [];
    try { kinds = JSON.parse(localStorage.getItem(oldViewsKey(listUid)) ?? "[]"); } catch {}
    try { embeds = JSON.parse(localStorage.getItem(oldEmbedsKey(listUid)) ?? "[]"); } catch {}
    if (!Array.isArray(kinds)) kinds = [];
    if (!Array.isArray(embeds)) embeds = [];
    if (!kinds.length && !embeds.length) return;
    void (async () => {
      for (const k of kinds) if (typeof k === "string" && !views.some((v) => v.kind === k)) await workApi.createView({ type: "list", ref: listUid, kind: k }).catch(() => null);
      for (const e of embeds) if (e?.url && /^https:\/\//.test(e.url)) await workApi.createView({ type: "list", ref: listUid, kind: "embed", name: e.name, settings: { url: e.url, embedKind: e.kind } }).catch(() => null);
      try { localStorage.removeItem(oldViewsKey(listUid)); localStorage.removeItem(oldEmbedsKey(listUid)); } catch {}
      await qc.invalidateQueries({ queryKey: viewsKey("list", listUid) });
    })();
  }, [viewsLoading, canEditViews, views, listUid, qc]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    value === null ? next.delete(key) : next.set(key, value);
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };
  const openTask = (uid: string) => setParam("task", uid);
  const selectView = (uid: string) => {
    const next = new URLSearchParams(sp.toString());
    next.set("v", uid);
    next.delete("view");
    next.delete("embed");
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  const saveSettings = async (next: ViewSettings) => {
    if (!active) return;
    try { await workApi.updateView(active.uid, { settings: next as unknown as Record<string, unknown> }); setSaved(next); await qc.invalidateQueries({ queryKey: viewsKey("list", listUid) }); toast.success("View saved for everyone"); }
    catch (e: any) { toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't save the view."); }
  };
  const boardGroup = (vs.boardGroup ?? "status") as BoardGroup;

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
        {/* breadcrumb: Space / Folder / List */}
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
          {list ? (
            <>
              <Link href={`/work/${workspaceId}/space/${list.space.uid}`} className="flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-accent hover:text-foreground">
                <SpaceIcon name={list.space.name} color={list.space.color} size={16} /> {list.space.name}
              </Link>
              {list.folder && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                  <Link href={`/work/${workspaceId}/folder/${list.folder.uid}`} className="flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-accent hover:text-foreground"><Folder className="h-3.5 w-3.5" /> {list.folder.name}</Link>
                </>
              )}
              <ChevronRight className="h-3.5 w-3.5 opacity-60" />
              <span aria-current="page" className="flex items-center gap-1.5 px-1 font-semibold text-foreground"><span className="h-2 w-2 rounded-full" style={{ background: list.color ?? "var(--primary)" }} /> {list.name}</span>
            </>
          ) : <span>…</span>}
        </nav>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="min-w-0 max-w-full truncate font-serif text-[26px] font-normal leading-tight tracking-tight sm:text-[34px]">{list?.name ?? (isLoading ? "…" : "")}</h1>
          {list && (
            <div className="flex flex-wrap items-center gap-2 pb-1.5 sm:gap-3">
              <p className="w-full whitespace-nowrap font-mono text-[12px] text-muted-foreground sm:w-auto">
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
        {/* views: saved for everyone */}
        {list && (
          <SavedViewTabs
            home={{ ws: workspaceId, type: "list", ref: listUid, name: list.name, spaceId: list.spaceId, folderId: list.folderId, listId: list.id }}
            views={views}
            canEdit={canEditViews}
            activeUid={active?.uid ?? null}
            onSelect={selectView}
          />
        )}
      </div>

      {/* toolbar */}
      {list && active && !NO_TOOLBAR.includes(view) && (
        <div className="px-4 pt-4 sm:px-6">
          <ListToolbar
            list={list}
            tasks={tasks}
            view={vs}
            onView={setVs}
            dirty={!sameView(vs, saved)}
            onSave={() => void saveSettings(vs)}
            canSave={canEditViews}
            boardGroup={view === "board" ? { value: boardGroup, options: boardGroupOptions(fields), onChange: (g) => setVs({ ...vs, boardGroup: g }) } : undefined}
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
        {(isLoading || tasksLoading || viewsLoading || !list) ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-card" />)}
          </div>
        ) : active && ["embed", "doc", "form"].includes(view) ? (
          <ModuleView view={active} canEdit={canEditViews} home={{ ws: workspaceId, type: "list", ref: listUid, name: list.name, spaceId: list.spaceId, folderId: list.folderId, listId: list.id }} />
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
          <BoardView list={list} tasks={shown} onOpenTask={openTask} groupBy={boardGroup} fields={fields} fieldValues={fieldValues} onFieldChange={onFieldChange} />
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
