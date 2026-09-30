"use client";

import React, { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { SecondarySidebar } from "./Sidebar/SecondarySidebar";
import { TopNavbar } from "./TopNavbar/TopNavbar";
import { NotificationStreamProvider } from "@/providers/NotificationStreamProvider";
import { ImportJobProvider } from "@/providers/ImportJobContext";
import { useAuth } from "@/providers/AuthProvider";
import { OnboardingTour } from "@/components/OnboardingTour";
import { AskAiWidget } from "@/components/AskAiWidget";
import { ChatProvider } from "@/components/Chat/ChatProvider";
import { useChatStore } from "@/store/chat-store";

interface AppShellProps {
  children: React.ReactNode;
}

function ChatFAB() {
  const router = useRouter();
  const params = useParams();
  const { unreadCounts } = useChatStore();
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
  const workspaceId = params?.workspaceId;

  const handleClick = () => {
    if (workspaceId) {
      router.push(`/workspace/${workspaceId}/chat`);
    }
  };

  if (!workspaceId) return null;

  return (
    <button
      onClick={handleClick}
      title="Open Team Chat"
      className="fixed bottom-20 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-lg transition-colors hover:bg-indigo-50 hover:text-indigo-600"
    >
      <MessageSquare className="h-5 w-5" />
      {totalUnread > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {totalUnread > 9 ? "9+" : totalUnread}
        </span>
      )}
    </button>
  );
}

export function AppShell({ children }: AppShellProps) {
  const [isSecondaryOpen, setIsSecondaryOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 text-gray-900 antialiased font-sans">
      {user && (
        <ChatProvider>
          <ImportJobProvider>
            <NotificationStreamProvider userId={user?.id}>
              <OnboardingTour />
              {isMobileOpen && (
                <div
                  className="fixed inset-0 z-40 bg-black/40 md:hidden"
                  onClick={() => setIsMobileOpen(false)}
                />
              )}

              <SecondarySidebar
                isOpen={isSecondaryOpen}
                onToggle={() => setIsSecondaryOpen(!isSecondaryOpen)}
                isMobileOpen={isMobileOpen}
                onMobileClose={() => setIsMobileOpen(false)}
              />

              <div className="flex flex-1 flex-col overflow-hidden">
                <TopNavbar onMenuToggle={() => setIsMobileOpen(!isMobileOpen)} />
                <main className="flex-1 overflow-auto bg-white">{children}</main>
              </div>

              <AskAiWidget />
              <ChatFAB />
            </NotificationStreamProvider>
          </ImportJobProvider>
        </ChatProvider>
      )}
    </div>
  );
}
