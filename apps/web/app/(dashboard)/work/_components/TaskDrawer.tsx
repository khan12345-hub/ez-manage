"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Archive,
  CalendarDays,
  Check,
  ChevronsLeft,
  ChevronsRight,
  CircleDot,
  Flag,
  GitBranch,
  Hourglass,
  LayoutList,
  Link2,
  Loader2,
  Maximize2,
  MessageSquare,
  PanelRight,
  Paperclip,
  Plus,
  SquareStack,
  Tag as TagIcon,
  Timer,
  Users,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { userName, workApi, workKeys, type TaskInput, type WorkTask, type WorkTaskDetail } from "@/services/work.api";
import { ChecklistsSection, EstimateField, RelationshipsSection, TagsField, TimeTracker, Timeline } from "./TaskDetailSections";
import { AvatarStack, DueLabel, PriorityFlag, StatusGlyph, StatusPill, dueText } from "./primitives";
import { AssigneePicker, DatePicker, PriorityPicker, StatusPicker } from "./pickers";
import { AddLinkPanel, AttachmentsSection, FileChip, WebLinksList, attachmentsKey, useUpload } from "./TaskFiles";
import { Composer } from "./Composer";
import { CustomFieldsSection } from "./CustomFields";
import { ThreadView } from "./ThreadView";
import { TaskMenu } from "./TaskMenu";
import { TaskListsControl, type PickMode } from "./TaskLists";
import { mineKey } from "./CommentActions";

const errMsg = (e: any) => e?.response?.data?.message?.toString?.() ?? "Something went wrong.";

function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export type TaskLayout = "modal" | "full" | "sidebar";
const LAYOUT_KEY = "ez:work:taskLayout";
const PANEL_KEY = "ez:work:panelWidth";
const LAYOUTS: { id: TaskLayout; label: string; icon: typeof Maximize2 }[] = [
  { id: "modal", label: "Modal", icon: SquareStack },
  { id: "full", label: "Full screen", icon: Maximize2 },
  { id: "sidebar", label: "Sidebar", icon: PanelRight },
];
const LAYOUT_CLASS: Record<TaskLayout, string> = {
  sidebar: "data-[side=right]:w-full data-[side=right]:sm:w-[680px] data-[side=right]:sm:max-w-[680px]",
  modal:
    "data-[side=right]:inset-y-auto data-[side=right]:top-[4vh] data-[side=right]:left-0 data-[side=right]:mx-auto data-[side=right]:h-[92vh] data-[side=right]:w-[min(1240px,96vw)] data-[side=right]:sm:max-w-none data-[side=right]:overflow-hidden data-[side=right]:rounded-2xl data-[side=right]:border",
  full: "data-[side=right]:left-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:border-l-0",
};

type PanelTab = "comments" | "activity" | "related" | "links";
const PANEL_TABS: { id: PanelTab; label: string; icon: typeof Activity }[] = [
  { id: "comments", label: "Comments", icon: MessageSquare },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "related", label: "Related items", icon: GitBranch },
  { id: "links", label: "Add a link", icon: Link2 },
];

function useStored<T extends string | number>(key: string, initial: T, valid: (v: any) => boolean) {
  const [v, setV] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return;
      const parsed = typeof initial === "number" ? Number(raw) : raw;
      if (valid(parsed)) setV(parsed as T);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = (n: T) => {
    setV(n);
    try { localStorage.setItem(key, String(n)); } catch {}
  };
  return [v, set] as const;
}

/** Task detail view (opened with ?task=<uid>): Modal, Full screen or Sidebar layout. */
export function TaskDrawer({ taskUid, onClose, onOpenTask }: { taskUid: string | null; onClose: () => void; onOpenTask: (uid: string) => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: task, isLoading, isError } = useQuery({
    queryKey: workKeys.task(taskUid ?? ""),
    queryFn: () => workApi.getTask(taskUid!),
    enabled: !!taskUid,
    retry: false,
  });
  const { data: list } = useQuery({
    queryKey: workKeys.list(task?.list.uid ?? ""),
    queryFn: () => workApi.getList(task!.list.uid),
    enabled: !!task?.list.uid,
    staleTime: 30_000,
  });
  const { data: comments = [] } = useQuery({
    queryKey: workKeys.comments(task?.id ?? 0),
    queryFn: () => workApi.comments(task!.id),
    enabled: !!task?.id,
  });

  const canEdit = !!task?.access.canEdit;
  const [layout, setLayout] = useStored<TaskLayout>(LAYOUT_KEY, "modal", (v) => v in LAYOUT_CLASS);
  const [panelW, setPanelW] = useStored<number>(PANEL_KEY, 420, (v) => Number.isFinite(v) && v >= 300 && v <= 900);
  const [tab, setTab] = useState<PanelTab>("comments");
  const [panelOpen, setPanelOpen] = useState(true);
  const wide = layout !== "sidebar";
  // Sidebar layout: the rail switches the whole body (Details / Comments / Activity / …)
  const [sideTab, setSideTab] = useState<PanelTab | "details">("details");
  const [thread, setThread] = useState<number | null>(null);
  const [picker, setPicker] = useState(false);
  const [pickMode, setPickMode] = useState<PickMode>("add");
  const { data: mine } = useQuery({ queryKey: mineKey(task?.id ?? 0), queryFn: () => workApi.taskMine(task!.id), enabled: !!task?.id });
  const search = useSearchParams();
  const focusComment = Number(search?.get("comment")) || null;
  useEffect(() => {
    setThread(null);
  }, [task?.id]);
  // ?comment=ID (copied comment link): open the comments, and the thread when it's a reply
  useEffect(() => {
    if (!focusComment) return;
    const c = comments.find((x) => x.id === focusComment);
    if (!c) return;
    setTab("comments");
    setPanelOpen(true);
    setSideTab("comments");
    setThread(c.parentId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusComment, comments.length]);
  const [name, setName] = useState("");
  const [subName, setSubName] = useState("");
  const members = list?.members ?? [];
  useEffect(() => {
    setName(task?.name ?? "");
  }, [task?.id, task?.name]);

  const refresh = (listId?: number) => {
    qc.invalidateQueries({ queryKey: workKeys.task(taskUid ?? "") });
    if (listId) qc.invalidateQueries({ queryKey: workKeys.tasks(listId) });
    qc.invalidateQueries({ queryKey: ["work", "my"] });
    qc.invalidateQueries({ queryKey: ["work", "tree"] });
  };

  const save = useMutation({
    mutationFn: ({ id, body }: { id: number; body: TaskInput }) => workApi.updateTask(id, body),
    onSuccess: (t: WorkTask) => refresh(t.listId),
    onError: (e) => toast.error(errMsg(e)),
  });
  const addSub = useMutation({
    mutationFn: (n: string) => workApi.createTask(task!.listId, { name: n, parentId: task!.id }),
    onSuccess: () => {
      setSubName("");
      refresh(task!.listId);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const delComment = useMutation({
    mutationFn: (id: number) => workApi.deleteComment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: workKeys.comments(task!.id) }),
    onError: (e) => toast.error(errMsg(e)),
  });
  const archive = useMutation({
    mutationFn: () => workApi.archiveTask(task!.id),
    onSuccess: () => {
      refresh(task!.listId);
      toast.success("Task archived");
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const status = task?.statuses.find((s) => s.id === task.statusId);
  const update = (body: TaskInput) => task && save.mutate({ id: task.id, body });
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => toast.success("Task link copied"));
  };

  // drag the panel edge to resize (wide layouts)
  const body = useRef<HTMLDivElement>(null);
  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelW;
    const max = Math.max(320, (body.current?.clientWidth ?? 1200) - 380);
    let w = startW;
    const move = (ev: PointerEvent) => {
      w = Math.min(max, Math.max(300, startW + (startX - ev.clientX)));
      body.current?.style.setProperty("--panel-w", `${w}px`);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      setPanelW(Math.round(w));
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const resizeKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") setPanelW(Math.min(900, panelW + 24));
    if (e.key === "ArrowRight") setPanelW(Math.max(300, panelW - 24));
  };
  const openTab = (t: PanelTab) => {
    if (t !== "comments") setThread(null);
    if (!wide) {
      setSideTab(t);
      return;
    }
    if (panelOpen && tab === t) setPanelOpen(false);
    else {
      setTab(t);
      setPanelOpen(true);
    }
  };
  const openThread = (id: number) => {
    setThread(id);
    if (wide) {
      setTab("comments");
      setPanelOpen(true);
    } else setSideTab("comments");
  };
  const active: PanelTab | "details" = wide ? tab : sideTab;
  const panelBody = (t: PanelTab) =>
    t === "comments" && thread !== null ? (
      <ThreadView task={task!} rootId={thread} comments={comments} members={members} currentUserId={user?.id} mine={mine} onBack={() => setThread(null)} onDelete={(id) => delComment.mutate(id)} />
    ) : (
      <>
        <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-3">
          <h3 className="text-[14px] font-semibold">{PANEL_TABS.find((x) => x.id === t)!.label}</h3>
          <span className="text-[12px] text-muted-foreground">Created {new Date(task!.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {t === "comments" && <Timeline bare task={task!} comments={comments} currentUserId={user?.id} members={members} mine={mine} highlight={focusComment ?? undefined} onOpenThread={openThread} onDeleteComment={(id) => delComment.mutate(id)} />}
          {t === "activity" && <Timeline bare mode="activity" task={task!} comments={comments} currentUserId={user?.id} members={members} onDeleteComment={() => {}} />}
          {t === "related" && <RelatedPanel task={task!} onAdd={() => openTab("links")} />}
          {t === "links" && <AddLinkPanel task={task!} onRelate={() => openTab("related")} />}
        </div>
        {t === "comments" && (task!.access.canComment ?? canEdit) && (
          <div className="border-t border-border bg-card p-3">
            <Composer task={task!} members={members} />
          </div>
        )}
      </>
    );
  const railBtn = (id: PanelTab | "details", label: string, Icon: typeof Activity, badge?: number) => (
    <button
      key={id}
      type="button"
      aria-label={label}
      aria-pressed={wide ? panelOpen && tab === id : sideTab === id}
      title={label}
      onClick={() => (id === "details" ? (setSideTab("details"), setThread(null)) : openTab(id))}
      className={cn("relative flex h-8 w-8 items-center justify-center rounded-md transition-colors", (wide ? panelOpen && tab === id : sideTab === id) ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
    >
      <Icon className="h-4 w-4" />
      {!!badge && <span className="absolute -right-0.5 -top-0.5 min-w-[14px] rounded-full bg-primary px-1 text-center font-mono text-[9px] leading-[14px] text-primary-foreground">{badge}</span>}
    </button>
  );

  return (
    <Sheet open={!!taskUid} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" data-layout={layout} className={cn("flex w-full flex-col gap-0 p-0", LAYOUT_CLASS[layout])}>
        {(isLoading || !task) && (
          <div className="p-6">
            <SheetHeader className="sr-only">
              <SheetTitle>Task</SheetTitle>
              <SheetDescription>Loading task</SheetDescription>
            </SheetHeader>
            {isError ? <p className="text-sm text-muted-foreground">This task doesn&apos;t exist or you don&apos;t have access.</p> : <div className="h-40 animate-pulse rounded-xl bg-muted" />}
          </div>
        )}

        {task && (
          <>
            <SheetHeader className="relative gap-0 border-b border-border bg-card px-6 pb-4 pr-32 pt-5 text-left">
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px]" style={{ background: "linear-gradient(90deg, var(--primary) 0%, var(--brass) 60%, transparent 100%)" }} />
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                {task.list.space.name} <span aria-hidden>/</span> {task.list.name}{" "}
                <TaskListsControl task={task} picker={picker} setPicker={setPicker} mode={pickMode} setMode={setPickMode} />
                {task.parent && (
                  <>
                    {" "}<span aria-hidden>/</span>{" "}
                    <button type="button" onClick={() => onOpenTask(task.parent!.uid)} className="normal-case tracking-normal text-primary hover:underline">{task.parent.name}</button>
                  </>
                )}
              </p>
              <div className="absolute right-[5.25rem] top-3">
                <TaskMenu
                  task={task}
                  mine={mine}
                  onPickList={(m) => { setPickMode(m); setPicker(true); }}
                  onOpenRelated={() => openTab("related")}
                  onArchive={() => window.confirm("Archive this task (and its subtasks)?") && archive.mutate()}
                  onOpenTask={onOpenTask}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label="Switch layout" title="Switch layout" className="absolute right-12 top-3 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                    {(() => { const I = LAYOUTS.find((l) => l.id === layout)!.icon; return <I className="h-4 w-4" />; })()}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">Task view layout</DropdownMenuLabel>
                  {LAYOUTS.map((l) => (
                    <DropdownMenuItem key={l.id} onClick={() => setLayout(l.id)}>
                      <l.icon className="mr-2 h-3.5 w-3.5" />
                      {l.label}
                      {layout === l.id && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <SheetTitle className="sr-only">{task.name}</SheetTitle>
              <SheetDescription className="sr-only">Task details</SheetDescription>
              <textarea
                value={name}
                readOnly={!canEdit}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name.trim() && name.trim() !== task.name && update({ name: name.trim() })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLTextAreaElement).blur();
                  }
                }}
                rows={1}
                aria-label="Task name"
                className="mt-1.5 w-full resize-none bg-transparent font-serif text-[28px] font-normal leading-tight tracking-tight text-foreground outline-none [field-sizing:content]"
              />
            </SheetHeader>

            <div ref={body} className={cn("flex min-h-0 flex-1", wide ? "flex-col lg:flex-row" : "flex-row")} style={{ ["--panel-w" as any]: `${panelW}px` }}>
              <div hidden={!wide && active !== "details"} className="min-h-0 flex-1 overflow-y-auto">
                {/* properties */}
                <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-1 border-b border-border px-6 py-4 sm:grid-cols-2", layout === "full" && !panelOpen && "xl:grid-cols-3")}>
                  <Prop icon={CircleDot} label="Status">
                    <StatusPicker statuses={task.statuses} value={task.statusId} disabled={!canEdit} onChange={(id) => update({ statusId: id })}>
                      <button type="button" className="rounded-md px-1 py-0.5 hover:bg-accent"><StatusPill status={status} /></button>
                    </StatusPicker>
                  </Prop>
                  <Prop icon={Users} label="Assignees">
                    <AssigneePicker members={members} value={task.assignees} disabled={!canEdit || !list} onChange={(ids) => update({ assigneeIds: ids })}>
                      <button type="button" className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-accent">
                        {task.assignees.length ? (
                          <>
                            <AvatarStack users={task.assignees} size={24} max={4} />
                            {task.assignees.length === 1 && <span className="text-[13px]">{userName(task.assignees[0]!)}</span>}
                          </>
                        ) : (
                          <span className="text-[13px] text-muted-foreground">Empty</span>
                        )}
                      </button>
                    </AssigneePicker>
                  </Prop>
                  <Prop icon={CalendarDays} label="Dates">
                    <span className="flex items-center gap-1 text-[13px]">
                      <DatePicker label="Start date" value={task.startDate} disabled={!canEdit} onChange={(iso) => update({ startDate: iso })}>
                        <button type="button" className="rounded-md px-1 py-0.5 text-muted-foreground hover:bg-accent">{task.startDate ? dueText(task.startDate) : "Start"}</button>
                      </DatePicker>
                      <span aria-hidden className="text-muted-foreground">→</span>
                      <DatePicker label="Due date" value={task.dueDate} disabled={!canEdit} onChange={(iso) => update({ dueDate: iso })}>
                        <button type="button" className="rounded-md px-1 py-0.5 hover:bg-accent">{task.dueDate ? <DueLabel task={task} /> : <span className="text-muted-foreground">Due</span>}</button>
                      </DatePicker>
                    </span>
                  </Prop>
                  <Prop icon={Flag} label="Priority">
                    <PriorityPicker value={task.priority} disabled={!canEdit} onChange={(p) => update({ priority: p })}>
                      <button type="button" className="rounded-md px-1 py-0.5 hover:bg-accent"><PriorityFlag priority={task.priority} showLabel /></button>
                    </PriorityPicker>
                  </Prop>
                  <Prop icon={Hourglass} label="Estimate">
                    <EstimateField task={task} onSave={(m) => update({ timeEstimate: m })} />
                  </Prop>
                  <Prop icon={Timer} label="Track time">
                    <TimeTracker task={task} />
                  </Prop>
                  <Prop icon={TagIcon} label="Tags">
                    <TagsField task={task} spaceId={task.list.spaceId} onSave={(ids) => update({ tagIds: ids })} />
                  </Prop>
                </dl>

                <DescriptionSection task={task} onSave={(d) => update({ description: d })} />
                <div id="task-custom-fields" />
                <CustomFieldsSection taskId={task.id} listId={task.listId} spaceId={task.list.spaceId} members={members} canEdit={canEdit} canManage={task.access.canManage} />

                {/* subtasks */}
                {!task.parentId && (
                  <section className="border-b border-border px-6 py-4">
                    <h3 className="mb-2 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                      Subtasks <span className="normal-case tracking-normal">{task.subtasks.length}</span>
                    </h3>
                    <ul className="overflow-hidden rounded-lg border border-border">
                      {task.subtasks.map((s) => {
                        const st = task.statuses.find((x) => x.id === s.statusId);
                        return (
                          <li key={s.id} className="flex items-center gap-2.5 border-b border-border/70 px-3 py-2 last:border-b-0 hover:bg-accent/30">
                            <StatusPicker statuses={task.statuses} value={s.statusId} disabled={!canEdit} onChange={(id) => save.mutate({ id: s.id, body: { statusId: id } })}>
                              <button type="button" aria-label="Subtask status"><StatusGlyph status={st} size={14} /></button>
                            </StatusPicker>
                            <button type="button" onClick={() => onOpenTask(s.uid)} className={cn("min-w-0 flex-1 truncate text-left text-[13.5px] hover:text-primary", s.completedAt && "text-muted-foreground line-through")}>{s.name}</button>
                            <AvatarStack users={s.assignees} size={20} />
                            {s.dueDate && <DueLabel task={s} className="text-[12px]" />}
                          </li>
                        );
                      })}
                      {canEdit && (
                        <li className="flex items-center gap-2 px-3 py-1.5">
                          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                          <input
                            value={subName}
                            onChange={(e) => setSubName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && subName.trim() && addSub.mutate(subName.trim())}
                            placeholder="Add subtask, then Enter"
                            aria-label="New subtask"
                            className="h-7 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground"
                          />
                        </li>
                      )}
                      {!canEdit && task.subtasks.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">No subtasks</li>}
                    </ul>
                  </section>
                )}

                <ChecklistsSection task={task} members={members} />
                <RelationshipsSection task={task} />
                <AttachmentsSection task={task} />
              </div>

              {!wide && active !== "details" && (
                <aside aria-label={PANEL_TABS.find((t) => t.id === active)!.label} className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/25">
                  {panelBody(active)}
                </aside>
              )}
              {!wide && (
                <nav aria-label="Task panels" className="flex shrink-0 flex-col items-center gap-1 border-l border-border bg-card px-1.5 py-2">
                  {railBtn("details", "Details", LayoutList)}
                  <span aria-hidden className="my-1 h-px w-5 bg-border" />
                  {PANEL_TABS.map((t) => railBtn(t.id, t.label, t.icon, t.id === "comments" ? comments.length : undefined))}
                </nav>
              )}

              {wide && (
                <>
                  {/* icon rail */}
                  <nav aria-label="Task panels" className="hidden shrink-0 flex-col items-center gap-1 border-l border-border bg-card px-1.5 py-2 lg:flex">
                    <button type="button" aria-label={panelOpen ? "Collapse panel" : "Expand panel"} title={panelOpen ? "Collapse" : "Expand"} onClick={() => setPanelOpen(!panelOpen)} className="mb-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                      {panelOpen ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
                    </button>
                    {PANEL_TABS.map((t, i) => (
                      <div key={t.id} className="flex flex-col items-center">
                        {i === 2 && <span aria-hidden className="my-1 h-px w-5 bg-border" />}
                        {railBtn(t.id, t.label, t.icon, t.id === "comments" ? comments.length : undefined)}
                      </div>
                    ))}
                  </nav>

                  {panelOpen && (
                    <aside aria-label={PANEL_TABS.find((t) => t.id === tab)!.label} className="relative flex min-h-0 w-full flex-col border-t border-border bg-muted/25 lg:w-[var(--panel-w)] lg:shrink-0 lg:border-l lg:border-t-0">
                      {/* drag handle */}
                      <div
                        role="separator"
                        aria-orientation="vertical"
                        aria-label="Resize panel"
                        tabIndex={0}
                        onPointerDown={startDrag}
                        onKeyDown={resizeKey}
                        onDoubleClick={() => setPanelW(420)}
                        className="absolute inset-y-0 -left-1 z-10 hidden w-2 cursor-col-resize lg:block [&:hover>span]:bg-primary/50 focus-visible:outline-none [&:focus-visible>span]:bg-primary"
                      >
                        <span className="mx-auto block h-full w-0.5 bg-transparent transition-colors" />
                      </div>
                      {panelBody(tab)}
                    </aside>
                  )}
                </>
              )}
            </div>

            {/* footer */}
            <footer className="border-t border-border bg-card px-6 py-1.5">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>Created by {userName(task.createdBy)} · {timeAgo(task.createdAt)}</span>
                <span className="flex-1" />
                <button type="button" onClick={copyLink} className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-accent hover:text-foreground"><Link2 className="h-3.5 w-3.5" />Copy link</button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => window.confirm("Archive this task (and its subtasks)?") && archive.mutate()}
                    className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Archive className="h-3.5 w-3.5" />Archive
                  </button>
                )}
              </div>
            </footer>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Description: a short preview that expands into the editor on click; files can be attached. */
function DescriptionSection({ task, onSave }: { task: WorkTaskDetail; onSave: (d: string | null) => void }) {
  const canEdit = task.access.canEdit;
  const [value, setValue] = useState(task.description ?? "");
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useUpload(task, "description");
  const { data: files = [] } = useQuery({ queryKey: attachmentsKey(task.id), queryFn: () => workApi.attachments(task.id) });
  const descFiles = files.filter((f) => f.source === "description");
  useEffect(() => setValue(task.description ?? ""), [task.id, task.description]);
  const long = value.length > 280 || value.split("\n").length > 5;

  const start = () => {
    if (!canEdit) return setExpanded(true);
    setEditing(true);
    requestAnimationFrame(() => area.current?.focus());
  };

  return (
    <section className="border-b border-border px-6 py-4" aria-label="Description">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Description</h3>
        <span className="flex-1" />
        {canEdit && (
          <>
            <input ref={fileInput} type="file" multiple hidden aria-label="Attach files to description" onChange={(e) => { if (e.target.files?.length) upload.mutate(Array.from(e.target.files)); e.target.value = ""; }} />
            <button type="button" onClick={() => fileInput.current?.click()} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground">
              {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />} Attach
            </button>
          </>
        )}
      </div>

      {editing ? (
        <div className="rounded-lg border border-primary/40 bg-background ring-2 ring-primary/10">
          <textarea
            ref={area}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (value !== (task.description ?? "")) onSave(value || null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
            placeholder="Write a description… (Esc or click outside to save)"
            aria-label="Description"
            className="block min-h-[220px] w-full resize-y bg-transparent px-3 py-2.5 text-[14px] leading-relaxed outline-none [field-sizing:content]"
          />
        </div>
      ) : value ? (
        <div className="relative">
          <button
            type="button"
            onClick={start}
            aria-label="Edit description"
            className={cn("block w-full whitespace-pre-wrap break-words rounded-lg px-2 py-1.5 text-left text-[14px] leading-relaxed transition-colors hover:bg-accent/40", !expanded && long && "max-h-[140px] overflow-hidden")}
          >
            {value}
          </button>
          {long && !expanded && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-14 items-end justify-center bg-gradient-to-t from-card to-transparent">
              <button type="button" onClick={() => setExpanded(true)} className="pointer-events-auto mb-1 rounded-full border border-border bg-card px-3 py-0.5 text-[12px] font-medium shadow-sm hover:bg-accent">Show more</button>
            </div>
          )}
        </div>
      ) : (
        <button type="button" onClick={start} disabled={!canEdit} className="flex w-full items-center rounded-lg border border-dashed border-transparent px-2 py-2 text-left text-[14px] text-muted-foreground hover:border-border hover:bg-accent/30">
          {canEdit ? "Add a description…" : "No description"}
        </button>
      )}

      {descFiles.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {descFiles.map((a) => <FileChip key={a.id} a={a} />)}
        </div>
      )}
    </section>
  );
}

/** Related items: Relationships (task links) | References (web links). */
function RelatedPanel({ task, onAdd }: { task: WorkTaskDetail; onAdd: () => void }) {
  const [sub, setSub] = useState<"relationships" | "references">("relationships");
  const n = task.links.waitingOn.length + task.links.blocking.length + task.links.linked.length;
  return (
    <div className="px-4 py-3">
      <div className="mb-3 grid grid-cols-2 rounded-lg bg-muted p-0.5">
        {(["relationships", "references"] as const).map((s) => (
          <button key={s} type="button" aria-pressed={sub === s} onClick={() => setSub(s)} className={cn("rounded-md py-1.5 text-[12.5px] font-medium capitalize", sub === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {s === "references" ? "Links" : "Relationships"}
          </button>
        ))}
      </div>
      {sub === "relationships" ? (
        n === 0 && !task.access.canEdit ? (
          <EmptyRelated onAdd={onAdd} canEdit={false} />
        ) : (
          <div className="-mx-4 -mt-3 [&>section]:border-b-0 [&>section]:px-4">
            <RelationshipsSection task={task} />
          </div>
        )
      ) : (
        <WebLinksList task={task} />
      )}
    </div>
  );
}

function EmptyRelated({ onAdd, canEdit }: { onAdd: () => void; canEdit: boolean }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground"><GitBranch className="h-5 w-5" /></span>
      <p className="text-[14px] font-semibold">No related items</p>
      <p className="mt-1 max-w-[240px] text-[12.5px] text-muted-foreground">Link related tasks or web pages to organise and quickly reach them here.</p>
      {canEdit && <button type="button" onClick={onAdd} className="mt-3 flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[12.5px] hover:bg-accent"><Plus className="h-3.5 w-3.5" /> Add a link</button>}
    </div>
  );
}

function Prop({ icon: Icon, label, children }: { icon: typeof Users; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[38px] items-center gap-3">
      <dt className="flex w-24 shrink-0 items-center gap-2 text-[12.5px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}
