"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, CalendarClock, CalendarPlus, ExternalLink, Pencil, Video, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ceoApi, type CeoMeeting } from "@/services/ceo-tower.api";
import { Avatar } from "../../work/_components/primitives";
import { PeoplePicker } from "./PeoplePicker";

const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const err = (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Something went wrong.");

/** CEO Tower → Meetings: schedule, invite, edit, cancel; everyone is reminded before it starts */
export function MeetingsView() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [editing, setEditing] = useState<CeoMeeting | "new" | null>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ["ceo-tower", "meetings", tab], queryFn: () => ceoApi.meetings(tab), refetchInterval: 60_000 });
  const cancel = useMutation({ mutationFn: (id: number) => ceoApi.cancelMeeting(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["ceo-tower", "meetings"] }); toast.success("Meeting cancelled — attendees were told"); }, onError: err });
  return (
    <section aria-label="Meetings" className="rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-brass-soft"><CalendarClock className="h-4.5 w-4.5" /></span>
        <span className="min-w-0 flex-1"><span className="block font-serif text-[21px] leading-tight">Meetings</span><span className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Invites go out at once · reminders 24 h, 1 h and 15 min before</span></span>
        <div role="tablist" aria-label="Which meetings" className="flex rounded-lg border border-border p-0.5">
          {(["upcoming", "past"] as const).map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("rounded-md px-2.5 py-1 text-[12.5px] font-medium capitalize", tab === t ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>{t === "past" ? "Past & cancelled" : "Upcoming"}</button>)}
        </div>
        <button type="button" onClick={() => setEditing("new")} className="flex h-9 items-center gap-1.5 rounded-lg bg-forest px-3.5 text-[13px] font-semibold text-forest-foreground hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground"><CalendarPlus className="h-4 w-4" /> New meeting</button>
      </header>
      {isLoading ? <div className="space-y-2 p-5">{[0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}</div> : !data.length ? (
        <p className="px-5 py-14 text-center text-[13px] text-muted-foreground">{tab === "upcoming" ? "No meetings coming up. Schedule one — invitations and reminders go out automatically." : "No past meetings yet."}</p>
      ) : (
        <ul aria-label="Meeting list" className="divide-y divide-border">
          {data.map((m) => (
            <li key={m.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
              <div className="w-28 shrink-0 rounded-xl border border-border bg-muted/30 px-3 py-2 text-center">
                <p className="font-mono text-[10.5px] uppercase text-muted-foreground">{new Date(m.scheduledAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</p>
                <p className="font-serif text-[20px] leading-tight">{new Date(m.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-[15px] font-semibold", m.cancelledAt && "text-muted-foreground line-through")}>{m.title}</p>
                {m.description && <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[12.5px] text-muted-foreground">{m.description}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
                  <span className="flex -space-x-1.5" title={m.attendees.map((a) => `${a.user.firstName} ${a.user.lastName}`).join(", ")}>{m.attendees.slice(0, 6).map((a) => <Avatar key={a.userId} user={a.user as any} size={22} />)}</span>
                  <span className="text-muted-foreground">{m.attendees.length} invited</span>
                  {m.meetingLink && <a href={m.meetingLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-medium text-primary hover:underline"><Video className="h-3.5 w-3.5" /> Join link <ExternalLink className="h-3 w-3" /></a>}
                  {m.cancelledAt ? <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Cancelled</span> : tab === "upcoming" && <span className="flex items-center gap-1 text-muted-foreground"><BellRing className="h-3.5 w-3.5" /> reminders on</span>}
                </div>
              </div>
              {tab === "upcoming" && !m.cancelledAt && (
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setEditing(m)} aria-label={`Edit ${m.title}`} className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[12.5px] hover:bg-accent"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                  <button type="button" onClick={() => window.confirm(`Cancel "${m.title}"? Everyone invited is told.`) && cancel.mutate(m.id)} aria-label={`Cancel ${m.title}`} className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-[12.5px] text-destructive hover:bg-destructive/10"><XCircle className="h-3.5 w-3.5" /> Cancel</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && <MeetingDialog meeting={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

export function MeetingDialog({ meeting, onClose }: { meeting: CeoMeeting | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [at, setAt] = useState(() => toLocalInput(meeting ? new Date(meeting.scheduledAt) : (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(11, 0, 0, 0); return d; })()));
  const [link, setLink] = useState(meeting?.meetingLink ?? "");
  const [desc, setDesc] = useState(meeting?.description ?? "");
  const [people, setPeople] = useState<number[]>(meeting?.attendees.map((a) => a.userId) ?? []);
  const date = new Date(at);
  const ready = title.trim() && !isNaN(+date) && +date > Date.now() && people.length > 0;
  const save = useMutation({
    mutationFn: () => {
      const body = { title: title.trim(), scheduledAt: date.toISOString(), attendeeIds: people, description: desc.trim() || undefined, meetingLink: link.trim() || undefined };
      return meeting ? ceoApi.updateMeeting(meeting.id, { ...body, description: desc.trim() || null, meetingLink: link.trim() || null }) : ceoApi.createMeeting(body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ceo-tower", "meetings"] }); toast.success(meeting ? "Meeting updated — attendees were told" : `Meeting scheduled for ${when(date.toISOString())} — invitations sent`); onClose(); },
    onError: err,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[600px]">
        <DialogTitle className="font-serif text-[22px] font-normal">{meeting ? "Edit meeting" : "New meeting"}</DialogTitle>
        <DialogDescription>Everyone invited is notified now and reminded 24 hours, 1 hour and 15 minutes before it starts.</DialogDescription>
        <div className="grid gap-3">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly management review" aria-label="Meeting title" maxLength={255} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[14px] font-medium outline-none focus:border-primary/50" />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[12px] font-medium text-muted-foreground">Date & time
              <input type="datetime-local" aria-label="Date and time" value={at} min={toLocalInput(new Date())} onChange={(e) => setAt(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground" />
            </label>
            <label className="text-[12px] font-medium text-muted-foreground">Video call link (optional)
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/…" aria-label="Meeting link" className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground" />
            </label>
          </div>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Agenda (optional)" aria-label="Agenda" rows={3} className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary/50" />
          <PeoplePicker value={people} onChange={setPeople} label="Invite" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] text-muted-foreground">{ready ? "" : "Add a title, a future time and at least one person."}</span>
          <button type="button" disabled={!ready || save.isPending} onClick={() => save.mutate()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">{meeting ? "Save changes" : "Schedule & invite"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
