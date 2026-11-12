"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Bell, Phone, PhoneOff, Video, X } from "lucide-react";
import { SecondarySidebar } from "./Sidebar/SecondarySidebar";
import { WorkSidebar } from "./Sidebar/WorkSidebar";
import { TopNavbar } from "./TopNavbar/TopNavbar";
import { WorkTopbar } from "./TopNavbar/WorkTopbar";
import { NotificationStreamProvider } from "@/providers/NotificationStreamProvider";
import { ImportJobProvider } from "@/providers/ImportJobContext";
import { useAuth } from "@/providers/AuthProvider";
import { OnboardingTour } from "@/components/OnboardingTour";
import { AskAiWidget } from "@/components/AskAiWidget";
import { ChatProvider } from "@/components/Chat/ChatProvider";
import { getLiveKitToken } from "@/services/chat.api";
import { useChatStore } from "@/store/chat-store";
import { getSocket } from "@/components/Chat/ChatProvider";
import { playRingtone } from "@/lib/sounds";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { CommandPalette } from "@/components/CommandPalette";
import { WorkCommandPalette } from "@/components/WorkCommandPalette";
import { TaskDetailsSheet } from "@/app/(dashboard)/workspace/[workspaceId]/board/Task/TaskDetailDrawer/Updates/TaskDetailsDrawer";

// Lazy-load LiveKit bundle — prevents the SDK from running region-discovery
// on every page load. The bundle only downloads when a call is actually active.
const LiveKitCallPanel = dynamic(
  () => import("@/components/Chat/LiveKitCallPanel").then((m) => m.LiveKitCallPanel),
  { ssr: false },
);

interface AppShellProps {
  children: React.ReactNode;
}

function CallToast() {
  const { incomingCall, setIncomingCall, setActiveCall } = useChatStore();
  const { user } = useAuth();
  const stopRingtone = useRef<(() => void) | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!incomingCall) return;
    setJoining(false); // reset from any previous call attempt
    stopRingtone.current = playRingtone();
    const t = setTimeout(() => {
      stopRingtone.current?.();
      setIncomingCall(null);
    }, 30_000);
    return () => {
      clearTimeout(t);
      stopRingtone.current?.();
    };
  }, [incomingCall]);

  if (!incomingCall) return null;

  const handleJoin = async () => {
    if (joining) return;
    stopRingtone.current?.();
    setJoining(true);
    try {
      const { token, wsUrl } = await getLiveKitToken(incomingCall.roomName);
      const socket = getSocket();
      if (socket && incomingCall.channelId) {
        socket.emit("call:joined", {
          channelId:     incomingCall.channelId,
          callMessageId: incomingCall.callMessageId,
        });
      }
      setActiveCall({
        roomName:           incomingCall.roomName,
        channelId:          incomingCall.channelId,
        startWithVideoMuted: incomingCall.callType === "voice",
        livekitToken:       token,
        livekitUrl:         wsUrl,
        callMessageId:      incomingCall.callMessageId,
        startedAt:          Date.now(),
      });
      setIncomingCall(null);
    } catch {
      setJoining(false);
    }
  };

  const handleDismiss = () => {
    stopRingtone.current?.();
    const socket = getSocket();
    if (socket && incomingCall?.channelId) {
      socket.emit("call:declined", {
        channelId: incomingCall.channelId,
        callMessageId: incomingCall.callMessageId,
      });
    }
    setIncomingCall(null);
  };

  return (
    <div className="fixed bottom-36 right-6 z-[60] w-80 overflow-hidden rounded-xl border border-green-200 bg-popover shadow-2xl animate-in slide-in-from-bottom-4">
      {/* Animated ring */}
      <div className="flex items-center gap-3 bg-green-500 px-4 py-3">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
          <div className="absolute inset-0 animate-ping rounded-full bg-white/30" />
          {incomingCall.callType === "video" ? (
            <Video className="h-5 w-5 text-white" />
          ) : (
            <Phone className="h-5 w-5 text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">
            {incomingCall.callType === "video" ? "Video" : "Voice"} Call
          </p>
          <p className="text-[11px] text-green-100 truncate">
            {incomingCall.callerName} · #{incomingCall.channelName}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-white/70 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-2 px-4 py-3">
        <button
          onClick={handleJoin}
          disabled={joining}
          className="flex-1 rounded-lg bg-green-500 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-600 disabled:opacity-60"
        >
          {joining ? "Joining…" : "Join Call"}
        </button>
        <button
          onClick={handleDismiss}
          className="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}


function PushPermissionBanner({ top = false, corner = false }: { top?: boolean; corner?: boolean }) {
  const { state, loading, enable } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);

  if (
    dismissed ||
    state === "unsupported" ||
    state === "denied" ||
    state === "subscribed"
  )
    return null;

  return (
    <div className={corner
      ? "fixed bottom-5 right-5 z-[70] flex max-w-[360px] items-center gap-3 rounded-xl border border-primary/25 bg-popover px-4 py-3 shadow-xl animate-in slide-in-from-bottom-4"
      : top
      // Work: a slim strip under the header so it never covers a chat box or composer
      ? "fixed left-1/2 top-16 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-primary/25 bg-popover px-4 py-2 shadow-lg animate-in slide-in-from-top-2"
      : "fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 flex items-center gap-3 rounded-xl border border-primary/25 bg-popover px-4 py-3 shadow-2xl animate-in slide-in-from-bottom-4"}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Bell className="h-4 w-4 text-primary" />
      </div>
      <p className="text-sm text-foreground">
        <span className="font-semibold">Enable notifications</span> to get alerts when you're away
      </p>
      <button
        onClick={enable}
        disabled={loading}
        className="ml-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary disabled:opacity-60"
      >
        {loading ? "…" : "Enable"}
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-slate-400 hover:text-slate-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function CallDeclinedToast() {
  const { callDeclinedMsg, setCallDeclinedMsg } = useChatStore();
  if (!callDeclinedMsg) return null;
  return (
    <div className="fixed bottom-36 right-6 z-[60] flex items-center gap-3 rounded-xl border border-red-200 bg-popover px-4 py-3 shadow-2xl animate-in slide-in-from-bottom-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
        <PhoneOff className="h-4 w-4 text-red-500" />
      </div>
      <p className="text-sm font-medium text-foreground">{callDeclinedMsg}</p>
      <button onClick={() => setCallDeclinedMsg(null)} className="ml-1 text-slate-400 hover:text-slate-600">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function GlobalLiveKitPanel() {
  const { activeCall, setActiveCall } = useChatStore();
  if (!activeCall) return null;

  const handleClose = () => {
    const socket = getSocket();
    if (socket && activeCall.channelId) {
      const duration = activeCall.startedAt
        ? Math.round((Date.now() - activeCall.startedAt) / 1000)
        : undefined;
      socket.emit("call:ended", {
        channelId:     activeCall.channelId,
        callMessageId: activeCall.callMessageId,
        duration,
      });
    }
    setActiveCall(null);
  };

  return (
    <LiveKitCallPanel
      token={activeCall.livekitToken}
      serverUrl={activeCall.livekitUrl}
      startWithVideoMuted={activeCall.startWithVideoMuted}
      startedAt={activeCall.startedAt}
      onClose={handleClose}
    />
  );
}

export function AppShell({ children }: AppShellProps) {
  const [isSecondaryOpen, setIsSecondaryOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user } = useAuth();
  const pathname = usePathname();
  // Board pages render their own TaskDetailsSheet; all other pages need it globally
  // Board URLs carry uid strings (e.g. /board/Xr9…), not numeric ids — the old
  // /\d+/ check never matched, so every board page rendered a second drawer.
  const isBoardPage = /\/workspace\/[^/]+\/board\/[^/]+/.test(pathname ?? "");
  // Work (ClickUp-style product) has its own sidebar: Spaces → Folders → Lists
  // NOTE: "/workspace/..." is Boards — match "/work" or "/work/..." only
  const isWorkPage = /^\/work(\/|$)/.test(pathname ?? "");
  // CEO Tower is its own full-screen product with its own header
  const isCeoPage = /^\/ceo(\/|$)/.test(pathname ?? "");

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground antialiased font-sans">
      {user && (
        <ChatProvider>
          <ImportJobProvider>
            <NotificationStreamProvider userId={user?.id}>
              {isCeoPage ? (
                <main className="flex-1 overflow-auto bg-background ez-page-surface">{children}</main>
              ) : (
              <>
              {!isWorkPage && <OnboardingTour />}
              {isMobileOpen && (
                <div
                  className="fixed inset-0 z-40 bg-black/40 md:hidden"
                  onClick={() => setIsMobileOpen(false)}
                />
              )}

              {isWorkPage ? (
                <Suspense fallback={<div className="hidden w-[270px] shrink-0 border-r border-border bg-background md:block" />}>
                <WorkSidebar
                  isOpen={isSecondaryOpen}
                  onToggle={() => setIsSecondaryOpen(!isSecondaryOpen)}
                  isMobileOpen={isMobileOpen}
                  onMobileClose={() => setIsMobileOpen(false)}
                />
                </Suspense>
              ) : (
                <SecondarySidebar
                  isOpen={isSecondaryOpen}
                  onToggle={() => setIsSecondaryOpen(!isSecondaryOpen)}
                  isMobileOpen={isMobileOpen}
                  onMobileClose={() => setIsMobileOpen(false)}
                />
              )}

              <div className="flex flex-1 flex-col overflow-hidden">
                {isWorkPage ? (
                  <WorkTopbar onMenuToggle={() => setIsMobileOpen(!isMobileOpen)} />
                ) : (
                  <TopNavbar product="boards" onMenuToggle={() => setIsMobileOpen(!isMobileOpen)} />
                )}
                <main className="flex-1 overflow-auto bg-background ez-page-surface">{children}</main>
              </div>

              {/* Boards and Work never share UI: own search, task drawer and helper */}
              {isWorkPage ? <WorkCommandPalette /> : <CommandPalette />}
              {!isBoardPage && !isWorkPage && <TaskDetailsSheet />}
              {!isWorkPage && <AskAiWidget />}
              </>
              )}
              <CallToast />
              <CallDeclinedToast />
              <GlobalLiveKitPanel />
              <PushPermissionBanner top={isWorkPage} corner={isCeoPage} />
            </NotificationStreamProvider>
          </ImportJobProvider>
        </ChatProvider>
      )}
    </div>
  );
}
