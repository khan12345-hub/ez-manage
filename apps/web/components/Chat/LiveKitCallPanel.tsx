"use client";

import "@livekit/components-styles";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useParticipants,
} from "@livekit/components-react";
import { useEffect, useState } from "react";
import { Minimize2, Maximize2, PhoneOff, MicOff, VideoOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type PermState = "checking" | "granted" | "denied" | "notfound";

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

// ── Permission denied screen ─────────────────────────────────────────────────
function PermissionDeniedScreen({
  type,
  onRetry,
  onClose,
}: {
  type: "denied" | "notfound";
  onRetry: () => void;
  onClose: () => void;
}) {
  const isDenied = type === "denied";
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-[#111827] px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
        {isDenied ? (
          <MicOff className="h-8 w-8 text-red-400" />
        ) : (
          <VideoOff className="h-8 w-8 text-red-400" />
        )}
      </div>

      <div>
        <p className="text-lg font-semibold text-white">
          {isDenied ? "Microphone / Camera Blocked" : "No Devices Found"}
        </p>
        <p className="mt-2 max-w-sm text-sm text-gray-400">
          {isDenied
            ? "Your browser blocked access. Click the camera/lock icon in the address bar, allow Microphone and Camera, then click Retry."
            : "No microphone or camera was detected. Connect your devices and click Retry."}
        </p>
      </div>

      {isDenied && (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-left text-xs text-gray-300">
          <p className="font-medium text-white">How to allow:</p>
          <p>1. Click the 🔒 icon in the address bar</p>
          <p>2. Click <strong>Site settings</strong></p>
          <p>3. Find <strong>Microphone</strong> &amp; <strong>Camera</strong> → set to <strong>Allow</strong></p>
          <p>4. Come back and click <strong>Retry</strong> below</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-2 rounded-lg bg-red-600/80 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
        >
          <PhoneOff className="h-4 w-4" />
          Leave
        </button>
      </div>
    </div>
  );
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
  const [permState, setPermState] = useState<PermState>("checking");

  // Check mic/camera permissions before mounting LiveKitRoom.
  // This avoids the confusing "toast + stuck screen" experience when the
  // browser blocks access (common in Incognito or on first visit).
  useEffect(() => {
    if (!token || !serverUrl) return;

    const constraints = { audio: true, video: !startWithVideoMuted };
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        // Release the tracks immediately — LiveKit will re-acquire them.
        stream.getTracks().forEach((t) => t.stop());
        setPermState("granted");
      })
      .catch((err: DOMException) => {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setPermState("denied");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setPermState("notfound");
        } else {
          // Unknown error — still try to connect; LiveKit will surface it.
          setPermState("granted");
        }
      });
  }, [token, serverUrl, startWithVideoMuted]);

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

  if (!token || !serverUrl) return null;

  // Still checking permissions — show brief loading state
  if (permState === "checking") {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#111827]">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-white" />
          <p className="text-sm">Checking devices…</p>
        </div>
      </div>
    );
  }

  // Permission denied or no devices — show actionable screen
  if (permState === "denied" || permState === "notfound") {
    return (
      <PermissionDeniedScreen
        type={permState}
        onRetry={() => setPermState("checking")}
        onClose={onClose}
      />
    );
  }

  return (
    <div
      data-lk-theme="default"
      className={
        minimized
          ? ""
          : "fixed inset-0 z-[200] flex flex-col bg-[#111827]"
      }
    >
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={Boolean(token && serverUrl)}
        video={!startWithVideoMuted}
        audio={true}
        options={{
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        }}
        onDisconnected={onClose}
        onError={(error) => {
          const msg = error?.message ?? String(error);
          if (/permission|denied|notallowed/i.test(msg)) {
            setPermState("denied");
          } else if (/notfound|devicenotfound/i.test(msg)) {
            setPermState("notfound");
          } else {
            toast.error(`Call error: ${msg}`);
          }
        }}
        className={minimized ? "" : "flex flex-1 flex-col overflow-hidden"}
      >
        <RoomAudioRenderer />

        {minimized ? (
          <MinimizedBar
            onMaximize={() => setMinimized(false)}
            onEnd={onClose}
            startedAt={startedAt}
          />
        ) : (
          <>
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

            <div className="min-h-0 flex-1">
              <VideoConference />
            </div>
          </>
        )}
      </LiveKitRoom>
    </div>
  );
}
