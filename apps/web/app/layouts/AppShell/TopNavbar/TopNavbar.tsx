"use client";

import React, { useState } from "react";
import { Searchbar } from "./Searchbar";
import { Notifications } from "./Notifications";
import { 
  Mail, 
  UserPlus, 
  HelpCircle, 
  Grid, 
  Sparkles,
  ArrowUpRight
} from "lucide-react";
import { InviteModal } from "@/components/InviteModal";
import UserProfile from "./UserProfile";
import { useInviteModalStore } from "@/store/invite-modal";

export function TopNavbar() {
    const open = useInviteModalStore((state) => state.open);
  

  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-gray-200 bg-white px-8 shadow-sm">
      {/* Left Area - Space for branding or page status context */}
      {/* <div className="flex items-center gap-3">
        <button className="flex items-center gap-1.5 rounded-full bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-100/80">
          <Sparkles className="h-4 w-4 text-blue-500" />
          <span>Upgrade</span>
          <ArrowUpRight className="h-3 w-3" />
        </button>
      </div> */}

      {/* Middle Area - Searchbar */}
      <div className="flex flex-1 justify-center px-6">
        <Searchbar />
      </div>

      {/* Right Area - Action Items */}
      <div className="flex items-center gap-3.5">
        {/* Notifications */}
        <Notifications />

        {/* Inbox / Mail */}
        {/* <button className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors">
          <Mail className="h-5 w-5" />
        </button> */}

        {/* Invite Members */}
        <button 
          onClick={open}
          className="flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors border border-gray-200 cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Invite</span>
        </button>

        {/* <div className="h-5 bg-gray-200 mx-1" /> */}

        {/* Help Center */}
        {/* <button className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors">
          <HelpCircle className="h-5 w-5" />
        </button> */}

        {/* Grid / Integrations Launcher */}
        {/* <button className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors">
          <Grid className="h-5 w-5" />
        </button> */}

        
        <UserProfile/>
      </div>

      {/* Invite Modal */}
      <InviteModal />
    </header>
  );
}

