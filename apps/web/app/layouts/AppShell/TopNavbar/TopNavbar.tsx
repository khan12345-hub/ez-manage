"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, UserPlus, RefreshCw, LayoutGrid } from "lucide-react";
import { useCommandPalette } from "@/store/command-palette";
import { useQueryClient } from "@tanstack/react-query";
import { InviteModal } from "@/components/InviteModal";
import { useInviteModalStore } from "@/store/invite-modal";
import { Searchbar } from "./Searchbar";
import { Notifications } from "./Notifications";
import UserProfile from "./UserProfile";
import { ImportJobBadge } from "@/components/ImportJobBadge";
import { RunningTimer } from "./RunningTimer";
import { WorkInboxBell } from "./WorkInboxBell";
import { WorkInviteModal, useWorkInvite } from "@/app/(dashboard)/work/_components/WorkInviteModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useProductAccess } from "@/hooks/useProductAccess";
import { GlobalSearchModal } from "@/app/(dashboard)/workspace/[workspaceId]/board/[boardId]/BoardHeader/GlobalSearch/GlobalSearchModal";

interface TopNavbarProps {
  onMenuToggle?: () => void;
  /** Boards and Work have fully separate headers: own search, notifications and tools */
  product?: "boards" | "work";
}

export function TopNavbar({ onMenuToggle, product = "boards" }: TopNavbarProps) {
  const isWork = product === "work";
  const products = useProductAccess();
  const openWorkInvite = useWorkInvite((s) => s.setOpen);
  const openInviteModal = useInviteModalStore((state) => state.open);
  const setPaletteOpen = useCommandPalette((s) => s.setPaletteOpen);
  const searchOpen = useCommandPalette((s) => s.taskSearchOpen);
  const setSearchOpen = useCommandPalette((s) => s.setTaskSearchOpen);
  const [refreshing, setRefreshing] = useState(false);
  const qc = useQueryClient();

  const handleRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries();
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <>
      <header className="flex h-14 w-full shrink-0 items-center justify-between border-b border-border bg-card/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/70 sm:h-16 sm:px-6">
        {/* Hamburger — mobile only */}
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Open menu"
          className="mr-2 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Back to module launcher — desktop only, and only when there is more than one product */}
        {products.productCount > 1 && <Link
          href="/home"
          className="mr-3 hidden shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex"
          title="All products"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          <span>Products</span>
        </Link>}

        {/* Search bar */}
        <div className="flex flex-1 justify-center px-1 sm:px-6">
          <Searchbar onOpen={() => setPaletteOpen(true)} placeholder={isWork ? "Search Work: lists, spaces, actions…" : undefined} />
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 sm:gap-3.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh all data"
            aria-label="Refresh all data"
            className="hidden h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 sm:flex"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          {isWork ? <RunningTimer /> : <ImportJobBadge />}
          <ThemeToggle />
          {isWork ? <WorkInboxBell /> : <Notifications />}

          <button
            onClick={() => (isWork ? openWorkInvite(true) : openInviteModal())}
            className="flex cursor-pointer items-center gap-1.5 rounded-md bg-forest px-2.5 py-1.5 text-xs font-semibold text-forest-foreground shadow-sm transition-colors hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 sm:px-3.5 sm:py-2"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Invite</span>
          </button>

          <UserProfile />
        </div>
      </header>

      {!isWork && (
        <GlobalSearchModal
          open={searchOpen}
          onOpenChange={setSearchOpen}
        />
      )}

      {isWork ? <WorkInviteModal /> : <InviteModal />}
    </>
  );
}
