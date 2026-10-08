"use client";

import "@livekit/components-styles";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useParticipants,
} from "@livekit/components-react";
import { useEffect, useState } from "react";
import { Minimize2, Maximize2, PhoneOff } from "lucide-react";

// ── Minimized floating bar ───────────────────────────────────────────────────
// Must render inside <LiveKitRoom> to access participant hooks
function MinimizedBar({
  onMaximize,
  onEnd,
  startedAt,
}: {
  onMaximize: () => void;
  onEnd: () => void;
  startedAt?: number;
}) {
  const participants = useParticipants();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    setElapsed(Math.round((Date.now() - startedAt) / 1000));
    const t = setInterval(
      () => setElapsed(Math.round((Date.now() - startedAt!) / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [startedAt]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="fixed bottom-6 right-6 z-[300] flex items-center gap-3 rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 shadow-2xl">
      <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
      <span className="text-sm font-medium text-gray-200">
        {participants.length > 0
          ? `${participants.length} in call`
          : "Calling…"}
        {startedAt ? ` · ${mm}:${ss}` : ""}
      </span>
      <button
        onClick={onMaximize}
        title="Expand call"
        className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
      >
        <Maximize2 className="h-4 w-4" />
      </button>
      <button
        onClick={onEnd}
        title="End call"
        className="rounded-full bg-red-600 p-1.5 text-white transition-colors hover:bg-red-700"
      >
        <PhoneOff className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  token: string;
  serverUrl: string;
  startWithVideoMuted?: boolean;
  startedAt?: number;
  onClose: () => void;
}

// ── Main component ───────────────────────────────────────────────────────────
export function LiveKitCallPanel({
  token,
  serverUrl,
  startWithVideoMuted,
  startedAt,
  onClose,
}: Props) {
  const [minimized, setMinimized] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    setElapsed(Math.round((Date.now() - startedAt) / 1000));
    const t = setInterval(
      () => setElapsed(Math.round((Date.now() - startedAt!) / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [startedAt]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  // Don't mount the room at all if credentials are missing — prevents the SDK
  // from running region-discovery and logging "invalid token" errors.
  if (!token || !serverUrl) return null;

  return (
    // data-lk-theme="default" activates LiveKit's built-in dark theme CSS variables
    <div
      data-lk-theme="default"
      className={
        minimized
          ? "" // MinimizedBar handles its own fixed positioning
          : "fixed inset-0 z-[200] flex flex-col bg-[#111827]"
      }
    >
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={Boolean(token && serverUrl)}
        video={!startWithVideoMuted}
        audio={true}
        onDisconnected={onClose}
        onError={() => {}}
        className={minimized ? "" : "flex flex-1 flex-col overflow-hidden"}
      >
        {/* Always-on audio renderer (works even when minimized) */}
        <RoomAudioRenderer />

        {minimized ? (
          <MinimizedBar
            onMaximize={() => setMinimized(false)}
            onEnd={onClose}
            startedAt={startedAt}
          />
        ) : (
          <>
            {/* Top bar */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-gray-900/80 px-4 py-2.5 backdrop-blur-sm">
              <div className="flex items-center gap-2.5">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm font-semibold text-gray-100">
                  {startedAt ? `${mm}:${ss}` : "Calling…"}
                </span>
              </div>
              <button
                onClick={() => setMinimized(true)}
                title="Minimize — keep call running"
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
            </div>

            {/* LiveKit VideoConference — includes video grid + control bar */}
            <div className="min-h-0 flex-1">
              <VideoConference />
            </div>
          </>
        )}
      </LiveKitRoom>
    </div>
  );
}
