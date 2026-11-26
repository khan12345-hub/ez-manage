"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, CalendarClock, CalendarPlus, Check, Clock, Copy, Crown, ExternalLink, Mail, Pencil, Plus, Search, Share2, UserPlus, Users, Video, X, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { ceoApi, type CeoMeeting } from "@/services/ceo-tower.api";
import { Avatar } from "../../work/_components/primitives";

const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const err = (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Something went wrong.");

type Attendee = CeoMeeting["attendees"][number];
const attendeeLabel = (a: Attendee) => a.user ? `${a.user.firstName} ${a.user.lastName}`.trim() : (a.name || a.email || "Guest");
const attendeeInitials = (a: Attendee) => { const s = attendeeLabel(a); const parts = s.split(/[\s@.]+/).filter(Boolean); return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?"; };

/** a plain-text invite anyone can paste into chat/email/WhatsApp */
function inviteText(m: CeoMeeting) {
  const lines = [
    `📅 ${m.title}`,
    `🕑 ${when(m.scheduledAt)}`,
    ...(m.description ? [``, m.description] : []),
    ...(m.meetingLink ? [``, `Join: ${m.meetingLink}`] : []),
  ];
  return lines.join("\n");
}

/** copy a shareable invite (uses the native share sheet on mobile, clipboard elsewhere) */
function ShareInvite({ m }: { m: CeoMeeting }) {
  const [done, setDone] = useState(false);
  const share = async () => {
    const text = inviteText(m);
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) { await (navigator as any).share({ title: m.title, text }); return; }
      await navigator.clipboard.writeText(text);
      setDone(true); toast.success("Invite copied — paste it anywhere"); setTimeout(() => setDone(false), 1500);
    } catch { /* user dismissed the share sheet */ }
  };
  const canShare = typeof navigator !== "undefined" && (navigator as any).share;
  return (
    <button type="button" onClick={share} aria-label={`Share ${m.title}`} className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[12.5px] hover:bg-accent">
      {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : canShare ? <Share2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Share
    </button>
  );
}

/** Executive Hub → Meetings: schedule, invite, edit, cancel; everyone is reminded before it starts */
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
        <span className="min-w-[220px] flex-1"><span className="block font-serif text-[21px] leading-tight">Meetings</span><span className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Invites go out at once · reminders 24 h, 1 h and 15 min before</span></span>
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
                  <span className="flex -space-x-1.5" title={m.attendees.map(attendeeLabel).join(", ")}>{m.attendees.slice(0, 6).map((a, i) => a.user ? <Avatar key={i} user={a.user as any} size={22} /> : <span key={i} title={attendeeLabel(a)} className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-2 ring-background">{attendeeInitials(a)}</span>)}</span>
                  <span className="text-muted-foreground">{m.attendees.length} invited</span>
                  {m.meetingLink && <a href={m.meetingLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-medium text-primary hover:underline"><Video className="h-3.5 w-3.5" /> Join link <ExternalLink className="h-3 w-3" /></a>}
                  {m.cancelledAt ? <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Cancelled</span> : tab === "upcoming" && <span className="flex items-center gap-1 text-muted-foreground"><BellRing className="h-3.5 w-3.5" /> reminders on</span>}
                </div>
              </div>
              <div className="flex gap-1.5">
                {!m.cancelledAt && <ShareInvite m={m} />}
                {tab === "upcoming" && !m.cancelledAt && (
                  <>
                    <button type="button" onClick={() => setEditing(m)} aria-label={`Edit ${m.title}`} className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[12.5px] hover:bg-accent"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                    <button type="button" onClick={() => window.confirm(`Cancel "${m.title}"? Everyone invited is told.`) && cancel.mutate(m.id)} aria-label={`Cancel ${m.title}`} className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-[12.5px] text-destructive hover:bg-destructive/10"><XCircle className="h-3.5 w-3.5" /> Cancel</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <MeetingDialog meeting={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

/** quick date/time presets so you don't have to fiddle with the picker */
function presetDate(kind: "1h" | "tomAM" | "tomPM" | "mon"): Date {
  const d = new Date();
  if (kind === "1h") d.setHours(d.getHours() + 1, 0, 0, 0);
  else if (kind === "tomAM") { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
  else if (kind === "tomPM") { d.setDate(d.getDate() + 1); d.setHours(14, 0, 0, 0); }
  else { d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(10, 0, 0, 0); }
  return d;
}
const PRESETS: { key: "1h" | "tomAM" | "tomPM" | "mon"; label: string }[] = [
  { key: "1h", label: "In 1 hour" }, { key: "tomAM", label: "Tomorrow 9 AM" }, { key: "tomPM", label: "Tomorrow 2 PM" }, { key: "mon", label: "Mon 10 AM" },
];

/**
 * One clean control to invite people: search a teammate or type an email — picked people and
 * external emails show as chips. Bulk "groups" are tucked behind a toggle so the common case
 * (add a couple of people) stays simple.
 */
function InvitePeople({ people, setPeople, emails, setEmails, lockTeammates }: {
  people: number[]; setPeople: (ids: number[]) => void;
  emails: { email: string; name?: string }[]; setEmails: (e: { email: string; name?: string }[]) => void;
  lockTeammates?: boolean;
}) {
  const { user } = useAuth();
  const { data: team = [] } = useQuery({ queryKey: ["ceo-tower", "team", "all", null], queryFn: () => ceoApi.team("all"), enabled: !lockTeammates });
  const { data: aud } = useQuery({ queryKey: ["ceo-tower", "audiences"], queryFn: ceoApi.audiences, enabled: !lockTeammates });
  const [q, setQ] = useState("");
  const [showGroups, setShowGroups] = useState(false);
  const allPeople = useMemo(() => team.map((t) => t.user).filter((u) => u.id !== user?.id), [team, user?.id]);
  const byId = useMemo(() => new Map(allPeople.map((p) => [p.id, p])), [allPeople]);
  const qq = q.trim().toLowerCase();
  const isEmail = /.+@.+\..+/.test(q.trim());
  const emailTaken = emails.some((e) => e.email.toLowerCase() === q.trim().toLowerCase());
  const matches = allPeople.filter((p) => !people.includes(p.id) && (!qq || `${p.firstName} ${p.lastName}`.toLowerCase().includes(qq))).slice(0, 6);
  const addEmail = (raw: string) => { const v = raw.trim(); if (/.+@.+\..+/.test(v) && !emails.some((x) => x.email.toLowerCase() === v.toLowerCase())) setEmails([...emails, { email: v }]); setQ(""); };
  const addPerson = (id: number) => { setPeople([...new Set([...people, id])]); setQ(""); };
  const total = people.length + emails.length;
  const hasGroups = !!aud && (aud.management.length > 0 || (aud.teams?.length ?? 0) > 0 || (aud.companies?.length ?? 0) > 0);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[12px] font-medium text-muted-foreground">Invite{total > 0 && <span className="text-foreground"> · {total}</span>}</span>
        {!lockTeammates && hasGroups && <button type="button" onClick={() => setShowGroups((s) => !s)} className="flex items-center gap-1 text-[11.5px] font-medium text-primary hover:underline"><Users className="h-3 w-3" /> {showGroups ? "Hide groups" : "Add a group"}</button>}
      </div>
      {total > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {people.map((id) => { const p = byId.get(id); return (
            <span key={`p${id}`} className="flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-0.5 pr-1.5 text-[12px] font-medium">
              {p ? <Avatar user={p as any} size={18} /> : <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-muted text-[9px]">·</span>}
              {p ? `${p.firstName} ${p.lastName}` : `#${id}`}
              <button type="button" aria-label="Remove" onClick={() => setPeople(people.filter((x) => x !== id))} className="rounded-full p-0.5 hover:bg-primary/20"><X className="h-3 w-3" /></button>
            </span>
          ); })}
          {emails.map((e) => (
            <span key={`e${e.email}`} className="flex items-center gap-1 rounded-full bg-accent py-0.5 pl-2 pr-1.5 text-[12px] font-medium"><Mail className="h-3 w-3 text-muted-foreground" />{e.name || e.email}
              <button type="button" aria-label="Remove" onClick={() => setEmails(emails.filter((x) => x.email !== e.email))} className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-2.5"><Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && isEmail) { e.preventDefault(); addEmail(q); } }} placeholder={lockTeammates ? "Type an email to invite…" : "Search teammates or type an email…"} aria-label="Invite people" className="w-full bg-transparent text-[13px] outline-none" />
      </label>
      {(qq.length > 0 || isEmail) && (
        <div className="mt-1 overflow-hidden rounded-lg border border-border">
          {isEmail && !emailTaken && <button type="button" onClick={() => addEmail(q)} className="flex w-full items-center gap-2 bg-primary/5 px-2.5 py-2 text-left text-[13px] hover:bg-primary/10"><UserPlus className="h-4 w-4 text-primary" /> Invite <b className="font-semibold">{q.trim()}</b> by email</button>}
          {!lockTeammates && matches.map((p) => <button key={p.id} type="button" onClick={() => addPerson(p.id)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] hover:bg-accent"><Avatar user={p as any} size={20} /><span className="flex-1 truncate">{p.firstName} {p.lastName}</span><Plus className="h-3.5 w-3.5 text-muted-foreground" /></button>)}
          {!lockTeammates && !matches.length && !isEmail && <p className="px-2.5 py-2 text-[12px] text-muted-foreground">No teammate matches. Type a full email to invite someone outside.</p>}
        </div>
      )}
      {showGroups && !lockTeammates && aud && (() => {
        const boardsCos = (aud.companies ?? []).filter((c) => c.source === "boards");
        const workCos = (aud.companies ?? []).filter((c) => c.source === "work");
        const grp = "rounded-full border border-border px-2.5 py-0.5 text-[12px] hover:bg-accent";
        const addAll = (ids: number[]) => setPeople([...new Set([...people, ...ids])]);
        const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
          <div><p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p><div className="flex flex-wrap gap-1.5">{children}</div></div>
        );
        return (
          <div className="mt-2 space-y-2.5">
            {aud.management.length > 0 && <button type="button" onClick={() => addAll(aud.management)} className={cn(grp, "flex items-center gap-1")}><Crown className="h-3 w-3 text-[#b08d57]" /> Owners & admins ({aud.management.length})</button>}
            {boardsCos.length > 0 && <Section title="Accounts & Invoices">{boardsCos.map((c) => <button key={c.key} type="button" onClick={() => addAll(c.people)} className={grp}>Everyone · {c.name}</button>)}</Section>}
            {(workCos.length > 0 || (aud.teams?.length ?? 0) > 0) && (
              <Section title="Company Work">
                {aud.teams?.map((t) => <button key={t.id} type="button" onClick={() => addAll(t.people)} className={cn(grp, "flex items-center gap-1")}><Users className="h-3 w-3" /> {t.name} ({t.people.length})</button>)}
                {workCos.map((c) => <button key={c.key} type="button" onClick={() => addAll(c.people)} className={grp}>Everyone · {c.name}</button>)}
              </Section>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export function MeetingDialog({ meeting, onClose, presetTitle, presetEmails, crm, lockPeople }: {
  meeting: CeoMeeting | null; onClose: () => void;
  presetTitle?: string;
  presetEmails?: { email: string; name?: string }[];
  crm?: { workspaceId: number; contactId?: number; companyId?: number };
  lockPeople?: boolean; // CRM mode — hide the internal people picker, invite by email
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(meeting?.title ?? presetTitle ?? "");
  const [at, setAt] = useState(() => toLocalInput(meeting ? new Date(meeting.scheduledAt) : (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(11, 0, 0, 0); return d; })()));
  const [link, setLink] = useState(meeting?.meetingLink ?? "");
  const [desc, setDesc] = useState(meeting?.description ?? "");
  const [people, setPeople] = useState<number[]>(meeting?.attendees.filter((a) => a.userId != null).map((a) => a.userId!) ?? []);
  const [emails, setEmails] = useState<{ email: string; name?: string }[]>(
    meeting ? meeting.attendees.filter((a) => !a.user && a.email).map((a) => ({ email: a.email!, name: a.name || undefined })) : (presetEmails ?? []),
  );
  const [addMeet, setAddMeet] = useState(false); // auto-create a Google Meet + Google Calendar event
  const { data: gstatus } = useQuery({ queryKey: ["ceo-tower", "meet-google"], queryFn: ceoApi.meetingGoogleStatus, enabled: !meeting });
  const date = new Date(at);
  const ready = !!title.trim() && !isNaN(+date) && +date > Date.now() && (people.length > 0 || emails.length > 0);
  const save = useMutation({
    mutationFn: () => {
      const body = { title: title.trim(), scheduledAt: date.toISOString(), attendeeIds: people, attendeeEmails: emails, description: desc.trim() || undefined, meetingLink: link.trim() || undefined, addGoogleMeet: addMeet, ...(crm ? { crmWorkspaceId: crm.workspaceId, crmContactId: crm.contactId, crmCompanyId: crm.companyId } : {}) };
      return meeting ? ceoApi.updateMeeting(meeting.id, { title: body.title, scheduledAt: body.scheduledAt, attendeeIds: people, description: desc.trim() || null, meetingLink: link.trim() || null }) : ceoApi.createMeeting(body);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["ceo-tower"] });
      const gm = (res as any)?.googleMeet as string | undefined;
      if (!meeting && addMeet && gm === "ok") toast.success(`Google Meet created & added to Google Calendar — scheduled for ${when(date.toISOString())}`);
      else if (!meeting && addMeet && gm === "reconnect") toast.warning("Scheduled, but reconnect Google (we now need calendar access) to auto-create Meet links.");
      else if (!meeting && addMeet && gm === "not_connected") toast.warning("Scheduled with email invites. Connect Google to auto-create Meet links.");
      else toast.success(meeting ? "Meeting updated — everyone was told" : `Meeting scheduled for ${when(date.toISOString())} — invitations sent`);
      onClose();
    },
    onError: err,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[600px]">
        <DialogTitle className="font-serif text-[22px] font-normal">{meeting ? "Edit meeting" : "New meeting"}</DialogTitle>
        <DialogDescription>Everyone invited gets a calendar invite now and is reminded 24 hours, 1 hour and 15 minutes before it starts.</DialogDescription>
        <div className="grid gap-3">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly management review" aria-label="Meeting title" maxLength={255} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[14px] font-medium outline-none focus:border-primary/50" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[12px] font-medium text-muted-foreground" htmlFor="meet-at">Date & time</label>
              <input id="meet-at" type="datetime-local" aria-label="Date and time" value={at} min={toLocalInput(new Date())} onChange={(e) => setAt(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground" />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {PRESETS.map((p) => <button key={p.key} type="button" onClick={() => setAt(toLocalInput(presetDate(p.key)))} className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"><Clock className="h-2.5 w-2.5" /> {p.label}</button>)}
              </div>
            </div>
            <div>
              <span className="text-[12px] font-medium text-muted-foreground">Video call</span>
              {!meeting ? (
                <div className="mt-1 rounded-lg border border-border p-2">
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium">
                    <input type="checkbox" checked={addMeet} onChange={(e) => setAddMeet(e.target.checked)} className="h-4 w-4 accent-[#1f6f4f]" />
                    <Video className="h-4 w-4 text-primary" /> Add a Google Meet
                  </label>
                  {addMeet ? (
                    gstatus?.connected
                      ? <p className="mt-1 pl-6 text-[11px] text-emerald-700 dark:text-emerald-400">✓ A Meet link is created and the event added to your Google Calendar on schedule.</p>
                      : <p className="mt-1 pl-6 text-[11px] text-muted-foreground">Needs your Google connected. <a href="/ceo?view=calendar" className="font-semibold text-primary hover:underline">Connect Google</a>{gstatus && !gstatus.configured ? " — not set up on the server yet." : "."}</p>
                  ) : (
                    <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="…or paste a Meet / Zoom / Teams link" aria-label="Meeting link" className="mt-1.5 h-8 w-full rounded-md border border-border bg-background px-2 text-[12.5px]" />
                  )}
                </div>
              ) : (
                <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste a Meet/Zoom/Teams link…" aria-label="Meeting link" className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground" />
              )}
            </div>
          </div>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Agenda (optional)" aria-label="Agenda" rows={2} className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary/50" />
          <InvitePeople people={people} setPeople={setPeople} emails={emails} setEmails={setEmails} lockTeammates={lockPeople} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11.5px] text-muted-foreground">{ready ? <>Scheduling for <b className="font-semibold text-foreground">{when(date.toISOString())}</b></> : "Add a title, a future time and at least one person."}</span>
          <button type="button" disabled={!ready || save.isPending} onClick={() => save.mutate()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">{meeting ? "Save changes" : "Schedule & invite"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
