"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlarmClock, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { userName, workApi, type WorkReminder, type WorkUser } from "@/services/work.api";
import { Avatar } from "./primitives";

export const remindersKey = (ws: string) => ["work", "reminders", ws] as const;

function when(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;
  return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "Reminders" card on My Tasks: upcoming reminders for me (or that I set), tick to finish. */
export function RemindersCard({ ws, currentUserId, onOpenTask }: { ws: string; currentUserId?: number; onOpenTask: (uid: string) => void }) {
  const qc = useQueryClient();
  const [showDone, setShowDone] = useState(false);
  const { data = [] } = useQuery({ queryKey: [...remindersKey(ws), showDone], queryFn: () => workApi.reminders(ws, showDone) });
  const done = useMutation({
    mutationFn: (r: WorkReminder) => workApi.updateReminder(r.id, { done: !r.doneAt }),
    onSuccess: () => qc.invalidateQueries({ queryKey: remindersKey(ws) }),
    onError: () => toast.error("Couldn't update the reminder."),
  });
  const del = useMutation({
    mutationFn: (id: number) => workApi.deleteReminder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: remindersKey(ws) }),
  });
  if (!data.length && !showDone) return null;
  const now = Date.now();
  return (
    <section aria-label="Reminders" className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex items-center gap-2 border-b border-border bg-table-head px-4 py-2.5">
        <AlarmClock className="h-4 w-4 text-[#b08d57]" />
        <h2 className="text-[13.5px] font-semibold">Reminders</h2>
        <span className="font-mono text-[11.5px] text-muted-foreground">{data.filter((r) => !r.doneAt).length}</span>
        <span className="flex-1" />
        <button type="button" onClick={() => setShowDone(!showDone)} className="text-[12px] text-muted-foreground hover:text-foreground">{showDone ? "Hide done" : "Show done"}</button>
      </header>
      <ul>
        {data.map((r) => {
          const late = !r.doneAt && new Date(r.remindAt).getTime() < now;
          const forOther = r.assignee.id !== currentUserId;
          return (
            <li key={r.id} className="group flex items-center gap-3 border-b border-border/70 px-4 py-2.5 last:border-b-0 hover:bg-accent/30">
              <button type="button" aria-label={r.doneAt ? `Reopen ${r.title}` : `Done: ${r.title}`} onClick={() => done.mutate(r)} className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", r.doneAt ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50 hover:border-primary")}>
                {r.doneAt && <Check className="h-3 w-3" />}
              </button>
              <button type="button" disabled={!r.task} onClick={() => r.task && onOpenTask(r.task.uid)} className="min-w-0 flex-1 text-left disabled:cursor-default">
                <span className={cn("block truncate text-[14px]", r.doneAt && "text-muted-foreground line-through")}>{r.title}</span>
                <span className="block truncate text-[12px] text-muted-foreground">
                  {r.task ? `On “${r.task.name}”` : r.description || "Reminder"}
                  {forOther && <> · for {userName(r.assignee as WorkUser)}</>}
                  {!forOther && r.user.id !== currentUserId && <> · from {userName(r.user as WorkUser)}</>}
                </span>
              </button>
              {forOther && <Avatar user={r.assignee as WorkUser} size={20} />}
              <span className={cn("shrink-0 text-[12.5px]", late ? "font-medium text-destructive" : "text-muted-foreground")}>{when(r.remindAt)}</span>
              <button type="button" aria-label={`Delete ${r.title}`} onClick={() => del.mutate(r.id)} className="hidden rounded p-1 text-muted-foreground hover:text-destructive group-hover:block"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          );
        })}
        {!data.length && <li className="px-4 py-4 text-[13px] text-muted-foreground">No reminders.</li>}
      </ul>
    </section>
  );
}
