"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isPast, isToday, isTomorrow, differenceInMinutes, differenceInHours, differenceInDays, parseISO } from "date-fns";
import {
  Calendar, Clock, Users, Plus, X, ChevronDown, Trash2,
  Video, CheckSquare, Square, Search, Loader2, AlertCircle,
  Pencil, Check, Bell, ChevronRight, Link2, ExternalLink, Eye, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getMeetings, createMeeting, cancelMeeting, updateMeeting,
  type Meeting, type CreateMeetingPayload, type UpdateMeetingPayload,
} from "@/services/ceo-assistant.api";
import type { EmployeeTaskGroup } from "@/services/ceo-assistant.api";

interface Props { employees: EmployeeTaskGroup[] }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTimeLabel(date: Date): { label: string; urgent: boolean } {
  const now = new Date();
  if (isPast(date)) return { label: "Past", urgent: false };
  const mins  = differenceInMinutes(date, now);
  const hours = differenceInHours(date, now);
  const days  = differenceInDays(date, now);
  if (mins  < 60)   return { label: `In ${mins}m`,       urgent: true  };
  if (hours < 24)   return { label: `In ${hours}h`,      urgent: hours < 3 };
  if (isToday(date))   return { label: "Today",          urgent: true  };
  if (isTomorrow(date)) return { label: "Tomorrow",      urgent: false };
  return { label: `In ${days}d`, urgent: false };
}

function getAccentColor(date: Date) {
  if (isPast(date)) return { bar: "bg-slate-300 dark:bg-slate-600", badge: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" };
  const mins = differenceInMinutes(date, new Date());
  if (mins < 60)  return { bar: "bg-red-500",    badge: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400" };
  if (mins < 180) return { bar: "bg-amber-500",  badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" };
  return           { bar: "bg-blue-500",          badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" };
}

// ─── Attendee Picker ──────────────────────────────────────────────────────────

function AttendeePicker({
  employees,
  selected,
  onChange,
}: {
  employees: EmployeeTaskGroup[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () => employees.filter((e) => {
      const name = `${e.user.firstName} ${e.user.lastName}`.toLowerCase();
      return !search || name.includes(search.toLowerCase());
    }),
    [employees, search],
  );

  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Attendees * <span className="font-normal">({selected.length} selected)</span>
        </label>
        {selected.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-[10px] text-muted-foreground hover:text-foreground">
            Clear all
          </button>
        )}
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          placeholder="Search team members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border">
        {filtered.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">No members found</div>
        ) : (
          filtered.map((e) => {
            const on = selected.includes(e.user.id);
            return (
              <button
                key={e.user.id}
                type="button"
                onClick={() => toggle(e.user.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                  on ? "bg-blue-50 dark:bg-blue-950/20" : "hover:bg-muted/40",
                )}
              >
                {on ? <CheckSquare className="h-3.5 w-3.5 shrink-0 text-blue-500" /> : <Square className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                <div className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[9px] font-bold text-white">
                  {e.user.firstName[0]}{e.user.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">{e.user.firstName} {e.user.lastName}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{e.user.email}</div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Meeting Form (create or edit) ───────────────────────────────────────────

function MeetingForm({
  employees,
  initial,
  onSuccess,
  onCancel,
}: {
  employees: EmployeeTaskGroup[];
  initial?: Meeting;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!initial;

  const toLocalDatetime = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [title,       setTitle]       = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [meetingLink, setMeetingLink] = useState(initial?.meetingLink ?? "");
  const [scheduledAt, setScheduledAt] = useState(initial ? toLocalDatetime(initial.scheduledAt) : "");
  const [selectedIds, setSelectedIds] = useState<number[]>(initial?.attendees.map((a) => a.userId) ?? []);

  const createMut = useMutation({
    mutationFn: (p: CreateMeetingPayload) => createMeeting(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ceo-meetings"] }); onSuccess(); },
  });
  const updateMut = useMutation({
    mutationFn: (p: UpdateMeetingPayload) => updateMeeting(initial!.id, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ceo-meetings"] }); onSuccess(); },
  });

  const isPending = createMut.isPending || updateMut.isPending;
  const isError   = createMut.isError   || updateMut.isError;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !scheduledAt || selectedIds.length === 0) return;
    if (isEdit) {
      updateMut.mutate({ title, description: description || undefined, meetingLink: meetingLink || undefined, scheduledAt, attendeeIds: selectedIds });
    } else {
      createMut.mutate({ title, description: description || undefined, meetingLink: meetingLink || undefined, scheduledAt, attendeeIds: selectedIds });
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-blue-500 flex items-center justify-center">
            {isEdit ? <Pencil className="h-3.5 w-3.5 text-white" /> : <Video className="h-3.5 w-3.5 text-white" />}
          </div>
          <span className="text-sm font-bold text-foreground">
            {isEdit ? "Edit Meeting" : "Schedule New Meeting"}
          </span>
        </div>
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-7 w-7 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Meeting Title *</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              placeholder="e.g. Q4 Planning Review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Date & Time *</label>
            <input
              type="datetime-local"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Meeting Link <span className="font-normal normal-case">(Zoom / Meet / Teams)</span>
            </label>
            <div className="relative">
              <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="url"
                className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                placeholder="https://zoom.us/j/..."
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Description (optional)</label>
            <textarea
              rows={4}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-y min-h-[96px]"
              placeholder="Agenda, talking points, or notes for this meeting..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <AttendeePicker employees={employees} selected={selectedIds} onChange={setSelectedIds} />

        {isError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 px-3 py-2 text-xs text-red-700 dark:text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {isEdit ? "Failed to update meeting." : "Failed to schedule meeting."}
          </div>
        )}

        <div className="flex gap-2">
          <Button type="submit" size="sm" className="flex-1"
            disabled={!title.trim() || !scheduledAt || selectedIds.length === 0 || isPending}>
            {isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />{isEdit ? "Saving…" : "Scheduling…"}</>
              : isEdit
              ? <><Check className="h-3.5 w-3.5 mr-1.5" />Save Changes</>
              : <><Calendar className="h-3.5 w-3.5 mr-1.5" />Schedule Meeting</>}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}

// ─── Meeting Detail Modal ─────────────────────────────────────────────────────

function MeetingDetailModal({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const date = parseISO(meeting.scheduledAt);
  const past = isPast(date);
  const accent = getAccentColor(date);
  const timeLabel = getTimeLabel(date);

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn("flex items-start gap-3 p-5 border-b border-border", past ? "bg-muted/30" : "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20")}>
          {/* Date block */}
          <div className="shrink-0 flex flex-col items-center justify-center rounded-xl border border-border bg-white dark:bg-card px-3 py-2 min-w-[56px] text-center shadow-sm">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none">
              {format(date, "MMM")}
            </span>
            <span className="text-2xl font-black text-foreground leading-tight">{format(date, "d")}</span>
            <span className="text-[10px] font-semibold text-muted-foreground leading-none">{format(date, "EEE")}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-base font-bold text-foreground leading-tight">{meeting.title}</h2>
              <span className={cn("shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full", accent.badge)}>
                {timeLabel.label}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 text-blue-500 shrink-0" />
              <span>{format(date, "EEEE, MMMM d, yyyy")} at {format(date, "h:mm a")}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Meeting Link */}
          {meeting.meetingLink && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-3.5 flex items-center gap-3">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-blue-500 flex items-center justify-center">
                <Video className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-0.5">Video Meeting Link</div>
                <div className="text-xs text-blue-600 dark:text-blue-300 truncate">{meeting.meetingLink}</div>
              </div>
              <a
                href={meeting.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 text-xs font-bold transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Join
              </a>
            </div>
          )}

          {/* Description */}
          {meeting.description ? (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Description / Agenda</div>
              <div className="rounded-xl border border-border bg-muted/20 p-3.5 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {meeting.description}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-3.5 text-center text-xs text-muted-foreground">
              No description added
            </div>
          )}

          {/* Attendees */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Attendees
              </div>
              <div className="text-[10px] text-muted-foreground font-semibold">
                {meeting.attendees.length} {meeting.attendees.length === 1 ? "person" : "people"}
              </div>
            </div>
            <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
              {meeting.attendees.map(({ user }) => (
                <div key={user.id} className="flex items-center gap-3 px-3.5 py-2.5 bg-card hover:bg-muted/30 transition-colors">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[11px] font-bold text-white">
                    {user.firstName[0]}{user.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                      <Mail className="h-2.5 w-2.5 shrink-0" />
                      {user.email}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reminders */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2">Auto-Reminders</div>
            <div className="space-y-1.5">
              {[
                { label: "24 hours before",  sub: "Email + in-app" },
                { label: "1 hour before",    sub: "Email + in-app" },
                { label: "15 minutes before",sub: "In-app only"    },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                    <Bell className="h-3 w-3 shrink-0" />
                    {r.label}
                  </div>
                  <span className="text-amber-600 dark:text-amber-500 text-[10px]">{r.sub}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Meeting Card ─────────────────────────────────────────────────────────────

function MeetingCard({ meeting, employees }: { meeting: Meeting; employees: EmployeeTaskGroup[] }) {
  const qc = useQueryClient();
  const [editing,    setEditing]    = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [viewing,    setViewing]    = useState(false);

  const cancelMut = useMutation({
    mutationFn: () => cancelMeeting(meeting.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ceo-meetings"] }),
  });

  const date    = parseISO(meeting.scheduledAt);
  const past    = isPast(date);
  const accent  = getAccentColor(date);
  const timeLabel = getTimeLabel(date);

  if (editing) {
    return (
      <MeetingForm
        employees={employees}
        initial={meeting}
        onSuccess={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <>
      {viewing && <MeetingDetailModal meeting={meeting} onClose={() => setViewing(false)} />}

    <div
      className={cn(
        "group rounded-2xl border bg-card shadow-sm overflow-hidden flex transition-all hover:shadow-md cursor-pointer",
        past && "opacity-60",
      )}
      onClick={() => setViewing(true)}
    >
      {/* Left accent bar */}
      <div className={cn("w-1 shrink-0", accent.bar)} />

      <div className="flex-1 min-w-0 p-4">
        <div className="flex items-start gap-3">
          {/* Date block */}
          <div className="shrink-0 flex flex-col items-center justify-center rounded-xl border border-border bg-muted/30 px-3 py-2 min-w-[52px] text-center">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none">
              {format(date, "MMM")}
            </span>
            <span className="text-xl font-black text-foreground leading-tight">{format(date, "d")}</span>
            <span className="text-[10px] font-semibold text-muted-foreground leading-none">{format(date, "EEE")}</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-sm font-bold text-foreground truncate">{meeting.title}</h3>
              <span className={cn("shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full", accent.badge)}>
                {timeLabel.label}
              </span>
            </div>

            {meeting.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">{meeting.description}</p>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3 text-blue-500 shrink-0" />
                <span>{format(date, "h:mm a")}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3 text-violet-500 shrink-0" />
                <span>{meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Bell className="h-3 w-3 text-amber-500 shrink-0" />
                <span>Auto-reminders on</span>
              </div>
              {meeting.meetingLink && (
                <a
                  href={meeting.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  Join Meeting
                </a>
              )}
            </div>

            {/* Attendee avatars */}
            {meeting.attendees.length > 0 && (
              <div className="flex items-center gap-2 mt-2.5">
                <div className="flex -space-x-1.5">
                  {meeting.attendees.slice(0, 5).map(({ user }) => (
                    <div
                      key={user.id}
                      title={`${user.firstName} ${user.lastName}`}
                      className="h-5 w-5 rounded-full border-2 border-card bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[8px] font-bold text-white"
                    >
                      {user.firstName[0]}{user.lastName[0]}
                    </div>
                  ))}
                  {meeting.attendees.length > 5 && (
                    <div className="h-5 w-5 rounded-full border-2 border-card bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[8px] font-bold text-slate-600 dark:text-slate-300">
                      +{meeting.attendees.length - 5}
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                  {meeting.attendees.map((a) => a.user.firstName).join(", ")}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            {/* View button — always shown */}
            <button
              onClick={(e) => { e.stopPropagation(); setViewing(true); }}
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 dark:hover:border-indigo-900 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Eye className="h-3 w-3" /> View
            </button>

            {!past && (
              <>
                {confirming ? (
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); cancelMut.mutate(); }}
                      disabled={cancelMut.isPending}
                      className="rounded-lg border border-red-300 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-900 px-2.5 py-1 text-[11px] font-bold text-red-700 dark:text-red-400 transition-colors whitespace-nowrap"
                    >
                      {cancelMut.isPending ? "…" : "Yes, cancel"}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
                      className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted/40 transition-colors"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                      className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/20 dark:hover:border-blue-900 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
                      className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-red-600 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/20 dark:hover:border-red-900 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" /> Cancel
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onSchedule }: { onSchedule: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border py-14 text-center">
      <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 flex items-center justify-center">
        <Calendar className="h-7 w-7 text-blue-500" />
      </div>
      <p className="text-sm font-semibold text-foreground">No upcoming meetings</p>
      <p className="text-xs text-muted-foreground mt-1 mb-4">Schedule a meeting and your team gets notified automatically</p>
      <Button size="sm" variant="outline" onClick={onSchedule} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" /> Schedule your first meeting
      </Button>
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function MeetingsTab({ employees }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [showPast,   setShowPast]   = useState(false);

  const { data: upcoming = [], isLoading: upcomingLoading } = useQuery({
    queryKey: ["ceo-meetings", "upcoming"],
    queryFn: () => getMeetings(true),
  });

  const { data: past = [], isLoading: pastLoading } = useQuery({
    queryKey: ["ceo-meetings", "past"],
    queryFn: () => getMeetings(false),
    enabled: showPast,
  });

  // Upcoming stats
  const todayCount    = upcoming.filter((m) => isToday(parseISO(m.scheduledAt))).length;
  const tomorrowCount = upcoming.filter((m) => isTomorrow(parseISO(m.scheduledAt))).length;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Meetings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Schedule meetings — attendees receive email + in-app reminders automatically
          </p>
        </div>
        {!showCreate && (
          <Button size="sm" onClick={() => setShowCreate(true)} className="shrink-0 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Schedule Meeting
          </Button>
        )}
      </div>

      {/* Quick stats */}
      {!upcomingLoading && upcoming.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Upcoming",  value: upcoming.length,  color: "text-blue-600",  bg: "bg-blue-50 dark:bg-blue-950/20",  border: "border-blue-100 dark:border-blue-900" },
            { label: "Today",     value: todayCount,       color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20", border: "border-amber-100 dark:border-amber-900" },
            { label: "Tomorrow",  value: tomorrowCount,    color: "text-violet-600",bg: "bg-violet-50 dark:bg-violet-950/20",border: "border-violet-100 dark:border-violet-900" },
          ].map((s) => (
            <div key={s.label} className={cn("rounded-xl border p-3 text-center", s.bg, s.border)}>
              <div className={cn("text-xl font-black", s.color)}>{s.value}</div>
              <div className="text-[11px] text-muted-foreground font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <MeetingForm
          employees={employees}
          onSuccess={() => setShowCreate(false)}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Upcoming */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-bold text-foreground">Upcoming</span>
          {upcomingLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {!upcomingLoading && upcoming.length > 0 && (
            <span className="ml-auto text-[11px] text-muted-foreground">{upcoming.length} scheduled</span>
          )}
        </div>

        {!upcomingLoading && upcoming.length === 0 && !showCreate ? (
          <EmptyState onSchedule={() => setShowCreate(true)} />
        ) : (
          <div className="space-y-2.5">
            {upcoming.map((m) => <MeetingCard key={m.id} meeting={m} employees={employees} />)}
          </div>
        )}
      </div>

      {/* Past meetings */}
      <button
        onClick={() => setShowPast((p) => !p)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showPast && "rotate-180")} />
        {showPast ? "Hide" : "Show"} past meetings
        {!upcomingLoading && past.length > 0 && showPast && (
          <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">{past.length}</span>
        )}
      </button>

      {showPast && (
        <div className="space-y-2.5">
          {pastLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : past.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-8 text-center">
              <p className="text-sm text-muted-foreground">No past meetings</p>
            </div>
          ) : (
            past.map((m) => <MeetingCard key={m.id} meeting={m} employees={employees} />)
          )}
        </div>
      )}
    </div>
  );
}
