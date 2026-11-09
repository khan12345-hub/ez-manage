"use client";

import { useMemo, useState } from "react";
import { AlarmClock, CalendarDays, CalendarRange, ChevronDown, ChevronUp, Clock, Sunrise, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

const at8 = (d: Date) => { const x = new Date(d); x.setHours(8, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Understands: "in 20 min", "in 3 hours", "in 2 days", "tomorrow", "tomorrow at 2 pm", "friday 9am", "next week", "nov 12", "12/11 3pm", "at 5pm". */
export function parseWhen(text: string, now = new Date()): Date | null {
  const s = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return null;
  let m = s.match(/^in (\d+) ?(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)$/);
  if (m) {
    const n = Number(m[1]);
    const u = m[2]![0];
    const ms = u === "m" ? 60_000 : u === "h" ? 3_600_000 : u === "d" ? 86_400_000 : 7 * 86_400_000;
    return u === "d" || u === "w" ? at8(new Date(now.getTime() + n * ms)) : new Date(now.getTime() + n * ms);
  }
  // split an optional "at 2 pm" / "2pm" / "14:30" time part
  let time: { h: number; min: number } | null = null;
  const tm = s.match(/(?:^|\s)(?:at )?(\d{1,2})(?::(\d{2}))? ?(am|pm)?$/);
  let day = s;
  if (tm && (tm[3] || tm[2] || /at /.test(s))) {
    let h = Number(tm[1]);
    const min = Number(tm[2] ?? 0);
    if (tm[3] === "pm" && h < 12) h += 12;
    if (tm[3] === "am" && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    time = { h, min };
    day = s.slice(0, tm.index).trim();
  }
  let base: Date | null = null;
  if (!day || day === "today") base = new Date(now);
  else if (day === "tomorrow" || day === "tmrw") base = addDays(now, 1);
  else if (day === "next week") base = addDays(now, ((8 - now.getDay()) % 7) || 7);
  else if (WEEKDAYS.some((w) => w.startsWith(day.replace(/^next /, "")) && day.replace(/^next /, "").length >= 3)) {
    const target = WEEKDAYS.findIndex((w) => w.startsWith(day.replace(/^next /, "")));
    let diff = (target - now.getDay() + 7) % 7 || 7;
    if (day.startsWith("next ")) diff += diff < 7 ? 7 : 0;
    base = addDays(now, diff);
  } else if ((m = day.match(/^([a-z]{3})[a-z]* (\d{1,2})$/)) && MONTHS.includes(m[1]!)) {
    base = new Date(now.getFullYear(), MONTHS.indexOf(m[1]!), Number(m[2]));
    if (base < now) base.setFullYear(base.getFullYear() + 1);
  } else if ((m = day.match(/^(\d{1,2})[/-](\d{1,2})$/))) {
    base = new Date(now.getFullYear(), Number(m[2]) - 1, Number(m[1]));
    if (base < now) base.setFullYear(base.getFullYear() + 1);
  }
  if (!base || Number.isNaN(base.getTime())) return null;
  const out = new Date(base);
  if (time) out.setHours(time.h, time.min, 0, 0);
  else if (!day || day === "today") return null; // "today" alone is not a time
  else out.setHours(8, 0, 0, 0);
  return out > now ? out : null;
}

const fmt = (d: Date) => {
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
};

/** ClickUp-style "Remind me": type a time, pick a preset, or pick a day (8:00 AM). */
export function SnoozePicker({ onPick }: { onPick: (at: Date) => void }) {
  const now = new Date();
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseWhen(text), [text]);
  const presets = [
    { label: "In 20 minutes", icon: Timer, at: new Date(now.getTime() + 20 * 60_000) },
    { label: "In 2 hours", icon: Clock, at: new Date(now.getTime() + 2 * 3_600_000) },
    { label: "Tomorrow", icon: Sunrise, at: at8(addDays(now, 1)) },
    { label: "In 2 days", icon: CalendarDays, at: at8(addDays(now, 2)) },
    { label: "Next week", icon: CalendarRange, at: at8(addDays(now, ((8 - now.getDay()) % 7) || 7)) },
  ];
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const days = useMemo(() => {
    const start = new Date(month);
    start.setDate(1 - start.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return (
    <div className="w-[264px]" onClick={(e) => e.stopPropagation()}>
      <form
        className="p-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (parsed) onPick(parsed);
        }}
      >
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='Try "Tomorrow at 2 PM"…'
          aria-label="Remind me at"
          className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-[13px] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
        />
        {text && (
          <button type="submit" disabled={!parsed} className={cn("mt-1.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px]", parsed ? "bg-accent text-foreground" : "text-muted-foreground")}>
            <AlarmClock className="h-3.5 w-3.5" />
            {parsed ? <>Remind me <b className="font-semibold">{parsed.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</b></> : "Try “in 3 hours”, “friday 9am”, “nov 12”"}
          </button>
        )}
      </form>
      <div className="border-t border-border p-1">
        {presets.map((p) => (
          <button key={p.label} type="button" onClick={() => onPick(p.at)} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent">
            <p.icon className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">{p.label}</span>
            <span className="text-[11.5px] text-muted-foreground">{fmt(p.at)}</span>
          </button>
        ))}
      </div>
      <div className="border-t border-border p-2">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-[13px] font-semibold">{month.toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
          <span className="flex items-center gap-0.5">
            <button type="button" onClick={() => setMonth(new Date(now.getFullYear(), now.getMonth(), 1))} className="rounded px-1.5 py-0.5 text-[11.5px] text-muted-foreground hover:bg-accent">Today</button>
            <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded p-0.5 text-muted-foreground hover:bg-accent"><ChevronUp className="h-4 w-4" /></button>
            <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded p-0.5 text-muted-foreground hover:bg-accent"><ChevronDown className="h-4 w-4" /></button>
          </span>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <span key={d} className="py-1">{d}</span>)}
        </div>
        <div className="grid grid-cols-7 text-center text-[12px]">
          {days.map((d) => {
            const past = d < today0;
            const isToday = d.getTime() === today0.getTime();
            const out = d.getMonth() !== month.getMonth();
            return (
              <button
                key={d.toISOString()}
                type="button"
                disabled={past}
                aria-label={`Remind me ${d.toDateString()} 8 AM`}
                onClick={() => onPick(isToday ? new Date(Math.max(at8(d).getTime(), now.getTime() + 3_600_000)) : at8(d))}
                className={cn(
                  "mx-auto my-0.5 flex h-7 w-7 items-center justify-center rounded-full",
                  past ? "text-muted-foreground/35" : out ? "text-muted-foreground hover:bg-accent" : "hover:bg-accent",
                  isToday && "bg-destructive font-semibold text-white hover:bg-destructive",
                )}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
