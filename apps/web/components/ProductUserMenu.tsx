"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, LayoutGrid, LogOut, Settings, ShieldCheck, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { useLogout } from "@/services/auth/auth.hooks";

/**
 * The account menu for the product shells (EZ Tracker, EZ Sales, EZ Vault …): tapping the avatar
 * opens My profile, All products, Access Center (if allowed), System settings (Administrator), Log out.
 * The main AppShell has its own; this gives the standalone product shells the same.
 */
export function ProductUserMenu({ subtitle, canManageAccess, compact, placement = "up" }: { subtitle?: string; canManageAccess?: boolean; compact?: boolean; placement?: "up" | "down" }) {
  const { user } = useAuth();
  const logout = useLogout();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Account";
  const initials = (`${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "?");
  const avatarUrl = (user as any)?.avatarUrl as string | null | undefined;
  const isSuper = user?.systemRole === "SUPER_ADMIN";
  const go = (p: string) => { router.push(p); setOpen(false); };

  const Item = ({ icon: Icon, label, onClick, danger }: { icon: any; label: string; onClick: () => void; danger?: boolean }) => (
    <button type="button" onClick={onClick} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium hover:bg-accent", danger && "text-destructive hover:bg-destructive/10")}>
      <Icon className="h-4 w-4 shrink-0 opacity-80" /> {label}
    </button>
  );

  const Pic = avatarUrl
    ? <img src={avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
    : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">{initials}</span>;

  return (
    <div ref={ref} className="relative">
      {compact ? (
        <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label="Account" onClick={() => setOpen((o) => !o)} className="flex h-9 w-9 items-center justify-center rounded-full transition hover:ring-2 hover:ring-border">{Pic}</button>
      ) : (
        <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 rounded-2xl px-1 py-1 text-left transition hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
          {Pic}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold leading-tight">{name}</span>
            {subtitle && <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>}
          </span>
          <ChevronUp className={cn("h-4 w-4 shrink-0 text-muted-foreground transition", !open && "rotate-180")} />
        </button>
      )}
      {open && (
        <div role="menu" className={cn("absolute z-50 w-[220px] rounded-xl border border-border bg-popover p-1.5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.3)]", placement === "down" ? "top-full mt-2 right-0" : "bottom-full mb-2 left-0")}>
          {compact && <div className="truncate border-b border-border px-2.5 pb-2 pt-1 text-[12px]"><span className="block truncate font-semibold">{name}</span>{subtitle && <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>}</div>}
          <Item icon={User} label="My profile" onClick={() => go("/settings")} />
          <Item icon={LayoutGrid} label="All products" onClick={() => go("/home")} />
          {canManageAccess && <Item icon={ShieldCheck} label="Access Center" onClick={() => go("/access")} />}
          {isSuper && <Item icon={Settings} label="System settings" onClick={() => go("/system-settings")} />}
          <div className="my-1 border-t border-border" />
          <Item icon={LogOut} label="Log out" danger onClick={() => { setOpen(false); logout.mutate(); }} />
        </div>
      )}
    </div>
  );
}
