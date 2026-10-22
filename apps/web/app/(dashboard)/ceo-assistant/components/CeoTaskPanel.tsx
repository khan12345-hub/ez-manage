"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, Calendar, Building2, LayoutGrid, Users, MessageSquare,
  Bell, AlertTriangle, Clock, CheckCircle2, ChevronRight, Send,
  CheckSquare, Square, ExternalLink, BrainCircuit, RefreshCw,
  UserRoundCog, Search,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getCeoTaskDetail, addCommentToTask, sendTaskNotification,
  markTaskDone, reassignTask, getTaskWorkspaceMembers,
} from "../management/management.api";
import type { MyTaskItem } from "@/services/ceo-assistant.api";

interface Props {
  task: { taskId: number; taskName: string } | null;
  onClose: () => void;
  onWorkspaceClick?: (workspaceName: string) => void;
}

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function CategoryBadge({ category }: { category: MyTaskItem["category"] }) {
  const map = {
    overdue:  { label: "Overdue",   cls: "bg-red-100 text-red-700 border-red-200" },
    due_soon: { label: "Due Soon",  cls: "bg-amber-100 text-amber-700 border-amber-200" },
    done:     { label: "Done",      cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    inactive: { label: "Inactive",  cls: "bg-slate-100 text-slate-600 border-slate-200" },
    on_track: { label: "On Track",  cls: "bg-blue-100 text-blue-700 border-blue-200" },
  };
  const { label, cls } = map[category] ?? map.on_track;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", cls)}>
      {label}
    </span>
  );
}

export function CeoTaskPanel({ task, onClose, onWorkspaceClick }: Props) {
  const [mode, setMode] = useState<"view" | "comment" | "notify" | "ai" | "reassign" | "done-confirm">("view");
  const [commentText, setCommentText] = useState("");
  const [notifyText, setNotifyText] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [aiType, setAiType] = useState<"comment" | "notify">("comment");
  const [aiText, setAiText] = useState("");
  const [reassignSearch, setReassignSearch] = useState("");
  const [selectedReassignId, setSelectedReassignId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["ceo-task-detail", task?.taskId],
    queryFn: () => getCeoTaskDetail(task!.taskId),
    enabled: !!task,
    staleTime: 30_000,
  });

  const { data: wsMembers, isLoading: loadingMembers } = useQuery({
    queryKey: ["ceo-task-ws-members", task?.taskId],
    queryFn: () => getTaskWorkspaceMembers(task!.taskId),
    enabled: !!task && mode === "reassign",
    staleTime: 60_000,
  });

  const commentMutation = useMutation({
    mutationFn: () => addCommentToTask(task!.taskId, commentText),
    onSuccess: () => {
      toast.success("Comment added.");
      setCommentText("");
      setMode("view");
      queryClient.invalidateQueries({ queryKey: ["ceo-task-detail", task?.taskId] });
    },
    onError: () => toast.error("Failed to add comment."),
  });

  const notifyMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await sendTaskNotification(task!.taskId, id, notifyText);
      }
    },
    onSuccess: () => {
      const count = selectedIds.size;
      toast.success(`Notification sent to ${count} assignee${count !== 1 ? "s" : ""}.`);
      setNotifyText("");
      setSelectedIds(new Set());
      setMode("view");
    },
    onError: () => toast.error("Failed to send notification."),
  });

  const aiMutation = useMutation({
    mutationFn: async () => {
      if (aiType === "comment") {
        return addCommentToTask(task!.taskId, aiText);
      }
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await sendTaskNotification(task!.taskId, id, aiText);
      }
    },
    onSuccess: () => {
      if (aiType === "comment") {
        toast.success("Comment added.");
        queryClient.invalidateQueries({ queryKey: ["ceo-task-detail", task?.taskId] });
      } else {
        toast.success(`Notification sent to ${selectedIds.size} assignee${selectedIds.size !== 1 ? "s" : ""}.`);
      }
      setAiText("");
      setMode("view");
    },
    onError: () => toast.error("Failed to send message."),
  });

  const markDoneMutation = useMutation({
    mutationFn: () => markTaskDone(task!.taskId),
    onSuccess: (result) => {
      toast.success(`Task marked as "${result.status.label}".`);
      setMode("view");
      queryClient.invalidateQueries({ queryKey: ["ceo-task-detail", task?.taskId] });
      queryClient.invalidateQueries({ queryKey: ["ceo-task-overview"] });
    },
    onError: () => toast.error("Failed to mark task as done."),
  });

  const reassignMutation = useMutation({
    mutationFn: () => reassignTask(task!.taskId, selectedReassignId!),
    onSuccess: (result) => {
      toast.success(`Task reassigned to ${result.assignee.firstName} ${result.assignee.lastName}.`);
      setMode("view");
      setSelectedReassignId(null);
      setReassignSearch("");
      queryClient.invalidateQueries({ queryKey: ["ceo-task-detail", task?.taskId] });
      queryClient.invalidateQueries({ queryKey: ["ceo-task-overview"] });
    },
    onError: () => toast.error("Failed to reassign task."),
  });

  function toggleAssignee(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function enterNotifyMode() {
    if (data) setSelectedIds(new Set(data.assignees.map((a) => a.id)));
    setMode("notify");
  }

  function generateMessage(type: "comment" | "notify"): string {
    if (!data) return "";
    const name = data.name;
    const ws   = data.workspaceName;

    if (data.daysOverdue && data.daysOverdue > 0) {
      const d = data.daysOverdue;
      return type === "comment"
        ? `Hi team,\n\nI wanted to follow up on "${name}" which is currently ${d} day${d !== 1 ? "s" : ""} overdue in ${ws}.\n\nCould you please provide a status update and your expected completion date? If there are any blockers, flag them so we can help resolve them quickly.\n\nThank you.`
        : `"${name}" is ${d} day${d !== 1 ? "s" : ""} overdue. Please update the task status and provide an estimated completion date as soon as possible.`;
    }

    if (data.dueDate) {
      const due    = new Date(data.dueDate);
      const dueStr = due.toLocaleDateString("en-US", { month: "long", day: "numeric" });
      return type === "comment"
        ? `Hi team,\n\nFriendly reminder that "${name}" is due on ${dueStr}.\n\nPlease ensure progress is on track. Let me know if you need any support or anticipate delays.\n\nThank you.`
        : `Reminder: "${name}" is due on ${dueStr}. Please ensure you are on track to complete it on time.`;
    }

    return type === "comment"
      ? `Hi team,\n\n"${name}" in ${ws} hasn't had any recent activity.\n\nCould you please share a status update? If this task is blocked or needs re-prioritizing, let me know.\n\nThank you.`
      : `"${name}" has had no recent activity. Please update the task status or flag any blockers so we can keep things moving.`;
  }

  function enterAiMode() {
    if (data?.assignees.length) setSelectedIds(new Set(data.assignees.map((a) => a.id)));
    setAiType("comment");
    setAiText(generateMessage("comment"));
    setMode("ai");
  }

  if (!task) return null;

  const dueDate = data?.dueDate ? new Date(data.dueDate) : null;
  const isDone = data?.status
    ? ["done", "complete", "completed", "finished", "closed", "deployed", "shipped", "resolved"].some((k) =>
        data.status?.label?.toLowerCase().includes(k),
      )
    : false;
  const taskCategory: MyTaskItem["category"] = isDone
    ? "done"
    : data?.daysOverdue
    ? "overdue"
    : dueDate && !data?.daysOverdue
    ? "due_soon"
    : "on_track";

  const allSelected = data ? data.assignees.length > 0 && data.assignees.every((a) => selectedIds.has(a.id)) : false;
  const someSelected = selectedIds.size > 0;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-background shadow-2xl border-l border-border">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/30 px-5 py-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">CEO VIEW</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-5 w-3/4" />
            ) : (
              <h2 className="text-base font-bold text-foreground leading-snug">{data?.name ?? task.taskName}</h2>
            )}
            {data && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <CategoryBadge category={taskCategory} />
                {data.status && (
                  <span
                    className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                    style={{
                      background: data.status.color ? `${data.status.color}20` : undefined,
                      color: data.status.color || undefined,
                      borderColor: data.status.color ? `${data.status.color}40` : undefined,
                    }}
                  >
                    {data.status.label}
                  </span>
                )}
                {data.daysOverdue && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                    <AlertTriangle className="h-3 w-3" />
                    {data.daysOverdue}d overdue
                  </span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : data ? (
            <>
              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onWorkspaceClick ? () => onWorkspaceClick(data.workspaceName) : undefined}
                  disabled={!onWorkspaceClick}
                  className={cn(
                    "rounded-lg bg-muted/40 border border-border p-3 text-left w-full group",
                    onWorkspaceClick && "hover:border-blue-300 hover:bg-blue-50/40 dark:hover:border-blue-800 dark:hover:bg-blue-950/20 transition-colors cursor-pointer"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Workspace</span>
                    {onWorkspaceClick && (
                      <ExternalLink className="h-3 w-3 text-blue-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={cn("text-sm font-medium", onWorkspaceClick ? "text-blue-600 dark:text-blue-400 group-hover:underline" : "text-foreground")}>
                      {data.workspaceName}
                    </span>
                  </div>
                  {onWorkspaceClick && (
                    <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity leading-none mt-0.5 block">
                      View workspace →
                    </span>
                  )}
                </button>
                <div className="rounded-lg bg-muted/40 border border-border p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Board</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">{data.boardName}</span>
                </div>
                <div className="rounded-lg bg-muted/40 border border-border p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Group</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">{data.groupName}</span>
                </div>
                {dueDate && (
                  <div className={cn("rounded-lg border p-3", data.daysOverdue ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900" : "bg-muted/40 border-border")}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Calendar className={cn("h-3.5 w-3.5", data.daysOverdue ? "text-red-500" : "text-muted-foreground")} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Due Date</span>
                    </div>
                    <span className={cn("text-sm font-medium", data.daysOverdue ? "text-red-600" : "text-foreground")}>
                      {dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                )}
              </div>

              {/* Assignees */}
              {data.assignees.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Assignees</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.assignees.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 rounded-full bg-muted/50 border border-border pl-1 pr-3 py-1">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={a.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-[10px]">{initials(a.firstName, a.lastName)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium">{a.firstName} {a.lastName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent comments */}
              {data.comments.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent Comments</span>
                  </div>
                  <div className="space-y-2">
                    {data.comments.slice(0, 4).map((c) => (
                      <div key={c.id} className="rounded-lg border border-border bg-muted/30 p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={c.author.avatarUrl ?? undefined} />
                            <AvatarFallback className="text-[9px]">{initials(c.author.firstName, c.author.lastName)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-semibold">{c.author.firstName} {c.author.lastName}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {new Date(c.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{c.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comment form */}
              {mode === "comment" && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900 p-3 space-y-2">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Add Comment (visible to all task members)</p>
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Type your comment..."
                    rows={3}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setMode("view")}>Cancel</Button>
                    <Button
                      size="sm"
                      disabled={!commentText.trim() || commentMutation.isPending}
                      onClick={() => commentMutation.mutate()}
                      className="gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {commentMutation.isPending ? "Sending..." : "Add Comment"}
                    </Button>
                  </div>
                </div>
              )}

              {/* AI Message Composer */}
              {mode === "ai" && data && (
                <div className="rounded-xl border border-violet-200 dark:border-violet-900 overflow-hidden"
                  style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.07) 0%, rgba(255,255,255,0) 100%)" }}>
                  <div className="px-4 py-3 border-b border-violet-100 dark:border-violet-900/60 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500 shrink-0">
                      <BrainCircuit className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-sm font-bold text-violet-700 dark:text-violet-400">AI Message Composer</span>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Type toggle */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Send as</p>
                      <div className="flex rounded-lg border border-border bg-background overflow-hidden">
                        {(["comment", "notify"] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => { setAiType(t); setAiText(generateMessage(t)); }}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors",
                              aiType === t ? "bg-violet-500 text-white" : "text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {t === "comment" ? <MessageSquare className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                            {t === "comment" ? "Comment" : "Notification"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Recipients (notify only) */}
                    {aiType === "notify" && data.assignees.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recipients</p>
                          <span className="text-[10px] text-muted-foreground">{selectedIds.size} selected</span>
                        </div>
                        <div className="rounded-lg border border-border bg-background overflow-hidden">
                          <button
                            onClick={() => {
                              if (allSelected) setSelectedIds(new Set());
                              else setSelectedIds(new Set(data.assignees.map((a) => a.id)));
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 border-b border-border hover:bg-muted/30 transition-colors"
                          >
                            {allSelected
                              ? <CheckSquare className="h-4 w-4 text-violet-600 shrink-0" />
                              : <Square className="h-4 w-4 text-muted-foreground shrink-0" />}
                            <span className="text-xs font-semibold">All Assignees</span>
                          </button>
                          {data.assignees.map((a) => (
                            <button key={a.id} onClick={() => toggleAssignee(a.id)}
                              className="w-full flex items-center gap-3 px-3 py-2 last:border-0 border-b border-border hover:bg-muted/30 transition-colors">
                              {selectedIds.has(a.id)
                                ? <CheckSquare className="h-4 w-4 text-violet-600 shrink-0" />
                                : <Square className="h-4 w-4 text-muted-foreground shrink-0" />}
                              <Avatar className="h-5 w-5 shrink-0">
                                <AvatarImage src={a.avatarUrl ?? undefined} />
                                <AvatarFallback className="text-[9px]">{initials(a.firstName, a.lastName)}</AvatarFallback>
                              </Avatar>
                              <span className="text-xs font-medium">{a.firstName} {a.lastName}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Message */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Message</p>
                        <button
                          onClick={() => setAiText(generateMessage(aiType))}
                          className="flex items-center gap-1 text-[10px] font-semibold text-violet-600 hover:text-violet-800 dark:text-violet-400 transition-colors"
                        >
                          <RefreshCw className="h-2.5 w-2.5" />
                          Regenerate
                        </button>
                      </div>
                      <textarea
                        value={aiText}
                        onChange={(e) => setAiText(e.target.value)}
                        rows={5}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 leading-relaxed"
                      />
                    </div>

                    {/* Send */}
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setMode("view")}>Cancel</Button>
                      <Button
                        size="sm"
                        disabled={!aiText.trim() || (aiType === "notify" && !someSelected) || aiMutation.isPending}
                        onClick={() => aiMutation.mutate()}
                        className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
                      >
                        {aiType === "comment"
                          ? <MessageSquare className="h-3.5 w-3.5" />
                          : <Bell className="h-3.5 w-3.5" />}
                        {aiMutation.isPending
                          ? "Sending…"
                          : aiType === "comment"
                          ? "Post Comment"
                          : `Notify ${selectedIds.size > 1 ? `${selectedIds.size} people` : "1 person"}`}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Mark Done confirmation */}
              {mode === "done-confirm" && data && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-900 p-4 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Mark as Done?</p>
                      <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70">
                        Status will update and all assignees will be notified.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setMode("view")}>Cancel</Button>
                    <Button
                      size="sm"
                      disabled={markDoneMutation.isPending}
                      onClick={() => markDoneMutation.mutate()}
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {markDoneMutation.isPending ? "Updating…" : "Yes, Mark Done"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Reassign picker */}
              {mode === "reassign" && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-900 overflow-hidden">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-blue-100 dark:border-blue-900/60">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500 shrink-0">
                      <UserRoundCog className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-sm font-bold text-blue-800 dark:text-blue-300">Reassign Task</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {selectedReassignId ? "1 selected" : "Select a member"}
                    </span>
                  </div>

                  <div className="p-3 space-y-2">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        value={reassignSearch}
                        onChange={(e) => setReassignSearch(e.target.value)}
                        placeholder="Search member…"
                        className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Member list */}
                    <div className="rounded-lg border border-border bg-background overflow-hidden max-h-52 overflow-y-auto">
                      {loadingMembers ? (
                        <div className="flex items-center justify-center py-6">
                          <div className="h-5 w-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                        </div>
                      ) : (wsMembers ?? []).filter((m) =>
                          `${m.firstName} ${m.lastName}`.toLowerCase().includes(reassignSearch.toLowerCase())
                        ).length === 0 ? (
                        <p className="py-6 text-center text-xs text-muted-foreground">No members found</p>
                      ) : (
                        (wsMembers ?? [])
                          .filter((m) =>
                            `${m.firstName} ${m.lastName}`.toLowerCase().includes(reassignSearch.toLowerCase())
                          )
                          .map((m) => (
                            <button
                              key={m.id}
                              onClick={() => setSelectedReassignId(m.id === selectedReassignId ? null : m.id)}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-0 text-left transition-colors",
                                selectedReassignId === m.id
                                  ? "bg-blue-50 dark:bg-blue-950/30"
                                  : "hover:bg-muted/40"
                              )}
                            >
                              <div className={cn(
                                "h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
                                selectedReassignId === m.id
                                  ? "border-blue-500 bg-blue-500"
                                  : "border-muted-foreground/30"
                              )}>
                                {selectedReassignId === m.id && (
                                  <div className="h-full w-full rounded-full flex items-center justify-center">
                                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                                  </div>
                                )}
                              </div>
                              <Avatar className="h-6 w-6 shrink-0">
                                <AvatarImage src={m.avatarUrl ?? undefined} />
                                <AvatarFallback className="text-[9px]">{initials(m.firstName, m.lastName)}</AvatarFallback>
                              </Avatar>
                              <span className={cn("text-sm font-medium", selectedReassignId === m.id ? "text-blue-700 dark:text-blue-300" : "text-foreground")}>
                                {m.firstName} {m.lastName}
                              </span>
                            </button>
                          ))
                      )}
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => { setMode("view"); setSelectedReassignId(null); setReassignSearch(""); }}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={!selectedReassignId || reassignMutation.isPending}
                        onClick={() => reassignMutation.mutate()}
                        className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <UserRoundCog className="h-3.5 w-3.5" />
                        {reassignMutation.isPending ? "Reassigning…" : "Confirm Reassign"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Notify form — multi-select */}
              {mode === "notify" && data && (
                <div className="rounded-lg border border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-900 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-purple-700 dark:text-purple-400">Send In-App Notification</p>
                    <span className="text-[10px] text-muted-foreground">{selectedIds.size} selected</span>
                  </div>

                  {/* Assignee checkboxes */}
                  {data.assignees.length > 0 && (
                    <div className="rounded-lg border border-border bg-background overflow-hidden">
                      {/* Select all row */}
                      <button
                        onClick={() => {
                          if (allSelected) setSelectedIds(new Set());
                          else setSelectedIds(new Set(data.assignees.map((a) => a.id)));
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 border-b border-border hover:bg-muted/30 transition-colors"
                      >
                        {allSelected ? (
                          <CheckSquare className="h-4 w-4 text-purple-600 shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-foreground">Select All</span>
                      </button>
                      {/* Individual assignees */}
                      {data.assignees.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => toggleAssignee(a.id)}
                          className="w-full flex items-center gap-3 px-3 py-2 last:border-0 border-b border-border hover:bg-muted/30 transition-colors"
                        >
                          {selectedIds.has(a.id) ? (
                            <CheckSquare className="h-4 w-4 text-purple-600 shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <Avatar className="h-5 w-5 shrink-0">
                            <AvatarImage src={a.avatarUrl ?? undefined} />
                            <AvatarFallback className="text-[9px]">{initials(a.firstName, a.lastName)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium text-foreground">{a.firstName} {a.lastName}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <textarea
                    value={notifyText}
                    onChange={(e) => setNotifyText(e.target.value)}
                    placeholder="Message to send..."
                    rows={3}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setMode("view")}>Cancel</Button>
                    <Button
                      size="sm"
                      disabled={!notifyText.trim() || !someSelected || notifyMutation.isPending}
                      onClick={() => notifyMutation.mutate()}
                      className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Bell className="h-3.5 w-3.5" />
                      {notifyMutation.isPending ? "Sending..." : `Notify ${selectedIds.size > 1 ? `${selectedIds.size} people` : "1 person"}`}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer actions */}
        {mode === "view" && data && (
          <div className="border-t border-border bg-muted/20 px-5 py-3 space-y-2">
            {/* Action row — Mark Done + Reassign */}
            <div className="flex gap-2">
              {!isDone && (
                <Button
                  size="sm"
                  className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => setMode("done-confirm")}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark Done
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400",
                  isDone ? "flex-1" : ""
                )}
                onClick={() => setMode("reassign")}
              >
                <UserRoundCog className="h-3.5 w-3.5" />
                Reassign
              </Button>
            </div>
            {/* AI Compose — primary CTA */}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 border-violet-200 bg-violet-50/50 text-violet-700 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/20 dark:text-violet-400 font-semibold"
              onClick={enterAiMode}
            >
              <BrainCircuit className="h-3.5 w-3.5" />
              AI Compose Message
            </Button>
            {/* Manual options */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400"
                onClick={() => setMode("comment")}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Comment
              </Button>
              {data.assignees.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-900 dark:text-purple-400"
                  onClick={enterNotifyMode}
                >
                  <Bell className="h-3.5 w-3.5" />
                  Notify
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
