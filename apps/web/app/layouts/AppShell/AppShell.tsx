"use client";

import React, { useState } from "react";
import { PrimarySidebar } from "./Sidebar/PrimarySidebar";
import { SecondarySidebar } from "./Sidebar/SecondarySidebar";
import { TopNavbar } from "./TopNavbar/TopNavbar";
import { NotificationStreamProvider } from "@/providers/NotificationStreamProvider";
import { useAuth } from "@/providers/AuthProvider";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isSecondaryOpen, setIsSecondaryOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("Workspace");
  const [activeItem, setActiveItem] = useState("Developer testing board");
  const { user } = useAuth();
  console.log({user})
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 text-gray-900 antialiased font-sans">
      {user && (
        <NotificationStreamProvider userId={user?.id}>
          {/* 1. Primary Sidebar (narrow left) */}
          <PrimarySidebar
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
            // If workspace or another sidebar tab is clicked, optionally auto-open or toggle
            if (tab === "Workspace") {
              setIsSecondaryOpen(true);
            } else {
              setIsSecondaryOpen(false);
            }
          }}
        />

        {/* 2. Secondary Sidebar (collapsible workspace panel) */}
        <SecondarySidebar
          isOpen={isSecondaryOpen}
          onToggle={() => setIsSecondaryOpen(!isSecondaryOpen)}
        />

        {/* 3. Main Workspace Container (Navbar + Page) */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Navbar */}
          <TopNavbar />

          {/* Page Content area */}
          <main className="flex-1 overflow-auto bg-white">{children}</main>
        </div>
      </NotificationStreamProvider>)}
    </div>
  );
}
