"use client";

import { useState } from "react";
import { Menu, UserPlus } from "lucide-react";
import { InviteModal } from "@/components/InviteModal";
import { useInviteModalStore } from "@/store/invite-modal";
import { Searchbar } from "./Searchbar";
import { Notifications } from "./Notifications";
import UserProfile from "./UserProfile";
import { GlobalSearchModal } from "@/app/(dashboard)/workspace/[workspaceId]/board/[boardId]/BoardHeader/GlobalSearch/GlobalSearchModal";

interface TopNavbarProps {
  onMenuToggle?: () => void;
}

export function TopNavbar({ onMenuToggle }: TopNavbarProps) {
  const openInviteModal = useInviteModalStore((state) => state.open);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header className="flex h-14 w-full shrink-0 items-center justify-between border-b border-gray-200 bg-white px-3 shadow-sm sm:h-16 sm:px-8">
        {/* Hamburger — mobile only */}
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Open menu"
          className="mr-2 shrink-0 rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search bar */}
        <div className="flex flex-1 justify-center px-1 sm:px-6">
          <Searchbar onOpen={() => setSearchOpen(true)} />
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 sm:gap-3.5">
          <Notifications />

          <button
            onClick={openInviteModal}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 sm:px-3.5 sm:py-2"
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
