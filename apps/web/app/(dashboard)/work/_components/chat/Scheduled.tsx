"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, ChevronDown, Clock, Hash, Pencil, SendHorizontal, Trash2, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { userName, workApi, type ChatScheduled } from "@/services/work.api";
import { useChatEvents, useWs } from "./useChat";

export const scheduledKey = (ws: string, channelUid?: string) => ["work", "chat-scheduled", ws, channelUid ?? "all"] as const;
const err = (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Something went wrong.");

export function useScheduled(channelUid?: string) {
  const ws = useWs();
  const qc = useQueryClient();
  useChatEvents((e) => { if (e.type === "scheduled") qc.invalidateQueries({ queryKey: ["work", "chat-scheduled", ws] }); });
  return useQuery({ queryKey: scheduledKey(ws, channelUid), queryFn: () => workApi.chatScheduled(ws, channelUid), enabled: !!ws });
}

export const whenLabel = (iso: string) => new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
/** a Date → the value a datetime-local input wants (local time) */
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const at9 = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(9, 0, 0, 0); return d; };
function presets() {
  const now = new Date();
  const inHour = new Date(Math.ceil((now.getTime() + 60 * 60_000) / (5 * 60_000)) * 5 * 60_000);
  const monday = (() => { const d = at9(1); while (d.getDay() !== 1) d.setDate(d.getDate() + 1); return d; })();
  return [
    { label: "In 1 hour", at: inHour },
    { label: "Tomorrow at 9:00 AM", at: at9(1) },
    { label: "Monday at 9:00 AM", at: monday },
  ];
}

/** the ⌄ next to Send: pick a preset or a custom date & time */
export function ScheduleButton({ disabled, onSchedule }: { disabled: boolean; onSchedule: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(() => toLocalInput(at9(1)));
  const pick = (d: Date) => { setOpen(false); onSchedule(d.toISOString()); };
  const customDate = new Date(custom);
  const customOk = !isNaN(+customDate) && +customDate > Date.now() + 60_000;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Schedule message" title="Schedule message" disabled={disabled} className="flex h-8 items-center rounded-lg border border-border px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"><CalendarClock className="h-3.5 w-3.5" /><ChevronDown className="h-3 w-3" /></button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-64 p-1.5">
        <p className="px-2 pb-1 pt-1 text-[11.5px] font-semibold text-muted-foreground">Schedule message</p>
        {presets().map((p) => (
          <button key={p.label} type="button" onClick={() => pick(p.at)} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent">
            {p.label} <span className="text-[11px] text-muted-foreground">{p.at.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span>
          </button>
        ))}
        <div className="mt-1 border-t border-border px-2 pb-1 pt-2">
          <label className="text-[11.5px] font-medium text-muted-foreground" htmlFor="schedule-custom">Custom time</label>
          <input id="schedule-custom" type="datetime-local" value={custom} min={toLocalInput(new Date())} onChange={(e) => setCustom(e.target.value)} className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-[12.5px] outline-none focus:border-primary/50" />
          <button type="button" disabled={!customOk} onClick={() => pick(customDate)} className="mt-2 h-8 w-full rounded-md bg-forest text-[12.5px] font-semibold text-forest-foreground disabled:opacity-40 dark:bg-primary dark:text-primary-foreground">Schedule</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** "You have 2 scheduled messages here" above the composer */
export function ScheduledBanner({ channelUid }: { channelUid: string }) {
  const ws = useWs();
  const { data = [] } = useScheduled(channelUid);
  if (!data.length) return null;
  const failed = data.filter((s) => s.status === "failed").length;
  return (
    <Link href={`/work/${ws}/chat/drafts?tab=scheduled`} className={cn("mx-4 mb-1.5 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12.5px] hover:bg-accent/50", failed ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground")}>
      {failed ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
      {failed ? `${failed} scheduled ${failed === 1 ? "message" : "messages"} couldn't be sent` : `${data.length} scheduled ${data.length === 1 ? "message" : "messages"} here · next ${whenLabel(data[0]!.sendAt)}`}
      <span className="ml-auto font-medium text-primary">View</span>
    </Link>
  );
}

/** Drafts & Sent → Scheduled */
export function ScheduledList() {
  const ws = useWs();
  const qc = useQueryClient();
  const { data = [], isLoading } = useScheduled();
  const [editing, setEditing] = useState<ChatScheduled | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["work", "chat-scheduled", ws] });
  const sendNow = useMutation({ mutationFn: (id: number) => workApi.sendScheduledChat(id), onSuccess: () => { refresh(); toast.success("Message sent"); }, onError: (e) => { refresh(); err(e); } });
  const remove = useMutation({ mutationFn: (id: number) => workApi.deleteScheduledChat(id), onSuccess: () => { refresh(); toast.success("Scheduled message deleted"); }, onError: err });
  const where = (s: ChatScheduled) => (s.channel.kind === "channel" ? `#${s.channel.name}` : s.channel.people.map((p) => userName(p)).join(", ") || "You");
  if (isLoading) return <div className="h-20 animate-pulse rounded-xl bg-muted" />;
  if (!data.length) return <p className="py-14 text-center text-[13px] text-muted-foreground">No scheduled messages. Use the clock next to Send to schedule one.</p>;
  return (
    <>
      <ul aria-label="Scheduled messages" className="space-y-2">
        {data.map((s) => (
          <li key={s.id} className={cn("rounded-xl border bg-card p-3.5", s.status === "failed" ? "border-destructive/40" : "border-border")}>
            <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
              {s.channel.kind === "channel" ? <Hash className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
              <Link href={`/work/${ws}/chat/${s.channel.uid}${s.parentId ? `?thread=${s.parentId}` : ""}`} className="font-medium text-foreground hover:underline">{where(s)}</Link>
              {s.parentId && <span>· thread reply</span>}
              <span className="ml-auto flex items-center gap-1">{s.status === "failed" ? <><AlertTriangle className="h-3.5 w-3.5 text-destructive" /> <span className="text-destructive">Not sent</span></> : s.status === "sending" ? "Sending…" : <><Clock className="h-3.5 w-3.5" /> {whenLabel(s.sendAt)}</>}</span>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-[13.5px]">{s.content}</p>
            {s.files.length > 0 && <p className="mt-1 text-[11.5px] text-muted-foreground">📎 {s.files.map((f) => f.name).join(", ")}</p>}
            {s.status === "failed" && s.error && <p role="alert" className="mt-1.5 text-[12px] text-destructive">{s.error}</p>}
            <div className="mt-2.5 flex gap-1.5">
              <button type="button" onClick={() => setEditing(s)} disabled={s.status === "sending"} className="flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[12px] hover:bg-accent disabled:opacity-40"><Pencil className="h-3 w-3" /> Edit</button>
              <button type="button" onClick={() => sendNow.mutate(s.id)} disabled={s.status === "sending" || sendNow.isPending} className="flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[12px] hover:bg-accent disabled:opacity-40"><SendHorizontal className="h-3 w-3" /> Send now</button>
              <button type="button" onClick={() => window.confirm("Delete this scheduled message?") && remove.mutate(s.id)} disabled={s.status === "sending"} className="flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-destructive hover:bg-destructive/10 disabled:opacity-40"><Trash2 className="h-3 w-3" /> Delete</button>
            </div>
          </li>
        ))}
      </ul>
      {editing && <EditScheduled s={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function EditScheduled({ s, onClose }: { s: ChatScheduled; onClose: () => void }) {
  const ws = useWs();
  const qc = useQueryClient();
  const [text, setText] = useState(s.content);
  const [when, setWhen] = useState(() => toLocalInput(new Date(Math.max(new Date(s.sendAt).getTime(), Date.now() + 5 * 60_000))));
  const at = new Date(when);
  const ok = text.trim() && !isNaN(+at) && +at > Date.now() + 60_000;
  const save = useMutation({
    mutationFn: () => workApi.updateScheduledChat(s.id, { content: text.trim(), sendAt: at.toISOString() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work", "chat-scheduled", ws] }); toast.success(`Scheduled for ${whenLabel(at.toISOString())}`); onClose(); },
    onError: err,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogTitle>Edit scheduled message</DialogTitle>
        <DialogDescription>{s.status === "failed" ? "Fix it and pick a new time. It goes back in the queue." : "Change the text or the time it is sent."}</DialogDescription>
        <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={5} aria-label="Message" className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus:border-primary/50" />
        <label className="text-[12px] font-medium text-muted-foreground" htmlFor="edit-sched-at">Send at</label>
        <input id="edit-sched-at" type="datetime-local" value={when} min={toLocalInput(new Date())} onChange={(e) => setWhen(e.target.value)} className="-mt-1 h-9 w-full rounded-lg border border-border bg-background px-2.5 text-[13px] outline-none focus:border-primary/50" />
        <div className="flex justify-end"><button type="button" disabled={!ok || save.isPending} onClick={() => save.mutate()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">Save</button></div>
      </DialogContent>
    </Dialog>
  );
}
