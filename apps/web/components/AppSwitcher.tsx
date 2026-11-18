"use client";

/*
 * One app switcher for every product (Accounts & Invoices, Company Work, Executive Hub, EZ Vault).
 * It sits in the same place everywhere: the top of the product's sidebar. Only products this
 * person can open are listed.
 */

import Link from "next/link";
import { useState } from "react";
import { BarChart3, Check, ChevronsUpDown, Home, KeyRound, LayoutGrid, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/products";
import { useProductAccess } from "@/hooks/useProductAccess";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type AppKey = "boards" | "work" | "ceo" | "vault";

export const APPS: Record<AppKey, { name: string; line: string; icon: typeof Home; color: string }> = {
  boards: { name: PRODUCT_NAME.boards, line: "Accounts, invoices and team tables", icon: LayoutGrid, color: "#4f46e5" },
  work: { name: PRODUCT_NAME.work, line: "Spaces, lists and tasks per company", icon: ListChecks, color: "#047857" },
  ceo: { name: PRODUCT_NAME.ceo, line: "Every company, risks and decisions", icon: BarChart3, color: "#b45309" },
  vault: { name: PRODUCT_NAME.vault, line: "Every password in one locked place", icon: KeyRound, color: "#0f766e" },
};

function useApps(hrefs?: Partial<Record<AppKey, string>>) {
  const access = useProductAccess();
  const list: { key: AppKey; href: string }[] = [];
  if (access.hasBoards) list.push({ key: "boards", href: hrefs?.boards ?? access.boardsHref ?? "/home" });
  if (access.hasWork) list.push({ key: "work", href: hrefs?.work ?? access.workHref ?? "/work" });
  if (access.hasCeo) list.push({ key: "ceo", href: "/ceo" });
  list.push({ key: "vault", href: "/vault" });
  return list;
}

function Tile({ k, size = 32 }: { k: AppKey; size?: number }) {
  const A = APPS[k];
  return (
    <span className="flex shrink-0 items-center justify-center rounded-[10px] text-white shadow-[0_6px_14px_-8px_rgba(0,0,0,0.6)]" style={{ width: size, height: size, background: `linear-gradient(140deg, ${A.color}, ${A.color}cc)` }}>
      <A.icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.2} />
    </span>
  );
}

/** the list of apps (also used inside the Work rail's logo popover) */
export function AppSwitcherMenu({ active, hrefs, onNavigate }: { active: AppKey; hrefs?: Partial<Record<AppKey, string>>; onNavigate?: () => void }) {
  const apps = useApps(hrefs);
  return (
    <div className="w-[268px] p-1.5">
      <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Switch app</p>
      <ul className="space-y-0.5">
        {apps.map(({ key, href }) => {
          const A = APPS[key];
          const on = key === active;
          return (
            <li key={key}>
              <Link href={href} onClick={onNavigate} aria-current={on ? "page" : undefined}
                className={cn("flex items-center gap-3 rounded-xl px-2 py-2 transition-colors", on ? "bg-accent" : "hover:bg-accent/70")}>
                <Tile k={key} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold leading-tight">{A.name}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">{A.line}</span>
                </span>
                {on && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href="/home" onClick={onNavigate} className="mt-1 flex items-center gap-2.5 rounded-xl border-t border-border px-2.5 py-2 text-[12.5px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
        <Home className="h-4 w-4" /> EZ Manage home
      </Link>
    </div>
  );
}

/** The switcher button: current app (tile + name) with ⇅; opens the app list. */
export function AppSwitcher({ active, hrefs, subtitle, className, onNavigate }: { active: AppKey; hrefs?: Partial<Record<AppKey, string>>; subtitle?: string; className?: string; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const A = APPS[active];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`${A.name}: switch app`} title="Switch app"
          className={cn("group flex w-full items-center gap-2.5 rounded-2xl p-1.5 pr-2.5 text-left transition hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-white/[0.06]", open && "bg-black/[0.04] dark:bg-white/[0.06]", className)}>
          <Tile k={active} size={36} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold leading-tight">{A.name}</span>
            <span className="block truncate text-[11.5px] text-muted-foreground">{subtitle ?? "EZ Manage"}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-auto rounded-2xl p-0">
        <AppSwitcherMenu active={active} hrefs={hrefs} onNavigate={() => { setOpen(false); onNavigate?.(); }} />
      </PopoverContent>
    </Popover>
  );
}
