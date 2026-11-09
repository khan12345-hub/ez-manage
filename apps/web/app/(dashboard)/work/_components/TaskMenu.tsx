"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlarmClock,
  Archive,
  ArrowRightLeft,
  Bell,
  BellOff,
  CopyPlus,
  FileClock,
  GitMerge,
  LayoutTemplate,
  Link2,
  ListPlus,
  Mail,
  MoreHorizontal,
  Printer,
  Repeat,
  Shapes,
  Share2,
  SlidersHorizontal,
  Star,
  Workflow,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { workApi, workKeys, type WorkTaskDetail, type WorkTaskMine } from "@/services/work.api";
import { mineKey } from "./CommentActions";
import { remindersKey } from "./Reminders";
import type { PickMode } from "./TaskLists";

function presets() {
  const now = new Date();
  const t = new Date(now);
  t.setDate(now.getDate() + 1);
  t.setHours(9, 0, 0, 0);
  const w = new Date(now);
  w.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
  w.setHours(9, 0, 0, 0);
  return [
    { label: "In 1 hour", at: new Date(now.getTime() + 3600e3) },
    { label: "Tomorrow", at: t },
    { label: "Next week", at: w },
  ];
}

/** Task ⋯ menu (ClickUp): copy, favourite, follow, remind, move / add, duplicate, print, archive… */
export function TaskMenu({
  task,
  mine,
  onPickList,
  onOpenRelated,
  onArchive,
  onOpenTask,
}: {
  task: WorkTaskDetail;
  mine?: WorkTaskMine;
  onPickList: (mode: PickMode) => void;
  onOpenRelated: () => void;
  onArchive: () => void;
  onOpenTask: (uid: string) => void;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const { workspaceId: ws } = useParams<{ workspaceId: string }>();
  const canEdit = task.access.canEdit;
  const url = () => `${window.location.origin}/work/${ws}/list/${task.list.uid}?task=${task.uid}`;
  const setMine = (m: WorkTaskMine) => qc.setQueryData(mineKey(task.id), m);

  const fav = useMutation({
    mutationFn: () => workApi.favoriteTask(task.id, !mine?.favorite),
    onSuccess: (m) => { setMine(m); qc.invalidateQueries({ queryKey: ["work", "favorites"] }); toast.success(m.favorite ? "Added to Favorites" : "Removed from Favorites"); },
  });
  const watch = useMutation({
    mutationFn: () => workApi.watchTask(task.id, !(mine?.following ?? true)),
    onSuccess: (m) => { setMine(m); toast.success(m.following ? "You'll get updates about this task" : "You won't get comment or status updates"); },
  });
  const remind = useMutation({
    mutationFn: (at: Date) => workApi.createReminder(ws, { title: task.name, remindAt: at.toISOString(), taskUid: task.uid }),
    onSuccess: (_r, at) => { qc.invalidateQueries({ queryKey: remindersKey(ws) }); toast.success(`Reminder set for ${at.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}`); },
    onError: () => toast.error("Couldn't set the reminder."),
  });
  const dup = useMutation({
    mutationFn: () => workApi.duplicateTask(task.id),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: workKeys.tasks(task.listId) });
      toast.success("Task duplicated", { action: { label: "Open", onClick: () => onOpenTask(t.uid) } });
    },
    onError: () => toast.error("Couldn't duplicate the task."),
  });
  const soon = (label: string, Icon: typeof Star) => (
    <DropdownMenuItem disabled>
      <Icon className="mr-2 h-4 w-4" /> {label}
      <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">Soon</span>
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Task actions" title="More" className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="grid grid-cols-2 gap-1 p-1">
          <button type="button" onClick={() => navigator.clipboard.writeText(url()).then(() => toast.success("Task link copied"))} className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-border text-[12.5px] font-medium hover:bg-accent">
            <Link2 className="h-3.5 w-3.5" /> Copy link
          </button>
          <button type="button" onClick={() => navigator.clipboard.writeText(task.uid).then(() => toast.success(`Copied ${task.uid}`))} className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-border font-mono text-[12px] font-medium hover:bg-accent">
            Copy ID
          </button>
        </div>
        <DropdownMenuItem onClick={() => fav.mutate()}>
          <Star className={mine?.favorite ? "mr-2 h-4 w-4 fill-[#b08d57] text-[#b08d57]" : "mr-2 h-4 w-4"} /> {mine?.favorite ? "Remove from Favorites" : "Favorite"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => watch.mutate()}>
          {mine?.following === false ? <><Bell className="mr-2 h-4 w-4" /> Follow task</> : <><BellOff className="mr-2 h-4 w-4" /> Unfollow task</>}
        </DropdownMenuItem>
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
        {canEdit && <DropdownMenuItem onClick={() => setTimeout(() => onPickList("move"), 0)}><ArrowRightLeft className="mr-2 h-4 w-4" /> Move to</DropdownMenuItem>}
        {canEdit && !task.parentId && <DropdownMenuItem onClick={() => setTimeout(() => onPickList("add"), 0)}><ListPlus className="mr-2 h-4 w-4" /> Add to another List</DropdownMenuItem>}
        {soon("Merge", GitMerge)}
        {canEdit && <DropdownMenuItem onClick={() => dup.mutate()}><CopyPlus className="mr-2 h-4 w-4" /> Duplicate</DropdownMenuItem>}
        {soon("Convert to", Repeat)}
        <DropdownMenuItem onClick={() => document.getElementById("task-custom-fields")?.scrollIntoView({ behavior: "smooth", block: "center" })}><SlidersHorizontal className="mr-2 h-4 w-4" /> Custom Fields</DropdownMenuItem>
        {soon("Templates", LayoutTemplate)}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenRelated}><Workflow className="mr-2 h-4 w-4" /> Relationships</DropdownMenuItem>
        {soon("Description history", FileClock)}
        {soon("Task type", Shapes)}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTimeout(() => window.print(), 50)}><Printer className="mr-2 h-4 w-4" /> Print</DropdownMenuItem>
        {soon("Send email to task", Mail)}
        {canEdit && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onArchive} className="text-destructive focus:text-destructive"><Archive className="mr-2 h-4 w-4" /> Archive</DropdownMenuItem>
          </>
        )}
        <div className="p-1">
          <button type="button" onClick={() => router.push(`/work/${ws}/people`)} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-forest text-[12.5px] font-semibold text-forest-foreground hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground">
            <Share2 className="h-3.5 w-3.5" /> Sharing &amp; Permissions
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
