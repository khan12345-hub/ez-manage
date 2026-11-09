"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlarmClock, Bell, BellOff, Bookmark, Copy, Link2, ListPlus, MessageSquareReply, MoreHorizontal, Quote, SmilePlus, Type, UserCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { REACTION_EMOJIS, userName, workApi, workKeys, type WorkComment, type WorkTaskDetail, type WorkTaskMine, type WorkUser } from "@/services/work.api";
import { SnoozePicker } from "../[workspaceId]/inbox/SnoozePicker";
import { AssigneePicker } from "./pickers";
import { useReact } from "./Reactions";
import { remindersKey } from "./Reminders";

const QUICK = ["👍", "✅", "🔥"];
export const QUOTE_EVENT = "ez:work:quote";
export const mineKey = (taskId: number) => ["work", "task-me", taskId] as const;

function presets() {
  const now = new Date();
  const inHour = new Date(now.getTime() + 3600e3);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
  nextWeek.setHours(9, 0, 0, 0);
  return [
    { label: "In 1 hour", at: inHour },
    { label: "Tomorrow", at: tomorrow },
    { label: "Next week", at: nextWeek },
  ];
}

/** The tooltip-style toolbar that appears over a comment on hover (ClickUp). */
export function CommentActions({
  task,
  comment,
  members,
  currentUserId,
  mine,
  onReply,
  className,
}: {
  task: WorkTaskDetail;
  comment: WorkComment;
  members: WorkUser[];
  currentUserId?: number;
  mine?: WorkTaskMine;
  onReply?: () => void;
  className?: string;
}) {
  const qc = useQueryClient();
  const params = useParams<{ workspaceId: string }>();
  const ws = params?.workspaceId ?? "";
  const react = useReact(comment, currentUserId);
  const [remindOpen, setRemindOpen] = useState(false);
  const canEdit = task.access.canEdit;
  const root = comment.parentId ?? comment.id;
  const following = !!mine?.followedComments.includes(root);
  const snippet = comment.content.length > 80 ? `${comment.content.slice(0, 80)}…` : comment.content;
  const link = () => `${window.location.origin}/work/${ws}/list/${task.list.uid}?task=${task.uid}&comment=${comment.id}`;

  const remind = useMutation({
    mutationFn: (at: Date) => workApi.createReminder(ws, { title: `Comment from ${userName(comment.user)}: ${snippet}`, remindAt: at.toISOString(), taskUid: task.uid }),
    onSuccess: (_r, at) => {
      qc.invalidateQueries({ queryKey: remindersKey(ws) });
      toast.success(`I'll remind you ${at.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}`);
    },
    onError: () => toast.error("Couldn't set the reminder."),
  });
  const assign = useMutation({
    mutationFn: (id: number | null) => workApi.assignComment(comment.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: workKeys.comments(task.id) }),
    onError: () => toast.error("Couldn't assign the comment."),
  });
  const unread = useMutation({
    mutationFn: () => workApi.commentUnread(comment.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-inbox"] });
      toast.success("Marked as unread in your Inbox");
    },
  });
  const follow = useMutation({
    mutationFn: () => workApi.followComment(comment.id, !following),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: mineKey(task.id) });
      toast.success(r.following ? "You'll be notified about new replies" : "Stopped following replies");
    },
  });
  const toDescription = useMutation({
    mutationFn: () => {
      const quote = comment.content.split("\n").map((l) => `> ${l}`).join("\n");
      return workApi.updateTask(task.id, { description: `${task.description ? `${task.description}\n\n` : ""}${quote}` });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workKeys.task(task.uid) });
      toast.success("Added to the description");
    },
    onError: () => toast.error("Couldn't update the description."),
  });

  const btn = "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground";
  return (
    <div role="toolbar" aria-label="Comment actions" className={cn("flex items-center gap-0.5 rounded-lg border border-border bg-popover p-0.5 shadow-md", className)}>
      {QUICK.map((e) => (
        <button key={e} type="button" aria-label={`React ${e}`} title={`React ${e}`} onClick={() => react.mutate(e)} className="h-7 w-7 rounded-md text-[15px] hover:bg-accent">{e}</button>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Add reaction" title="Add reaction" className={btn}><SmilePlus className="h-4 w-4" /></button>
        </PopoverTrigger>
        <PopoverContent align="end" side="top" className="grid w-auto grid-cols-6 gap-0.5 p-1.5">
          {REACTION_EMOJIS.map((e) => (
            <button key={e} type="button" aria-label={`React ${e}`} onClick={() => react.mutate(e)} className="h-8 w-8 rounded-md text-[18px] hover:bg-accent">{e}</button>
          ))}
        </PopoverContent>
      </Popover>
      <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
      {onReply && canEdit && (
        <button type="button" aria-label="Reply in thread" title="Reply in thread" onClick={onReply} className={btn}><MessageSquareReply className="h-4 w-4" /></button>
      )}
      {canEdit && (
        <button
          type="button"
          aria-label="Quote"
          title="Quote in a new comment"
          onClick={() => window.dispatchEvent(new CustomEvent(QUOTE_EVENT, { detail: { taskId: task.id, text: comment.content, author: userName(comment.user) } }))}
          className={btn}
        >
          <Quote className="h-4 w-4" />
        </button>
      )}
      <button type="button" aria-label="Copy link to comment" title="Copy link" onClick={() => navigator.clipboard.writeText(link()).then(() => toast.success("Comment link copied"))} className={btn}>
        <Link2 className="h-4 w-4" />
      </button>
      <Popover open={remindOpen} onOpenChange={setRemindOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Save for later" title="Remind me in Inbox" className={btn}><Bookmark className="h-4 w-4" /></button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <SnoozePicker onPick={(d) => { remind.mutate(d); setRemindOpen(false); }} />
        </PopoverContent>
      </Popover>
      {canEdit && (
        <AssigneePicker
          members={members}
          value={comment.assignee ? [comment.assignee] : []}
          onChange={(ids) => {
            const id = ids.filter((x) => x !== comment.assignee?.id)[0];
            assign.mutate(id ?? null);
          }}
        >
          <button type="button" aria-label="Assign comment" title={comment.assignee ? `Assigned to ${userName(comment.assignee)}` : "Assign comment"} className={cn(btn, comment.assignee && "text-[#b08d57]")}>
            <UserCheck className="h-4 w-4" />
          </button>
        </AssigneePicker>
      )}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="More comment actions" title="More" className={btn}><MoreHorizontal className="h-4 w-4" /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onClick={() => unread.mutate()}><Bell className="mr-2 h-4 w-4" /> Mark as unread</DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(link()).then(() => toast.success("Comment link copied"))}><Link2 className="mr-2 h-4 w-4" /> Copy link</DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(comment.content).then(() => toast.success("Text copied"))}><Type className="mr-2 h-4 w-4" /> Copy text<DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger><AlarmClock className="mr-2 h-4 w-4" /> Remind me in Inbox</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              {presets().map((p) => (
                <DropdownMenuItem key={p.label} onClick={() => remind.mutate(p.at)}>
                  {p.label}
                  <span className="ml-auto text-[11px] text-muted-foreground">{p.at.toLocaleString("en-US", { weekday: "short", hour: "numeric" })}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          {canEdit && <DropdownMenuItem onClick={() => toDescription.mutate()}><ListPlus className="mr-2 h-4 w-4" /> Add to description</DropdownMenuItem>}
          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(`${task.name}\n${link()}`).then(() => toast.success("Copied"))}><Copy className="mr-2 h-4 w-4" /> Copy task + link</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => follow.mutate()}>
            {following ? <BellOff className="mr-2 h-4 w-4" /> : <Bell className="mr-2 h-4 w-4" />}
            {following ? "Stop notifications about replies" : "Get notified about new replies"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
