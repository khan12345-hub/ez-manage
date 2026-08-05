"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { InviteModal } from "@/components/InviteModal";
import { useInviteModalStore } from "@/store/invite-modal";
import { Searchbar } from "./Searchbar";
import { Notifications } from "./Notifications";
import UserProfile from "./UserProfile";
import { GlobalSearchModal } from "@/app/(dashboard)/workspace/[workspaceId]/board/[boardId]/BoardHeader/GlobalSearch/GlobalSearchModal";

export function TopNavbar() {
  const openInviteModal = useInviteModalStore((state) => state.open);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header className="flex h-16 w-full items-center justify-between border-b border-gray-200 bg-white px-8 shadow-sm">
        <div className="flex flex-1 justify-center px-6">
          <Searchbar onOpen={() => setSearchOpen(true)} />
        </div>

        <div className="flex items-center gap-3.5">
          <Notifications />

          <button
            onClick={openInviteModal}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 px-3.5 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800"
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