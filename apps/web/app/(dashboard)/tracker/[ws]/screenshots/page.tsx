"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Eye, EyeOff, ImageOff, Keyboard, ListChecks, Mouse, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { hm, trackerApi, userName, type TrackerShot, type TrackerSlot } from "@/services/tracker.api";
import { dayRange, fmtDay, keyOf, todayKey, useTrackerWs } from "../../_lib/tracker";
import { ActivityBar, Avatar, DayPicker, InstallHint, PersonPicker, Stat, glass } from "../../_components/bits";

const err = (e: any, m: string) => toast.error(e?.response?.data?.message?.toString?.() ?? m);
const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" });
const t = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

type Flat = { shot: TrackerShot; slot: TrackerSlot };

function Lightbox({ items, index, onIndex, onClose, own, canHide, onDelete, onHide, busy }: {
  items: Flat[]; index: number; onIndex: (i: number) => void; onClose: () => void; own: boolean; canHide: boolean;
  onDelete: (s: TrackerShot) => void; onHide: (s: TrackerShot) => void; busy: boolean;
}) {
  const it = items[index];
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setConfirm(false), [index]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1); if (e.key === "ArrowRight" && index < items.length - 1) onIndex(index + 1); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [index, items.length, onIndex]);
  if (!it) return null;
  const { shot, slot } = it;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[min(1100px,96vw)] max-w-[min(1100px,96vw)] gap-3 p-3 sm:max-w-[min(1100px,96vw)] sm:p-4">
        <DialogTitle className="flex flex-wrap items-center gap-2 pr-8 text-[15px]">
          {t(shot.takenAt)}<span className="text-[12.5px] font-normal text-muted-foreground">· {fmtDay(keyOf(new Date(slot.start)))} · screen {shot.screen + 1}{shot.blurred ? " · blurred" : ""}{shot.hiddenAt ? " · hidden from the team" : ""}</span>
        </DialogTitle>
        <DialogDescription className="sr-only">Screenshot {index + 1} of {items.length}</DialogDescription>
        <div className="relative overflow-hidden rounded-xl bg-black/90">
          {shot.url ? <img src={shot.url} alt={`Screenshot at ${t(shot.takenAt)}`} className="mx-auto max-h-[68vh] w-auto object-contain" /> : <div className="flex h-64 items-center justify-center text-white/70"><EyeOff className="mr-2 h-5 w-5" /> Hidden</div>}
          {index > 0 && <button type="button" aria-label="Previous screenshot" onClick={() => onIndex(index - 1)} className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"><ChevronLeft className="h-5 w-5" /></button>}
          {index < items.length - 1 && <button type="button" aria-label="Next screenshot" onClick={() => onIndex(index + 1)} className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"><ChevronRight className="h-5 w-5" /></button>}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px]">
          <span className="flex min-w-[180px] flex-1 items-center gap-2"><span className="text-muted-foreground">Activity</span><ActivityBar pct={slot.activityPct} className="max-w-[180px] flex-1" /></span>
          <span className="flex items-center gap-1 text-muted-foreground"><Keyboard className="h-3.5 w-3.5" />{slot.keyboard}</span>
          <span className="flex items-center gap-1 text-muted-foreground"><Mouse className="h-3.5 w-3.5" />{slot.mouse}</span>
          {(slot.task || slot.project) && <span className="flex items-center gap-1 truncate"><ListChecks className="h-3.5 w-3.5 text-muted-foreground" />{slot.task?.name ?? slot.project}</span>}
          {slot.apps[0] && <span className="truncate text-muted-foreground">Mostly in <b className="font-medium text-foreground">{slot.apps[0].app}</b></span>}
          <span className="flex-1" />
          {canHide && <button type="button" disabled={busy} onClick={() => onHide(shot)} className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 font-medium hover:bg-accent disabled:opacity-50">{shot.hiddenAt ? <><Eye className="h-3.5 w-3.5" /> Show to team</> : <><EyeOff className="h-3.5 w-3.5" /> Hide from team</>}</button>}
          {own && (confirm ? (
            <span className="flex items-center gap-2 rounded-lg bg-[#dc2626]/[0.07] px-2.5 py-1 text-[12px]">
              Delete it and remove these 10 minutes of time?
              <button type="button" disabled={busy} onClick={() => onDelete(shot)} className="h-7 rounded-md bg-[#dc2626] px-2.5 font-semibold text-white disabled:opacity-50">Delete</button>
              <button type="button" onClick={() => setConfirm(false)} className="h-7 rounded-md px-2 text-muted-foreground hover:text-foreground">Cancel</button>
            </span>
          ) : <button type="button" onClick={() => setConfirm(true)} className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 font-medium text-[#dc2626] hover:bg-[#dc2626]/[0.06] dark:text-[#f87171]"><Trash2 className="h-3.5 w-3.5" /> Delete</button>)}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SlotCard({ s, onOpen }: { s: TrackerSlot; onOpen: (shot: TrackerShot) => void }) {
  const first = s.shots[0];
  const start = new Date(s.start);
  const end = new Date(start.getTime() + 600_000);
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card", s.idleDiscarded && "opacity-60", s.away && !s.idleDiscarded && "ring-1 ring-[#d97706]/40")}>
      {s.idleDiscarded ? (
        <div className="flex aspect-[16/10] items-center justify-center bg-[repeating-linear-gradient(135deg,transparent_0_8px,rgba(0,0,0,0.04)_8px_16px)] text-[11.5px] text-muted-foreground dark:bg-[repeating-linear-gradient(135deg,transparent_0_8px,rgba(255,255,255,0.05)_8px_16px)]">Idle · discarded</div>
      ) : first ? (
        <button type="button" onClick={() => onOpen(first)} aria-label={`Screenshot at ${t(first.takenAt)}`} className="group relative block aspect-[16/10] overflow-hidden bg-black/[0.04]">
          {first.url ? <img src={first.url} alt="" loading="lazy" className={cn("h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.04]", first.blurred && "blur-[1.5px]")} /> : <span className="flex h-full items-center justify-center text-muted-foreground"><EyeOff className="h-4 w-4" /></span>}
          {s.shots.length > 1 && <span className="absolute right-1.5 top-1.5 rounded-md bg-black/55 px-1.5 text-[10.5px] font-semibold text-white">+{s.shots.length - 1}</span>}
          {first.hiddenAt && <span className="absolute left-1.5 top-1.5 rounded-md bg-black/55 px-1.5 text-[10.5px] text-white">Hidden</span>}
          {s.away && <span className="absolute bottom-1.5 left-1.5 rounded-md bg-[#d97706] px-1.5 py-0.5 text-[10px] font-semibold text-white">Away</span>}
        </button>
      ) : (
        <div className="flex aspect-[16/10] items-center justify-center bg-black/[0.03] text-muted-foreground dark:bg-white/[0.03]"><ImageOff className="h-4 w-4" /></div>
      )}
      <div className="space-y-1.5 p-2.5">
        <p className="flex items-center justify-between text-[11.5px]"><span className="font-semibold tabular-nums">{t(start.toISOString())} – {t(end.toISOString())}</span><span className="tabular-nums text-muted-foreground">{Math.round(s.seconds / 60)}m</span></p>
        <ActivityBar pct={s.activityPct} />
        <p className={cn("truncate text-[11px]", s.away ? "font-medium text-[#b45309] dark:text-[#fbbf24]" : "text-muted-foreground")} title={s.project ?? ""}>{s.away ? "Away · not on seat" : s.project ?? "Active"}</p>
      </div>
    </div>
  );
}

function Screenshots() {
  const { ws, ov } = useTrackerWs();
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const day = sp.get("day") || todayKey();
  const userParam = sp.get("user");
  const set = (k: string, v: string | null) => { const p = new URLSearchParams(sp.toString()); if (v) p.set(k, v); else p.delete(k); router.replace(`${pathname}?${p.toString()}`); };
  const { data: live = [] } = useQuery({ queryKey: ["tracker", ws, "live"], queryFn: () => trackerApi.live(ws), enabled: !!ws && !!ov?.canSeeOthers });
  const people = live.map((r) => r.user);
  const userId = userParam ? Number(userParam) : undefined;
  const { from, to } = dayRange(day);
  const key = ["tracker", ws, "day", userId ?? "me", day];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => trackerApi.day(ws, from, to, userId), enabled: !!ws });
  const [open, setOpen] = useState<number | null>(null);

  const flat: Flat[] = useMemo(() => (data?.slots ?? []).flatMap((slot) => slot.shots.map((shot) => ({ shot, slot }))), [data]);
  const byHour = useMemo(() => {
    const m = new Map<number, TrackerSlot[]>();
    for (const s of data?.slots ?? []) { const h = new Date(s.start).getHours(); m.set(h, [...(m.get(h) ?? []), s]); }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [data]);
  const kept = (data?.slots ?? []).filter((s) => !s.idleDiscarded);
  const avg = kept.length ? Math.round(kept.reduce((n, s) => n + s.activityPct * s.seconds, 0) / Math.max(1, kept.reduce((n, s) => n + s.seconds, 0))) : 0;

  const del = useMutation({
    mutationFn: (s: TrackerShot) => trackerApi.deleteShot(s.id),
    onSuccess: () => { toast.success("Screenshot deleted. Its 10 minutes were removed."); setOpen(null); qc.invalidateQueries({ queryKey: ["tracker", ws] }); },
    onError: (e) => err(e, "Couldn't delete the screenshot."),
  });
  const hide = useMutation({
    mutationFn: (s: TrackerShot) => trackerApi.hideShot(s.id, !s.hiddenAt),
    onSuccess: (_r, s) => { toast.success(s.hiddenAt ? "Shown to the team again" : "Hidden from the team"); qc.invalidateQueries({ queryKey: key }); },
    onError: (e) => err(e, "Couldn't change it."),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {ov?.canSeeOthers && people.length > 0 && <PersonPicker people={people} value={userId ?? data?.user?.id ?? null} onChange={(id) => set("user", id ? String(id) : null)} />}
        <DayPicker day={day} onDay={(d) => set("day", d)} />
        <span className="flex-1" />
        {data?.user && <span className="flex items-center gap-2 text-[13px]"><Avatar user={data.user} size={26} /><b className="font-semibold">{userName(data.user)}</b></span>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Tracked" value={hm(data?.totalSeconds ?? 0)} sub={fmtDay(day, { weekday: "long", month: "short", day: "numeric" })} />
        <Stat label="Activity" value={`${avg}%`} sub="average this day" />
        <Stat label="Screenshots" value={flat.length} sub={ov?.settings.blur ? "blurred for privacy" : `${kept.length} blocks of 10 min`} />
      </div>

      {isLoading ? <div className="h-80 animate-pulse rounded-[24px] bg-muted" /> : !data?.slots.length ? <InstallHint ws={ws} compact /> : (
        <div className="space-y-4">
          {byHour.map(([h, slots]) => (
            <section key={h} aria-label={hourLabel(h)} className={cn(glass, "p-4")}>
              <header className="mb-3 flex items-center gap-3">
                <h3 className="text-[14px] font-semibold">{hourLabel(h)}</h3>
                <span className="text-[12px] text-muted-foreground">{hm(slots.filter((s) => !s.idleDiscarded).reduce((n, s) => n + s.seconds, 0))}</span>
              </header>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
                {slots.map((s) => <SlotCard key={s.id} s={s} onOpen={(shot) => setOpen(flat.findIndex((f) => f.shot.id === shot.id))} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {open !== null && open >= 0 && data && (
        <Lightbox items={flat} index={open} onIndex={setOpen} onClose={() => setOpen(null)} own={data.own} canHide={data.canHide}
          onDelete={(s) => del.mutate(s)} onHide={(s) => hide.mutate(s)} busy={del.isPending || hide.isPending} />
      )}
    </div>
  );
}

export default function TrackerScreenshots() {
  return <Suspense fallback={<div className="h-80 animate-pulse rounded-[24px] bg-muted" />}><Screenshots /></Suspense>;
}
