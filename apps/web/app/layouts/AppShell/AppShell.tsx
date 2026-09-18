"use client";

import React, { useState } from "react";
import { SecondarySidebar } from "./Sidebar/SecondarySidebar";
import { TopNavbar } from "./TopNavbar/TopNavbar";
import { NotificationStreamProvider } from "@/providers/NotificationStreamProvider";
import { ImportJobProvider } from "@/providers/ImportJobContext";
import { useAuth } from "@/providers/AuthProvider";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isSecondaryOpen, setIsSecondaryOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 text-gray-900 antialiased font-sans">
      {user && (
        <ImportJobProvider>
          <NotificationStreamProvider userId={user?.id}>
            {/* Mobile backdrop */}
            {isMobileOpen && (
              <div
                className="fixed inset-0 z-40 bg-black/40 md:hidden"
                onClick={() => setIsMobileOpen(false)}
              />
            )}

            {/* Sidebar */}
            <SecondarySidebar
              isOpen={isSecondaryOpen}
              onToggle={() => setIsSecondaryOpen(!isSecondaryOpen)}
              isMobileOpen={isMobileOpen}
              onMobileClose={() => setIsMobileOpen(false)}
            />

            {/* Main content */}
            <div className="flex flex-1 flex-col overflow-hidden">
              <TopNavbar onMenuToggle={() => setIsMobileOpen(!isMobileOpen)} />
              <main className="flex-1 overflow-auto bg-white">{children}</main>
            </div>
          </NotificationStreamProvider>
        </ImportJobProvider>
      )}
    </div>
  );
}
