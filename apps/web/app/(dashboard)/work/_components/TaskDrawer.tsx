"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, CalendarDays, CircleDot, Flag, Hourglass, Link2, Plus, Tag as TagIcon, Timer, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { userName, workApi, workKeys, type TaskInput, type WorkTask, type WorkUser } from "@/services/work.api";
import { ChecklistsSection, EstimateField, RelationshipsSection, TagsField, TimeTracker, Timeline } from "./TaskDetailSections";
import { Avatar, AvatarStack, DueLabel, PriorityFlag, StatusGlyph, StatusPill, dueText } from "./primitives";
import { AssigneePicker, DatePicker, PriorityPicker, StatusPicker } from "./pickers";

const errMsg = (e: any) => e?.response?.data?.message?.toString?.() ?? "Something went wrong.";

function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Task detail drawer (opened with ?task=<uid>). */
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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [comment, setComment] = useState("");
  const [subName, setSubName] = useState("");
  const [commentAssignee, setCommentAssignee] = useState<WorkUser | null>(null);
  useEffect(() => {
    setName(task?.name ?? "");
    setDescription(task?.description ?? "");
  }, [task?.id, task?.name, task?.description]);

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
  const addComment = useMutation({
    mutationFn: (c: string) => workApi.addComment(task!.id, c, { assigneeId: commentAssignee?.id }),
    onSuccess: () => {
      setComment("");
      setCommentAssignee(null);
      qc.invalidateQueries({ queryKey: workKeys.comments(task!.id) });
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

  return (
    <Sheet open={!!taskUid} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:w-[680px] data-[side=right]:sm:max-w-[680px]">
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
            <SheetHeader className="relative gap-0 border-b border-border bg-card px-6 pb-4 pr-14 pt-5 text-left">
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px]" style={{ background: "linear-gradient(90deg, var(--primary) 0%, var(--brass) 60%, transparent 100%)" }} />
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                {task.list.space.name} <span aria-hidden>/</span> {task.list.name}
                {task.parent && (
                  <>
                    {" "}<span aria-hidden>/</span>{" "}
                    <button type="button" onClick={() => onOpenTask(task.parent!.uid)} className="normal-case tracking-normal text-primary hover:underline">{task.parent.name}</button>
                  </>
                )}
              </p>
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

            <div className="flex-1 overflow-y-auto">
              {/* properties */}
              <dl className="grid grid-cols-1 gap-x-6 gap-y-1 border-b border-border px-6 py-4 sm:grid-cols-2">
                <Prop icon={CircleDot} label="Status">
                  <StatusPicker statuses={task.statuses} value={task.statusId} disabled={!canEdit} onChange={(id) => update({ statusId: id })}>
                    <button type="button" className="rounded-md px-1 py-0.5 hover:bg-accent"><StatusPill status={status} /></button>
                  </StatusPicker>
                </Prop>
                <Prop icon={Users} label="Assignees">
                  <AssigneePicker members={list?.members ?? []} value={task.assignees} disabled={!canEdit || !list} onChange={(ids) => update({ assigneeIds: ids })}>
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

              {/* description */}
              <section className="border-b border-border px-6 py-4">
                <h3 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Description</h3>
                <textarea
                  value={description}
                  readOnly={!canEdit}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => description !== (task.description ?? "") && update({ description: description || null })}
                  placeholder={canEdit ? "Add a description…" : "No description"}
                  aria-label="Description"
                  className="min-h-[90px] w-full resize-y rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[14px] leading-relaxed outline-none transition-colors hover:border-border focus:border-primary/40 focus:bg-background [field-sizing:content]"
                />
              </section>

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

              <ChecklistsSection task={task} members={list?.members ?? []} />
              <RelationshipsSection task={task} />

              {/* comments + history */}
              <Timeline
                task={task}
                comments={comments}
                currentUserId={user?.id}
                members={list?.members ?? []}
                onDeleteComment={(id) => delComment.mutate(id)}
              />
            </div>

            {/* composer + actions */}
            <footer className="border-t border-border bg-card px-6 py-3">
              {canEdit && (
                <div className="flex items-end gap-2">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && comment.trim()) addComment.mutate(comment.trim());
                    }}
                    placeholder="Write a comment…  (Ctrl+Enter to send)"
                    aria-label="Comment"
                    rows={2}
                    className="min-h-[44px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                  />
                  <AssigneePicker
                    members={list?.members ?? []}
                    value={commentAssignee ? [commentAssignee] : []}
                    onChange={(ids) => {
                      const id = ids.filter((x) => x !== commentAssignee?.id)[0];
                      setCommentAssignee(id ? (list?.members ?? []).find((m) => m.id === id) ?? null : null);
                    }}
                  >
                    <button
                      type="button"
                      title="Assign this comment"
                      aria-label="Assign this comment"
                      className={cn("flex h-10 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium", commentAssignee ? "border-[#b08d57]/60 bg-[#b08d57]/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
                    >
                      {commentAssignee ? <><Avatar user={commentAssignee} size={18} /> <span className="max-w-[70px] truncate">{commentAssignee.firstName}</span></> : <UserCheck className="h-4 w-4" />}
                    </button>
                  </AssigneePicker>
                  <button
                    type="button"
                    disabled={!comment.trim() || addComment.isPending}
                    onClick={() => addComment.mutate(comment.trim())}
                    className="h-10 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground hover:bg-forest/90 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"
                  >
                    Comment
                  </button>
                </div>
              )}
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
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
