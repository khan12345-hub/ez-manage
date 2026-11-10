"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CornerDownRight, MessageSquareReply, SendHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { userName, workApi, workKeys, type WorkComment, type WorkTaskDetail } from "@/services/work.api";
import { Avatar } from "./primitives";
import { Reactions } from "./Reactions";

function ago(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Threaded replies under a comment (ClickUp-style "N replies" + Reply box). */
export function Thread({ task, parent, replies, currentUserId, onDelete }: { task: WorkTaskDetail; parent: WorkComment; replies: WorkComment[]; currentUserId?: number; onDelete: (id: number) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const send = useMutation({
    mutationFn: () => workApi.addComment(task.id, text.trim(), { parentId: parent.id }),
    onSuccess: () => {
      setText("");
      setOpen(true);
      qc.invalidateQueries({ queryKey: workKeys.comments(task.id) });
    },
    onError: () => toast.error("Couldn't send the reply."),
  });
  const people = [...new Map(replies.map((r) => [r.user.id, r.user])).values()].slice(0, 3);

  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-3 text-[12px]">
        {replies.length > 0 && (
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1.5 font-semibold text-primary hover:underline">
            <span className="flex -space-x-1.5">{people.map((u) => <Avatar key={u.id} user={u} size={16} />)}</span>
            {replies.length} {replies.length === 1 ? "reply" : "replies"}
            <span className="font-normal text-muted-foreground">· last {ago(replies[replies.length - 1]!.createdAt)}</span>
          </button>
        )}
        {(task.access.canComment ?? task.access.canEdit) && (
          <button type="button" onClick={() => { setReplying(true); setOpen(true); }} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <MessageSquareReply className="h-3.5 w-3.5" /> Reply
          </button>
        )}
      </div>

      {open && replies.length > 0 && (
        <ul className="mt-2 space-y-2 border-l-2 border-border pl-3">
          {replies.map((r) => (
            <li key={r.id} className="group/reply flex gap-2">
              <Avatar user={r.user} size={22} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[12.5px] font-semibold">{userName(r.user)}</span>
                  <span className="text-[11px] text-muted-foreground">{ago(r.createdAt)}</span>
                  {r.user.id === currentUserId && (
                    <button type="button" aria-label="Delete reply" onClick={() => onDelete(r.id)} className="ml-auto hidden text-muted-foreground hover:text-destructive group-hover/reply:block"><Trash2 className="h-3 w-3" /></button>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{r.content}</p>
                <Reactions comment={r} currentUserId={currentUserId} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {replying && (
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim() && !send.isPending) send.mutate();
          }}
        >
          <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (setReplying(false), setText(""))}
            placeholder="Reply… (Enter to send)"
            aria-label="Reply"
            className="h-8 flex-1 rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus:border-primary/50"
          />
          <button type="submit" aria-label="Send reply" disabled={!text.trim() || send.isPending} className={cn("flex h-8 w-8 items-center justify-center rounded-md bg-forest text-forest-foreground disabled:opacity-40 dark:bg-primary dark:text-primary-foreground")}>
            <SendHorizontal className="h-3.5 w-3.5" />
          </button>
        </form>
      )}
    </div>
  );
}
