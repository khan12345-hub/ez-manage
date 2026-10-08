"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Bell, Phone, PhoneOff, Video, X } from "lucide-react";
import { SecondarySidebar } from "./Sidebar/SecondarySidebar";
import { TopNavbar } from "./TopNavbar/TopNavbar";
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


function PushPermissionBanner() {
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
    <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 flex items-center gap-3 rounded-xl border border-indigo-200 bg-popover px-4 py-3 shadow-2xl animate-in slide-in-from-bottom-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100">
        <Bell className="h-4 w-4 text-indigo-600" />
      </div>
      <p className="text-sm text-foreground">
        <span className="font-semibold">Enable notifications</span> to get alerts when you're away
      </p>
      <button
        onClick={enable}
        disabled={loading}
        className="ml-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground antialiased font-sans">
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
                <main className="flex-1 overflow-auto bg-background">{children}</main>
              </div>

              <CommandPalette />
              <AskAiWidget />
              <CallToast />
              <CallDeclinedToast />
              <GlobalLiveKitPanel />
              <PushPermissionBanner />
            </NotificationStreamProvider>
          </ImportJobProvider>
        </ChatProvider>
      )}
    </div>
  );
}
