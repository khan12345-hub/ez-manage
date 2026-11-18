"use client";

/*
 * CEO Tower → Calendar: several Google accounts (read-only) plus CEO Tower meetings in one place.
 * Month / Week / Agenda. Phones always get the agenda.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, ExternalLink, Eye, EyeOff, MapPin, Plus, Settings2, Trash2, Users, Video } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { calendarApi, type CalAccount, type CalEvent } from "@/services/calendar.api";

type Mode = "month" | "week" | "agenda";
const HOUR = 48;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d: Date) => addDays(d, -d.getDay());
/** all-day events come as YYYY-MM-DD: read them as local dates */
const at = (s: string, allDay: boolean) => { if (allDay && /^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, d] = s.split("-").map(Number); return new Date(y!, m! - 1, d!); } return new Date(s); };
const time = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const ERR: Record<string, string> = { denied: "Google access was not allowed.", expired: "That sign-in took too long. Try again.", no_refresh: "Google didn't give lasting access. Remove EZ Manage at myaccount.google.com/permissions and connect again.", not_configured: "Google Calendar is not set up on the server yet.", google: "Google didn't connect. Try again." };
const glass = "rounded-[24px] border border-white/70 bg-white/70 shadow-[0_16px_48px_-28px_rgba(11,42,31,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]";

function range(mode: Mode, cursor: Date) {
  if (mode === "week") { const s = startOfWeek(cursor); return { from: s, to: addDays(s, 7) }; }
  if (mode === "agenda") { const s = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()); return { from: s, to: addDays(s, 30) }; }
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const s = addDays(first, -first.getDay());
  return { from: s, to: addDays(s, 42) };
}

/** which days an event covers (all-day end is exclusive) */
function days(e: CalEvent) {
  const s = at(e.start, e.allDay), en = at(e.end || e.start, e.allDay);
  const out: string[] = [];
  let d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  // all-day end is exclusive; a timed event ending exactly at midnight doesn't take the next day
  const endIn = e.allDay ? addDays(en, -1) : new Date(Math.max(+s, +en - 1));
  const last = new Date(endIn.getFullYear(), endIn.getMonth(), endIn.getDate());
  for (let i = 0; i < 60 && d <= last; i++, d = addDays(d, 1)) out.push(dayKey(d));
  return out.length ? out : [dayKey(s)];
}

export function CalendarView() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [open, setOpen] = useState<CalEvent | null>(null);
  const [showEz, setShowEz] = useState(true);
  const { from, to } = useMemo(() => range(mode, cursor), [mode, cursor]);
  const accounts = useQuery({ queryKey: ["calendar", "accounts"], queryFn: calendarApi.accounts });
  const events = useQuery({ queryKey: ["calendar", "events", +from, +to], queryFn: () => calendarApi.events(from, to), refetchInterval: 120_000, placeholderData: (p) => p });
  const configured = accounts.data?.configured ?? true;
  const list = (events.data?.events ?? []).filter((e) => (e.source === "ezmanage" ? showEz : true));
  const refresh = () => { qc.invalidateQueries({ queryKey: ["calendar"] }); };

  // back from Google
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("connected")) toast.success(`Connected ${p.get("email") ?? "Google Calendar"}`);
    else if (p.get("calendar_error")) toast.error(ERR[p.get("calendar_error")!] ?? ERR.google!);
    if (p.get("connected") || p.get("calendar_error")) { p.delete("connected"); p.delete("email"); p.delete("calendar_error"); window.history.replaceState(null, "", `${window.location.pathname}${p.size ? `?${p}` : ""}`); refresh(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useMutation({
    mutationFn: calendarApi.connect,
    onSuccess: (r) => { if (r.url) window.location.href = r.url; else toast.error(ERR.not_configured!); },
    onError: () => toast.error("Couldn't start Google sign-in."),
  });
  const update = useMutation({ mutationFn: ({ id, b }: { id: number; b: { enabled?: boolean; color?: string } }) => calendarApi.update(id, b), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (a: CalAccount) => calendarApi.remove(a.id), onSuccess: () => { toast.success("Calendar removed"); refresh(); } });

  const shift = (n: number) => setCursor((c) => (mode === "month" ? new Date(c.getFullYear(), c.getMonth() + n, 1) : addDays(c, n * (mode === "week" ? 7 : 30))));
  const title = mode === "month" ? cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : `${from.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${addDays(to, -1).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="grid gap-4 xl:grid-cols-[280px_1fr]">
      {/* accounts */}
      <aside aria-label="Calendars" className={cn(glass, "h-fit p-4")}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-brass-soft"><CalendarDays className="h-4.5 w-4.5" /></span>
          <span className="min-w-0 flex-1"><span className="block text-[15.5px] font-semibold tracking-tight">Calendars</span><span className="block text-[11.5px] text-muted-foreground">Google, read-only</span></span>
        </div>
        {!configured ? (
          <div className="mt-4 rounded-2xl border border-[#b08d57]/40 bg-[#b08d57]/[0.07] p-3.5 text-[12.5px]">
            <p className="flex items-center gap-1.5 font-semibold text-[#8a6a35] dark:text-[#d9bd8c]"><Settings2 className="h-3.5 w-3.5" /> Setup needed</p>
            <p className="mt-1 text-muted-foreground">Administrator: add <code className="rounded bg-muted px-1">GOOGLE_CLIENT_ID</code> and <code className="rounded bg-muted px-1">GOOGLE_CLIENT_SECRET</code> to the API <code className="rounded bg-muted px-1">.env</code>, then restart the API. CEO Tower meetings still show here.</p>
          </div>
        ) : null}
        <ul className="mt-4 space-y-1">
          {(accounts.data?.accounts ?? []).map((a) => {
            const err = events.data?.errors.find((x) => x.accountId === a.id);
            return (
              <li key={a.id} className="group flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/70 dark:hover:bg-white/5">
                <label className="relative h-4 w-4 shrink-0 cursor-pointer rounded-full ring-2 ring-white dark:ring-transparent" style={{ background: a.color }} title="Colour">
                  <input type="color" value={a.color} aria-label={`Colour for ${a.email}`} onChange={(e) => update.mutate({ id: a.id, b: { color: e.target.value } })} className="absolute inset-0 cursor-pointer opacity-0" />
                </label>
                <span className={cn("min-w-0 flex-1", !a.enabled && "opacity-50")}>
                  <span className="block truncate text-[13px] font-medium">{a.email}</span>
                  {err && <button type="button" onClick={() => connect.mutate()} className="text-[11px] font-semibold text-destructive hover:underline">{err.reconnect ? "Access ended. Reconnect" : "Couldn't load. Retry sign-in"}</button>}
                </span>
                <button type="button" aria-label={a.enabled ? `Hide ${a.email}` : `Show ${a.email}`} onClick={() => update.mutate({ id: a.id, b: { enabled: !a.enabled } })} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground">{a.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</button>
                <button type="button" aria-label={`Remove ${a.email}`} onClick={() => { if (confirm(`Remove ${a.email}? Its events stop showing here. Nothing changes in Google Calendar.`)) remove.mutate(a); }} className="rounded-lg p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-destructive group-hover:opacity-100 focus:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            );
          })}
          <li className="flex items-center gap-2 rounded-xl px-2 py-1.5">
            <span className="h-4 w-4 shrink-0 rounded-full bg-[#b08d57]" />
            <span className={cn("min-w-0 flex-1 truncate text-[13px] font-medium", !showEz && "opacity-50")}>CEO Tower meetings</span>
            <button type="button" aria-label={showEz ? "Hide CEO Tower meetings" : "Show CEO Tower meetings"} onClick={() => setShowEz((v) => !v)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground">{showEz ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</button>
          </li>
        </ul>
        <button type="button" disabled={!configured || connect.isPending} onClick={() => connect.mutate()} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-forest text-[13px] font-semibold text-white transition hover:brightness-110 disabled:opacity-45 dark:bg-primary dark:text-primary-foreground">
          <Plus className="h-4 w-4" /> {accounts.data?.accounts.length ? "Add another Google account" : "Connect Google Calendar"}
        </button>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">Read-only. EZ Manage never changes your Google Calendar. Add as many accounts as you like.</p>
      </aside>

      {/* calendar */}
      <section aria-label="Calendar" className={cn(glass, "min-w-0 overflow-hidden")}>
        <header className="flex flex-wrap items-center gap-2 border-b border-black/[0.06] px-4 py-3 dark:border-white/10">
          <h2 aria-live="polite" className="mr-auto text-[18px] font-semibold tracking-tight">{title}</h2>
          <div role="tablist" aria-label="Calendar layout" className="hidden rounded-xl bg-muted/70 p-0.5 sm:flex">
            {(["month", "week", "agenda"] as const).map((m) => <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("rounded-lg px-3 py-1 text-[12.5px] font-semibold capitalize transition", mode === m ? "bg-white text-foreground shadow-sm dark:bg-white/15" : "text-muted-foreground hover:text-foreground")}>{m}</button>)}
          </div>
          <button type="button" onClick={() => setCursor(new Date())} className="h-8 rounded-lg border border-border px-3 text-[12.5px] font-semibold hover:bg-muted">Today</button>
          <button type="button" aria-label="Previous" onClick={() => shift(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" aria-label="Next" onClick={() => shift(1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
        </header>
        <div className={cn("transition-opacity", events.isFetching && !events.isLoading && "opacity-70")}>
          {/* phones: always the agenda */}
          <div className="sm:hidden"><Agenda events={list} from={mode === "agenda" ? from : new Date(Math.max(+from, +new Date(new Date().setHours(0, 0, 0, 0))))} to={to} onOpen={setOpen} /></div>
          <div className="hidden sm:block">
            {mode === "month" ? <Month events={list} cursor={cursor} from={from} onOpen={setOpen} onDay={(d) => { setCursor(d); setMode("week"); }} />
              : mode === "week" ? <Week events={list} from={from} onOpen={setOpen} />
              : <Agenda events={list} from={from} to={to} onOpen={setOpen} />}
          </div>
        </div>
      </section>

      {open && <EventDialog e={open} onClose={() => setOpen(null)} />}
    </motion.div>
  );
}

function Chip({ e, onOpen, compact }: { e: CalEvent; onOpen: (e: CalEvent) => void; compact?: boolean }) {
  return (
    <button type="button" onClick={() => onOpen(e)} title={e.title}
      className={cn("flex w-full items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-left text-[11.5px] font-medium transition hover:brightness-95", e.allDay && "text-white")}
      style={e.allDay ? { background: e.color } : { background: `${e.color}1f` }}>
      {!e.allDay && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: e.color }} />}
      {!e.allDay && !compact && <span className="shrink-0 tabular-nums text-muted-foreground">{time(at(e.start, false)).replace(":00", "")}</span>}
      <span className="truncate">{e.title}</span>
    </button>
  );
}

function Month({ events, cursor, from, onOpen, onDay }: { events: CalEvent[]; cursor: Date; from: Date; onOpen: (e: CalEvent) => void; onDay: (d: Date) => void }) {
  const byDay = useMemo(() => { const m = new Map<string, CalEvent[]>(); for (const e of events) for (const k of days(e)) m.set(k, [...(m.get(k) ?? []), e]); for (const l of m.values()) l.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start)); return m; }, [events]);
  const today = dayKey(new Date());
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        <div className="grid grid-cols-7 bg-muted/40">{WEEKDAYS.map((d) => <div key={d} className="py-2 text-center text-[11.5px] font-semibold text-muted-foreground">{d}</div>)}</div>
        <div role="grid" className="grid grid-cols-7 gap-px bg-border/70">
          {Array.from({ length: 42 }, (_, i) => addDays(from, i)).map((d) => {
            const k = dayKey(d), l = byDay.get(k) ?? [], inMonth = d.getMonth() === cursor.getMonth();
            return (
              <div key={k} role="gridcell" aria-label={d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} className={cn("flex min-h-[112px] flex-col gap-0.5 p-1.5", inMonth ? "bg-card/90" : "bg-muted/30", k === today && "bg-primary/[0.05]")}>
                <button type="button" onClick={() => onDay(d)} aria-label="Open this week" className={cn("mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium hover:bg-muted", k === today ? "bg-primary font-semibold text-primary-foreground hover:bg-primary" : inMonth ? "" : "text-muted-foreground/60")}>{d.getDate()}</button>
                {l.slice(0, 3).map((e) => <Chip key={e.id} e={e} onOpen={onOpen} />)}
                {l.length > 3 && <button type="button" onClick={() => onDay(d)} className="px-1 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground">+{l.length - 3} more</button>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Week({ events, from, onOpen }: { events: CalEvent[]; from: Date; onOpen: (e: CalEvent) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { scroller.current?.scrollTo({ top: HOUR * 7.5 }); }, []);
  const week = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const today = dayKey(new Date());
  const allDay = (d: Date) => events.filter((e) => e.allDay && days(e).includes(dayKey(d)));
  // timed events per day, in side-by-side lanes when they overlap
  const timed = (d: Date) => {
    const k = dayKey(d);
    const l = events.filter((e) => !e.allDay && dayKey(at(e.start, false)) === k).sort((a, b) => a.start.localeCompare(b.start));
    const lanes: number[] = [];
    return l.map((e) => {
      const s = at(e.start, false), en = new Date(Math.max(+at(e.end, false), +s + 20 * 60_000));
      let lane = lanes.findIndex((end) => end <= +s);
      if (lane < 0) { lane = lanes.length; lanes.push(+en); } else lanes[lane] = +en;
      return { e, s, en, lane };
    }).map((x, _, all) => ({ ...x, lanes: Math.max(...all.filter((y) => y.s < x.en && y.en > x.s).map((y) => y.lane)) + 1 }));
  };
  const now = new Date();
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border/70">
          <span />
          {week.map((d) => (
            <div key={dayKey(d)} className="border-l border-border/70 px-1.5 py-2 text-center">
              <span className="block text-[11px] font-semibold uppercase text-muted-foreground">{WEEKDAYS[d.getDay()]}</span>
              <span className={cn("mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-semibold", dayKey(d) === today && "bg-primary text-primary-foreground")}>{d.getDate()}</span>
              <span className="mt-1 block space-y-0.5">{allDay(d).map((e) => <Chip key={e.id} e={e} onOpen={onOpen} compact />)}</span>
            </div>
          ))}
        </div>
        <div ref={scroller} className="relative max-h-[620px] overflow-y-auto">
          <div className="grid grid-cols-[56px_repeat(7,1fr)]" style={{ height: HOUR * 24 }}>
            <div className="relative">{Array.from({ length: 24 }, (_, h) => <span key={h} className="absolute right-2 -translate-y-1/2 text-[10.5px] text-muted-foreground" style={{ top: h * HOUR }}>{h ? new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" }) : ""}</span>)}</div>
            {week.map((d) => (
              <div key={dayKey(d)} className={cn("relative border-l border-border/70", dayKey(d) === today && "bg-primary/[0.03]")}>
                {Array.from({ length: 24 }, (_, h) => <span key={h} className="absolute inset-x-0 border-t border-border/50" style={{ top: h * HOUR }} />)}
                {dayKey(d) === today && <span className="absolute inset-x-0 z-10 border-t-2 border-[#dc2626]" style={{ top: (now.getHours() + now.getMinutes() / 60) * HOUR }}><span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-[#dc2626]" /></span>}
                {timed(d).map(({ e, s, en, lane, lanes }) => {
                  const top = (s.getHours() + s.getMinutes() / 60) * HOUR;
                  const h = Math.max(20, ((+en - +s) / 3_600_000) * HOUR - 2);
                  return (
                    <button key={e.id} type="button" onClick={() => onOpen(e)} title={e.title}
                      className="absolute overflow-hidden rounded-lg border-l-[3px] px-1.5 py-0.5 text-left text-[11.5px] leading-tight shadow-sm transition hover:z-20 hover:shadow-md"
                      style={{ top, height: h, left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)`, borderColor: e.color, background: `color-mix(in srgb, ${e.color} 14%, var(--card))` }}>
                      <span className="block truncate font-semibold">{e.title}</span>
                      {h > 32 && <span className="block truncate text-muted-foreground">{time(s)} – {time(en)}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Agenda({ events, from, to, onOpen }: { events: CalEvent[]; from: Date; to: Date; onOpen: (e: CalEvent) => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, { d: Date; l: CalEvent[] }>();
    for (const e of events) for (const k of days(e)) {
      const [y, mo, da] = k.split("-").map(Number); const d = new Date(y!, mo!, da!);
      if (d < from || d >= to) continue;
      const g = m.get(k) ?? { d, l: [] }; g.l.push(e); m.set(k, g);
    }
    return [...m.values()].sort((a, b) => +a.d - +b.d).map((g) => ({ ...g, l: g.l.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start)) }));
  }, [events, from, to]);
  const today = dayKey(new Date());
  if (!groups.length) return <p className="px-6 py-16 text-center text-[13px] text-muted-foreground">Nothing on the calendar for these dates.</p>;
  return (
    <ul className="divide-y divide-border/70">
      {groups.map(({ d, l }) => (
        <li key={dayKey(d)} className={cn("flex gap-4 px-4 py-3", dayKey(d) === today && "bg-primary/[0.04]")}>
          <span className="w-12 shrink-0 text-center">
            <span className="block text-[10.5px] font-semibold uppercase text-muted-foreground">{WEEKDAYS[d.getDay()]}</span>
            <span className={cn("mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-semibold", dayKey(d) === today && "bg-primary text-primary-foreground")}>{d.getDate()}</span>
          </span>
          <ul className="min-w-0 flex-1 space-y-1">
            {l.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => onOpen(e)} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-muted/60">
                  <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: e.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{e.title}</span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">{e.allDay ? "All day" : `${time(at(e.start, false))} – ${time(at(e.end, false))}`} · {e.accountEmail ?? e.calendarName}</span>
                  </span>
                  {e.meetLink && <a href={e.meetLink} target="_blank" rel="noreferrer" onClick={(x) => x.stopPropagation()} className="flex shrink-0 items-center gap-1 rounded-lg bg-forest px-2.5 py-1 text-[11.5px] font-semibold text-white hover:brightness-110 dark:bg-primary dark:text-primary-foreground"><Video className="h-3.5 w-3.5" /> Join</a>}
                </button>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function EventDialog({ e, onClose }: { e: CalEvent; onClose: () => void }) {
  const s = at(e.start, e.allDay), en = at(e.end || e.start, e.allDay);
  const when = e.allDay
    ? `${s.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}${+addDays(s, 1) < +en ? ` – ${addDays(en, -1).toLocaleDateString("en-US", { month: "long", day: "numeric" })}` : ""} · All day`
    : `${s.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · ${time(s)} – ${time(en)}`;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <span className="h-1.5 w-12 rounded-full" style={{ background: e.color }} />
        <DialogTitle className="text-[19px] leading-snug">{e.title}</DialogTitle>
        <DialogDescription className="sr-only">Event details</DialogDescription>
        <ul className="space-y-2 text-[13px]">
          <li className="flex gap-2.5"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />{when}</li>
          {e.location && <li className="flex gap-2.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="break-words">{e.location}</span></li>}
          {e.attendees > 0 && <li className="flex gap-2.5"><Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />{e.attendees} {e.attendees === 1 ? "guest" : "guests"}</li>}
          <li className="flex gap-2.5"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{e.calendarName}{e.accountEmail && e.accountEmail !== e.calendarName ? <span className="text-muted-foreground"> · {e.accountEmail}</span> : null}</span></li>
        </ul>
        <div className="mt-2 flex flex-wrap gap-2">
          {e.meetLink && <a href={e.meetLink} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-2 rounded-xl bg-forest px-4 text-[13px] font-semibold text-white hover:brightness-110 dark:bg-primary dark:text-primary-foreground"><Video className="h-4 w-4" /> Join meeting</a>}
          {e.htmlLink && <a href={e.htmlLink} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-[13px] font-semibold hover:bg-muted"><ExternalLink className="h-4 w-4" /> Open in Google Calendar</a>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
