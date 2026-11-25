"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AppWindow, CalendarCheck, Clock4, Home, Images, Menu, Network, Settings, ShieldCheck, Siren, UserRound, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppSwitcher } from "@/components/AppSwitcher";
import { useAuth } from "@/providers/AuthProvider";
import { useTrackerWs } from "../_lib/tracker";
import { ProductUserMenu } from "@/components/ProductUserMenu";
import { Avatar } from "./bits";

const NAV = [
  { path: "", label: "Live", icon: Home, team: false },
  { path: "timesheets", label: "Timesheets", icon: Clock4, team: false },
  { path: "screenshots", label: "Screenshots", icon: Images, team: true },
  { path: "apps", label: "Apps & sites", icon: AppWindow, team: true },
  { path: "attendance", label: "Attendance", icon: CalendarCheck, team: false },
  { path: "alerts", label: "Unusual activity", icon: Siren, team: true },
  { path: "me", label: "My tracking", icon: UserRound, team: false },
  { path: "people", label: "People", icon: UsersRound, team: true },
  { path: "team", label: "Teams", icon: Network, team: true, admin: true },
  { path: "settings", label: "Settings", icon: Settings, team: true },
] as const;

/** EZ Tracker: one organization-wide tracker. Glass sidebar (app switcher on top) + slim title bar. */
export function TrackerShell({ children }: { children: React.ReactNode }) {
  const { ws, ov, isError } = useTrackerWs();
  const { user } = useAuth();
  const pathname = usePathname() ?? "";
  const base = `/tracker/${ws}`;
  const [menu, setMenu] = useState(false);
  const isOn = (p: string) => (p ? pathname.startsWith(`${base}/${p}`) : pathname === base);
  const title = NAV.find((n) => isOn(n.path))?.label ?? "EZ Tracker";
  useEffect(() => setMenu(false), [pathname]);

  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-10 text-center">
        <p className="text-[20px] font-semibold">EZ Tracker isn&apos;t set up for you</p>
        <p className="mt-1 text-[13px] text-muted-foreground">EZ Tracker records work time, screenshots and activity. A Tracker admin or the Administrator adds people to it.</p>
        <Link href="/home" className="mt-4 text-[13px] font-semibold text-primary hover:underline">Back to home</Link>
      </div>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col overflow-y-auto rounded-[28px] border border-white/70 bg-white/60 p-3.5 shadow-[0_20px_60px_-24px_rgba(11,42,31,0.35)] ring-1 ring-black/[0.03] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-white/[0.04]">
      <AppSwitcher active="tracker" hrefs={{ tracker: base }} subtitle="Time & activity" />
      <p className="mb-1.5 mt-5 px-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{ov?.canSeeOthers ? "Team" : "You"}</p>
      <nav aria-label="EZ Tracker" className="space-y-0.5">
        {NAV.filter((n) => (!n.team || ov?.isManager) && (!("admin" in n && (n as { admin?: boolean }).admin) || (ov as { isAdmin?: boolean } | undefined)?.isAdmin)).map((n) => {
          const on = isOn(n.path);
          return (
            <Link key={n.label} href={n.path ? `${base}/${n.path}` : base} aria-current={on ? "page" : undefined}
              className={cn("group flex items-center gap-3 rounded-2xl px-2.5 py-[7px] text-[13.5px] font-medium transition-all", on ? "bg-forest text-white shadow-[0_10px_24px_-12px_rgba(11,42,31,0.8)] dark:bg-primary dark:text-primary-foreground" : "text-foreground/75 hover:bg-white/70 hover:text-foreground dark:hover:bg-white/5")}>
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition", on ? "bg-white/10 text-brass-soft" : "bg-white/60 text-muted-foreground group-hover:text-foreground dark:bg-white/5")}><n.icon className="h-4 w-4" /></span>
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-2 pt-5">
        {ov && (
          <Link href={`${base}/me`} className={cn("flex items-center gap-2 rounded-2xl px-3 py-2 text-[12px] ring-1", ov.consent.acceptedAt ? "bg-[#047857]/[0.06] text-[#047857] ring-[#047857]/15 dark:text-[#34d399]" : "bg-[#b45309]/[0.07] text-[#b45309] ring-[#b45309]/20 dark:text-[#fbbf24]")}>
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate font-medium">{ov.consent.acceptedAt ? "You agreed to tracking" : "Consent needed before tracking"}</span>
          </Link>
        )}
        <div className="rounded-2xl bg-white/60 p-1.5 ring-1 ring-black/[0.04] dark:bg-white/5">
          <ProductUserMenu subtitle={ov ? (ov.isSystemAdmin ? "Administrator" : ov.isManager ? "Tracker admin" : "Member") : undefined} canManageAccess={!!ov?.isSystemAdmin} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative flex min-h-full bg-[#f0f4f4] dark:bg-background">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#34d399]/20 blur-[110px] dark:bg-[#34d399]/8" />
        <div className="absolute -right-32 top-24 h-[420px] w-[420px] rounded-full bg-[#0369a1]/12 blur-[120px] dark:bg-[#0369a1]/10" />
        <div className="absolute -bottom-40 left-[35%] h-[420px] w-[420px] rounded-full bg-[#b08d57]/15 blur-[120px] dark:bg-[#b08d57]/8" />
      </div>

      <aside aria-label="EZ Tracker menu" className="sticky top-0 z-30 hidden h-screen w-[268px] shrink-0 p-3 lg:block">{sidebar}</aside>
      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setMenu(false)} className="absolute inset-0 bg-black/30" />
          <div className="absolute inset-y-0 left-0 w-[280px] p-2">{sidebar}</div>
        </div>
      )}

      <div className="relative z-10 min-w-0 flex-1">
        <header className="sticky top-0 z-20 px-4 pb-1 pt-4 sm:px-5">
          <div className="flex items-center gap-3 rounded-[22px] border border-white/70 bg-white/60 px-3 py-2.5 shadow-[0_12px_40px_-24px_rgba(11,42,31,0.35)] backdrop-blur-2xl sm:px-4 dark:border-white/10 dark:bg-white/[0.04]">
            <button type="button" aria-label="Open menu" onClick={() => setMenu(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border lg:hidden"><Menu className="h-4 w-4" /></button>
            <span className="min-w-0">
              <span className="block text-[11px] font-medium text-muted-foreground">EZ Tracker</span>
              <h1 className="truncate text-[20px] font-semibold leading-tight tracking-tight">{title}</h1>
            </span>
            <span className="flex-1" />
            <span className="hidden text-[12.5px] text-muted-foreground sm:block">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
          </div>
        </header>
        <div className="px-4 pb-10 pt-3 sm:px-5">{children}</div>
      </div>
    </div>
  );
}
