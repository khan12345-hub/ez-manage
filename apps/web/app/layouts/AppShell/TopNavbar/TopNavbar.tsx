"use client";

import { useState } from "react";
import { Menu, UserPlus, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { InviteModal } from "@/components/InviteModal";
import { useInviteModalStore } from "@/store/invite-modal";
import { Searchbar } from "./Searchbar";
import { Notifications } from "./Notifications";
import UserProfile from "./UserProfile";
import { ImportJobBadge } from "@/components/ImportJobBadge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GlobalSearchModal } from "@/app/(dashboard)/workspace/[workspaceId]/board/[boardId]/BoardHeader/GlobalSearch/GlobalSearchModal";

interface TopNavbarProps {
  onMenuToggle?: () => void;
}

export function TopNavbar({ onMenuToggle }: TopNavbarProps) {
  const openInviteModal = useInviteModalStore((state) => state.open);
  const [searchOpen, setSearchOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const qc = useQueryClient();

  const handleRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries();
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <>
      <header className="flex h-14 w-full shrink-0 items-center justify-between border-b border-border bg-background px-3 shadow-sm sm:h-16 sm:px-8">
        {/* Hamburger — mobile only */}
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Open menu"
          className="mr-2 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search bar */}
        <div className="flex flex-1 justify-center px-1 sm:px-6">
          <Searchbar onOpen={() => setSearchOpen(true)} />
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 sm:gap-3.5">
          {/* System status + Refresh */}
          <div className="hidden items-center gap-2 sm:flex">
            <span className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-700 dark:border-green-900/50 dark:text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              System Online
            </span>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh all data"
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
            </button>
          </div>

          <ImportJobBadge />
          <ThemeToggle />
          <Notifications />

          <button
            onClick={openInviteModal}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:px-3.5 sm:py-2"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Invite</span>
          </button>

          <UserProfile />
        </div>
      </header>

      <GlobalSearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />

      <InviteModal />
    </>
  );
}
