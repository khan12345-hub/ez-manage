"use client";

/*
 * The product rail (Slack / Linear style): a slim forest strip on the far left with the
 * products as icons (Boards · Work · CEO · Vault) and quick actions at the bottom.
 * It frees the Work sidebar from the big product tiles.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { BarChart3, Inbox, KeyRound, LayoutGrid, ListChecks, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { useProductAccess } from "@/hooks/useProductAccess";
import { useCeoAccess } from "@/services/ceo-tower.api";
import { useCommandPalette } from "@/store/command-palette";
import { useWorkCreate } from "@/store/work-create";
import { useInboxCounts } from "@/app/(dashboard)/work/[workspaceId]/inbox/useInboxCounts";

function RailButton({ href, onClick, label, icon: Icon, active, badge, tint }: { href?: string; onClick?: () => void; label: string; icon: typeof Inbox; active?: boolean; badge?: number; tint?: string }) {
  const body = (
    <>
      <span className={cn("relative flex h-10 w-10 items-center justify-center rounded-xl transition-all", active ? "bg-white text-forest shadow-[0_6px_16px_-6px_rgba(0,0,0,0.5)]" : "text-white/70 group-hover:bg-white/10 group-hover:text-white")}>
        <Icon className="h-[19px] w-[19px]" strokeWidth={2} style={active && tint ? { color: tint } : undefined} />
        {!!badge && <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-[#ef4444] px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-forest">{badge > 99 ? "99+" : badge}</span>}
      </span>
      <span className={cn("mt-1 text-[10.5px] font-medium leading-none", active ? "text-white" : "text-white/60 group-hover:text-white/90")}>{label}</span>
    </>
  );
  const cls = "group flex w-full flex-col items-center py-1.5 outline-none focus-visible:[&>span:first-child]:ring-2 focus-visible:[&>span:first-child]:ring-brass-soft";
  return href ? <Link href={href} aria-label={label} aria-current={active ? "page" : undefined} className={cls}>{body}</Link> : <button type="button" aria-label={label} onClick={onClick} className={cls}>{body}</button>;
}

export function WorkRail() {
  const { user } = useAuth();
  const access = useProductAccess();
  const ceo = useCeoAccess();
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const setPaletteOpen = useCommandPalette((s) => s.setPaletteOpen);
  const openCreate = useWorkCreate((s) => s.openCreate);
  const inbox = useInboxCounts();
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  return (
    <nav aria-label="Products" className="relative z-40 hidden w-[72px] shrink-0 flex-col items-center bg-forest py-3 md:flex dark:bg-[#0a1f17]">
      <Link href="/home" aria-label="EZ Manage home" className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 font-serif text-[17px] font-semibold text-brass-soft ring-1 ring-brass/40">EZ</Link>
      <div className="flex w-full flex-1 flex-col items-center gap-1 px-1.5">
        {access.hasBoards && <RailButton href={access.boardsHref} label="Boards" icon={LayoutGrid} />}
        <RailButton href={workspaceId ? `/work/${workspaceId}` : access.workHref} label="Work" icon={ListChecks} active tint="#047857" />
        {ceo.allowed && <RailButton href="/ceo" label="CEO" icon={BarChart3} />}
        <RailButton href="/vault" label="Vault" icon={KeyRound} />
        <span className="my-2 h-px w-8 bg-white/15" />
        {workspaceId && <RailButton href={`/work/${workspaceId}/inbox`} label="Inbox" icon={Inbox} badge={inbox.primaryUnread} />}
        <RailButton onClick={() => setPaletteOpen(true)} label="Search" icon={Search} />
      </div>
      <div className="flex flex-col items-center gap-3">
        <button type="button" aria-label="Create a task" title="Create a task" onClick={() => openCreate(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-brass text-forest shadow-[0_8px_18px_-8px_rgba(176,141,87,0.9)] transition hover:brightness-110">
          <Plus className="h-5 w-5" strokeWidth={2.5} />
        </button>
        <span title={user ? `${user.firstName} ${user.lastName}` : undefined} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/15 text-[12px] font-semibold text-white ring-2 ring-white/20">
          {(user as any)?.avatarUrl ? <img src={(user as any).avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}
        </span>
      </div>
    </nav>
  );
}
