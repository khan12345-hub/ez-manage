"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, Settings2, Sunrise } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ceoApi, type CeoSettings } from "@/services/ceo-tower.api";

const ZONES = ["Asia/Karachi", "Asia/Dubai", "Asia/Kolkata", "Europe/London", "America/Toronto", "America/New_York", "America/Vancouver", "UTC"];
const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" });

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50", on ? "bg-forest dark:bg-primary" : "bg-muted ring-1 ring-border")}>
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

/** Command Center → Settings: the morning brief (when, where) and "company turned red" alerts */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: s } = useQuery({ queryKey: ["ceo-tower", "settings"], queryFn: ceoApi.settings });
  const save = useMutation({
    mutationFn: (dto: Partial<CeoSettings>) => ceoApi.saveSettings(dto),
    onSuccess: (d) => { qc.setQueryData(["ceo-tower", "settings"], d); toast.success("Saved"); },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't save."),
  });
  const now = useMutation({
    mutationFn: ceoApi.sendBriefNow,
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["ceo-tower", "settings"] }); toast.success(r.emailed === "sent" ? "Brief sent to your inbox and email" : r.emailed === "not_sent" ? "Brief sent to your inbox (email isn't set up on this server)" : "Brief sent to your inbox"); },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't send it."),
  });
  const browserZone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const zones = [...new Set([s?.timezone, browserZone, ...ZONES].filter(Boolean))] as string[];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogTitle className="flex items-center gap-2 font-serif text-[22px] font-normal"><Settings2 className="h-5 w-5 text-[#b08d57]" /> Command Center settings</DialogTitle>
        <DialogDescription>Just for you. Nothing here changes Boards or Work.</DialogDescription>
        {!s ? <div className="h-48 animate-pulse rounded-xl bg-muted" /> : (
          <div className="space-y-3">
            <section aria-label="Morning brief" className="rounded-xl border border-border p-4">
              <div className="flex items-start gap-3">
                <Sunrise className="mt-0.5 h-5 w-5 text-[#b08d57]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold">Morning brief</p>
                  <p className="text-[12.5px] text-muted-foreground">Every day the Executive AI writes what happened in the last 24 hours — what got done, what slipped, who is behind — and puts it in your inbox.</p>
                </div>
                <Toggle on={s.briefOn} label="Morning brief" disabled={save.isPending} onChange={(v) => save.mutate({ briefOn: v })} />
              </div>
              <div className={cn("mt-3 grid gap-3 pl-8 sm:grid-cols-2", !s.briefOn && "opacity-50")}>
                <label className="text-[12px] font-medium text-muted-foreground">Time
                  <select aria-label="Brief time" value={s.briefHour} disabled={!s.briefOn || save.isPending} onChange={(e) => save.mutate({ briefHour: Number(e.target.value) })} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground">
                    {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                  </select>
                </label>
                <label className="text-[12px] font-medium text-muted-foreground">Timezone
                  <select aria-label="Timezone" value={s.timezone} disabled={!s.briefOn || save.isPending} onChange={(e) => save.mutate({ timezone: e.target.value })} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground">
                    {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
                  </select>
                </label>
                <span className="flex items-center justify-between gap-3 sm:col-span-2"><span className="text-[13px]">Also email it to me</span><Toggle on={s.briefEmail} label="Email the brief" disabled={!s.briefOn || save.isPending} onChange={(v) => save.mutate({ briefEmail: v })} /></span>
                <span className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
                  <span className="text-[11.5px] text-muted-foreground">{s.lastBriefOn ? `Last sent ${new Date(`${s.lastBriefOn}T00:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}` : "Not sent yet"}</span>
                  <button type="button" onClick={() => now.mutate()} disabled={now.isPending} className="h-8 rounded-lg border border-border px-3 text-[12.5px] font-semibold hover:bg-accent disabled:opacity-50">{now.isPending ? "Writing…" : "Send me today's brief now"}</button>
                </span>
              </div>
            </section>
            <section aria-label="Alerts" className="rounded-xl border border-border p-4">
              <div className="flex items-start gap-3">
                <BellRing className="mt-0.5 h-5 w-5 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold">Alert me when a company turns red</p>
                  <p className="text-[12.5px] text-muted-foreground">One notice the moment a company becomes critical (5+ overdue, or more than a quarter of its open work late) — not again while it stays red.</p>
                </div>
                <Toggle on={s.alertsOn} label="Company alerts" disabled={save.isPending} onChange={(v) => save.mutate({ alertsOn: v })} />
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
