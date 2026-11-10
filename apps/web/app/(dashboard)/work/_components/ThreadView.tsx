"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { userName, workApi, workKeys, type WorkComment, type WorkTaskDetail, type WorkTaskMine, type WorkUser } from "@/services/work.api";
import { AssigneePicker } from "./pickers";
import { Avatar } from "./primitives";
import { Composer } from "./Composer";
import { CommentCard } from "./TaskDetailSections";

/** A comment's thread, shown in the task's side panel (ClickUp: "Fiaz's Thread"). */
export function ThreadView({
  task,
  rootId,
  comments,
  members,
  currentUserId,
  mine,
  onBack,
  onDelete,
}: {
  task: WorkTaskDetail;
  rootId: number;
  comments: WorkComment[];
  members: WorkUser[];
  currentUserId?: number;
  mine?: WorkTaskMine;
  onBack: () => void;
  onDelete: (id: number) => void;
}) {
  const qc = useQueryClient();
  const root = comments.find((c) => c.id === rootId);
  const replies = comments.filter((c) => c.parentId === rootId);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: workKeys.comments(task.id) });
    qc.invalidateQueries({ queryKey: workKeys.task(task.uid) });
  };
  const resolve = (c: WorkComment, resolved: boolean) =>
    (resolved ? workApi.resolveComment(c.id) : workApi.reopenComment(c.id)).then(refresh).catch(() => toast.error("Couldn't update the comment."));
  const assign = (id: number | null) => workApi.assignComment(rootId, id).then(refresh).catch(() => toast.error("Couldn't assign the comment."));

  return (
    <section aria-label="Thread" className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border bg-card px-3 py-2.5">
        <button type="button" aria-label="Back to comments" title="Back" onClick={onBack} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold">{root ? `${root.user.firstName}'s Thread` : "Thread"}</h3>
        {root && task.access.canEdit && (
          <AssigneePicker
            members={members}
            value={root.assignee ? [root.assignee] : []}
            onChange={(ids) => assign(ids.filter((x) => x !== root.assignee?.id)[0] ?? null)}
          >
            <button type="button" className={cn("flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[12.5px] hover:bg-accent", root.assignee && "border-[#b08d57]/60")}>
              {root.assignee ? <><Avatar user={root.assignee} size={16} /> {userName(root.assignee)}</> : <><UserCheck className="h-3.5 w-3.5" /> Assign</>}
            </button>
          </AssigneePicker>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!root ? (
          <p className="text-[13px] text-muted-foreground">This comment was deleted.</p>
        ) : (
          <>
            <ul>
              <CommentCard task={task} c={root} members={members} currentUserId={currentUserId} mine={mine} onDelete={(id) => { onDelete(id); onBack(); }} onResolve={resolve} inThread />
            </ul>
            <div aria-hidden className="my-3 flex items-center gap-3 text-[11.5px] font-medium text-muted-foreground">
              <span>{replies.length ? `${replies.length} ${replies.length === 1 ? "reply" : "replies"}` : "No replies"}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <ul aria-label="Replies" className="space-y-3 border-l-2 border-border pl-3">
              {replies.map((r) => (
                <CommentCard key={r.id} task={task} c={r} members={members} currentUserId={currentUserId} mine={mine} onDelete={onDelete} onResolve={resolve} inThread />
              ))}
            </ul>
          </>
        )}
      </div>

      {root && (task.access.canComment ?? task.access.canEdit) && (
        <div className="border-t border-border bg-card p-3">
          <Composer task={task} members={members} parentId={rootId} />
        </div>
      )}
    </section>
  );
}
