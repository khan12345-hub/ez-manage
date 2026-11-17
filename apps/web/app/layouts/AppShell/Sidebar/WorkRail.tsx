"use client";

/*
 * The Work rail (ClickUp style): a slim forest strip on the far left with Work's own pages
 * (Home, Inbox, Teams, Docs, Forms, Goals, Timesheet, More). The products (Boards / Work /
 * CEO / Vault) open from the EZ logo at the top.
 */

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  BarChart3, Clapperboard, ClipboardList, Clock, FileText, Goal, Grid3x3, Hash, Home, Inbox, KeyRound, LayoutGrid,
  ListChecks, PenTool, Plus, Search, Sparkles, UsersRound, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { workApi, workKeys } from "@/services/work.api";
import { useAuth } from "@/providers/AuthProvider";
import { useProductAccess } from "@/hooks/useProductAccess";
import { useCeoAccess } from "@/services/ceo-tower.api";
import { useCommandPalette } from "@/store/command-palette";
import { useWorkCreate } from "@/store/work-create";
import { useInboxCounts } from "@/app/(dashboard)/work/[workspaceId]/inbox/useInboxCounts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const INBOX_PATHS = ["inbox", "replies", "assigned-comments", "chat/posts", "chat/search"];
const MAIN = [
  { path: "", label: "Home", icon: Home },
  { path: "inbox", label: "Inbox", icon: Inbox },
  { path: "teams", label: "Teams", icon: UsersRound },
  { path: "docs", label: "Docs", icon: FileText },
  { path: "forms", label: "Forms", icon: ClipboardList },
  { path: "goals", label: "Goals", icon: Goal },
  { path: "timesheets", label: "Timesheet", icon: Clock },
] as const;
const MORE = [
  { path: "sprints", label: "Sprints", icon: Zap },
  { path: "whiteboards", label: "Whiteboards", icon: PenTool },
  { path: "clips", label: "Clips", icon: Clapperboard },
  { path: "ai", label: "Ask AI", icon: Sparkles },
  { path: "all-tasks", label: "All Tasks", icon: ListChecks },
  { path: "spaces", label: "All Spaces", icon: LayoutGrid },
  { path: "chat/channels", label: "All Channels", icon: Hash },
] as const;

function RailItem({ href, label, icon: Icon, active, badge }: { href: string; label: string; icon: typeof Inbox; active?: boolean; badge?: number }) {
  return (
    <Link href={href} aria-label={label} aria-current={active ? "page" : undefined} className="group flex w-full flex-col items-center py-1 outline-none">
      <span className={cn("relative flex h-9 w-9 items-center justify-center rounded-xl transition-all", active ? "bg-white text-forest shadow-[0_6px_16px_-6px_rgba(0,0,0,0.5)]" : "text-white/70 group-hover:bg-white/10 group-hover:text-white group-focus-visible:ring-2 group-focus-visible:ring-brass-soft")}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        {!!badge && <span className="absolute -right-1.5 -top-1 min-w-[17px] rounded-full bg-[#ef4444] px-1 text-center text-[9.5px] font-bold leading-[17px] text-white ring-2 ring-forest">{badge > 99 ? "99+" : badge}</span>}
      </span>
      <span className={cn("mt-0.5 text-[10px] font-medium leading-tight", active ? "text-white" : "text-white/60 group-hover:text-white/90")}>{label}</span>
    </Link>
  );
}

export function WorkRail() {
  const { user } = useAuth();
  const access = useProductAccess();
  const ceo = useCeoAccess();
  const pathname = usePathname() ?? "";
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const setPaletteOpen = useCommandPalette((s) => s.setPaletteOpen);
  const openCreate = useWorkCreate((s) => s.openCreate);
  const inbox = useInboxCounts();
  const { data: accessTree } = useQuery({ queryKey: workKeys.tree(workspaceId ?? ""), queryFn: () => workApi.tree(workspaceId ?? ""), enabled: !!workspaceId, staleTime: 30_000 });
  const canCreate = !!accessTree?.access.canEdit;
  const base = workspaceId ? `/work/${workspaceId}` : access.workHref ?? "/work";
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  const isOn = (p: string) => (p === "" ? pathname === base : p === "inbox" ? INBOX_PATHS.some((x) => pathname === `${base}/${x}`) : pathname.startsWith(`${base}/${p}`));
  const products = [
    access.hasBoards && { href: access.boardsHref ?? "/home", label: "Boards", icon: LayoutGrid, color: "#4f46e5" },
    { href: base, label: "Work", icon: ListChecks, color: "#047857", on: true },
    ceo.allowed && { href: "/ceo", label: "CEO Tower", icon: BarChart3, color: "#b45309" },
    { href: "/vault", label: "EZ Vault", icon: KeyRound, color: "#0f766e" },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Inbox; color: string; on?: boolean }[];

  return (
    <nav aria-label="Work" className="relative z-40 hidden w-[72px] shrink-0 flex-col items-center bg-forest py-3 md:flex dark:bg-[#0a1f17]">
      {/* EZ logo: switch product */}
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Switch product" title="Switch product" className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 font-serif text-[16px] font-semibold text-brass-soft ring-1 ring-brass/40 transition hover:bg-white/15">EZ</button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="w-56 p-1.5">
          <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Switch to</p>
          {products.map((p) => (
            <Link key={p.label} href={p.href} className={cn("flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13.5px] font-medium hover:bg-accent", p.on && "bg-accent")}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: p.color }}><p.icon className="h-4 w-4" /></span>
              {p.label}{p.on && <span className="ml-auto text-[11px] text-muted-foreground">here</span>}
            </Link>
          ))}
          <Link href="/home" className="mt-1 flex items-center gap-2.5 rounded-lg border-t border-border px-2 py-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground"><Home className="h-4 w-4" /> EZ Manage home</Link>
        </PopoverContent>
      </Popover>

      <div className="flex w-full flex-1 flex-col items-center gap-0.5 overflow-y-auto px-1.5">
        {MAIN.map((m) => <RailItem key={m.label} href={m.path ? `${base}/${m.path}` : base} label={m.label} icon={m.icon} active={isOn(m.path)} badge={m.path === "inbox" ? inbox.primaryUnread : undefined} />)}
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label="More" className="group flex w-full flex-col items-center py-1 outline-none">
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl transition-all", MORE.some((m) => isOn(m.path)) ? "bg-white text-forest" : "text-white/70 group-hover:bg-white/10 group-hover:text-white")}><Grid3x3 className="h-[18px] w-[18px]" /></span>
              <span className="mt-0.5 text-[10px] font-medium text-white/60 group-hover:text-white/90">More</span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className="w-60 p-2">
            <div className="grid grid-cols-2 gap-1">
              {MORE.map((m) => (
                <Link key={m.path} href={`${base}/${m.path}`} className={cn("flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center text-[12px] font-medium hover:bg-accent", isOn(m.path) && "bg-accent")}>
                  <m.icon className="h-5 w-5 text-primary" /> {m.label}
                </Link>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="mt-2 flex flex-col items-center gap-2.5">
        <button type="button" aria-label="Search" title="Search (Ctrl K)" onClick={() => setPaletteOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white"><Search className="h-[18px] w-[18px]" /></button>
        {canCreate && <button type="button" aria-label="Create a task" title="Create a task" onClick={() => openCreate(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-brass text-forest shadow-[0_8px_18px_-8px_rgba(176,141,87,0.9)] transition hover:brightness-110">
          <Plus className="h-5 w-5" strokeWidth={2.5} />
        </button>}
        <span title={user ? `${user.firstName} ${user.lastName}` : undefined} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/15 text-[12px] font-semibold text-white ring-2 ring-white/20">
          {(user as any)?.avatarUrl ? <img src={(user as any).avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}
        </span>
      </div>
    </nav>
  );
}
